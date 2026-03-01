using FileViewer.Models;

namespace FileViewer.Services;

/// <summary>
/// Manages application state and notifies subscribers of changes.
/// </summary>
public class AppStateService
{
    private readonly AppState _state = new();

    public event Action? OnChange;

    public AppState State => _state;

    public void SetCurrentFile(string? path, string? type, string? name)
    {
        _state.CurrentFilePath = path;
        _state.CurrentFileType = type;
        _state.CurrentFileName = name;
        NotifyStateChanged();
    }

    public void SetSidebarCollapsed(bool collapsed)
    {
        _state.IsSidebarCollapsed = collapsed;
        NotifyStateChanged();
    }

    public void SetOpenFolderMode(bool isOpenFolder)
    {
        _state.IsOpenFolderMode = isOpenFolder;
        NotifyStateChanged();
    }

    public void SetDirty(bool isDirty)
    {
        _state.IsDirty = isDirty;
        NotifyStateChanged();
    }

    public void SetLoading(bool isLoading)
    {
        _state.IsLoading = isLoading;
        NotifyStateChanged();
    }

    public void SetFolderAccess(bool hasAccess)
    {
        _state.HasFolderAccess = hasAccess;
        NotifyStateChanged();
    }

    public void SetFileSystemSupported(bool supported)
    {
        _state.IsFileSystemSupported = supported;
        NotifyStateChanged();
    }

    public void SetTheme(string theme)
    {
        _state.Theme = theme;
        NotifyStateChanged();
    }

    public void ShowWelcome()
    {
        _state.CurrentFilePath = null;
        _state.CurrentFileType = null;
        _state.CurrentFileName = null;
        _state.IsDirty = false;
        NotifyStateChanged();
    }

    private void NotifyStateChanged() => OnChange?.Invoke();
}
