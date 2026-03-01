namespace FileViewer.Models;

/// <summary>
/// Represents a node in the file tree (either a folder or a file).
/// </summary>
public class FileNode
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty; // "folder" or "file"
    public string? FileType { get; set; } // "markdown", "excel", "pdf"
    public List<FileNode> Children { get; set; } = new();

    /// <summary>
    /// Get file type based on extension.
    /// </summary>
    public static string? GetFileTypeFromExtension(string filename)
    {
        var ext = System.IO.Path.GetExtension(filename).ToLowerInvariant();
        return ext switch
        {
            ".md" => "markdown",
            ".xlsx" or ".xls" => "excel",
            ".csv" => "excel",
            ".pdf" => "pdf",
            _ => null
        };
    }

    /// <summary>
    /// Get CSS class for file icon based on extension.
    /// </summary>
    public static string GetIconClass(string filename)
    {
        var ext = System.IO.Path.GetExtension(filename).ToLowerInvariant();
        return ext switch
        {
            ".md" => "file-icon-md",
            ".xlsx" or ".xls" => "file-icon-excel",
            ".csv" => "file-icon-csv",
            ".pdf" => "file-icon-pdf",
            _ => ""
        };
    }
}
