# CNCF Landscape Submission Guide

**Repo:** https://github.com/cncf/landscape

## Eligibility

freelens-pod-filebrowser is eligible if:
- It is open source (MIT ✓)
- It relates to cloud native technologies (Kubernetes ✓)
- It has a clear GitHub repo with documentation

## Steps

1. **Fork** the cncf/landscape repo
2. **Add** a entry in `landscape.yml`
3. **Submit PR**

## Suggested Entry

Find the `landscape.yml` file and add under a suitable category (e.g., "Provisioning → Automation & Configuration" or create a Freelens-related entry):

```yaml
- name: freelens-pod-filebrowser
  homepage: https://github.com/masoudei/freelens-pod-filebrowser
  description: >-
    Freelens extension for browsing, viewing, editing, uploading,
    and deleting files inside Kubernetes pod containers.
  licenses:
    - MIT
  organization: masoudei
```

## Alternative: Submit to Landscape

If the manual PR is too involved, use: https://landscape.cncf.io/?selected=about
Click "Suggest a Tool" button at the bottom.

## PR Description

```
Title: Add freelens-pod-filebrowser to landscape

MIT-licensed Freelens extension for Kubernetes pod file browsing.
Uses kubectl exec through Freelens proxy — no sidecars needed.
```
