# Demo GIF Creation Guide

A 30-45 second screencast is the single highest-ROI change you can make.

## Recording Tools

| OS | Tool | Notes |
|----|------|-------|
| Windows | ScreenRec (free) or OBS | OBS is overkill; ScreenRec is simpler |
| macOS | Kap (free, open source) | Clean, lightweight |
| Linux | Peek (free, open source) | Built for GIF recording |

## Script

Record **one continuous take** showing:

1. **(0-5s)** Open Freelens, navigate to a pod in the cluster
2. **(5-15s)** Scroll to "Filesystem Browser" section, select container
3. **(15-25s)** Browse directories — click through folders using breadcrumb nav
4. **(25-35s)** Open a config file (YAML/JSON/conf) in Monaco editor
5. **(35-40s)** Edit the file, save it back to the pod
6. **(40-45s)** Drag a file from desktop onto the file list to upload

## Quality Guidelines

- Resolution: 1280×720 or 1920×1080 (scale down if needed)
- File size: <5MB (compress with gifsicle or ezgif.com)
- Frame rate: 10-15fps (smooth enough without bloating size)
- Remove background noise if recording audio

## Compression

### Option A: gifsicle (recommended)
```bash
gifsicle --optimize=3 --colors 256 --delay=10 input.gif -o output.gif
```

### Option B: ezgif.com
Upload → optimize → download. Set colors to 256, leave loss at 0.

## Placement

Embed at the top of README, right after the badges:

```markdown
![Demo](img/demo.gif)
```

Replace the static hero screenshot with this GIF.
