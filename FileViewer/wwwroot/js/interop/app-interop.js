/**
 * app-interop.js
 * Blazor JS Interop wrapper for the main app orchestrator.
 * Handles theme toggling, toast notifications, sidebar resizing,
 * keyboard shortcuts, Open Folder functionality, and folder persistence.
 */
window.AppInterop = (() => {
    let _dotNetRef = null;
    let isOpenFolderMode = false;

    // Store the last scanned tree for findFileInTree during restore
    let _lastScannedTree = null;

    // ===========================
    // Theme
    // ===========================

    /**
     * Initialize theme from localStorage.
     */
    function initTheme() {
        const saved = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', saved);
        updateThemeIcon();
    }

    /**
     * Toggle between light and dark theme.
     */
    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon();

        // Re-initialize Mermaid with the new theme and re-render diagrams
        if (window.MarkdownInterop) {
            window.MarkdownInterop.reinitMermaidTheme();
        }
    }

    /**
     * Get the current theme string.
     * @returns {string} 'light' or 'dark'
     */
    function getTheme() {
        return document.documentElement.getAttribute('data-theme') || 'light';
    }

    /**
     * Update the theme toggle button icon (sun/moon).
     */
    function updateThemeIcon() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        btn.innerHTML = isDark
            ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
            : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;
        btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    }

    // ===========================
    // Toast Notifications
    // ===========================

    /**
     * Show a toast notification.
     * @param {string} message - the message to display
     * @param {string} [type='info'] - 'info', 'success', or 'error'
     * @param {number} [duration=3000] - how long to show the toast (ms)
     */
    function showToast(message, type, duration) {
        type = type || 'info';
        duration = duration || 3000;

        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'block';
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 300);
        }, duration);
    }

    // ===========================
    // Sidebar Resize
    // ===========================

    /**
     * Initialize sidebar resize drag handling.
     */
    function initResizer() {
        const resizer = document.getElementById('resizer');
        const sidebar = document.getElementById('sidebar');
        if (!resizer || !sidebar) return;

        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizer.classList.add('active');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const newWidth = e.clientX;
            if (newWidth >= 180 && newWidth <= 500) {
                sidebar.style.width = `${newWidth}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('active');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';

                // Resize markdown editor if active
                if (window.MarkdownInterop) {
                    window.MarkdownInterop.resize();
                }
                // Re-fit PDF if active
                if (window.PdfInterop) {
                    window.PdfInterop.fitWidth();
                }
            }
        });
    }

    // ===========================
    // Keyboard Shortcuts
    // ===========================

    /**
     * Initialize keyboard shortcuts.
     * Sets up Ctrl+S handler that calls .NET via dotNetRef.
     * @param {object} dotNetRef - DotNetObjectReference for callbacks
     */
    function initKeyboardShortcuts(dotNetRef) {
        _dotNetRef = dotNetRef;

        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (_dotNetRef) {
                    _dotNetRef.invokeMethodAsync('OnSaveRequested');
                }
            }
        });
    }

    // ===========================
    // Open Folder (File System Access API)
    // ===========================

    /**
     * Recursively scan a directory handle and build a tree structure.
     * Only includes folders that contain supported file types somewhere in their subtree.
     * @param {FileSystemDirectoryHandle} dirHandle
     * @param {string} path
     * @returns {Promise<object>} tree node
     */
    async function scanDirectoryHandle(dirHandle, path) {
        const node = {
            name: dirHandle.name,
            path: path,
            type: 'folder',
            handle: dirHandle,
            children: [],
        };

        const supportedExtensions = new Set(['md', 'xlsx', 'xls', 'csv', 'pdf']);

        for await (const [name, handle] of dirHandle) {
            if (name.startsWith('.')) continue;

            if (handle.kind === 'directory') {
                const childNode = await scanDirectoryHandle(handle, `${path}/${name}`);
                if (hasSupportedFiles(childNode)) {
                    node.children.push(childNode);
                }
            } else if (handle.kind === 'file') {
                const ext = name.split('.').pop().toLowerCase();
                if (supportedExtensions.has(ext)) {
                    node.children.push({
                        name: name,
                        path: `${path}/${name}`,
                        type: 'file',
                        handle: handle,
                        ext: ext,
                    });
                }
            }
        }

        // Sort: folders first, then files, alphabetically
        node.children.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        return node;
    }

    /**
     * Check if a tree node has supported files somewhere in its subtree.
     */
    function hasSupportedFiles(node) {
        if (node.type === 'file') return true;
        return node.children && node.children.some(child => hasSupportedFiles(child));
    }

    /**
     * Recursively search a tree for a file node by path.
     */
    function findFileInTree(node, filePath) {
        if (node.type === 'file' && node.path === filePath) {
            return node;
        }
        if (node.children) {
            for (const child of node.children) {
                const found = findFileInTree(child, filePath);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Get file type from extension.
     */
    function getFileTypeFromExt(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        switch (ext) {
            case 'md': return 'markdown';
            case 'xlsx':
            case 'xls':
            case 'csv': return 'excel';
            case 'pdf': return 'pdf';
            default: return null;
        }
    }

    /**
     * Open a folder via the File System Access API directory picker.
     * Scans the directory, renders the nav tree, and notifies Blazor.
     * @param {object} dotNetRef - DotNetObjectReference for callbacks
     */
    async function openFolder(dotNetRef) {
        if (!('showDirectoryPicker' in window)) {
            showToast('Open Folder requires Chrome or Edge browser.', 'error');
            return;
        }

        try {
            const dirHandle = await window.showDirectoryPicker({
                id: 'file-viewer-open',
                mode: 'readwrite',
            });

            showToast(`Scanning folder: ${dirHandle.name}...`, 'info');

            // Recursively scan the picked directory
            const tree = await scanDirectoryHandle(dirHandle, dirHandle.name);
            _lastScannedTree = tree;

            // Render the tree in the nav (uses NavTreeInterop)
            if (window.NavTreeInterop) {
                window.NavTreeInterop.renderFromOpenFolder(tree, dotNetRef);
            }

            // Set up FileSystemInterop with this directory handle for saving
            if (window.FileSystemInterop) {
                window.FileSystemInterop.setDirectoryHandle(dirHandle);
                await window.FileSystemInterop.persistDirectoryHandle(dirHandle);
            }

            isOpenFolderMode = true;

            // Show the reset button
            const resetFolderBtn = document.getElementById('reset-folder-btn');
            if (resetFolderBtn) {
                resetFolderBtn.style.display = 'inline-flex';
            }

            showToast(`Loaded folder: ${dirHandle.name}`, 'success');

            // Notify Blazor
            if (dotNetRef) {
                dotNetRef.invokeMethodAsync('OnFolderOpened', true);
            }
        } catch (error) {
            if (error.name === 'AbortError') return; // User cancelled
            console.error('Open folder error:', error);
            showToast(`Failed to open folder: ${error.message}`, 'error');
        }
    }

    /**
     * Try to restore a previously opened folder from IndexedDB.
     * @param {object} dotNetRef - DotNetObjectReference for callbacks
     */
    async function tryRestorePersistedFolder(dotNetRef) {
        if (!window.FileSystemInterop) return false;

        const savedHandle = await window.FileSystemInterop.getPersistedDirectoryHandle();
        if (!savedHandle) return false;

        try {
            // Verify we still have permission
            const hasPermission = await window.FileSystemInterop.verifyPermission(savedHandle);
            if (!hasPermission) {
                await window.FileSystemInterop.clearPersistedDirectoryHandle();
                return false;
            }

            showToast(`Restoring folder: ${savedHandle.name}...`, 'info');

            // Re-scan the directory
            const tree = await scanDirectoryHandle(savedHandle, savedHandle.name);
            _lastScannedTree = tree;

            // Render the tree
            if (window.NavTreeInterop) {
                window.NavTreeInterop.renderFromOpenFolder(tree, dotNetRef);
            }

            // Set up FileSystemInterop
            window.FileSystemInterop.setDirectoryHandle(savedHandle);

            // Try to re-select the last opened file
            const lastFilePath = await window.FileSystemInterop.getPersistedLastFilePath();
            if (lastFilePath && _lastScannedTree) {
                const fileNode = findFileInTree(_lastScannedTree, lastFilePath);
                if (fileNode && fileNode.handle) {
                    // Notify Blazor about the file to load
                    if (dotNetRef) {
                        dotNetRef.invokeMethodAsync('OnFileSelected', {
                            path: fileNode.path,
                            type: getFileTypeFromExt(fileNode.name),
                            name: fileNode.name,
                            hasHandle: true,
                        });
                    }
                    // Highlight it in the nav tree
                    if (window.NavTreeInterop) {
                        window.NavTreeInterop.highlightFile(lastFilePath);
                    }
                }
            }

            showToast(`Restored folder: ${savedHandle.name}`, 'success');

            isOpenFolderMode = true;
            const resetFolderBtn = document.getElementById('reset-folder-btn');
            if (resetFolderBtn) {
                resetFolderBtn.style.display = 'inline-flex';
            }

            // Notify Blazor
            if (dotNetRef) {
                dotNetRef.invokeMethodAsync('OnFolderOpened', true);
            }

            return true;
        } catch (error) {
            console.warn('Failed to restore persisted folder:', error);
            if (window.FileSystemInterop) {
                await window.FileSystemInterop.clearPersistedDirectoryHandle();
            }
            return false;
        }
    }

    /**
     * Reset back to the default manifest-based tree view.
     * Clears the persisted folder handle.
     */
    async function resetToDefaultFolder() {
        // Clear persisted state
        if (window.FileSystemInterop) {
            await window.FileSystemInterop.clearPersistedDirectoryHandle();
        }

        isOpenFolderMode = false;
        _lastScannedTree = null;

        const resetFolderBtn = document.getElementById('reset-folder-btn');
        if (resetFolderBtn) {
            resetFolderBtn.style.display = 'none';
        }

        showToast('Reset to default data/ folder.', 'info');
    }

    /**
     * Get the last scanned tree (used internally for file lookup).
     * @returns {object|null}
     */
    function getLastScannedTree() {
        return _lastScannedTree;
    }

    /**
     * Check if in Open Folder mode.
     * @returns {boolean}
     */
    function isInOpenFolderMode() {
        return isOpenFolderMode;
    }

    return {
        initTheme,
        toggleTheme,
        getTheme,
        updateThemeIcon,
        showToast,
        initResizer,
        initKeyboardShortcuts,
        openFolder,
        tryRestorePersistedFolder,
        resetToDefaultFolder,
        getLastScannedTree,
        isInOpenFolderMode,
        getFileTypeFromExt,
        findFileInTree,
    };
})();
