namespace FileViewer.Models;

/// <summary>
/// Holds the current application state shared across components.
/// </summary>
public class AppState
{
    public string? CurrentFilePath { get; set; }
    public string? CurrentFileType { get; set; } // "markdown", "excel", "pdf", or null (welcome)
    public string? CurrentFileName { get; set; }
    public bool IsSidebarCollapsed { get; set; }
    public bool IsOpenFolderMode { get; set; }
    public bool IsDirty { get; set; }
    public bool IsLoading { get; set; }
    public bool HasFolderAccess { get; set; }
    public bool IsFileSystemSupported { get; set; }
    public string Theme { get; set; } = "light";
}
