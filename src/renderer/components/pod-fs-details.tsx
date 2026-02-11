import { Renderer } from "@freelensapp/extensions";
import React, { useEffect, useRef, useState } from "react";
import styles from "../styles/pod-fs.module.scss";
import stylesInline from "../styles/pod-fs.module.scss?inline";
import { FileTree } from "./file-tree";
import { FileViewer } from "./file-viewer";

const {
  Component: { DrawerItem, DrawerTitle },
  Catalog: { getActiveCluster },
} = Renderer;

export interface PodFsDetailsProps extends Renderer.Component.KubeObjectDetailsProps<any> {
  extension: Renderer.LensExtension;
}

export function PodFsDetails({ object }: PodFsDetailsProps) {
  const [browsing, setBrowsing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [currentPath, setCurrentPath] = useState<string>("/");

  const pod = object;
  const namespace = pod.getNs() ?? "default";
  const podName = pod.getName();
  const podKey = `${namespace}/${podName}`;
  const prevPodKey = useRef(podKey);

  const activeCluster = getActiveCluster();
  const clusterId = activeCluster?.id ?? "";

  // Reset everything when pod changes
  useEffect(() => {
    if (prevPodKey.current !== podKey) {
      prevPodKey.current = podKey;
      setBrowsing(false);
      setSelectedFile(null);
      setSelectedContainer("");
      setCurrentPath("/");
    }
  }, [podKey]);

  const containers: string[] = [];

  if (pod.spec?.containers) {
    for (const c of pod.spec.containers) {
      containers.push(c.name);
    }
  }

  if (pod.spec?.initContainers) {
    for (const c of pod.spec.initContainers) {
      containers.push(c.name);
    }
  }

  const activeContainer = selectedContainer || containers[0] || "";

  if (!clusterId) {
    return (
      <div className={styles.podFsPanel}>
        <DrawerTitle>Filesystem Browser</DrawerTitle>
        <DrawerItem name="Status">No active cluster found</DrawerItem>
      </div>
    );
  }

  if (!activeContainer) {
    return (
      <div className={styles.podFsPanel}>
        <DrawerTitle>Filesystem Browser</DrawerTitle>
        <DrawerItem name="Status">No containers found in this pod</DrawerItem>
      </div>
    );
  }

  const phase = pod.getStatusMessage?.() || pod.status?.phase || "Unknown";
  const isRunning = phase === "Running";

  if (!isRunning) {
    return (
      <div className={styles.podFsPanel}>
        <DrawerTitle>Filesystem Browser</DrawerTitle>
        <DrawerItem name="Status">
          Pod is not running (status: {phase}). Filesystem browsing requires a running pod.
        </DrawerItem>
      </div>
    );
  }

  if (!browsing) {
    return (
      <>
        <style>{stylesInline}</style>
        <div className={styles.podFsPanel}>
          <DrawerTitle>Filesystem Browser</DrawerTitle>
          {containers.length > 1 && (
            <DrawerItem name="Container">
              <select
                className={styles.containerSelect}
                value={activeContainer}
                onChange={(e) => {
                  setSelectedContainer(e.target.value);
                }}
              >
                {containers.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </DrawerItem>
          )}
          {containers.length === 1 && (
            <DrawerItem name="Container">{activeContainer}</DrawerItem>
          )}
          <div
            className={styles.browsePrompt}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <p className={styles.browsePromptText}>
              Browse the filesystem of this pod via kubectl exec.
            </p>
            <button
              className={`${styles.actionBtn} ${styles.browseBtn}`}
              onClick={() => setBrowsing(true)}
            >
              Browse Files
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{stylesInline}</style>
      <div className={styles.podFsPanel}>
        <DrawerTitle>Filesystem Browser</DrawerTitle>

        {containers.length > 1 && (
          <DrawerItem name="Container">
            <select
              className={styles.containerSelect}
              value={activeContainer}
              onChange={(e) => {
                setSelectedContainer(e.target.value);
                setSelectedFile(null);
                setCurrentPath("/");
              }}
            >
              {containers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </DrawerItem>
        )}

        {containers.length === 1 && (
          <DrawerItem name="Container">{activeContainer}</DrawerItem>
        )}

        <div
          className={`${styles.browserContainer} ${selectedFile ? styles.splitMode : ""}`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={`${styles.splitTop} ${selectedFile ? styles.splitTopCompact : ""}`}>
            <FileTree
              clusterId={clusterId}
              namespace={namespace}
              pod={podName}
              container={activeContainer}
              currentPath={currentPath}
              onNavigate={setCurrentPath}
              onFileSelect={setSelectedFile}
            />
          </div>
          {selectedFile && (
            <>
              <div className={styles.splitDivider} />
              <div className={styles.splitBottom}>
                <FileViewer
                  clusterId={clusterId}
                  namespace={namespace}
                  pod={podName}
                  container={activeContainer}
                  filePath={selectedFile}
                  onClose={() => setSelectedFile(null)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
