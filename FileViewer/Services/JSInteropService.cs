using Microsoft.JSInterop;

namespace FileViewer.Services;

/// <summary>
/// Centralized JS Interop service for calling JavaScript functions from Blazor.
/// </summary>
public class JSInteropService : IAsyncDisposable
{
    private readonly IJSRuntime _js;

    public JSInteropService(IJSRuntime js)
    {
        _js = js;
    }

    // ===========================
    // Theme
    // ===========================
    public ValueTask InitThemeAsync() =>
        _js.InvokeVoidAsync("AppInterop.initTheme");

    public ValueTask ToggleThemeAsync() =>
        _js.InvokeVoidAsync("AppInterop.toggleTheme");

    public ValueTask<string> GetThemeAsync() =>
        _js.InvokeAsync<string>("AppInterop.getTheme");

    // ===========================
    // File System
    // ===========================
    public ValueTask<bool> CheckFileSystemSupportAsync() =>
        _js.InvokeAsync<bool>("FileSystemInterop.checkSupport");

    public ValueTask<bool> RequestFolderAccessAsync() =>
        _js.InvokeAsync<bool>("FileSystemInterop.requestAccess");

    public ValueTask<bool> HasFolderAccessAsync() =>
        _js.InvokeAsync<bool>("FileSystemInterop.hasAccess");

    public ValueTask SaveFileAsync(string path, string content) =>
        _js.InvokeVoidAsync("FileSystemInterop.saveFile", path, content);

    public ValueTask SaveCurrentMarkdownAsync() =>
        _js.InvokeVoidAsync("FileSystemInterop.saveCurrentMarkdown");

    public ValueTask SaveCurrentCSVAsync() =>
        _js.InvokeVoidAsync("FileSystemInterop.saveCurrentCSV");

    // ===========================
    // Open Folder
    // ===========================
    public ValueTask<bool> OpenFolderAsync(DotNetObjectReference<object> callbackRef) =>
        _js.InvokeAsync<bool>("AppInterop.openFolder", callbackRef);

    public ValueTask<bool> TryRestorePersistedFolderAsync(DotNetObjectReference<object> callbackRef) =>
        _js.InvokeAsync<bool>("AppInterop.tryRestorePersistedFolder", callbackRef);

    public ValueTask ResetToDefaultFolderAsync() =>
        _js.InvokeVoidAsync("AppInterop.resetToDefaultFolder");

    // ===========================
    // Markdown Renderer
    // ===========================
    public ValueTask RenderMarkdownAsync(string content, string filePath) =>
        _js.InvokeVoidAsync("MarkdownInterop.render", content, filePath);

    public ValueTask<string> GetMarkdownContentAsync() =>
        _js.InvokeAsync<string>("MarkdownInterop.getMarkdown");

    public ValueTask<bool> HasMarkdownDirtyChangesAsync() =>
        _js.InvokeAsync<bool>("MarkdownInterop.hasDirtyChanges");

    public ValueTask MarkMarkdownCleanAsync() =>
        _js.InvokeVoidAsync("MarkdownInterop.markClean");

    public ValueTask DestroyMarkdownAsync() =>
        _js.InvokeVoidAsync("MarkdownInterop.destroy");

    public ValueTask ResizeMarkdownAsync() =>
        _js.InvokeVoidAsync("MarkdownInterop.resize");

    // ===========================
    // Excel Renderer
    // ===========================
    public ValueTask RenderExcelFromUrlAsync(string url, string filename, string filePath) =>
        _js.InvokeVoidAsync("ExcelInterop.renderFromUrl", url, filename, filePath);

    public ValueTask RenderExcelFromHandleAsync(string filename, string filePath) =>
        _js.InvokeVoidAsync("ExcelInterop.renderFromHandle", filename, filePath);

    public ValueTask<bool> HasExcelDirtyChangesAsync() =>
        _js.InvokeAsync<bool>("ExcelInterop.hasDirtyChanges");

    public ValueTask<bool> IsExcelEditableAsync() =>
        _js.InvokeAsync<bool>("ExcelInterop.isEditable");

    public ValueTask DestroyExcelAsync() =>
        _js.InvokeVoidAsync("ExcelInterop.destroy");

    // ===========================
    // PDF Renderer
    // ===========================
    public ValueTask RenderPdfFromUrlAsync(string url) =>
        _js.InvokeVoidAsync("PdfInterop.renderFromUrl", url);

    public ValueTask RenderPdfFromHandleAsync() =>
        _js.InvokeVoidAsync("PdfInterop.renderFromHandle");

    public ValueTask PdfNextPageAsync() =>
        _js.InvokeVoidAsync("PdfInterop.nextPage");

    public ValueTask PdfPrevPageAsync() =>
        _js.InvokeVoidAsync("PdfInterop.prevPage");

    public ValueTask PdfZoomInAsync() =>
        _js.InvokeVoidAsync("PdfInterop.zoomIn");

    public ValueTask PdfZoomOutAsync() =>
        _js.InvokeVoidAsync("PdfInterop.zoomOut");

    public ValueTask PdfFitWidthAsync() =>
        _js.InvokeVoidAsync("PdfInterop.fitWidth");

    public ValueTask DestroyPdfAsync() =>
        _js.InvokeVoidAsync("PdfInterop.destroy");

    // ===========================
    // Toast
    // ===========================
    public ValueTask ShowToastAsync(string message, string type = "info", int duration = 3000) =>
        _js.InvokeVoidAsync("AppInterop.showToast", message, type, duration);

    // ===========================
    // Sidebar Resize
    // ===========================
    public ValueTask InitResizerAsync() =>
        _js.InvokeVoidAsync("AppInterop.initResizer");

    // ===========================
    // Keyboard Shortcuts
    // ===========================
    public ValueTask InitKeyboardShortcutsAsync(DotNetObjectReference<object> callbackRef) =>
        _js.InvokeVoidAsync("AppInterop.initKeyboardShortcuts", callbackRef);

    // ===========================
    // Nav Tree (rendered in JS for Open Folder mode)
    // ===========================
    public ValueTask RenderNavTreeFromManifestAsync(string containerId) =>
        _js.InvokeVoidAsync("NavTreeInterop.initFromManifest", containerId);

    public ValueTask HighlightNavTreeFileAsync(string filePath) =>
        _js.InvokeVoidAsync("NavTreeInterop.highlightFile", filePath);

    // ===========================
    // Disposal
    // ===========================
    public async ValueTask DisposeAsync()
    {
        // Cleanup if needed
    }
}
