/**
 * nav-tree-interop.js
 * Blazor JS Interop wrapper for the NavTree module.
 * Renders a collapsible folder/file tree from manifest.json or a
 * FileSystemDirectoryHandle. Notifies Blazor via DotNetObjectReference
 * when files are selected.
 */
window.NavTreeInterop = (() => {
    let treeContainer = null;
    let selectedElement = null;
    let _dotNetRef = null;

    // SVG Icons
    const icons = {
        chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,6 15,12 9,18"/></svg>`,
        folder: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>`,
        folderOpen: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v1H7.5a2 2 0 00-1.8 1.1L2 18V6z"/><path d="M4 20h16.5a1 1 0 00.95-.68l2.5-8A1 1 0 0023 10H7.5a1 1 0 00-.95.68l-2.5 8A1 1 0 005 20z" opacity="0.7"/></svg>`,
        markdown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M8 13h2l1 2 2-4 1 2h2" stroke-width="1.5"/></svg>`,
        excel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><rect x="8" y="12" width="8" height="6" rx="1" stroke-width="1.5"/><line x1="12" y1="12" x2="12" y2="18" stroke-width="1.5"/><line x1="8" y1="15" x2="16" y2="15" stroke-width="1.5"/></svg>`,
        pdf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><text x="8" y="17" font-size="7" font-weight="bold" fill="currentColor" stroke="none" font-family="sans-serif">PDF</text></svg>`,
        csv: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><text x="7" y="17" font-size="7" font-weight="bold" fill="currentColor" stroke="none" font-family="sans-serif">CSV</text></svg>`,
    };

    /**
     * Get file icon and CSS class based on file extension.
     */
    function getFileIconInfo(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        switch (ext) {
            case 'md':
                return { icon: icons.markdown, cssClass: 'file-icon-md' };
            case 'xlsx':
            case 'xls':
                return { icon: icons.excel, cssClass: 'file-icon-excel' };
            case 'pdf':
                return { icon: icons.pdf, cssClass: 'file-icon-pdf' };
            case 'csv':
                return { icon: icons.csv, cssClass: 'file-icon-csv' };
            default:
                return { icon: icons.markdown, cssClass: '' };
        }
    }

    /**
     * Get file type category from parent folder name.
     */
    function getFileType(subdir) {
        switch (subdir) {
            case 'markdown-files': return 'markdown';
            case 'excel-files': return 'excel';
            case 'pdf-files': return 'pdf';
            default: return 'unknown';
        }
    }

    /**
     * Determine file type from extension.
     * @param {string} filename
     * @returns {string|null}
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
     * Create a folder tree item (expandable).
     */
    function createFolderItem(name, indent, isExpanded) {
        isExpanded = isExpanded !== undefined ? isExpanded : true;
        const item = document.createElement('div');
        item.className = `tree-item tree-indent-${indent}`;
        item.innerHTML = `
            <span class="tree-chevron ${isExpanded ? 'expanded' : ''}">${icons.chevron}</span>
            <span class="tree-icon file-icon-folder">${isExpanded ? icons.folderOpen : icons.folder}</span>
            <span class="tree-label">${name}</span>
        `;
        return item;
    }

    /**
     * Create a file tree item (clickable).
     */
    function createFileItem(filename, filePath, fileType, indent) {
        const { icon, cssClass } = getFileIconInfo(filename);
        const item = document.createElement('div');
        item.className = `tree-item tree-indent-${indent}`;
        item.dataset.filePath = filePath;
        item.dataset.fileType = fileType;
        item.dataset.fileName = filename;
        item.innerHTML = `
            <span class="tree-icon ${cssClass}">${icon}</span>
            <span class="tree-label">${filename}</span>
        `;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectFile(item);
        });

        return item;
    }

    /**
     * Handle file selection. Notifies Blazor via _dotNetRef.
     */
    function selectFile(element) {
        // Deselect previous
        if (selectedElement) {
            selectedElement.classList.remove('selected');
        }

        // Select new
        element.classList.add('selected');
        selectedElement = element;

        // Notify .NET callback
        if (_dotNetRef) {
            _dotNetRef.invokeMethodAsync('OnFileSelected', {
                path: element.dataset.filePath,
                type: element.dataset.fileType,
                name: element.dataset.fileName,
                hasHandle: !!element._fileHandle,
            });
        }
    }

    /**
     * Toggle folder expand/collapse.
     */
    function toggleFolder(folderItem, childrenContainer) {
        const chevron = folderItem.querySelector('.tree-chevron');
        const iconSpan = folderItem.querySelector('.tree-icon');
        const isCollapsed = childrenContainer.classList.contains('collapsed');

        if (isCollapsed) {
            childrenContainer.classList.remove('collapsed');
            chevron.classList.add('expanded');
            iconSpan.innerHTML = icons.folderOpen;
        } else {
            childrenContainer.classList.add('collapsed');
            chevron.classList.remove('expanded');
            iconSpan.innerHTML = icons.folder;
        }
    }

    /**
     * Render the tree from manifest data.
     */
    function renderTree(manifest) {
        treeContainer.innerHTML = '';

        if (!manifest.folders || manifest.folders.length === 0) {
            treeContainer.innerHTML = '<div style="padding:16px;color:#586069;font-size:13px;">No files found in data/ directory.</div>';
            return;
        }

        manifest.folders.forEach(folder => {
            // Project folder
            const projectItem = createFolderItem(folder.name, 0, true);
            const projectChildren = document.createElement('div');
            projectChildren.className = 'tree-children';

            projectItem.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFolder(projectItem, projectChildren);
            });

            treeContainer.appendChild(projectItem);

            // Sub-folders (markdown-files, excel-files, pdf-files)
            const subdirOrder = ['markdown-files', 'excel-files', 'pdf-files'];
            subdirOrder.forEach(subdir => {
                const files = folder.children[subdir];
                if (!files || files.length === 0) return;

                const subdirItem = createFolderItem(subdir, 1, true);
                const subdirChildren = document.createElement('div');
                subdirChildren.className = 'tree-children';

                subdirItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFolder(subdirItem, subdirChildren);
                });

                projectChildren.appendChild(subdirItem);

                // Files
                const fileType = getFileType(subdir);
                files.forEach(filename => {
                    const filePath = `${folder.path}/${subdir}/${filename}`;
                    const fileItem = createFileItem(filename, filePath, fileType, 2);
                    subdirChildren.appendChild(fileItem);
                });

                projectChildren.appendChild(subdirChildren);
            });

            treeContainer.appendChild(projectChildren);
        });
    }

    /**
     * Initialize the nav tree from manifest.json.
     * @param {string} containerId - DOM element ID for the tree container
     * @param {object} dotNetRef - DotNetObjectReference for callbacks
     */
    async function initFromManifest(containerId, dotNetRef) {
        treeContainer = document.getElementById(containerId);
        _dotNetRef = dotNetRef;

        try {
            const response = await fetch('data/manifest.json');
            if (!response.ok) {
                throw new Error(`Failed to load manifest: ${response.status}`);
            }
            const manifest = await response.json();
            renderTree(manifest);
        } catch (error) {
            console.error('NavTreeInterop initFromManifest error:', error);
            treeContainer.innerHTML = `
                <div style="padding:16px;color:#d73a49;font-size:13px;">
                    Failed to load file tree.<br>
                    <small>Run <code>python generate-manifest.py</code> to generate the manifest.</small>
                </div>
            `;
        }
    }

    /**
     * Recursively scan a directory handle and build folder/file lists.
     */
    async function scanDirectoryHandle(dirHandle, basePath) {
        const folders = [];
        const files = [];

        for await (const [name, handle] of dirHandle) {
            if (name.startsWith('.')) continue;
            if (handle.kind === 'directory') {
                folders.push({ name, handle });
            } else if (handle.kind === 'file') {
                files.push({ name, handle });
            }
        }

        // Sort
        folders.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => a.name.localeCompare(b.name));

        return { folders, files, basePath };
    }

    /**
     * Recursively render a directory handle into the tree.
     */
    async function renderDirRecursive(dirHandle, path, indent, parentEl) {
        const { folders, files } = await scanDirectoryHandle(dirHandle, path);

        // If this is the first call (indent=0), clear loading text
        if (indent === 0) {
            parentEl.innerHTML = '';
        }

        // Render subfolders first
        for (const folder of folders) {
            const folderItem = createFolderItem(folder.name, indent, false);
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children collapsed';

            let loaded = false;

            folderItem.addEventListener('click', async (e) => {
                e.stopPropagation();
                // Lazy load children on first expand
                if (!loaded) {
                    loaded = true;
                    await renderDirRecursive(folder.handle, `${path}/${folder.name}`, indent + 1, childrenContainer);
                    if (childrenContainer.children.length === 0) {
                        childrenContainer.innerHTML = `<div class="tree-item tree-indent-${indent + 1}" style="color:var(--color-text-secondary);font-size:12px;cursor:default;">(empty)</div>`;
                    }
                }
                toggleFolder(folderItem, childrenContainer);
            });

            parentEl.appendChild(folderItem);
            parentEl.appendChild(childrenContainer);
        }

        // Render supported files
        for (const file of files) {
            const fileType = getFileTypeFromExt(file.name);
            if (!fileType) continue; // Skip unsupported file types

            const filePath = `${path}/${file.name}`;
            const { icon, cssClass } = getFileIconInfo(file.name);

            const item = document.createElement('div');
            item.className = `tree-item tree-indent-${indent}`;
            item.dataset.filePath = filePath;
            item.dataset.fileType = fileType;
            item.dataset.fileName = file.name;
            // Store the handle reference on the element
            item._fileHandle = file.handle;
            item.innerHTML = `
                <span class="tree-icon ${cssClass}">${icon}</span>
                <span class="tree-label">${file.name}</span>
            `;

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                // Deselect previous
                if (selectedElement) {
                    selectedElement.classList.remove('selected');
                }
                item.classList.add('selected');
                selectedElement = item;

                if (_dotNetRef) {
                    _dotNetRef.invokeMethodAsync('OnFileSelected', {
                        path: filePath,
                        type: fileType,
                        name: file.name,
                        hasHandle: true,
                    });
                }
            });

            parentEl.appendChild(item);
        }
    }

    /**
     * Render the nav tree from a FileSystemDirectoryHandle (lazy loading).
     * @param {FileSystemDirectoryHandle} dirHandle - the picked directory
     * @param {object} dotNetRef - DotNetObjectReference for callbacks
     */
    async function renderFromDirectoryHandle(dirHandle, dotNetRef) {
        _dotNetRef = dotNetRef;

        if (!treeContainer) {
            treeContainer = document.getElementById('nav-tree');
        }
        treeContainer.innerHTML = '';

        // Show a loading indicator
        treeContainer.innerHTML = '<div style="padding:16px;color:var(--color-text-secondary);font-size:13px;">Scanning folder...</div>';

        try {
            await renderDirRecursive(dirHandle, dirHandle.name, 0, treeContainer);
        } catch (error) {
            console.error('Error scanning directory:', error);
            treeContainer.innerHTML = `
                <div style="padding:16px;color:var(--color-danger);font-size:13px;">
                    Failed to scan folder: ${error.message}
                </div>
            `;
        }
    }

    /**
     * Recursively render a tree node for pre-scanned tree data.
     */
    function renderTreeNode(node, indent, parentEl) {
        if (node.type === 'folder') {
            const folderItem = createFolderItem(node.name, indent, indent === 0);
            const childrenContainer = document.createElement('div');
            childrenContainer.className = `tree-children ${indent === 0 ? '' : 'collapsed'}`;

            folderItem.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFolder(folderItem, childrenContainer);
            });

            parentEl.appendChild(folderItem);

            if (node.children) {
                for (const child of node.children) {
                    renderTreeNode(child, indent + 1, childrenContainer);
                }
            }

            parentEl.appendChild(childrenContainer);
        } else if (node.type === 'file') {
            const fileType = getFileTypeFromExt(node.name);
            if (!fileType) return;

            const { icon, cssClass } = getFileIconInfo(node.name);
            const item = document.createElement('div');
            item.className = `tree-item tree-indent-${indent}`;
            item.dataset.filePath = node.path;
            item.dataset.fileType = fileType;
            item.dataset.fileName = node.name;
            item.innerHTML = `
                <span class="tree-icon ${cssClass}">${icon}</span>
                <span class="tree-label">${node.name}</span>
            `;

            // Store the handle reference on the element if available
            if (node.handle) {
                item._fileHandle = node.handle;
            }

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (selectedElement) {
                    selectedElement.classList.remove('selected');
                }
                item.classList.add('selected');
                selectedElement = item;

                if (_dotNetRef) {
                    _dotNetRef.invokeMethodAsync('OnFileSelected', {
                        path: node.path,
                        type: fileType,
                        name: node.name,
                        hasHandle: !!node.handle,
                    });
                }
            });

            parentEl.appendChild(item);
        }
    }

    /**
     * Render a pre-scanned tree structure into the nav tree.
     * @param {object} tree - the scanned tree node { name, path, type, handle, children }
     * @param {object} dotNetRef - DotNetObjectReference for callbacks
     */
    function renderFromOpenFolder(tree, dotNetRef) {
        _dotNetRef = dotNetRef;
        selectedElement = null;

        if (!treeContainer) {
            treeContainer = document.getElementById('nav-tree');
        }
        treeContainer.innerHTML = '';

        renderTreeNode(tree, 0, treeContainer);
    }

    /**
     * Highlight a specific file by path in the nav tree.
     * @param {string} filePath
     */
    function highlightFile(filePath) {
        if (!treeContainer) return;
        const item = treeContainer.querySelector(`[data-file-path="${filePath}"]`);
        if (item) {
            // Deselect previous
            if (selectedElement) {
                selectedElement.classList.remove('selected');
            }
            item.classList.add('selected');
            selectedElement = item;
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    return {
        initFromManifest,
        renderFromDirectoryHandle,
        renderFromOpenFolder,
        highlightFile,
        getFileTypeFromExt,
    };
})();
