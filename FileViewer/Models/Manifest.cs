using System.Text.Json.Serialization;

namespace FileViewer.Models;

/// <summary>
/// Represents the manifest.json structure for static file deployment.
/// </summary>
public class Manifest
{
    [JsonPropertyName("folders")]
    public List<ManifestFolder> Folders { get; set; } = new();
}

public class ManifestFolder
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("path")]
    public string Path { get; set; } = string.Empty;

    [JsonPropertyName("children")]
    public ManifestChildren Children { get; set; } = new();
}

public class ManifestChildren
{
    [JsonPropertyName("markdown-files")]
    public List<string> MarkdownFiles { get; set; } = new();

    [JsonPropertyName("excel-files")]
    public List<string> ExcelFiles { get; set; } = new();

    [JsonPropertyName("pdf-files")]
    public List<string> PdfFiles { get; set; } = new();
}
