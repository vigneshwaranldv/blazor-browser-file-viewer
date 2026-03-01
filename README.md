# Blazor Browser File Viewer

A Blazor WebAssembly application for viewing Markdown, Excel/CSV, and PDF files directly in the browser. Runs entirely client-side with no server required.

**Live Demo:** [https://vigneshwaranldv.github.io/blazor-browser-file-viewer/](https://vigneshwaranldv.github.io/blazor-browser-file-viewer/)

## Features

- **Markdown** — Full WYSIWYG editing with Toast UI Editor, Mermaid diagram rendering
- **Excel/CSV** — Spreadsheet viewing with SheetJS, inline CSV editing
- **PDF** — Document viewing with PDF.js (page navigation, zoom, fit-to-width)
- **Dark/Light Theme** — Toggle between themes with persistent preference
- **Open Local Folders** — File System Access API for browsing local folders (Chrome/Edge)
- **Save to Disk** — Edit and save Markdown and CSV files back to your filesystem
- **Offline** — All vendor JS libraries bundled locally (no CDN dependencies)
- **GitHub Pages** — Static deployment with manifest.json-based file tree

## Architecture

"Thin Blazor shell + heavy JS interop" — Blazor WASM handles layout, state management, and component rendering. JavaScript interop modules handle all heavy rendering (Toast UI Editor, SheetJS, PDF.js, Mermaid) since those remain JS libraries.

```
FileViewer/
├── Layout/MainLayout.razor        # Main orchestrator
├── Components/
│   ├── Layout/                    # TopBar, Sidebar, ContentPane
│   ├── FileTree/                  # NavTree, TreeNode
│   ├── Viewers/                   # Markdown, Excel, PDF viewers
│   └── Shared/                    # Toast, Loading, BrowserWarning
├── Models/                        # AppState, FileNode, Manifest
├── Services/                      # AppStateService, JSInteropService, ManifestService
└── wwwroot/
    ├── js/libs/                   # Vendor libraries (offline)
    ├── js/interop/                # JS interop modules
    ├── css/                       # App CSS + TUI Editor CSS
    └── data/                      # manifest.json + sample files
```

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) or later

## Running Locally

```bash
# Development mode with hot reload
python run.py

# Or directly with dotnet
cd FileViewer
dotnet watch run
```

The app will be available at `http://localhost:5158/blazor-browser-file-viewer/`.

## Build & Publish

```bash
# Build only
python run.py build

# Publish for deployment
python run.py publish

# Clean build artifacts
python run.py clean
```

## Deployment

The project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys to GitHub Pages on push to `main`.

### Manual Deployment

1. Run `python run.py publish`
2. Serve the contents of `release/wwwroot/` with any static file server

## Adding Your Own Files

### Static Mode (GitHub Pages)

1. Place files in `FileViewer/wwwroot/data/your-project/`
2. Update `FileViewer/wwwroot/data/manifest.json`:

```json
{
  "folders": [
    {
      "name": "your-project",
      "path": "data/your-project",
      "children": {
        "markdown-files": ["readme.md"],
        "excel-files": ["data.csv"],
        "pdf-files": ["report.pdf"]
      }
    }
  ]
}
```

### Open Folder Mode

Click **Open Folder** in the sidebar to browse any local folder. Requires Chrome or Edge for the File System Access API.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / `Cmd+S` | Save current file |

## License

MIT
