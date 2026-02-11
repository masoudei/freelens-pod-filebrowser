import { Renderer } from "@freelensapp/extensions";
import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import styles from "../styles/pod-fs.module.scss";
import stylesInline from "../styles/pod-fs.module.scss?inline";
import { FileTree } from "./file-tree";
import { FileViewer } from "./file-viewer";

const {
  K8sApi: { podsStore, namespaceStore },
  Catalog: { getActiveCluster },
} = Renderer;

export interface PodFsPageProps {
  extension: Renderer.LensExtension;
}

export const PodFsPage = observer(({ extension }: PodFsPageProps) => {
  const [selectedNamespace, setSelectedNamespace] = useState<string>("");
  const [selectedPod, setSelectedPod] = useState<string>("");
  const [selectedContainer, setSelectedContainer] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [browsing, setBrowsing] = useState(false);
  const prevPodKey = useRef("");

  const activeCluster = getActiveCluster();
  const clusterId = activeCluster?.id ?? "";

  const namespaces = namespaceStore.items.map((ns) => ns.getName());
  const pods = podsStore.items
    .filter((pod) => {
      if (!selectedNamespace) return true;

      return pod.getNs() === selectedNamespace;
    })
    .filter((pod) => pod.getStatusMessage?.() === "Running" || pod.status?.phase === "Running");

  const selectedPodObj = pods.find((p) => `${p.getNs()}/${p.getName()}` === selectedPod);
  const containers: string[] = [];

  if (selectedPodObj) {
    if (selectedPodObj.spec?.containers) {
      for (const c of selectedPodObj.spec.containers) {
        containers.push(c.name);
      }
    }

    if (selectedPodObj.spec?.initContainers) {
      for (const c of selectedPodObj.spec.initContainers) {
        containers.push(c.name);
      }
    }
  }

  const activeContainer = selectedContainer || containers[0] || "";
  const namespace = selectedPodObj?.getNs() ?? "";
  const podName = selectedPodObj?.getName() ?? "";
  const podKey = `${namespace}/${podName}/${activeContainer}`;

  // Reset browsing state when pod/container changes
  useEffect(() => {
    if (prevPodKey.current !== podKey) {
      prevPodKey.current = podKey;
      setBrowsing(false);
      setSelectedFile(null);
      setCurrentPath("/");
    }
  }, [podKey]);

  return (
    <>
      <style>{stylesInline}</style>
      <div className={styles.clusterPage}>
        <div className={styles.pageHeader}>
          <div className={styles.pageTitle}>Pod Filesystem Browser</div>
          <div className={styles.podSelector}>
            <span className={styles.podSelectorLabel}>Namespace:</span>
            <select
              className={styles.selectInput}
              value={selectedNamespace}
              onChange={(e) => {
                setSelectedNamespace(e.target.value);
                setSelectedPod("");
                setSelectedContainer("");
                setSelectedFile(null);
                setCurrentPath("/");
                setBrowsing(false);
              }}
            >
              <option value="">All namespaces</option>
              {namespaces.map((ns) => (
                <option key={ns} value={ns}>
                  {ns}
                </option>
              ))}
            </select>

            <span className={styles.podSelectorLabel}>Pod:</span>
            <select
              className={styles.selectInput}
              value={selectedPod}
              onChange={(e) => {
                setSelectedPod(e.target.value);
                setSelectedContainer("");
                setSelectedFile(null);
                setCurrentPath("/");
                setBrowsing(false);
              }}
            >
              <option value="">Select a pod...</option>
              {pods.map((p) => {
                const key = `${p.getNs()}/${p.getName()}`;

                return (
                  <option key={key} value={key}>
                    {key}
                  </option>
                );
              })}
            </select>

            {containers.length > 1 && (
              <>
                <span className={styles.podSelectorLabel}>Container:</span>
                <select
                  className={styles.selectInput}
                  value={activeContainer}
                  onChange={(e) => {
                    setSelectedContainer(e.target.value);
                    setSelectedFile(null);
                    setCurrentPath("/");
                    setBrowsing(false);
                  }}
                >
                  {containers.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        <div className={`${styles.pageContent} ${selectedFile ? styles.splitMode : ""}`}>
          {!selectedPodObj || !activeContainer || !clusterId ? (
            <div className={styles.loadingContainer}>
              Select a running pod to browse its filesystem
            </div>
          ) : !browsing ? (
            <div className={styles.browsePrompt}>
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
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </>
  );
});
