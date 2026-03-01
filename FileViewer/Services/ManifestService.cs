using System.Net.Http.Json;
using FileViewer.Models;

namespace FileViewer.Services;

/// <summary>
/// Loads the manifest.json and converts it to a tree of FileNodes.
/// </summary>
public class ManifestService
{
    private readonly HttpClient _http;

    public ManifestService(HttpClient http)
    {
        _http = http;
    }

    /// <summary>
    /// Load the manifest and convert to a list of FileNode trees.
    /// </summary>
    public async Task<List<FileNode>> LoadManifestTreeAsync()
    {
        try
        {
            var manifest = await _http.GetFromJsonAsync<Manifest>("data/manifest.json");
            if (manifest?.Folders == null || manifest.Folders.Count == 0)
                return new List<FileNode>();

            return ConvertToFileNodes(manifest);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Failed to load manifest: {ex.Message}");
            return new List<FileNode>();
        }
    }

    private List<FileNode> ConvertToFileNodes(Manifest manifest)
    {
        var roots = new List<FileNode>();

        foreach (var folder in manifest.Folders)
        {
            var projectNode = new FileNode
            {
                Name = folder.Name,
                Path = folder.Path,
                Type = "folder"
            };

            // Add subdirectories in order
            AddSubdirectory(projectNode, folder, "markdown-files", folder.Children.MarkdownFiles);
            AddSubdirectory(projectNode, folder, "excel-files", folder.Children.ExcelFiles);
            AddSubdirectory(projectNode, folder, "pdf-files", folder.Children.PdfFiles);

            roots.Add(projectNode);
        }

        return roots;
    }

    private void AddSubdirectory(FileNode parent, ManifestFolder folder, string subdirName, List<string> files)
    {
        if (files == null || files.Count == 0) return;

        var subdirNode = new FileNode
        {
            Name = subdirName,
            Path = $"{folder.Path}/{subdirName}",
            Type = "folder"
        };

        foreach (var filename in files)
        {
            var filePath = $"{folder.Path}/{subdirName}/{filename}";
            var fileType = FileNode.GetFileTypeFromExtension(filename);

            subdirNode.Children.Add(new FileNode
            {
                Name = filename,
                Path = filePath,
                Type = "file",
                FileType = fileType
            });
        }

        parent.Children.Add(subdirNode);
    }
}
