import { Main } from "@freelensapp/extensions";
import { execFile, spawn } from "child_process";
import { existsSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const EXEC_TIMEOUT = 10_000;
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  permissions?: string;
  size?: number;
  isSymlink?: boolean;
  symlinkTarget?: string;
}

export interface FileContent {
  content: string;
  truncated: boolean;
  size: number;
  isBinary?: boolean;
}

export interface FileStat {
  type: "file" | "directory" | "symlink" | "other";
  size: number;
  permissions: string;
  modified: string;
}

/**
 * Find Freelens's proxy kubeconfig for a given cluster ID.
 */
function findProxyKubeconfig(clusterId: string): string | undefined {
  if (!clusterId) return undefined;

  const tempDir = tmpdir();
  const directPath = join(tempDir, `kubeconfig-${clusterId}`);

  if (existsSync(directPath)) {
    return directPath;
  }

  try {
    const files = readdirSync(tempDir);

    for (const file of files) {
      if (file.startsWith("kubeconfig-") && file.includes(clusterId)) {
        const fullPath = join(tempDir, file);

        if (existsSync(fullPath)) {
          return fullPath;
        }
      }
    }
  } catch {
    // ignore errors scanning temp dir
  }

  return undefined;
}

function buildKubectlEnv(clusterId: string): { env: NodeJS.ProcessEnv; proxyKubeconfig?: string } {
  const proxyKubeconfig = findProxyKubeconfig(clusterId);
  const env = { ...process.env };

  if (proxyKubeconfig) {
    env.KUBECONFIG = proxyKubeconfig;
  }

  return { env, proxyKubeconfig };
}

async function kubectlExec(
  clusterId: string,
  namespace: string,
  pod: string,
  container: string,
  command: string[],
  options?: { timeout?: number },
): Promise<string> {
  const { env, proxyKubeconfig } = buildKubectlEnv(clusterId);
  const args: string[] = [];

  if (proxyKubeconfig) {
    args.push("--kubeconfig", proxyKubeconfig);
  }

  args.push(
    "exec",
    pod,
    "-n", namespace,
    "-c", container,
    "--",
    ...command,
  );

  const { stdout } = await execFileAsync("kubectl", args, {
    timeout: options?.timeout ?? EXEC_TIMEOUT,
    maxBuffer: MAX_FILE_SIZE * 2,
    env,
  });

  return stdout;
}

/**
 * Write content to a file on a pod using spawn + stdin pipe.
 * Uses spawn (not execFile) for reliable stdin EOF signaling on Windows.
 */
function kubectlWriteFile(
  clusterId: string,
  namespace: string,
  pod: string,
  container: string,
  remotePath: string,
  content: Buffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const { env, proxyKubeconfig } = buildKubectlEnv(clusterId);
    const args: string[] = [];

    if (proxyKubeconfig) {
      args.push("--kubeconfig", proxyKubeconfig);
    }

    args.push(
      "exec", "-i",
      pod,
      "-n", namespace,
      "-c", container,
      "--",
      "sh", "-c", 'cat > "$0"', remotePath,
    );

    const proc = spawn("kubectl", args, { env, stdio: ["pipe", "pipe", "pipe"] });

    let stderr = "";
    let settled = false;

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill("SIGTERM");
        reject(new Error("Upload timed out after 30 seconds"));
      }
    }, 30_000);

    proc.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    proc.on("close", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Upload failed (exit ${code}): ${stderr}`));
        }
      }
    });

    // Write content and close stdin to signal EOF
    proc.stdin.end(content);
  });
}

/**
 * Parse `ls -la` output into FileEntry objects.
 * Trims \r from each line (Windows kubectl output has \r\n).
 */
function parseLsLaOutput(output: string, dirPath: string): FileEntry[] {
  const entries: FileEntry[] = [];

  for (const rawLine of output.split("\n")) {
    const line = rawLine.replace(/\r$/, "");

    if (!line || line.startsWith("total ")) continue;

    const match = line.match(
      /^(\S{10,11})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+\w+\s+\d+\s+[\d:]+\s+(.+)$/,
    );
    if (!match) continue;

    const [, permissions, sizeStr, rawName] = match;
    if (rawName === "." || rawName === "..") continue;

    const typeChar = permissions[0];
    const isDirectory = typeChar === "d";
    const isSymlink = typeChar === "l";

    let name = rawName;
    let symlinkTarget: string | undefined;

    if (isSymlink && rawName.includes(" -> ")) {
      const arrowIdx = rawName.indexOf(" -> ");

      name = rawName.slice(0, arrowIdx);
      symlinkTarget = rawName.slice(arrowIdx + 4);
    }

    entries.push({
      name,
      path: `${dirPath}${name}`,
      isDirectory,
      permissions,
      size: parseInt(sizeStr, 10),
      isSymlink,
      symlinkTarget,
    });
  }

  return entries;
}

const KNOWN_BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "svg",
  "gz", "tar", "zip", "bz2", "xz", "7z", "rar", "zst",
  "bin", "so", "o", "a", "dylib", "dll", "exe", "elf",
  "wasm", "class", "pyc", "pyo",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "mp3", "mp4", "wav", "ogg", "flac", "avi", "mkv", "mov",
  "ttf", "otf", "woff", "woff2", "eot",
  "sqlite", "db",
]);

function isBinaryByExtension(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase();

  return ext ? KNOWN_BINARY_EXTENSIONS.has(ext) : false;
}

export default class PodFilesystemMain extends Main.LensExtension {
  async onActivate() {
    const ipc = Main.Ipc.createInstance(this);

    ipc.handle("listDir", async (_event: unknown, clusterId: string, namespace: string, pod: string, container: string, dirPath: string) => {
      try {
        const normalizedPath = dirPath.endsWith("/") ? dirPath : `${dirPath}/`;

        // Try detailed listing with ls -la
        try {
          const stdout = await kubectlExec(clusterId, namespace, pod, container, [
            "ls", "-la", "--color=never", normalizedPath,
          ]);

          const entries = parseLsLaOutput(stdout, normalizedPath);

          return { success: true, data: entries };
        } catch {
          // Fallback to simple listing (e.g., BusyBox without --color support)
          const stdout = await kubectlExec(clusterId, namespace, pod, container, [
            "ls", "-1ap", normalizedPath,
          ]);

          const entries: FileEntry[] = stdout
            .split("\n")
            .map((l) => l.replace(/\r$/, ""))
            .filter((line) => line && line !== "./" && line !== "../")
            .map((line) => {
              const isDir = line.endsWith("/");
              const name = isDir ? line.slice(0, -1) : line;

              return {
                name,
                path: `${normalizedPath}${name}`,
                isDirectory: isDir,
              };
            });

          return { success: true, data: entries };
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        return { success: false, error: message };
      }
    });

    ipc.handle("readFile", async (_event: unknown, clusterId: string, namespace: string, pod: string, container: string, filePath: string, maxSize?: number) => {
      try {
        const limit = maxSize ?? MAX_FILE_SIZE;

        const sizeOutput = await kubectlExec(clusterId, namespace, pod, container, [
          "stat", "-c", "%s", filePath,
        ]);
        const fileSize = parseInt(sizeOutput.trim(), 10);

        // Check for binary by extension first
        if (isBinaryByExtension(filePath)) {
          return {
            success: true,
            data: { content: "", truncated: false, size: fileSize, isBinary: true } as FileContent,
          };
        }

        // Read first 512 bytes and check for null bytes (binary indicator)
        try {
          const sample = await kubectlExec(clusterId, namespace, pod, container, [
            "head", "-c", "512", filePath,
          ]);

          if (sample.includes("\0")) {
            return {
              success: true,
              data: { content: "", truncated: false, size: fileSize, isBinary: true } as FileContent,
            };
          }
        } catch {
          // If head fails, proceed with reading (might be a short file)
        }

        let content: string;
        let truncated = false;

        if (fileSize > limit) {
          content = await kubectlExec(clusterId, namespace, pod, container, [
            "head", "-c", String(limit), filePath,
          ]);
          truncated = true;
        } else {
          content = await kubectlExec(clusterId, namespace, pod, container, [
            "cat", filePath,
          ]);
        }

        return {
          success: true,
          data: { content, truncated, size: fileSize, isBinary: false } as FileContent,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        return { success: false, error: message };
      }
    });

    ipc.handle("statPath", async (_event: unknown, clusterId: string, namespace: string, pod: string, container: string, targetPath: string) => {
      try {
        const stdout = await kubectlExec(clusterId, namespace, pod, container, [
          "stat", "-c", "%F|%s|%a|%y", targetPath,
        ]);

        const [typeStr, sizeStr, permissions, modified] = stdout.trim().split("|");
        let type: FileStat["type"] = "other";

        if (typeStr.includes("directory")) type = "directory";
        else if (typeStr.includes("regular")) type = "file";
        else if (typeStr.includes("symbolic")) type = "symlink";

        return {
          success: true,
          data: {
            type,
            size: parseInt(sizeStr, 10),
            permissions,
            modified,
          } as FileStat,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        return { success: false, error: message };
      }
    });

    ipc.handle("downloadFile", async (_event: unknown, clusterId: string, namespace: string, pod: string, container: string, filePath: string) => {
      try {
        const content = await kubectlExec(clusterId, namespace, pod, container, [
          "cat", filePath,
        ]);

        return { success: true, data: content };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        return { success: false, error: message };
      }
    });

    ipc.handle("deletePath", async (_event: unknown, clusterId: string, namespace: string, pod: string, container: string, targetPath: string, isDirectory: boolean) => {
      try {
        if (isDirectory) {
          await kubectlExec(clusterId, namespace, pod, container, [
            "rm", "-rf", targetPath,
          ]);
        } else {
          await kubectlExec(clusterId, namespace, pod, container, [
            "rm", "-f", targetPath,
          ]);
        }

        return { success: true };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        return { success: false, error: message };
      }
    });

    ipc.handle("uploadFile", async (_event: unknown, clusterId: string, namespace: string, pod: string, container: string, remotePath: string, contentBase64: string) => {
      try {
        const content = Buffer.from(contentBase64, "base64");

        await kubectlWriteFile(clusterId, namespace, pod, container, remotePath, content);

        return { success: true };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);

        return { success: false, error: message };
      }
    });
  }
}
