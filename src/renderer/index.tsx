import { Renderer } from "@freelensapp/extensions";
import React from "react";
import { PodFsDetails } from "./components/pod-fs-details";
import { PodFsIcon } from "./components/pod-fs-icon";
import { PodFsPage } from "./components/pod-fs-page";

import type { PodFsDetailsProps } from "./components/pod-fs-details";

export default class PodFilesystemRenderer extends Renderer.LensExtension {
  async onActivate() {
    Renderer.Ipc.createInstance(this);
  }

  kubeObjectDetailItems = [
    {
      kind: "Pod",
      apiVersions: ["v1"],
      priority: 5,
      components: {
        Details: (props: PodFsDetailsProps) => (
          <PodFsDetails {...props} extension={this} />
        ),
      },
    },
  ];

  clusterPages = [
    {
      id: "pod-filesystem",
      components: {
        Page: () => <PodFsPage extension={this} />,
      },
    },
  ];

  clusterPageMenus = [
    {
      id: "pod-filesystem",
      title: "Pod Filesystem",
      target: { pageId: "pod-filesystem" },
      components: {
        Icon: PodFsIcon,
      },
    },
  ];
}
