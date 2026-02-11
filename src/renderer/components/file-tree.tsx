import { Renderer } from "@freelensapp/extensions";
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import styles from "../styles/pod-fs.module.scss";
import stylesInline from "../styles/pod-fs.module.scss?inline";

import type { FileEntry } from "../../main/index";

const {
  Component: { Spinner, Notifications },
} = Renderer;

interface FileTreeProps {
  clusterId: string;
  namespace: string;
  pod: string;
  container: string;
  currentPath: string;
  onNavigate: (path: string) => void;
  onFileSelect: (path: string) => void;
}

function getFileIcon(entry: FileEntry): string {
  if (entry.isSymlink) return "\u{1F517}"; // link
  if (entry.isDirectory) return "\u{1F4C1}"; // folder

  const ext = entry.name.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "yaml":
    case "yml":
    case "json":
      return "\u{1F4CB}"; // clipboard
    case "log":
    case "txt":
      return "\u{1F4DD}"; // memo
    case "sh":
    case "bash":
      return "\u{2699}\uFE0F"; // gear
    case "conf":
    case "cfg":
    case "ini":
    case "toml":
      return "\u{1F527}"; // wrench
    case "key":
    case "pem":
    case "crt":
      return "\u{1F512}"; // lock
    case "py":
    case "js":
    case "ts":
    case "go":
    case "rs":
    case "java":
    case "c":
    case "cpp":
    case "h":
      return "\u{1F4C4}"; // page facing up
    case "gz":
    case "tar":
    case "zip":
    case "bz2":
    case "xz":
      return "\u{1F4E6}"; // package
    default:
      return "\u{1F4C4}"; // page facing up
  }
}

function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parentPath(path: string): string {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const lastSlash = trimmed.lastIndexOf("/");

  return lastSlash <= 0 ? "/" : trimmed.slice(0, lastSlash + 1);
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];

      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function FileTree({ clusterId, namespace, pod, container, currentPath, onNavigate, onFileSelect }: FileTreeProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<FileEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ entry: FileEntry; x: number; y: number } | null>(null);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuOverlayRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const ipc = Renderer.Ipc.getInstance();

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await ipc.invoke("listDir", clusterId, namespace, pod, container, path);

      if (result.success) {
        const sorted = (result.data as FileEntry[]).sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;

          return a.name.localeCompare(b.name);
        });

        setEntries(sorted);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [clusterId, namespace, pod, container, ipc]);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const navigateTo = useCallback((path: string) => {
    const normalized = path.endsWith("/") ? path : `${path}/`;

    onNavigate(normalized);
    setSearchQuery("");
  }, [onNavigate]);

  const handleEntryClick = useCallback((entry: FileEntry) => {
    if (entry.isDirectory) {
      navigateTo(entry.path);
    } else {
      onFileSelect(entry.path);
    }
  }, [navigateTo, onFileSelect]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);

    try {
      const result = await ipc.invoke(
        "deletePath", clusterId, namespace, pod, container,
        confirmDelete.path, confirmDelete.isDirectory,
      );

      if (result.success) {
        Notifications.ok(`Deleted ${confirmDelete.name}`);
        setConfirmDelete(null);
        loadDirectory(currentPath);
      } else {
        Notifications.error(`Delete failed: ${result.error}`);
      }
    } catch (err) {
      Notifications.error(`Delete error: ${err}`);
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete, clusterId, namespace, pod, container, ipc, currentPath, loadDirectory]);

  const handleUpload = useCallback(async (file: File) => {
    if (file.size > 1024 * 1024) {
      Notifications.error("File too large. Maximum upload size is 1 MB.");

      return;
    }

    setUploading(true);

    try {
      const base64 = await readFileAsBase64(file);
      const remotePath = `${currentPath}${file.name}`;

      const result = await ipc.invoke(
        "uploadFile", clusterId, namespace, pod, container,
        remotePath, base64,
      );

      if (result.success) {
        Notifications.ok(`Uploaded ${file.name}`);
        loadDirectory(currentPath);
      } else {
        Notifications.error(`Upload failed: ${result.error}`);
      }
    } catch (err) {
      Notifications.error(`Upload error: ${err}`);
    } finally {
      setUploading(false);
    }
  }, [currentPath, clusterId, namespace, pod, container, ipc, loadDirectory]);

  // Drag-and-drop handlers
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    if (dragCounterRef.current === 0) {
      setDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);

    for (const file of files) {
      handleUpload(file);
    }
  }, [handleUpload]);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ entry, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
    Notifications.ok("Path copied to clipboard");
    closeContextMenu();
  }, [closeContextMenu]);

  const handleDownloadFromMenu = useCallback(async (entry: FileEntry) => {
    closeContextMenu();

    try {
      const result = await ipc.invoke("downloadFile", clusterId, namespace, pod, container, entry.path);

      if (result.success) {
        const blob = new Blob([result.data as string], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = entry.name;
        a.click();
        URL.revokeObjectURL(url);
        Notifications.ok(`Downloaded ${entry.name}`);
      } else {
        Notifications.error(`Download failed: ${result.error}`);
      }
    } catch (err) {
      Notifications.error(`Download error: ${err}`);
    }
  }, [clusterId, namespace, pod, container, ipc, closeContextMenu]);

  // Position context menu relative to overlay (compensates for CSS transform ancestors)
  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuOverlayRef.current || !contextMenuRef.current) return;

    const overlay = contextMenuOverlayRef.current;
    const menu = contextMenuRef.current;
    const overlayRect = overlay.getBoundingClientRect();

    let top = contextMenu.y - overlayRect.top;
    let left = contextMenu.x - overlayRect.left;

    // Clamp to keep menu within visible area
    const menuRect = menu.getBoundingClientRect();

    if (left + menuRect.width > overlayRect.width) {
      left = Math.max(0, left - menuRect.width);
    }

    if (top + menuRect.height > overlayRect.height) {
      top = Math.max(0, top - menuRect.height);
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  }, [contextMenu]);

  // Close context menu on Escape
  useEffect(() => {
    if (!contextMenu) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const filteredEntries = searchQuery
    ? entries.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : entries;

  const breadcrumbSegments = currentPath.split("/").filter(Boolean);

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div onClick={stopPropagation} onMouseDown={stopPropagation} style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <style>{stylesInline}</style>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];

          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />

      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <span
          className={`${styles.breadcrumbSegment} ${breadcrumbSegments.length === 0 ? styles.breadcrumbActive : ""}`}
          onClick={() => navigateTo("/")}
        >
          /
        </span>
        {breadcrumbSegments.map((segment, i) => {
          const path = "/" + breadcrumbSegments.slice(0, i + 1).join("/") + "/";
          const isLast = i === breadcrumbSegments.length - 1;

          return (
            <React.Fragment key={path}>
              <span className={styles.breadcrumbSeparator}>{"\u203A"}</span>
              <span
                className={`${styles.breadcrumbSegment} ${isLast ? styles.breadcrumbActive : ""}`}
                onClick={() => navigateTo(path)}
              >
                {segment}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchContainer}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <span
              className={styles.searchClear}
              onClick={() => setSearchQuery("")}
            >
              {"\u00D7"}
            </span>
          )}
        </div>
        <div className={styles.toolbarActions}>
          <button
            className={`${styles.toolbarBtn} ${styles.uploadBtn}`}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Upload file to current directory"
          >
            {uploading ? "Uploading..." : "\u2191 Upload"}
          </button>
          <button
            className={styles.toolbarBtn}
            onClick={() => loadDirectory(currentPath)}
            title="Refresh directory"
          >
            {"\u27F3"}
          </button>
        </div>
      </div>

      {/* File listing */}
      <div
        className={`${styles.fileList} ${dragging ? styles.dragOver : ""}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {loading && (
          <div className={styles.loadingContainer}>
            <Spinner singleColor={false} />
            <span>Loading...</span>
          </div>
        )}

        {error && (
          <div className={styles.errorContainer}>
            <span className={styles.errorIcon}>{"\u26A0"}</span>
            <span>Failed to load: {error}</span>
          </div>
        )}

        {dragging && (
          <div className={styles.dragOverlay}>
            <span className={styles.dragOverlayIcon}>{"\u2191"}</span>
            <span>Drop files here to upload</span>
          </div>
        )}

        {!loading && !error && (
          <>
            {currentPath !== "/" && (
              <div
                className={`${styles.fileEntry} ${styles.parentEntry}`}
                onClick={() => navigateTo(parentPath(currentPath))}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <span className={styles.fileEntryIcon}>{"\u{1F4C1}"}</span>
                <span className={styles.fileEntryName}>..</span>
                <span className={styles.fileEntryPermissions} />
                <span className={styles.fileEntrySize} />
                <span className={styles.fileEntryActions} />
              </div>
            )}

            {filteredEntries.length === 0 && (
              <div className={styles.emptyDir}>
                {searchQuery ? "No matching files" : "Empty directory"}
              </div>
            )}

            {filteredEntries.map((entry) => (
              <div
                key={entry.path}
                className={`${styles.fileEntry} ${entry.isDirectory ? styles.dirEntry : ""}`}
                onClick={() => handleEntryClick(entry)}
                onContextMenu={(e) => handleContextMenu(e, entry)}
              >
                <span className={styles.fileEntryIcon}>
                  {getFileIcon(entry)}
                </span>
                <span className={styles.fileEntryName} title={entry.path}>
                  {entry.name}
                  {entry.isSymlink && (
                    <span className={styles.symlinkBadge}>
                      {"\u2192"}
                      {entry.symlinkTarget && (
                        <span className={styles.symlinkTarget}>{entry.symlinkTarget}</span>
                      )}
                    </span>
                  )}
                </span>
                {entry.permissions && (
                  <span className={styles.fileEntryPermissions}>
                    {entry.permissions}
                  </span>
                )}
                <span className={styles.fileEntrySize}>
                  {entry.isDirectory ? "" : formatSize(entry.size)}
                </span>
                <span
                  className={styles.fileEntryDelete}
                  title={`Delete ${entry.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(entry);
                  }}
                >
                  {"\u00D7"}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Context menu (uses transparent overlay like confirm dialog) */}
      {contextMenu && (
        <div
          ref={contextMenuOverlayRef}
          className={styles.contextMenuOverlay}
          onClick={closeContextMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeContextMenu();
          }}
        >
          <div
            ref={contextMenuRef}
            className={styles.contextMenu}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
          >
            <div
              className={styles.contextMenuItem}
              onClick={() => {
                handleEntryClick(contextMenu.entry);
                closeContextMenu();
              }}
            >
              Open
            </div>
            {!contextMenu.entry.isDirectory && (
              <div
                className={styles.contextMenuItem}
                onClick={() => handleDownloadFromMenu(contextMenu.entry)}
              >
                Download
              </div>
            )}
            <div
              className={styles.contextMenuItem}
              onClick={() => handleCopyPath(contextMenu.entry.path)}
            >
              Copy Path
            </div>
            <div className={styles.contextMenuDivider} />
            <div
              className={`${styles.contextMenuItem} ${styles.contextMenuDanger}`}
              onClick={() => {
                setConfirmDelete(contextMenu.entry);
                closeContextMenu();
              }}
            >
              Delete
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className={styles.confirmOverlay} onClick={() => !deleting && setConfirmDelete(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmTitle}>Confirm Delete</div>
            <div className={styles.confirmMessage}>
              Are you sure you want to delete{" "}
              <strong>{confirmDelete.name}</strong>
              {confirmDelete.isDirectory ? " and all its contents" : ""}?
            </div>
            <div className={styles.confirmActions}>
              <button
                className={`${styles.actionBtn} ${styles.dangerBtn}`}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
              <button
                className={`${styles.actionBtn} ${styles.cancelBtn}`}
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
