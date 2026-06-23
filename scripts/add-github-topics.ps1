# GitHub Topics Setup Script
#
# Run this to add all 20 recommended topics to the repository.
# Requires: GitHub CLI (gh) installed and authenticated.
#
# Usage: pwsh scripts/add-github-topics.ps1

$repo = "masoudei/freelens-pod-filebrowser"

$topics = @(
    "kubernetes",
    "k8s",
    "kubectl",
    "pod",
    "freelens",
    "freelens-extension",
    "file-browser",
    "filemanager",
    "file-explorer",
    "filesystem",
    "container",
    "debugging",
    "troubleshooting",
    "devtools",
    "developer-tools",
    "monaco-editor",
    "kubernetes-debugging",
    "kubernetes-tools",
    "devops",
    "opensource"
)

Write-Host "Adding topics to $repo..."
$topicsStr = $topics -join ","
gh repo edit $repo --add-topic $topicsStr

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully added $($topics.Count) topics."
} else {
    Write-Host "Failed to add topics. Make sure 'gh' is installed and authenticated."
    Write-Host "Install: winget install GitHub.cli"
    Write-Host "Auth: gh auth login"
}
