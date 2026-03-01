/**
 * filesystem-interop.js
 * Blazor JS Interop wrapper for the FileSaver module.
 * Uses the File System Access API to save files back to disk.
 * Provides IndexedDB-based persistence for FileSystemDirectoryHandle
 * so the last opened folder survives page refreshes.
 * Only works in Chromium-based browsers (Chrome, Edge, Opera).
 */
window.FileSystemInterop = (() => {
    let directoryHandle = null;
    let isSupported = false;

    // ===========================
    // IndexedDB for handle persistence
    // ===========================
    const DB_NAME = 'FileViewerDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'handles';
    const DIR_HANDLE_KEY = 'lastDirectoryHandle';
    const LAST_FILE_KEY = 'lastFilePath';

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function idbPut(key, value) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function idbGet(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function idbDelete(key) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Check if the File System Access API is supported.
     * @returns {boolean}
     */
    function checkSupport() {
        isSupported = 'showDirectoryPicker' in window;
        return isSupported;
    }

    /**
     * Request directory access from the user via directory picker.
     * @returns {Promise<boolean>} true if access was granted
     */
    async function requestAccess() {
        if (!isSupported) {
            throw new Error('File System Access API is not supported in this browser.');
        }

        try {
            directoryHandle = await window.showDirectoryPicker({
                id: 'file-viewer-data',
                mode: 'readwrite',
                startIn: 'documents',
            });
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                return false;
            }
            throw error;
        }
    }

    /**
     * Check if we currently have directory access.
     * @returns {boolean}
     */
    function hasAccess() {
        return directoryHandle !== null;
    }

    /**
     * Save content to a file path relative to the granted directory.
     * @param {string} relativePath - e.g., "data/project-alpha/markdown-files/notes.md"
     * @param {string} content - the file content to write
     * @returns {Promise<boolean>}
     */
    async function saveFile(relativePath, content) {
        if (!directoryHandle) {
            throw new Error('No directory access. Please grant folder access first.');
        }

        const pathSegments = relativePath.split('/').filter(Boolean);

        try {
            let currentHandle = directoryHandle;

            // Navigate to the parent directories
            for (let i = 0; i < pathSegments.length - 1; i++) {
                try {
                    currentHandle = await currentHandle.getDirectoryHandle(pathSegments[i]);
                } catch (e) {
                    // If "data" segment fails, skip it (user may have opened the data/ folder directly)
                    if (i === 0 && pathSegments[i] === 'data') {
                        continue;
                    }
                    throw new Error(`Cannot access directory: ${pathSegments.slice(0, i + 1).join('/')}`);
                }
            }

            // Get or create the file
            const fileName = pathSegments[pathSegments.length - 1];
            const fileHandle = await currentHandle.getFileHandle(fileName, { create: false });

            // Write the content
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            return true;
        } catch (error) {
            console.error('FileSystemInterop saveFile error:', error);
            throw error;
        }
    }

    /**
     * Read a file from the granted directory.
     * @param {string} relativePath - file path relative to granted directory
     * @returns {Promise<string>} file content
     */
    async function readFile(relativePath) {
        if (!directoryHandle) {
            throw new Error('No directory access.');
        }

        const pathSegments = relativePath.split('/').filter(Boolean);

        let currentHandle = directoryHandle;
        for (let i = 0; i < pathSegments.length - 1; i++) {
            try {
                currentHandle = await currentHandle.getDirectoryHandle(pathSegments[i]);
            } catch (e) {
                if (i === 0 && pathSegments[i] === 'data') {
                    continue;
                }
                throw e;
            }
        }

        const fileName = pathSegments[pathSegments.length - 1];
        const fileHandle = await currentHandle.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        return await file.text();
    }

    /**
     * Set the directory handle directly (e.g., from Open Folder).
     * @param {FileSystemDirectoryHandle} handle
     */
    function setDirectoryHandle(handle) {
        directoryHandle = handle;
    }

    /**
     * Get the current directory handle.
     * @returns {FileSystemDirectoryHandle|null}
     */
    function getDirectoryHandle() {
        return directoryHandle;
    }

    /**
     * Save content directly using a file handle (no path navigation needed).
     * @param {FileSystemFileHandle} fileHandle - direct handle to the file
     * @param {string} content - the content to write
     * @returns {Promise<boolean>}
     */
    async function saveFileWithHandle(fileHandle, content) {
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
    }

    /**
     * Persist the directory handle to IndexedDB so it survives page refresh.
     * Chrome/Edge support storing FileSystemHandle objects in IndexedDB.
     * @param {FileSystemDirectoryHandle} handle
     */
    async function persistDirectoryHandle(handle) {
        try {
            await idbPut(DIR_HANDLE_KEY, handle);
        } catch (err) {
            console.warn('Failed to persist directory handle:', err);
        }
    }

    /**
     * Retrieve the previously stored directory handle from IndexedDB.
     * @returns {Promise<FileSystemDirectoryHandle|null>}
     */
    async function getPersistedDirectoryHandle() {
        try {
            return await idbGet(DIR_HANDLE_KEY) || null;
        } catch (err) {
            console.warn('Failed to retrieve persisted directory handle:', err);
            return null;
        }
    }

    /**
     * Clear the persisted directory handle (e.g., when resetting to default view).
     */
    async function clearPersistedDirectoryHandle() {
        try {
            await idbDelete(DIR_HANDLE_KEY);
            await idbDelete(LAST_FILE_KEY);
        } catch (err) {
            console.warn('Failed to clear persisted handle:', err);
        }
    }

    /**
     * Persist the last opened file path to IndexedDB.
     * @param {string} filePath
     */
    async function persistLastFilePath(filePath) {
        try {
            await idbPut(LAST_FILE_KEY, filePath);
        } catch (err) {
            console.warn('Failed to persist last file path:', err);
        }
    }

    /**
     * Retrieve the last opened file path from IndexedDB.
     * @returns {Promise<string|null>}
     */
    async function getPersistedLastFilePath() {
        try {
            return await idbGet(LAST_FILE_KEY) || null;
        } catch (err) {
            return null;
        }
    }

    /**
     * Verify that we still have permission for a stored handle.
     * If not, request permission from the user.
     * @param {FileSystemHandle} handle
     * @param {string} mode - 'read' or 'readwrite'
     * @returns {Promise<boolean>} true if permission is granted
     */
    async function verifyPermission(handle, mode) {
        mode = mode || 'readwrite';
        const options = { mode };
        if ((await handle.queryPermission(options)) === 'granted') {
            return true;
        }
        if ((await handle.requestPermission(options)) === 'granted') {
            return true;
        }
        return false;
    }

    /**
     * Save the current markdown content.
     * Gets markdown from MarkdownInterop and saves via handle or path.
     */
    async function saveCurrentMarkdown() {
        if (!window.MarkdownInterop) {
            throw new Error('MarkdownInterop not available.');
        }

        if (!window.MarkdownInterop.hasDirtyChanges()) {
            return false;
        }

        const markdown = window.MarkdownInterop.getMarkdown();
        const fileHandle = window.MarkdownInterop.getFileHandle();

        if (fileHandle) {
            await saveFileWithHandle(fileHandle, markdown);
            window.MarkdownInterop.markClean();
            return true;
        }

        // Fallback: use directory-based path saving
        // Note: getCurrentFilePath is internal to MarkdownInterop; we save via the path if available
        throw new Error('No file handle available. Grant folder access first.');
    }

    /**
     * Save the current CSV content.
     * Gets CSV from ExcelInterop and saves via handle or path.
     */
    async function saveCurrentCSV() {
        if (!window.ExcelInterop) {
            throw new Error('ExcelInterop not available.');
        }

        if (!window.ExcelInterop.hasDirtyChanges()) {
            return false;
        }

        const csvContent = window.ExcelInterop.getCSVContent();
        const fileHandle = window.ExcelInterop.getFileHandle();

        if (fileHandle) {
            await saveFileWithHandle(fileHandle, csvContent);
            window.ExcelInterop.markClean();
            return true;
        }

        throw new Error('No file handle available. Grant folder access first.');
    }

    return {
        checkSupport,
        requestAccess,
        hasAccess,
        saveFile,
        readFile,
        setDirectoryHandle,
        getDirectoryHandle,
        saveFileWithHandle,
        persistDirectoryHandle,
        getPersistedDirectoryHandle,
        clearPersistedDirectoryHandle,
        persistLastFilePath,
        getPersistedLastFilePath,
        verifyPermission,
        saveCurrentMarkdown,
        saveCurrentCSV,
    };
})();
