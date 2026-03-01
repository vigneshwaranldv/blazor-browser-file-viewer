/**
 * pdf-interop.js
 * Blazor JS Interop wrapper for the PdfRenderer module.
 * Renders PDF files using PDF.js with all-pages rendering,
 * navigation, zoom, and scroll tracking.
 */
window.PdfInterop = (() => {
    let pdfDoc = null;
    let currentPage = 1;
    let totalPages = 0;
    let scale = 1.0;
    let rendering = false;
    let scrollTrackingInitialized = false;
    let fileHandle = null;

    // Set PDF.js worker to local file
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/libs/pdf.worker.min.js';
    }

    // ===========================
    // Core Rendering
    // ===========================

    /**
     * Render a PDF file from an ArrayBuffer.
     * @param {ArrayBuffer} data - the PDF as ArrayBuffer
     */
    async function render(data) {
        const viewer = document.getElementById('pdf-viewer');
        viewer.innerHTML = '';
        currentPage = 1;
        scale = 1.0;

        try {
            const loadingTask = pdfjsLib.getDocument({ data: data });
            pdfDoc = await loadingTask.promise;
            totalPages = pdfDoc.numPages;

            updatePageInfo();
            updateZoomLevel();

            // Set up scroll tracking if not already done
            if (!scrollTrackingInitialized) {
                setupScrollTracking();
                scrollTrackingInitialized = true;
            }

            // Fit to width by default
            await fitWidth();

        } catch (error) {
            console.error('PDF render error:', error);
            viewer.innerHTML = `
                <div style="padding:24px;color:#d73a49;background:white;border-radius:4px;margin:16px;">
                    <strong>Error loading PDF:</strong> ${error.message}
                </div>
            `;
        }
    }

    /**
     * Fetch and render a PDF from a URL.
     * @param {string} url - URL to fetch the PDF from
     */
    async function renderFromUrl(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.arrayBuffer();
        await render(data);
    }

    /**
     * Render from a stored file handle (Open Folder mode).
     */
    async function renderFromHandle() {
        if (!fileHandle) {
            throw new Error('No file handle set. Call setFileHandle first.');
        }
        const file = await fileHandle.getFile();
        const data = await file.arrayBuffer();
        await render(data);
    }

    /**
     * Render all pages at current scale.
     */
    async function renderAllPages() {
        if (!pdfDoc || rendering) return;
        rendering = true;

        const viewer = document.getElementById('pdf-viewer');
        viewer.innerHTML = '';

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            try {
                const page = await pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: scale });

                const canvas = document.createElement('canvas');
                canvas.className = 'pdf-page-canvas';
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.dataset.pageNum = pageNum;

                viewer.appendChild(canvas);

                const ctx = canvas.getContext('2d');
                await page.render({
                    canvasContext: ctx,
                    viewport: viewport,
                }).promise;
            } catch (err) {
                console.error(`Error rendering page ${pageNum}:`, err);
            }
        }

        rendering = false;
    }

    /**
     * Fit the PDF to the viewer width.
     */
    async function fitWidth() {
        if (!pdfDoc) return;

        const viewer = document.getElementById('pdf-viewer');
        const page = await pdfDoc.getPage(1);
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        // Account for padding
        const availableWidth = viewer.clientWidth - 32;
        scale = availableWidth / unscaledViewport.width;

        // Clamp scale
        scale = Math.max(0.25, Math.min(scale, 3.0));

        updateZoomLevel();
        await renderAllPages();
    }

    // ===========================
    // Navigation
    // ===========================

    /**
     * Navigate to a specific page (scroll to it).
     */
    function goToPage(pageNum) {
        if (pageNum < 1 || pageNum > totalPages) return;
        currentPage = pageNum;
        updatePageInfo();

        const viewer = document.getElementById('pdf-viewer');
        const canvas = viewer.querySelector(`canvas[data-page-num="${pageNum}"]`);
        if (canvas) {
            canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Go to next page.
     */
    function nextPage() {
        if (currentPage < totalPages) {
            goToPage(currentPage + 1);
        }
    }

    /**
     * Go to previous page.
     */
    function prevPage() {
        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }
    }

    // ===========================
    // Zoom
    // ===========================

    /**
     * Zoom in by 25%.
     */
    async function zoomIn() {
        scale = Math.min(scale + 0.25, 3.0);
        updateZoomLevel();
        await renderAllPages();
    }

    /**
     * Zoom out by 25%.
     */
    async function zoomOut() {
        scale = Math.max(scale - 0.25, 0.25);
        updateZoomLevel();
        await renderAllPages();
    }

    // ===========================
    // UI Updates
    // ===========================

    /**
     * Update page info display.
     */
    function updatePageInfo() {
        const pageInfo = document.getElementById('pdf-page-info');
        if (pageInfo) {
            pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;
        }
    }

    /**
     * Update zoom level display.
     */
    function updateZoomLevel() {
        const zoomLevel = document.getElementById('pdf-zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = `${Math.round(scale * 100)}%`;
        }
    }

    /**
     * Track current visible page on scroll.
     */
    function setupScrollTracking() {
        const viewer = document.getElementById('pdf-viewer');
        if (!viewer) return;

        viewer.addEventListener('scroll', () => {
            const canvases = viewer.querySelectorAll('canvas');
            const viewerRect = viewer.getBoundingClientRect();
            const viewerMiddle = viewerRect.top + viewerRect.height / 3;

            for (const canvas of canvases) {
                const rect = canvas.getBoundingClientRect();
                if (rect.top <= viewerMiddle && rect.bottom >= viewerMiddle) {
                    const pageNum = parseInt(canvas.dataset.pageNum);
                    if (pageNum !== currentPage) {
                        currentPage = pageNum;
                        updatePageInfo();
                    }
                    break;
                }
            }
        });
    }

    // ===========================
    // File Handle
    // ===========================

    /**
     * Set the file handle (for Open Folder mode).
     * @param {FileSystemFileHandle} handle
     */
    function setFileHandle(handle) {
        fileHandle = handle;
    }

    /**
     * Get the file handle.
     * @returns {FileSystemFileHandle|null}
     */
    function getFileHandle() {
        return fileHandle;
    }

    // ===========================
    // Cleanup
    // ===========================

    /**
     * Destroy / cleanup.
     */
    function destroy() {
        if (pdfDoc) {
            pdfDoc.destroy();
            pdfDoc = null;
        }
        currentPage = 1;
        totalPages = 0;
        scale = 1.0;
        rendering = false;
        fileHandle = null;
        const viewer = document.getElementById('pdf-viewer');
        if (viewer) viewer.innerHTML = '';
    }

    return {
        render,
        renderFromUrl,
        renderFromHandle,
        renderAllPages,
        nextPage,
        prevPage,
        zoomIn,
        zoomOut,
        fitWidth,
        goToPage,
        setFileHandle,
        getFileHandle,
        destroy,
    };
})();
