import { Renderer } from "@freelensapp/extensions";
import React, { useCallback, useEffect, useState } from "react";
import styles from "../styles/pod-fs.module.scss";
import stylesInline from "../styles/pod-fs.module.scss?inline";

import type { FileContent } from "../../main/index";

const {
  Component: { Spinner, Notifications, MonacoEditor },
} = Renderer;

interface FileViewerProps {
  clusterId: string;
  namespace: string;
  pod: string;
  container: string;
  filePath: string;
  onClose: () => void;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "yaml":
    case "yml":
      return "yaml";
    case "json":
      return "json";
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "sh":
    case "bash":
      return "shell";
    case "py":
      return "python";
    case "xml":
      return "xml";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "md":
      return "markdown";
    case "toml":
      return "ini";
    case "ini":
    case "conf":
    case "cfg":
      return "ini";
    case "sql":
      return "sql";
    case "go":
      return "go";
    case "rs":
      return "rust";
    default:
      return "plaintext";
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function stringToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

export function FileViewer({ clusterId, namespace, pod, container, filePath, onClose }: FileViewerProps) {
  const [content, setContent] = useState<FileContent | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isModified, setIsModified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ipc = Renderer.Ipc.getInstance();
  const fileName = filePath.split("/").pop() || filePath;
  const language = getLanguageFromPath(filePath);

  const loadFile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await ipc.invoke("readFile", clusterId, namespace, pod, container, filePath);

      if (result.success) {
        const data = result.data as FileContent;

        setContent(data);
        setEditedContent(data.content);
        setIsModified(false);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [clusterId, namespace, pod, container, filePath, ipc]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  const handleSave = useCallback(async () => {
    setSaving(true);

    try {
      const base64 = stringToBase64(editedContent);

      const result = await ipc.invoke(
        "uploadFile", clusterId, namespace, pod, container,
        filePath, base64,
      );

      if (result.success) {
        Notifications.ok(`Saved ${fileName}`);
        setIsModified(false);
        // Update the stored content to match what was saved
        setContent((prev) => prev ? { ...prev, content: editedContent, size: new TextEncoder().encode(editedContent).length } : prev);
      } else {
        Notifications.error(`Save failed: ${result.error}`);
      }
    } catch (err) {
      Notifications.error(`Save error: ${err}`);
    } finally {
      setSaving(false);
    }
  }, [editedContent, clusterId, namespace, pod, container, filePath, fileName, ipc]);

  const handleDownload = async () => {
    try {
      const result = await ipc.invoke("downloadFile", clusterId, namespace, pod, container, filePath);

      if (result.success) {
        const blob = new Blob([result.data as string], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        Notifications.ok(`Downloaded ${fileName}`);
      } else {
        Notifications.error(`Download failed: ${result.error}`);
      }
    } catch (err) {
      Notifications.error(`Download error: ${err}`);
    }
  };

  const handleDiscard = useCallback(() => {
    if (content) {
      setEditedContent(content.content);
      setIsModified(false);
    }
  }, [content]);

  const handleEditorChange = useCallback((value: string) => {
    setEditedContent(value);
    setIsModified(value !== content?.content);
  }, [content]);

  return (
    <>
      <style>{stylesInline}</style>
      <div className={styles.fileViewer}>
        <div className={styles.fileViewerHeader}>
          <div className={styles.fileViewerTitle}>
            <span className={styles.fileViewerPath} title={filePath}>
              {filePath}
            </span>
            {isModified && (
              <span className={styles.modifiedBadge}>Modified</span>
            )}
            {content && (
              <span className={styles.fileViewerMeta}>
                {formatSize(content.size)}
                {content.truncated && " (truncated, read-only)"}
              </span>
            )}
          </div>
          <div className={styles.fileViewerActions}>
            {isModified && !content?.isBinary && (
              <>
                <button
                  className={`${styles.actionBtn} ${styles.saveBtn}`}
                  onClick={handleSave}
                  disabled={saving}
                  title="Save changes to pod"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  className={`${styles.actionBtn} ${styles.cancelBtn}`}
                  onClick={handleDiscard}
                  title="Discard changes"
                >
                  Discard
                </button>
              </>
            )}
            {!content?.isBinary && (
              <button className={styles.actionBtn} onClick={handleDownload} title="Download file">
                Download
              </button>
            )}
            <button className={`${styles.actionBtn} ${styles.cancelBtn}`} onClick={onClose} title="Close editor">
              Close
            </button>
          </div>
        </div>
        <div className={styles.fileViewerContent}>
          {loading && (
            <div className={styles.loadingContainer}>
              <Spinner singleColor={false} />
              <span>Loading file...</span>
            </div>
          )}
          {error && (
            <div className={styles.errorContainer}>
              <span className={styles.errorIcon}>!</span>
              <span>{error}</span>
            </div>
          )}
          {content && !loading && content.isBinary && (
            <div className={styles.binaryPlaceholder}>
              <span className={styles.binaryIcon}>{"\u{1F4E6}"}</span>
              <span className={styles.binaryFileName}>{fileName}</span>
              <span className={styles.binaryMessage}>Binary file — preview not available</span>
              <span className={styles.binarySize}>{formatSize(content.size)}</span>
              <button className={styles.actionBtn} onClick={handleDownload}>
                Download
              </button>
            </div>
          )}
          {content && !loading && !content.isBinary && (
            <div className={styles.editorWrapper}>
              <MonacoEditor
                id={`pod-fs-${filePath}`}
                value={editedContent}
                language={language}
                onChange={handleEditorChange}
                options={{
                  readOnly: !!content.truncated,
                  minimap: { enabled: false },
                  lineNumbers: "on",
                  scrollBeyondLastLine: true,
                  wordWrap: "on",
                  automaticLayout: true,
                  fontSize: 12,
                  padding: { top: 4, bottom: 4 },
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
