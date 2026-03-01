/**
 * excel-interop.js
 * Blazor JS Interop wrapper for the ExcelRenderer module.
 * Renders .xlsx and .csv files as HTML tables using SheetJS.
 * CSV files are editable inline; XLSX files are read-only.
 */
window.ExcelInterop = (() => {
    let currentWorkbook = null;
    let currentSheetIndex = 0;

    // CSV editing state
    let isCSV = false;
    let isDirty = false;
    let _dotNetRef = null;
    let fileHandle = null;
    let currentFilePath = null;

    // ===========================
    // Core Rendering
    // ===========================

    /**
     * Render an Excel or CSV file from an ArrayBuffer.
     * @param {ArrayBuffer} data - file content as ArrayBuffer
     * @param {string} filename - the file name (to detect csv)
     * @param {string} [filePath] - optional file path for saving
     */
    function render(data, filename, filePath) {
        const ext = filename.split('.').pop().toLowerCase();
        const tabsContainer = document.getElementById('excel-sheet-tabs');
        const tableWrapper = document.getElementById('excel-table-wrapper');

        // Reset editing state
        isCSV = ext === 'csv';
        isDirty = false;
        fileHandle = null;
        currentFilePath = filePath || null;

        try {
            // Parse the workbook
            if (isCSV) {
                const decoder = new TextDecoder('utf-8');
                const csvString = decoder.decode(data);
                currentWorkbook = XLSX.read(csvString, { type: 'string' });
            } else {
                currentWorkbook = XLSX.read(data, { type: 'array' });
            }

            currentSheetIndex = 0;

            // Render sheet tabs
            renderSheetTabs(tabsContainer);

            // Render the first sheet
            renderSheet(currentSheetIndex, tableWrapper);
        } catch (error) {
            console.error('Excel render error:', error);
            tableWrapper.innerHTML = `
                <div style="padding:24px;color:#d73a49;">
                    <strong>Error loading file:</strong> ${error.message}
                </div>
            `;
            tabsContainer.innerHTML = '';
        }
    }

    /**
     * Fetch and render an Excel/CSV file from a URL.
     * @param {string} url - URL to fetch the file from
     * @param {string} filename - the file name
     * @param {string} [filePath] - optional file path for saving
     */
    async function renderFromUrl(url, filename, filePath) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.arrayBuffer();
        render(data, filename, filePath);
    }

    /**
     * Render from a stored file handle (Open Folder mode).
     * @param {string} filename - the file name
     * @param {string} [filePath] - optional file path
     */
    async function renderFromHandle(filename, filePath) {
        if (!fileHandle) {
            throw new Error('No file handle set. Call setFileHandle first.');
        }
        const file = await fileHandle.getFile();
        const data = await file.arrayBuffer();
        render(data, filename, filePath);
    }

    // ===========================
    // Sheet Tabs
    // ===========================

    /**
     * Render sheet tabs.
     */
    function renderSheetTabs(container) {
        container.innerHTML = '';

        if (!currentWorkbook) return;

        const sheetNames = currentWorkbook.SheetNames;

        // Only show tabs if there are multiple sheets
        if (sheetNames.length <= 1) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';

        sheetNames.forEach((name, index) => {
            const tab = document.createElement('div');
            tab.className = `sheet-tab ${index === currentSheetIndex ? 'active' : ''}`;
            tab.textContent = name;
            tab.addEventListener('click', () => {
                currentSheetIndex = index;
                // Update active tab
                container.querySelectorAll('.sheet-tab').forEach((t, i) => {
                    t.classList.toggle('active', i === index);
                });
                renderSheet(index, document.getElementById('excel-table-wrapper'));
            });
            container.appendChild(tab);
        });
    }

    // ===========================
    // Sheet Rendering
    // ===========================

    /**
     * Render a specific sheet as an HTML table.
     */
    function renderSheet(sheetIndex, container) {
        if (!currentWorkbook) return;

        const sheetName = currentWorkbook.SheetNames[sheetIndex];
        const sheet = currentWorkbook.Sheets[sheetName];

        // Convert to array of arrays
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (jsonData.length === 0) {
            container.innerHTML = '<div style="padding:24px;color:#586069;">This sheet is empty.</div>';
            return;
        }

        // Build the HTML table
        const table = document.createElement('table');
        table.className = 'excel-table';
        if (isCSV) {
            table.classList.add('csv-editable');
        }

        // Determine max columns
        let maxCols = 0;
        jsonData.forEach(row => {
            if (row.length > maxCols) maxCols = row.length;
        });

        // Use first row as header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        // Row number header
        const rowNumHeader = document.createElement('th');
        rowNumHeader.className = 'row-num';
        rowNumHeader.textContent = '#';
        headerRow.appendChild(rowNumHeader);

        // Column headers from first row data
        const firstRow = jsonData[0];
        for (let col = 0; col < maxCols; col++) {
            const th = document.createElement('th');
            th.textContent = firstRow[col] !== undefined ? firstRow[col] : '';
            if (isCSV) {
                th.setAttribute('contenteditable', 'true');
                th.setAttribute('spellcheck', 'false');
            }
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Data rows (skip header row)
        const tbody = document.createElement('tbody');
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            const tr = document.createElement('tr');

            // Row number
            const rowNumCell = document.createElement('td');
            rowNumCell.className = 'row-num';
            rowNumCell.textContent = i;
            tr.appendChild(rowNumCell);

            for (let col = 0; col < maxCols; col++) {
                const td = document.createElement('td');
                const value = row[col] !== undefined ? row[col] : '';
                td.textContent = value;

                if (isCSV) {
                    td.setAttribute('contenteditable', 'true');
                    td.setAttribute('spellcheck', 'false');
                } else {
                    // XLSX: read-only, format numbers
                    if (typeof value === 'number') {
                        td.style.textAlign = 'right';
                        td.style.fontFamily = 'var(--font-mono)';
                        td.textContent = value.toLocaleString();
                    }
                }

                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        container.innerHTML = '';
        container.appendChild(table);

        // Set up editing event listeners for CSV
        if (isCSV) {
            setupEditingListeners(table);
        }
    }

    // ===========================
    // CSV Editing
    // ===========================

    /**
     * Set up event listeners for CSV inline editing.
     */
    function setupEditingListeners(table) {
        // Track dirty state via input events (fires on contenteditable changes)
        table.addEventListener('input', () => {
            if (!isDirty) {
                isDirty = true;
                if (_dotNetRef) {
                    _dotNetRef.invokeMethodAsync('OnDirtyChanged', true);
                }
            }
        });

        // Strip rich HTML on paste — insert plain text only
        table.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });

        // Prevent Enter from creating <br>/<div> — move to next row instead
        table.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const cell = e.target;
                if (cell.tagName === 'TD' || cell.tagName === 'TH') {
                    const row = cell.parentElement;
                    const cellIndex = Array.from(row.children).indexOf(cell);
                    const nextRow = row.closest('thead') ?
                        table.querySelector('tbody tr') :
                        row.nextElementSibling;
                    if (nextRow && nextRow.children[cellIndex]) {
                        nextRow.children[cellIndex].focus();
                    }
                }
            }
            // Tab moves to next cell
            if (e.key === 'Tab') {
                e.preventDefault();
                const cell = e.target;
                if (cell.tagName === 'TD' || cell.tagName === 'TH') {
                    const next = e.shiftKey ? getPrevEditableCell(cell) : getNextEditableCell(cell);
                    if (next) next.focus();
                }
            }
        });
    }

    /**
     * Get the next editable cell in the table.
     */
    function getNextEditableCell(cell) {
        let next = cell.nextElementSibling;
        while (next && next.classList.contains('row-num')) {
            next = next.nextElementSibling;
        }
        if (next) return next;

        const row = cell.parentElement;
        let nextRow = row.closest('thead') ?
            cell.closest('table').querySelector('tbody tr') :
            row.nextElementSibling;
        if (nextRow) {
            return nextRow.children[1] || null;
        }
        return null;
    }

    /**
     * Get the previous editable cell in the table.
     */
    function getPrevEditableCell(cell) {
        let prev = cell.previousElementSibling;
        while (prev && prev.classList.contains('row-num')) {
            prev = prev.previousElementSibling;
        }
        if (prev) return prev;

        const row = cell.parentElement;
        let prevRow = row.previousElementSibling;
        if (!prevRow && row.closest('tbody')) {
            const thead = cell.closest('table').querySelector('thead tr');
            if (thead) prevRow = thead;
        }
        if (prevRow) {
            return prevRow.lastElementChild || null;
        }
        return null;
    }

    /**
     * Escape a CSV field value per RFC 4180.
     */
    function escapeCSVField(value) {
        if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
            return '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
    }

    /**
     * Read the current HTML table DOM back into a CSV string.
     * @returns {string}
     */
    function getCSVContent() {
        const table = document.querySelector('#excel-table-wrapper .excel-table');
        if (!table) return '';

        const rows = [];

        // Header row (skip first th which is the row-number "#")
        const headerCells = table.querySelectorAll('thead th');
        const headerRow = [];
        for (let i = 1; i < headerCells.length; i++) {
            headerRow.push(escapeCSVField(headerCells[i].textContent));
        }
        rows.push(headerRow.join(','));

        // Data rows (skip first td which is the row-number)
        const bodyRows = table.querySelectorAll('tbody tr');
        bodyRows.forEach(tr => {
            const cells = tr.querySelectorAll('td');
            const rowData = [];
            for (let i = 1; i < cells.length; i++) {
                rowData.push(escapeCSVField(cells[i].textContent));
            }
            rows.push(rowData.join(','));
        });

        return rows.join('\n') + '\n';
    }

    // ===========================
    // State Accessors
    // ===========================

    /**
     * Check if the current file is editable (CSV).
     * @returns {boolean}
     */
    function isEditable() {
        return isCSV;
    }

    /**
     * Check if there are unsaved changes.
     * @returns {boolean}
     */
    function hasDirtyChanges() {
        return isDirty;
    }

    /**
     * Mark changes as saved.
     */
    function markClean() {
        isDirty = false;
        if (_dotNetRef) {
            _dotNetRef.invokeMethodAsync('OnDirtyChanged', false);
        }
    }

    /**
     * Register a DotNetObjectReference for dirty-change callbacks.
     * Blazor will be notified via dotNetRef.invokeMethodAsync('OnDirtyChanged', isDirty).
     * @param {object} dotNetRef
     */
    function onDirtyChange(dotNetRef) {
        _dotNetRef = dotNetRef;
    }

    /**
     * Get the file handle (for Open Folder mode saving).
     * @returns {FileSystemFileHandle|null}
     */
    function getFileHandle() {
        return fileHandle;
    }

    /**
     * Set the file handle (for Open Folder mode saving).
     * @param {FileSystemFileHandle} handle
     */
    function setFileHandle(handle) {
        fileHandle = handle;
    }

    /**
     * Get the current file path.
     * @returns {string|null}
     */
    function getCurrentFilePath() {
        return currentFilePath;
    }

    /**
     * Destroy / cleanup.
     */
    function destroy() {
        currentWorkbook = null;
        currentSheetIndex = 0;
        isCSV = false;
        isDirty = false;
        fileHandle = null;
        currentFilePath = null;
        const tabsContainer = document.getElementById('excel-sheet-tabs');
        const tableWrapper = document.getElementById('excel-table-wrapper');
        if (tabsContainer) tabsContainer.innerHTML = '';
        if (tableWrapper) tableWrapper.innerHTML = '';
    }

    return {
        render,
        renderFromUrl,
        renderFromHandle,
        isEditable,
        hasDirtyChanges,
        markClean,
        onDirtyChange,
        getFileHandle,
        setFileHandle,
        getCurrentFilePath,
        getCSVContent,
        destroy,
    };
})();
