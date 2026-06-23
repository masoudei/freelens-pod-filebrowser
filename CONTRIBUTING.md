# Contributing to freelens-pod-filebrowser

## Development Setup

```bash
git clone https://github.com/masoudei/freelens-pod-filebrowser.git
cd freelens-pod-filebrowser
pnpm install
pnpm build:force
pnpm pack
```

Load the `.tgz` in Freelens (Extensions → drag file).

## Architecture Overview

```
IPC (main process)         Renderer (React + MobX)
    │                            │
    ├─ kubectl exec ────────►    ├─ file-tree.tsx
    │  (ls, cat, stat,           ├─ file-viewer.tsx
    │   head, rm, base64)        ├─ pod-fs-details.tsx
    │                            ├─ pod-fs-page.tsx
    │                            └─ pod-fs-icon.tsx
```

- **Main process** (`src/main/index.ts`): IPC handlers that run shell commands in pods
- **Renderer**: React 17 + MobX components for the UI
- **No sidecars**: Everything runs through `kubectl exec` via Freelens proxy

## Code Style

- TypeScript strict mode
- React 17 patterns (class components with MobX decorators)
- SCSS Modules for styling
- No code comments unless necessary

## Pull Request Process

1. Fork and create a feature branch
2. Make your changes
3. Run `pnpm type:check` to verify types
4. Run `pnpm build:force` to verify build
5. Submit PR with description of changes

## Good First Issues

Check issues labeled `good first issue` for beginner-friendly tasks.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
