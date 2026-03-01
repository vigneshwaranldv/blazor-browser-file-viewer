# Getting Started

## Prerequisites

- A modern web browser (Chrome or Edge recommended for full functionality)
- No server-side setup required — runs entirely in the browser

## Two Ways to Use

### 1. Static Deployment (GitHub Pages)

The app loads files from a `manifest.json` that describes the folder structure:

```json
{
  "folders": [
    {
      "name": "my-project",
      "path": "data/my-project",
      "children": {
        "markdown-files": ["readme.md"],
        "excel-files": ["data.csv"],
        "pdf-files": ["report.pdf"]
      }
    }
  ]
}
```

Place your files in `wwwroot/data/` and update `manifest.json` accordingly.

### 2. Open Folder Mode

Click the **Open Folder** button in the sidebar to select a folder from your filesystem. The app will scan for supported file types and display them in the tree.

> **Note:** This requires the File System Access API, available in Chrome and Edge.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / `Cmd+S` | Save current file |

## File Type Support

| Extension | Viewer | Editable |
|-----------|--------|----------|
| `.md` | Toast UI Editor (WYSIWYG) | Yes |
| `.csv` | SheetJS table | Yes |
| `.xlsx` / `.xls` | SheetJS table | View only |
| `.pdf` | PDF.js | View only |
