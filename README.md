# Freelens Pod File Browser

A [Freelens](https://github.com/freelensapp/freelens) extension that provides a full-featured file browser for Kubernetes pod containers. Browse, view, edit, upload, and delete files inside running pods — directly from the Freelens UI.

![License](https://img.shields.io/github/license/masoudei/freelens-pod-filebrowser)
![Freelens](https://img.shields.io/badge/freelens-%3E%3D1.5.0-blue)

## Features

- **Directory browsing** — Navigate pod filesystems with a flat file listing and clickable breadcrumb bar
- **File viewing & editing** — Open files in a Monaco editor with syntax highlighting; edit and save changes back to the pod
- **Upload files** — Upload local files to the pod via button or drag-and-drop (max 1 MB)
- **Download files** — Download any file from the pod to your local machine
- **Delete files/directories** — Remove files or directories with a confirmation dialog
- **Binary file detection** — Automatically detects binary files and shows a download-only placeholder instead of the editor
- **Symlink resolution** — Displays symlink targets inline in the file listing
- **Context menu** — Right-click entries for quick access to Open, Download, Copy Path, and Delete
- **Container selector** — Switch between containers (including init containers) within a pod
- **Search/filter** — Filter files by name within the current directory
- **Permissions display** — Shows file permissions, sizes, and types parsed from `ls -la` output
- **Split-panel layout** — File tree on top, editor on bottom; works in both the pod detail panel and the dedicated cluster page
- **Cluster page** — Full-page file browser with namespace, pod, and container selectors

## Screenshots

> *Coming soon — contributions welcome!*

## Installation

### From Release

1. Download the latest `.tgz` from the [Releases](https://github.com/masoudei/freelens-pod-filebrowser/releases) page
2. Open Freelens
3. Go to **Extensions** (Ctrl+Shift+E)
4. Drag the `.tgz` file into the extensions panel or use the file picker

### From Source

```bash
git clone https://github.com/masoudei/freelens-pod-filebrowser.git
cd freelens-pod-filebrowser
pnpm install
pnpm build:force
pnpm pack
```

Then load the generated `.tgz` file in Freelens as described above.

## Usage

### Pod Detail Panel

1. Navigate to any pod in Freelens
2. Open the pod details drawer
3. Scroll to the **Filesystem Browser** section
4. Select a container and start browsing

### Cluster Page

1. Open the Freelens sidebar
2. Click **Pod Filesystem** in the menu
3. Select a namespace, pod, and container from the dropdowns

### Keyboard & Mouse

| Action | How |
|--------|-----|
| Open file/directory | Click the entry |
| Navigate up | Click `..` or a breadcrumb segment |
| Right-click menu | Right-click any file entry |
| Upload files | Click the Upload button, or drag & drop files onto the file list |
| Filter files | Type in the filter input above the file list |
| Refresh | Click the refresh button in the toolbar |

## Requirements

- [Freelens](https://github.com/freelensapp/freelens) >= 1.5.0
- `kubectl` available on your system PATH
- The target pod must have basic shell utilities (`ls`, `cat`, `stat`, `head`, `rm`)

## How It Works

The extension uses `kubectl exec` through the Freelens proxy kubeconfig to run shell commands inside pod containers. This means:

- It uses the same authentication as your Freelens cluster connection (including EKS SSO, etc.)
- No direct Kubernetes API calls — just standard shell utilities
- File content is transferred as base64 for uploads, and raw text for reads
- Binary detection uses file extension matching + null byte detection in the first 512 bytes

## Development

```bash
pnpm install          # Install dependencies
pnpm build            # Compile (with type checking)
pnpm build:force      # Compile (skip type checking)
pnpm pack             # Create installable .tgz
pnpm pack:dev         # Build + pack in one step
pnpm type:check       # Type checking only
pnpm clean            # Remove build output
pnpm clean:all        # Remove build output, node_modules, and .tgz files
```

### Project Structure

```
freelens-pod-filebrowser/
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
├── electron.vite.config.js   # Build configuration
└── src/
    ├── main/
    │   └── index.ts          # IPC handlers (kubectl exec commands)
    └── renderer/
        ├── index.tsx          # Extension registration
        ├── components/
        │   ├── pod-fs-details.tsx    # Pod detail panel integration
        │   ├── pod-fs-page.tsx       # Full-page cluster page
        │   ├── file-tree.tsx         # File listing, breadcrumb, upload, context menu
        │   ├── file-viewer.tsx       # Monaco editor / binary placeholder
        │   └── pod-fs-icon.tsx       # Extension icon
        └── styles/
            └── pod-fs.module.scss    # Scoped styles (CSS Modules)
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
