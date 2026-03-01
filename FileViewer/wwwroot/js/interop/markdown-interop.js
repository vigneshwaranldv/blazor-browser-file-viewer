/**
 * markdown-interop.js
 * Blazor JS Interop wrapper for the MarkdownRenderer module.
 * WYSIWYG Markdown editor using Toast UI Editor.
 * Supports checkboxes, radio buttons, text inputs via HTML embedding.
 * Supports Mermaid diagram rendering in Markdown preview mode.
 */
window.MarkdownInterop = (() => {
    let editor = null;
    let currentFilePath = null;
    let isDirty = false;
    let _dotNetRef = null;
    let fileHandle = null;
    let mermaidPreviewObserver = null;
    let mermaidRenderCounter = 0;

    const container = 'markdown-editor';

    // ===========================
    // Mermaid Integration
    // ===========================

    /**
     * Initialize Mermaid.js with the appropriate theme.
     */
    function initMermaid() {
        if (typeof mermaid === 'undefined') return;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'loose',
            fontFamily: 'inherit',
        });
    }

    /**
     * Re-initialize Mermaid with a new theme (called on theme toggle).
     * Clears previously rendered diagrams and re-renders them with the new theme.
     */
    function reinitMermaidTheme() {
        initMermaid();
        clearRenderedMermaidDiagrams();
        renderMermaidInPreview();
    }

    /**
     * Remove all rendered mermaid diagram wrappers and un-hide the original
     * <pre> code blocks so they can be re-rendered with the new theme.
     */
    function clearRenderedMermaidDiagrams() {
        const previewPane = findPreviewPane();
        if (!previewPane) return;

        // Remove rendered diagram wrappers
        previewPane.querySelectorAll('.mermaid-diagram').forEach(el => el.remove());

        // Un-hide and un-mark original <pre> blocks
        previewPane.querySelectorAll('pre[data-mermaid-rendered="true"]').forEach(pre => {
            pre.style.display = '';
            delete pre.dataset.mermaidRendered;
        });
    }

    /**
     * Find the markdown preview pane. TUI Editor can nest it in different ways
     * depending on the version. Try multiple selectors.
     */
    function findPreviewPane() {
        let pane = document.querySelector('.toastui-editor-md-preview .toastui-editor-contents');
        if (pane) return pane;

        pane = document.querySelector('.toastui-editor-md-preview');
        if (pane) return pane;

        return null;
    }

    /**
     * Find mermaid code blocks in the given container.
     * Tries multiple selector strategies to be robust across TUI Editor versions.
     */
    function findMermaidCodeBlocks(containerEl) {
        const results = [];
        const seen = new Set();

        // Strategy 1: code element with class="language-mermaid"
        containerEl.querySelectorAll('pre > code.language-mermaid').forEach(el => {
            if (!seen.has(el.parentElement)) {
                seen.add(el.parentElement);
                results.push({ pre: el.parentElement, code: el });
            }
        });

        // Strategy 2: code element with class containing "lang-mermaid"
        containerEl.querySelectorAll('pre > code[class*="lang-mermaid"]').forEach(el => {
            if (!seen.has(el.parentElement)) {
                seen.add(el.parentElement);
                results.push({ pre: el.parentElement, code: el });
            }
        });

        // Strategy 3: code element with data-language="mermaid"
        containerEl.querySelectorAll('pre > code[data-language="mermaid"]').forEach(el => {
            if (!seen.has(el.parentElement)) {
                seen.add(el.parentElement);
                results.push({ pre: el.parentElement, code: el });
            }
        });

        // Strategy 4: pre element with data-language="mermaid"
        containerEl.querySelectorAll('pre[data-language="mermaid"]').forEach(pre => {
            if (!seen.has(pre)) {
                seen.add(pre);
                const code = pre.querySelector('code') || pre;
                results.push({ pre: pre, code: code });
            }
        });

        // Strategy 5: Scan all <pre><code> blocks and check if first line looks like mermaid
        const mermaidKeywords = /^\s*(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram)\b/;
        containerEl.querySelectorAll('pre > code').forEach(codeEl => {
            if (!seen.has(codeEl.parentElement)) {
                const text = codeEl.textContent.trim();
                if (mermaidKeywords.test(text)) {
                    seen.add(codeEl.parentElement);
                    results.push({ pre: codeEl.parentElement, code: codeEl });
                }
            }
        });

        // Strategy 6: Also check <pre> without <code> children
        containerEl.querySelectorAll('pre').forEach(pre => {
            if (!seen.has(pre) && !pre.querySelector('code')) {
                const text = pre.textContent.trim();
                if (mermaidKeywords.test(text)) {
                    seen.add(pre);
                    results.push({ pre: pre, code: pre });
                }
            }
        });

        return results;
    }

    /**
     * Find mermaid code blocks in the Markdown preview pane and render them.
     */
    function renderMermaidInPreview() {
        if (typeof mermaid === 'undefined') return;

        const previewPane = findPreviewPane();
        if (!previewPane) return;

        const blocks = findMermaidCodeBlocks(previewPane);
        if (blocks.length === 0) return;

        blocks.forEach(({ pre, code }, index) => {
            // Skip if already rendered
            if (pre.dataset.mermaidRendered === 'true') return;

            const mermaidSource = code.textContent.trim();
            if (!mermaidSource) return;

            // Mark as rendered immediately to prevent duplicate attempts
            pre.dataset.mermaidRendered = 'true';

            // Create a wrapper div for the rendered diagram
            const wrapper = document.createElement('div');
            wrapper.className = 'mermaid-diagram';
            mermaidRenderCounter++;
            const diagramId = `mermaid-d-${mermaidRenderCounter}`;

            try {
                mermaid.render(diagramId, mermaidSource).then(({ svg }) => {
                    wrapper.innerHTML = svg;
                    pre.style.display = 'none';
                    pre.insertAdjacentElement('afterend', wrapper);
                }).catch((err) => {
                    console.warn('Mermaid render error for block', index, ':', err);
                    wrapper.className = 'mermaid-diagram mermaid-error';
                    wrapper.textContent = 'Mermaid diagram error: ' + (err.message || String(err));
                    pre.style.display = 'none';
                    pre.insertAdjacentElement('afterend', wrapper);
                });
            } catch (err) {
                console.warn('Mermaid render error (sync) for block', index, ':', err);
                wrapper.className = 'mermaid-diagram mermaid-error';
                wrapper.textContent = 'Mermaid diagram error: ' + (err.message || String(err));
                pre.style.display = 'none';
                pre.insertAdjacentElement('afterend', wrapper);
            }
        });
    }

    /**
     * Attempt to render mermaid in preview pane with retries.
     * When switching to markdown mode, the preview pane content may not be
     * fully rendered yet.
     */
    function renderMermaidWithRetry(retries, delay) {
        if (retries <= 0) return;
        setTimeout(() => {
            const previewPane = findPreviewPane();
            if (!previewPane) {
                renderMermaidWithRetry(retries - 1, delay * 1.5);
                return;
            }
            const blocks = findMermaidCodeBlocks(previewPane);
            const unrendered = blocks.filter(b => b.pre.dataset.mermaidRendered !== 'true');
            if (unrendered.length > 0) {
                renderMermaidInPreview();
            } else if (blocks.length === 0 && retries > 1) {
                renderMermaidWithRetry(retries - 1, delay * 1.5);
            }
        }, delay);
    }

    /**
     * Set up a MutationObserver on the editor container to detect preview
     * pane changes and auto-render mermaid diagrams.
     */
    function observePreviewPane() {
        if (mermaidPreviewObserver) {
            mermaidPreviewObserver.disconnect();
            mermaidPreviewObserver = null;
        }

        if (typeof mermaid === 'undefined') return;

        const editorEl = document.getElementById(container);
        if (!editorEl) return;

        let debounceTimer = null;

        mermaidPreviewObserver = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                renderMermaidInPreview();
            }, 600);
        });

        mermaidPreviewObserver.observe(editorEl, {
            childList: true,
            subtree: true,
            characterData: true,
        });
    }

    // ===========================
    // Editor Height Calculation
    // ===========================

    /**
     * Get the actual top offset for the editor by measuring DOM elements above it.
     */
    function getTopOffset() {
        let offset = 0;
        const topBar = document.querySelector('.top-bar');
        if (topBar) offset += topBar.offsetHeight;
        const warning = document.getElementById('browser-warning');
        if (warning && warning.style.display !== 'none') offset += warning.offsetHeight;
        return offset;
    }

    // ===========================
    // Editor Core
    // ===========================

    /**
     * Initialize or reinitialize the editor with content.
     * @param {string} markdownContent - the markdown text
     * @param {string} filePath - path to the file being edited
     */
    function render(markdownContent, filePath) {
        currentFilePath = filePath;
        isDirty = false;

        // Destroy previous editor instance if exists
        if (editor) {
            editor.destroy();
            editor = null;
        }

        // Disconnect previous preview observer
        if (mermaidPreviewObserver) {
            mermaidPreviewObserver.disconnect();
            mermaidPreviewObserver = null;
        }

        // Clear the container
        const editorEl = document.getElementById(container);
        editorEl.innerHTML = '';

        // Initialize mermaid with current theme
        initMermaid();

        // Calculate editor height from actual DOM
        const editorHeight = window.innerHeight - getTopOffset();

        // Create new editor instance
        editor = new toastui.Editor({
            el: editorEl,
            initialEditType: 'wysiwyg',
            initialValue: markdownContent,
            height: `${editorHeight}px`,
            previewStyle: 'vertical',
            usageStatistics: false,
            hideModeSwitch: false,
            toolbarItems: [
                ['heading', 'bold', 'italic', 'strike'],
                ['hr', 'quote'],
                ['ul', 'ol', 'task'],
                ['table', 'link'],
                ['code', 'codeblock'],
                ['scrollSync'],
            ],
            customHTMLRenderer: {
                htmlBlock: {
                    iframe(node) {
                        return [
                            { type: 'openTag', tagName: 'iframe', outerNewLine: true, attributes: node.attrs },
                            { type: 'closeTag', tagName: 'iframe', outerNewLine: true },
                        ];
                    },
                },
            },
        });

        // Track changes
        editor.on('change', () => {
            if (!isDirty) {
                isDirty = true;
                if (_dotNetRef) {
                    _dotNetRef.invokeMethodAsync('OnDirtyChanged', true);
                }
            }
        });

        // After rendering, make HTML inputs interactive in WYSIWYG mode
        waitForEditorContent(() => {
            enableHTMLInputs();
        });

        // Set up Mermaid preview observer
        observePreviewPane();

        // Listen for mode switches to render mermaid when user enters Markdown mode
        if (editor) {
            editor.on('changeMode', () => {
                renderMermaidWithRetry(5, 200);
            });
        }
    }

    /**
     * Wait for the WYSIWYG editor content to be rendered, then invoke callback.
     */
    function waitForEditorContent(callback) {
        const wwEditor = document.querySelector('.toastui-editor-ww-container .toastui-editor-contents');
        if (!wwEditor) {
            setTimeout(callback, 300);
            return;
        }

        if (wwEditor.childNodes.length > 1 || (wwEditor.firstChild && wwEditor.firstChild.textContent.trim())) {
            callback();
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            if (wwEditor.childNodes.length > 0) {
                obs.disconnect();
                callback();
            }
        });

        observer.observe(wwEditor, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            callback();
        }, 2000);
    }

    /**
     * Enable interaction with HTML inputs in the WYSIWYG editor.
     */
    function enableHTMLInputs() {
        const wwEditor = document.querySelector('.toastui-editor-ww-container .toastui-editor-contents');
        if (!wwEditor) return;

        const inputs = wwEditor.querySelectorAll('input[type="text"], input[type="radio"]');
        inputs.forEach(input => {
            input.removeAttribute('disabled');
            input.style.pointerEvents = 'auto';
        });
    }

    /**
     * Get the current markdown content from the editor.
     * @returns {string}
     */
    function getMarkdown() {
        if (!editor) return '';
        return editor.getMarkdown();
    }

    /**
     * Get the current file path.
     * @returns {string|null}
     */
    function getCurrentFilePath() {
        return currentFilePath;
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
     * Destroy the editor and clean up.
     */
    function destroy() {
        if (mermaidPreviewObserver) {
            mermaidPreviewObserver.disconnect();
            mermaidPreviewObserver = null;
        }
        if (editor) {
            editor.destroy();
            editor = null;
        }
        currentFilePath = null;
        isDirty = false;
        fileHandle = null;
    }

    /**
     * Recalculate and set editor height.
     */
    function resize() {
        if (!editor) return;
        const height = window.innerHeight - getTopOffset();
        editor.setHeight(`${height}px`);
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
     * Set the file handle for saving (from Open Folder mode).
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

    /**
     * Render from a stored file handle (Open Folder mode).
     * Reads the file content and calls render().
     * @param {string} filePath - path to the file
     */
    async function renderFromHandle(filePath) {
        if (!fileHandle) {
            throw new Error('No file handle set. Call setFileHandle first.');
        }
        const file = await fileHandle.getFile();
        const content = await file.text();
        render(content, filePath);
    }

    /**
     * Render markdown by fetching content from a URL.
     * Used in manifest/static mode.
     * @param {string} url - the URL to fetch markdown from
     */
    async function renderFromUrl(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        const content = await response.text();
        render(content, url);
    }

    return {
        render,
        renderFromHandle,
        renderFromUrl,
        getMarkdown,
        getCurrentFilePath,
        hasDirtyChanges,
        markClean,
        destroy,
        resize,
        reinitMermaidTheme,
        onDirtyChange,
        setFileHandle,
        getFileHandle,
    };
})();
