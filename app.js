/* ═══════════════════════════════════════════════════════
   TS·FORGE — Application Controller (app.js)
   ═══════════════════════════════════════════════════════ */

'use strict';

const TSForgeApp = (() => {
  // ── Internal State ───────────────────────────────────
  const state = {
    apiKey: null,
    files: [],          // Array of { name, content, size, type }
    outputFiles: {},    // Map of filename → ts content
    activeOutputTab: null,
    migrationActive: false,
    abortController: null,
    currentTab: 'file', // 'file' | 'paste' | 'github'
    githubFiles: [],
    retryState: null,   // { files, fromStage, partial } — set after recoverable failure
  };

  // ── DOM References ───────────────────────────────────
  let dom = {};

  // ── Logger ───────────────────────────────────────────
  const logger = (() => {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels.info;
    return {
      info:  (...a) => currentLevel <= levels.info  && _log('info',  ...a),
      warn:  (...a) => currentLevel <= levels.warn  && _log('warn',  ...a),
      error: (...a) => currentLevel <= levels.error && _log('error', ...a),
    };
    function _log(level, ...args) {
      const msg = args.map(String).join(' ');
      // Avoid leaking sensitive data — strip any key-like patterns before logging
      const safe = msg.replace(/gsk_[0-9A-Za-z]{20,}/g, '[REDACTED]');
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
      fn(`[TS·FORGE][${level.toUpperCase()}]`, safe);
    }
  })();

  // ── Security Helpers ─────────────────────────────────
  const Security = {
    /**
     * Safe set of text content — never uses innerHTML with untrusted data.
     */
    setTextSafe(el, text) {
      if (el) el.textContent = text;
    },

    /**
     * Escape HTML entities for use in syntax highlighter output.
     */
    escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /**
     * Validate GitHub URL before fetching.
     */
    isValidGithubUrl(url) {
      return /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url) ||
             /^https:\/\/raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+\//.test(url);
    },

    /**
     * Validate API key format.
     */
    isValidApiKey(key) {
      // Groq API keys: start with gsk_ followed by alphanumeric and underscores
      return /^gsk_[0-9A-Za-z]{20,}$/.test(key);
    },

    /**
     * Sanitize a filename for safe display.
     */
    sanitizeFilename(name) {
      return name.replace(/[^\w.\-/ ]/g, '_').slice(0, 255);
    },
  };

  // ── File Size Formatter ──────────────────────────────
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ── Toast Notification System ────────────────────────
  const Toast = {
    _idCounter: 0,

    show(type, title, message, duration = 8000) {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const id = ++this._idCounter;
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.setAttribute('role', 'alert');
      toast.dataset.id = id;

      const icons = {
        info:    '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        error:   '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      };

      // Build toast content using safe DOM manipulation
      const iconSpan = document.createElement('span');
      // Icons are static SVG strings we created — not user content
      iconSpan.innerHTML = icons[type] || icons.info;

      const body = document.createElement('div');
      body.className = 'toast-body';

      const titleEl = document.createElement('div');
      titleEl.className = 'toast-title';
      Security.setTextSafe(titleEl, title);

      const msgEl = document.createElement('div');
      msgEl.className = 'toast-msg';
      Security.setTextSafe(msgEl, message);

      body.append(titleEl, msgEl);

      const closeBtn = document.createElement('button');
      closeBtn.className = 'toast-close';
      closeBtn.setAttribute('aria-label', 'Dismiss notification');
      closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      closeBtn.addEventListener('click', () => this.dismiss(id));

      toast.append(iconSpan, body, closeBtn);
      container.appendChild(toast);

      if (duration > 0) {
        setTimeout(() => this.dismiss(id), duration);
      }

      return id;
    },

    dismiss(id) {
      const el = document.querySelector(`[data-id="${id}"]`);
      if (!el) return;
      el.classList.add('dismissing');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    },
  };

  // ── API Key Management ───────────────────────────────
  const ApiKeyManager = {
    save() {
      const raw = dom.apiKeyInput.value.trim();
      if (!raw) {
        Toast.show('warning', 'No API Key', 'Please enter your Anthropic API key.');
        return;
      }
      if (!Security.isValidApiKey(raw)) {
        Toast.show('error', 'Invalid Key Format', 'Groq API keys start with gsk_ — get one free at console.groq.com');
        dom.keyStatus.className = 'key-status invalid';
        Security.setTextSafe(dom.keyStatus, '✕ Invalid format');
        return;
      }
      sessionStorage.setItem('tsforge_key', raw);
      state.apiKey = raw;
      dom.keyStatus.className = 'key-status connected';
      Security.setTextSafe(dom.keyStatus, '✓ Connected');
      updateMigrateButton();
      Toast.show('success', 'API Key Saved', 'Your key is stored in sessionStorage only and will be cleared when you close this tab.');
    },

    load() {
      // Priority 1: key injected at deploy time via GitHub Actions secret
      const envKey = (typeof window.TSFORGE_API_KEY === 'string') ? window.TSFORGE_API_KEY.trim() : '';
      if (envKey && Security.isValidApiKey(envKey)) {
        state.apiKey = envKey;
        sessionStorage.setItem('tsforge_key', envKey);
        if (dom.apiKeySection) dom.apiKeySection.classList.add('auto-loaded');
        if (dom.autoKeyBadge) dom.autoKeyBadge.hidden = false;
        updateMigrateButton();
        return;
      }
      // Priority 2: key previously saved by the user in this session
      const stored = sessionStorage.getItem('tsforge_key');
      if (stored && Security.isValidApiKey(stored)) {
        state.apiKey = stored;
        dom.apiKeyInput.value = stored;
        dom.keyStatus.className = 'key-status connected';
        Security.setTextSafe(dom.keyStatus, '✓ Connected');
      }
    },

    get() {
      return state.apiKey;
    },
  };

  // ── Theme Management ─────────────────────────────────
  const ThemeManager = {
    toggle() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('tsforge_theme', next);
    },

    init() {
      const saved = localStorage.getItem('tsforge_theme');
      if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
      }
    },
  };

  // ── Tab Management ───────────────────────────────────
  const TabManager = {
    switchTo(tabId) {
      // Update tab buttons
      document.querySelectorAll('.tab-btn').forEach((btn) => {
        const isActive = btn.id === `tab-btn-${tabId}`;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      // Update panels
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.id === `tab-${tabId}`);
      });

      state.currentTab = tabId;
    },
  };

  // ── File Ingestion Engine ────────────────────────────
  const FileIngestion = {
    ALLOWED_EXTENSIONS: new Set(['.js', '.jsx', '.mjs', '.cjs', '.json', '.zip', '.tar.gz', '.ts', '.tsx']),
    ALLOWED_MIME_TYPES: new Set([
      'text/javascript', 'application/javascript', 'text/jsx',
      'application/json', 'application/zip', 'application/x-zip-compressed',
      'application/x-tar', 'text/plain', 'application/octet-stream',
      'video/mp2t', // .ts files
    ]),
    MAX_FILE_SIZE: 500 * 1024,
    MAX_TOTAL_SIZE: 5 * 1024 * 1024,
    MAX_FILES: 50,

    getExtension(name) {
      const lower = name.toLowerCase();
      if (lower.endsWith('.tar.gz')) return '.tar.gz';
      const dotIdx = lower.lastIndexOf('.');
      return dotIdx !== -1 ? lower.slice(dotIdx) : '';
    },

    async processFiles(fileList) {
      const totalExisting = state.files.reduce((s, f) => s + f.size, 0);
      let addedCount = 0;
      let skipped = [];

      for (const file of fileList) {
        const ext = this.getExtension(file.name);

        if (state.files.length + addedCount >= this.MAX_FILES) {
          skipped.push(`${Security.sanitizeFilename(file.name)}: max ${this.MAX_FILES} files`);
          continue;
        }

        if (!this.ALLOWED_EXTENSIONS.has(ext)) {
          skipped.push(`${Security.sanitizeFilename(file.name)}: unsupported type`);
          continue;
        }

        if (file.size > this.MAX_FILE_SIZE) {
          skipped.push(`${Security.sanitizeFilename(file.name)}: exceeds 500KB`);
          continue;
        }

        if (totalExisting + file.size > this.MAX_TOTAL_SIZE) {
          skipped.push(`${Security.sanitizeFilename(file.name)}: total limit 5MB exceeded`);
          continue;
        }

        if (ext === '.zip') {
          const zipFiles = await this.extractZip(file);
          for (const zf of zipFiles) {
            if (state.files.length + addedCount < this.MAX_FILES) {
              this.addFile(zf.name, zf.content);
              addedCount++;
            }
          }
        } else {
          const content = await this.readAsText(file);
          this.addFile(Security.sanitizeFilename(file.name), content);
          addedCount++;
        }
      }

      if (skipped.length > 0) {
        Toast.show('warning', 'Some files skipped', skipped.slice(0, 3).join('; ') + (skipped.length > 3 ? `... +${skipped.length - 3} more` : ''));
      }

      renderFileQueue();
      updateMigrateButton();
    },

    addFile(name, content) {
      // Avoid duplicates
      const existing = state.files.findIndex(f => f.name === name);
      const fileObj = {
        name: Security.sanitizeFilename(name),
        content,
        size: new Blob([content]).size,
        type: this.getExtension(name).replace('.', '').toUpperCase() || 'JS',
      };
      if (existing >= 0) {
        state.files[existing] = fileObj;
      } else {
        state.files.push(fileObj);
      }
    },

    readAsText(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file, 'utf-8');
      });
    },

    async extractZip(file) {
      // Minimal ZIP reader (STORE method, no compression required for reading)
      const results = [];
      try {
        const buf = await file.arrayBuffer();
        const view = new DataView(buf);
        const bytes = new Uint8Array(buf);
        let offset = 0;

        while (offset + 30 < buf.byteLength) {
          const sig = view.getUint32(offset, true);
          if (sig !== 0x04034b50) break;

          const compression  = view.getUint16(offset + 8, true);
          const nameLen      = view.getUint16(offset + 26, true);
          const extraLen     = view.getUint16(offset + 28, true);
          const compressedSz = view.getUint32(offset + 18, true);

          const nameBytes = bytes.slice(offset + 30, offset + 30 + nameLen);
          const entryName = new TextDecoder().decode(nameBytes);
          const dataStart = offset + 30 + nameLen + extraLen;

          if (compression === 0) { // STORE
            const content = new TextDecoder().decode(bytes.slice(dataStart, dataStart + compressedSz));
            const ext = this.getExtension(entryName);
            if (this.ALLOWED_EXTENSIONS.has(ext) && !entryName.endsWith('/')) {
              results.push({ name: entryName, content });
            }
          }

          offset = dataStart + compressedSz;
        }
      } catch (e) {
        logger.warn('ZIP extraction partial failure:', e.message);
      }
      return results;
    },
  };

  // ── Render File Queue ────────────────────────────────
  function renderFileQueue() {
    const queue = dom.fileQueue;
    queue.innerHTML = '';

    state.files.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.setAttribute('role', 'listitem');

      const iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      const iconEl = document.createElement('div');
      iconEl.className = 'file-item-icon';
      iconEl.innerHTML = iconSvg;

      const info = document.createElement('div');
      info.className = 'file-item-info';

      const nameEl = document.createElement('div');
      nameEl.className = 'file-item-name';
      Security.setTextSafe(nameEl, file.name);

      const meta = document.createElement('div');
      meta.className = 'file-item-meta';

      const sizeSpan = document.createElement('span');
      Security.setTextSafe(sizeSpan, formatFileSize(file.size));

      const badge = document.createElement('span');
      badge.className = 'file-type-badge';
      Security.setTextSafe(badge, `.${file.type.toLowerCase()}`);

      meta.append(sizeSpan, badge);
      info.append(nameEl, meta);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'file-item-remove';
      removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
      removeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      removeBtn.addEventListener('click', () => {
        state.files.splice(index, 1);
        renderFileQueue();
        updateMigrateButton();
      });

      item.append(iconEl, info, removeBtn);
      queue.appendChild(item);
    });

    dom.clearFilesBtn.style.display = state.files.length > 0 ? 'inline-flex' : 'none';
  }

  // ── Line Number Sync for Paste Editor ────────────────
  function syncLineNumbers() {
    const text = dom.codePaste.value;
    const lines = text.split('\n').length;
    let nums = '';
    for (let i = 1; i <= lines; i++) nums += i + '\n';
    dom.lineNumbers.textContent = nums;
    Security.setTextSafe(dom.charCount, text.length.toLocaleString() + ' chars');
  }

  // ── GitHub Fetch ─────────────────────────────────────
  const GithubFetcher = {
    async fetch() {
      const rawUrl = dom.githubUrl.value.trim();
      if (!rawUrl) {
        Toast.show('warning', 'No URL', 'Please enter a GitHub URL.');
        return;
      }
      if (!Security.isValidGithubUrl(rawUrl)) {
        Toast.show('error', 'Invalid URL', 'Please enter a valid public GitHub repository or raw file URL.');
        return;
      }

      dom.fetchGithubBtn.disabled = true;
      Security.setTextSafe(dom.fetchGithubBtn, 'Fetching…');
      dom.githubFileTree.innerHTML = '';
      state.githubFiles = [];

      try {
        // Handle raw file URL
        if (rawUrl.includes('raw.githubusercontent.com')) {
          await this.fetchRawFile(rawUrl);
        } else {
          // Convert github.com URL to API URL
          const apiUrl = this.toApiUrl(rawUrl);
          if (apiUrl) {
            await this.fetchRepoTree(apiUrl, rawUrl);
          } else {
            Toast.show('error', 'Unsupported URL', 'Could not parse repository URL. Try a direct raw file URL.');
          }
        }
      } catch (e) {
        const msg = e.message || 'Unknown error';
      Toast.show('error', 'Fetch Failed', msg.replace(/gsk_[0-9A-Za-z]{20,}/g, '[REDACTED]'));
      } finally {
        dom.fetchGithubBtn.disabled = false;
        Security.setTextSafe(dom.fetchGithubBtn, 'Fetch');
      }
    },

    toApiUrl(githubUrl) {
      // https://github.com/user/repo  → https://api.github.com/repos/user/repo/contents
      const match = githubUrl.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/tree\/([\w.-/]+))?/);
      if (!match) return null;
      const [, owner, repo, branch] = match;
      const path = branch ? `?ref=${branch}` : '';
      return `https://api.github.com/repos/${owner}/${repo}/contents${path}`;
    },

    async fetchRawFile(url) {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      const content = await resp.text();
      const parts = url.split('/');
      const filename = parts[parts.length - 1] || 'file.js';
      const safeName = Security.sanitizeFilename(filename);
      FileIngestion.addFile(safeName, content);
      renderFileQueue();
      updateMigrateButton();
      Toast.show('success', 'File fetched', `${safeName} added to queue`);
    },

    async fetchRepoTree(apiUrl, originalUrl) {
      const resp = await fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });
      if (!resp.ok) throw new Error(`GitHub API error ${resp.status}. Private repos are not supported.`);
      const items = await resp.json();

      if (!Array.isArray(items)) {
        // Single file
        if (items.download_url) {
          await this.fetchRawFile(items.download_url);
          return;
        }
        throw new Error('Unexpected GitHub API response.');
      }

      const tree = document.createElement('div');
      tree.setAttribute('role', 'group');
      tree.setAttribute('aria-label', 'Repository files');

      let jsFiles = items.filter(item =>
        item.type === 'file' &&
        FileIngestion.ALLOWED_EXTENSIONS.has(FileIngestion.getExtension(item.name))
      );

      if (jsFiles.length === 0) {
        const msg = document.createElement('p');
        Security.setTextSafe(msg, 'No JavaScript files found in root of this repository.');
        dom.githubFileTree.appendChild(msg);
        return;
      }

      jsFiles.forEach(item => {
        const row = document.createElement('label');
        row.className = 'github-file-item';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = true;
        cb.dataset.url = item.download_url;
        cb.dataset.name = Security.sanitizeFilename(item.name);

        const nameSpan = document.createElement('span');
        Security.setTextSafe(nameSpan, item.name);

        const sizeSpan = document.createElement('span');
        sizeSpan.style.marginLeft = 'auto';
        sizeSpan.style.color = 'var(--color-text-tertiary)';
        sizeSpan.style.fontSize = '11px';
        Security.setTextSafe(sizeSpan, formatFileSize(item.size || 0));

        row.append(cb, nameSpan, sizeSpan);
        tree.appendChild(row);
        state.githubFiles.push({ url: item.download_url, name: item.name });
      });

      const importBtn = document.createElement('button');
      importBtn.className = 'btn-primary';
      importBtn.style.marginTop = '10px';
      importBtn.style.fontSize = '13px';
      Security.setTextSafe(importBtn, `Import ${jsFiles.length} selected files`);
      importBtn.addEventListener('click', async () => {
        importBtn.disabled = true;
        Security.setTextSafe(importBtn, 'Importing…');
        const checkboxes = tree.querySelectorAll('input[type="checkbox"]:checked');
        for (const cb of checkboxes) {
          try {
            await this.fetchRawFile(cb.dataset.url);
          } catch (e) {
            logger.warn('Import failed for', cb.dataset.name, e.message);
          }
        }
        renderFileQueue();
        updateMigrateButton();
        importBtn.disabled = false;
        Security.setTextSafe(importBtn, 'Import selected files');
        Toast.show('success', 'Files imported', `${checkboxes.length} files added to queue`);
      });

      tree.appendChild(importBtn);
      dom.githubFileTree.appendChild(tree);
    },
  };

  // ── Syntax Highlighter ───────────────────────────────
  const Highlighter = {
    TS_KEYWORDS: new Set([
      'abstract','as','asserts','async','await','break','case','catch',
      'class','const','continue','declare','default','delete','do','else',
      'enum','export','extends','false','finally','for','from','function',
      'get','if','implements','import','in','infer','instanceof','interface',
      'is','keyof','let','module','namespace','never','new','null','of',
      'override','package','private','protected','public','readonly',
      'require','return','satisfies','set','static','super','switch',
      'this','throw','true','try','type','typeof','undefined','unique',
      'unknown','var','void','while','with','yield',
    ]),
    TS_TYPES: new Set([
      'string','number','boolean','object','symbol','bigint','any','void',
      'never','unknown','undefined','null','Array','Promise','Map','Set',
      'Record','Partial','Required','Readonly','Pick','Omit','Exclude',
      'Extract','NonNullable','ReturnType','InstanceType','Parameters',
      'ConstructorParameters','PropertyKey',
    ]),

    highlight(code) {
      const lines = code.split('\n');
      return lines.map(line => this.highlightLine(line)).join('\n');
    },

    highlightLine(line) {
      const escaped = Security.escapeHtml(line);
      const isReview = line.includes('@ts-review');
      let result = this.tokenize(escaped);

      if (isReview) {
        const reviewMatch = line.match(/@ts-review:\s*(.+)/);
        const reason = reviewMatch ? Security.escapeHtml(reviewMatch[1]) : '';
        return `<span class="tok-review" data-review="${reason}">${result}</span>`;
      }
      return result;
    },

    tokenize(html) {
      // Apply tokens in priority order, using placeholder system to prevent re-matching
      const placeholders = [];

      const protect = (str) => {
        const idx = placeholders.length;
        placeholders.push(str);
        return `\x00${idx}\x00`;
      };

      // 1. Multi-line comments (already single line here, but handle /*)
      html = html.replace(/(&lt;!--.*?--&gt;|\/\*.*?\*\/)/g, (m) =>
        protect(`<span class="tok-comment">${m}</span>`)
      );

      // 2. Single-line comments
      html = html.replace(/(\/\/.*$)/gm, (m) =>
        protect(`<span class="tok-comment">${m}</span>`)
      );

      // 3. Template literals (simplified — single line)
      html = html.replace(/(`[^`]*`)/g, (m) =>
        protect(`<span class="tok-string">${m}</span>`)
      );

      // 4. Double-quoted strings
      html = html.replace(/("(?:[^"\\]|\\.)*")/g, (m) =>
        protect(`<span class="tok-string">${m}</span>`)
      );

      // 5. Single-quoted strings
      html = html.replace(/('(?:[^'\\]|\\.)*')/g, (m) =>
        protect(`<span class="tok-string">${m}</span>`)
      );

      // 6. Decorators
      html = html.replace(/(@[\w]+)/g, (m) =>
        protect(`<span class="tok-decorator">${m}</span>`)
      );

      // 7. Numbers
      html = html.replace(/\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?n?)\b/g, (m) =>
        protect(`<span class="tok-number">${m}</span>`)
      );

      // 8. Keywords and types
      html = html.replace(/\b([a-zA-Z_$][\w$]*)\b/g, (_, word) => {
        if (this.TS_KEYWORDS.has(word)) return protect(`<span class="tok-keyword">${word}</span>`);
        if (this.TS_TYPES.has(word)) return protect(`<span class="tok-type">${word}</span>`);
        return word;
      });

      // 9. Operators
      html = html.replace(/(=&gt;|===|!==|==|!=|&amp;&amp;|\|\||&lt;=|&gt;=|\?\?|&gt;&gt;&gt;|&lt;&lt;|&gt;&gt;|[+\-*/%&|^~!<>=?:])/g, (m) =>
        protect(`<span class="tok-operator">${m}</span>`)
      );

      // Restore placeholders
      return html.replace(/\x00(\d+)\x00/g, (_, i) => placeholders[parseInt(i, 10)]);
    },
  };

  // ── Output Rendering ─────────────────────────────────
  const OutputRenderer = {
    render(outputFiles) {
      state.outputFiles = outputFiles;
      const keys = Object.keys(outputFiles);
      if (keys.length === 0) return;

      // Show output section
      dom.outputSection.hidden = false;

      // Build tabs
      dom.outputFileTabs.innerHTML = '';
      keys.forEach((filename, i) => {
        const tab = document.createElement('button');
        tab.className = 'out-tab' + (i === 0 ? ' active' : '');
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        Security.setTextSafe(tab, filename);
        tab.addEventListener('click', () => this.activateTab(filename));
        tab.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.activateTab(filename);
          }
        });
        dom.outputFileTabs.appendChild(tab);
      });

      this.activateTab(keys[0]);

      // Update download button
      if (keys.length === 1) {
        Security.setTextSafe(dom.downloadLabel, `Download ${keys[0]}`);
      } else {
        Security.setTextSafe(dom.downloadLabel, 'Download Migration Package (.zip)');
      }
    },

    activateTab(filename) {
      state.activeOutputTab = filename;

      // Update tab states
      dom.outputFileTabs.querySelectorAll('.out-tab').forEach(tab => {
        const isActive = tab.textContent === filename;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      const content = state.outputFiles[filename] || '';
      this.renderCode(filename, content);

      // If there are pending review decisions, overlay them on the rendered code
      if (ReviewManager._items.length > 0) {
        ReviewManager._rerenderViewer();
      }
    },

    renderCode(filename, content) {
      Security.setTextSafe(dom.codeViewerFilename, filename);

      // Build line numbers
      const lines = content.split('\n');
      dom.lineNumbersOut.textContent = Array.from({ length: lines.length }, (_, i) => i + 1).join('\n');

      // Syntax highlight (safe — escapes HTML before wrapping in spans)
      dom.codeHighlight.innerHTML = Highlighter.highlight(content);
    },
  };

  // ── Download Engine ───────────────────────────────────
  const Downloader = {
    downloadSingle(filename, content) {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      this._triggerDownload(blob, filename);
    },

    downloadZip(files) {
      const zip = this.buildZip(files);
      const blob = new Blob([zip], { type: 'application/zip' });
      this._triggerDownload(blob, 'migration-package.zip');
    },

    _triggerDownload(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = Security.sanitizeFilename(filename);
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    },

    /**
     * Build a ZIP file using the STORE method (no compression).
     * Implements the ZIP local file header format per PKWARE spec.
     */
    buildZip(files) {
      const encoder = new TextEncoder();
      const localHeaders = [];
      const centralDir = [];
      let offset = 0;
      const now = new Date();
      const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
      const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);

      for (const [name, content] of Object.entries(files)) {
        const nameBytes = encoder.encode(name);
        const dataBytes = encoder.encode(content);
        const crc = this.crc32(dataBytes);
        const size = dataBytes.length;

        // Local file header
        const lhSize = 30 + nameBytes.length;
        const lh = new Uint8Array(lhSize);
        const lhView = new DataView(lh.buffer);
        lhView.setUint32(0,  0x04034b50, true); // signature
        lhView.setUint16(4,  20, true);          // version needed
        lhView.setUint16(6,  0, true);           // flags
        lhView.setUint16(8,  0, true);           // compression (STORE)
        lhView.setUint16(10, dosTime, true);
        lhView.setUint16(12, dosDate, true);
        lhView.setUint32(14, crc, true);
        lhView.setUint32(18, size, true);        // compressed size
        lhView.setUint32(22, size, true);        // uncompressed size
        lhView.setUint16(26, nameBytes.length, true);
        lhView.setUint16(28, 0, true);           // extra length
        lh.set(nameBytes, 30);

        localHeaders.push(lh, dataBytes);

        // Central directory entry
        const cdSize = 46 + nameBytes.length;
        const cd = new Uint8Array(cdSize);
        const cdView = new DataView(cd.buffer);
        cdView.setUint32(0,  0x02014b50, true);  // central dir signature
        cdView.setUint16(4,  20, true);           // version made by
        cdView.setUint16(6,  20, true);           // version needed
        cdView.setUint16(8,  0, true);            // flags
        cdView.setUint16(10, 0, true);            // compression
        cdView.setUint16(12, dosTime, true);
        cdView.setUint16(14, dosDate, true);
        cdView.setUint32(16, crc, true);
        cdView.setUint32(20, size, true);
        cdView.setUint32(24, size, true);
        cdView.setUint16(28, nameBytes.length, true);
        cdView.setUint16(30, 0, true);
        cdView.setUint16(32, 0, true);
        cdView.setUint16(34, 0, true);
        cdView.setUint16(36, 0, true);
        cdView.setUint32(38, 0, true);
        cdView.setUint32(42, offset, true);      // local header offset
        cd.set(nameBytes, 46);

        centralDir.push(cd);
        offset += lhSize + size;
      }

      // End of central directory record
      const cdOffset = offset;
      const cdSize = centralDir.reduce((s, c) => s + c.length, 0);
      const eocd = new Uint8Array(22);
      const eocdView = new DataView(eocd.buffer);
      eocdView.setUint32(0,  0x06054b50, true);   // EOCD signature
      eocdView.setUint16(4,  0, true);
      eocdView.setUint16(6,  0, true);
      eocdView.setUint16(8,  Object.keys(files).length, true);
      eocdView.setUint16(10, Object.keys(files).length, true);
      eocdView.setUint32(12, cdSize, true);
      eocdView.setUint32(16, cdOffset, true);
      eocdView.setUint16(20, 0, true);

      const allParts = [...localHeaders, ...centralDir, eocd];
      const total = allParts.reduce((s, p) => s + p.length, 0);
      const result = new Uint8Array(total);
      let pos = 0;
      for (const part of allParts) {
        result.set(part, pos);
        pos += part.length;
      }
      return result.buffer;
    },

    /**
     * CRC-32 implementation (standard ZIP checksum).
     */
    crc32(data) {
      const table = this._getCrcTable();
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    },

    _crcTable: null,
    _getCrcTable() {
      if (this._crcTable) return this._crcTable;
      const table = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
          c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[n] = c;
      }
      this._crcTable = table;
      return table;
    },
  };

  // ── Migration Report Renderer ─────────────────────────
  const ReportRenderer = {
    render(markdownText, stats) {
      // Show report section
      dom.reportSection.hidden = false;

      // Render stats row
      if (stats) {
        dom.reportStats.innerHTML = '';
        const statItems = [
          { label: 'Files',    value: stats.files ?? 0 },
          { label: 'Lines',    value: stats.lines ?? 0 },
          { label: 'Coverage', value: (stats.coverage ?? 0) + '%' },
          { label: 'Reviews',  value: stats.reviews ?? 0 },
          { label: 'Est. Hrs', value: stats.hours ?? '?' },
        ];
        statItems.forEach(({ label, value }) => {
          const card = document.createElement('div');
          card.className = 'stat-card count-up';
          const val = document.createElement('div');
          val.className = 'stat-value';
          Security.setTextSafe(val, String(value));
          const lbl = document.createElement('div');
          lbl.className = 'stat-label';
          Security.setTextSafe(lbl, label);
          card.append(val, lbl);
          dom.reportStats.appendChild(card);
        });
      }

      // Render markdown as safe HTML
      const html = this.parseMarkdown(markdownText);
      dom.reportContent.innerHTML = html;

      // Wire copy buttons on code blocks (they're static SVG + data-target, safe)
      dom.reportContent.querySelectorAll('.btn-copy-code-block').forEach(btn => {
        btn.addEventListener('click', async () => {
          const targetId = btn.dataset.target;
          const codeEl = document.getElementById(targetId);
          if (!codeEl) return;
          try {
            await navigator.clipboard.writeText(codeEl.textContent);
            const orig = btn.innerHTML;
            btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> Copied!';
            setTimeout(() => { btn.innerHTML = orig; }, 2000);
          } catch (_) {
            Toast.show('error', 'Copy failed', 'Could not access clipboard.');
          }
        });
      });
    },

    /**
     * Minimal, safe Markdown→HTML converter.
     * All destructured content is treated as trusted only after we generate it,
     * not from user input. The report content comes from Claude's API response.
     * We still escape any special characters to prevent XSS.
     */
    parseMarkdown(md) {
      // Escape HTML first
      let html = Security.escapeHtml(md);

      // Tables
      html = html.replace(/^\|(.*\|)+\s*$/gm, (match) => {
        if (!match.trim().startsWith('|')) return match;
        return match; // handled in block pass
      });

      // Block-level: tables
      html = html.replace(/((?:^\|.+\|\s*\n)+)/gm, (block) => {
        const rows = block.trim().split('\n').filter(r => r.trim().startsWith('|'));
        if (rows.length < 2) return block;
        const isHeader = rows[1] && /^\|[-| ]+\|$/.test(rows[1].trim());
        let table = '<table><thead><tr>';
        const headerCells = rows[0].split('|').filter((_, i, a) => i > 0 && i < a.length - 1);
        headerCells.forEach(cell => { table += `<th>${cell.trim()}</th>`; });
        table += '</tr></thead><tbody>';
        const dataRows = isHeader ? rows.slice(2) : rows.slice(1);
        dataRows.forEach(row => {
          const cells = row.split('|').filter((_, i, a) => i > 0 && i < a.length - 1);
          table += '<tr>';
          cells.forEach(cell => {
            let cls = '';
            const t = cell.trim();
            if (t === 'certain') cls = ' class="badge-certain"';
            else if (t === 'inferred') cls = ' class="badge-inferred"';
            else if (t === 'ambiguous') cls = ' class="badge-ambiguous"';
            table += `<td${cls}>${t}</td>`;
          });
          table += '</tr>';
        });
        table += '</tbody></table>';
        return table;
      });

      // Headings
      html = html.replace(/^######\s+(.+)/gm, '<h6>$1</h6>');
      html = html.replace(/^#####\s+(.+)/gm,  '<h5>$1</h5>');
      html = html.replace(/^####\s+(.+)/gm,   '<h4>$1</h4>');
      html = html.replace(/^###\s+(.+)/gm,    '<h3>$1</h3>');
      html = html.replace(/^##\s+(.+)/gm,     '<h2>$1</h2>');
      html = html.replace(/^#\s+(.+)/gm,      '<h1>$1</h1>');

      // Code blocks — add a copy button for each
      html = html.replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) => {
        const id = `codeblock-${Math.random().toString(36).slice(2, 8)}`;
        return `<div class="report-code-block"><pre><code id="${id}">${code.trimEnd()}</code></pre>` +
               `<button class="btn-copy-code-block" data-target="${id}" type="button" aria-label="Copy code">` +
               `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</button></div>`;
      });

      // Inline code
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

      // Bold + italic
      html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

      // Unordered lists
      html = html.replace(/((?:^[-*+] .+\n?)+)/gm, (match) => {
        const items = match.trim().split('\n').map(l => `<li>${l.replace(/^[-*+] /, '').trim()}</li>`).join('');
        return `<ul>${items}</ul>`;
      });

      // Ordered lists
      html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
        const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\. /, '').trim()}</li>`).join('');
        return `<ol>${items}</ol>`;
      });

      // Horizontal rule
      html = html.replace(/^---+$/gm, '<hr/>');

      // Paragraphs
      html = html.replace(/\n\n+/g, '\n\n');
      const paragraphs = html.split('\n\n');
      html = paragraphs.map(p => {
        p = p.trim();
        if (!p) return '';
        if (/^<[huptol]/.test(p)) return p;
        return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
      }).join('\n');

      return html;
    },
  };

  // ── Migration Action ──────────────────────────────────
  async function startMigration(resumeFrom = null) {
    const apiKey = ApiKeyManager.get();
    if (!apiKey) {
      Toast.show('error', 'No API Key', 'Please enter and save your Groq API key.');
      return;
    }

    // Collect input — use saved files when resuming, otherwise read from UI
    let files = [];
    if (resumeFrom) {
      files = resumeFrom.files;
    } else if (state.currentTab === 'file') {
      files = [...state.files];
    } else if (state.currentTab === 'paste') {
      const code = dom.codePaste.value.trim();
      if (!code) {
        Toast.show('warning', 'Empty input', 'Please paste some JavaScript code.');
        return;
      }
      files = [{ name: 'input.js', content: code, size: code.length, type: 'JS' }];
    } else if (state.currentTab === 'github') {
      files = [...state.files];
    }

    if (files.length === 0) {
      Toast.show('warning', 'No input', 'Please add files or paste code to migrate.');
      return;
    }

    // Clear previous retry state and hide retry button
    state.retryState = null;
    if (dom.retryBtn) dom.retryBtn.style.display = 'none';

    // On fresh start, reset the flow visualizer
    if (!resumeFrom) FlowVisualizer.reset();

    state.migrationActive = true;
    state.abortController = new AbortController();

    // UI: loading state
    dom.migrateBtn.classList.add('loading');
    dom.migrateBtn.disabled = true;
    dom.migrateBtn.setAttribute('aria-disabled', 'true');
    Security.setTextSafe(dom.migrateBtnLabel, 'Migrating…');
    dom.cancelBtn.style.display = 'inline-flex';
    if (!resumeFrom) {
      dom.outputSection.hidden = true;
      dom.reportSection.hidden = true;
    }

    // Progress bar
    if (!dom.progressBarWrap) {
      const wrap = document.createElement('div');
      wrap.className = 'progress-bar-wrap';
      wrap.id = 'progress-bar-wrap';
      const bar = document.createElement('div');
      bar.className = 'progress-bar';
      bar.id = 'progress-bar';
      wrap.appendChild(bar);
      dom.migrateAction.insertBefore(wrap, dom.migrateBtn);
      dom.progressBarWrap = wrap;
      dom.progressBar = bar;
    }
    dom.progressBarWrap.style.display = 'block';
    // On resume, start the bar from where the previous run got to
    const startPct = resumeFrom ? Math.round((resumeFrom.fromStage / 6) * 100) : 0;
    dom.progressBar.style.width = `${startPct}%`;
    dom.progressBar.classList.add('animate-indeterminate');

    try {
      const agentResume = resumeFrom
        ? { fromStage: resumeFrom.fromStage, partial: resumeFrom.partial }
        : null;
      const result = await MigrationAgent.run(files, apiKey, onStageUpdate, state.abortController.signal, agentResume);
      handleMigrationResult(result);
    } catch (err) {
      if (err.name === 'AbortError') {
        Toast.show('info', 'Migration cancelled', 'You cancelled the migration.');
        FlowVisualizer.reset();
      } else {
        const safeMsg = (err.message || '').replace(/gsk_[0-9A-Za-z]{20,}/g, '[REDACTED]');
        Toast.show('error', 'Migration Failed', safeMsg);
        logger.error('Migration failed:', safeMsg);

        // Offer resume-from-stage if we have partial results
        if (err.partialResults != null && err.failedAtStage != null) {
          state.retryState = {
            files,
            fromStage: err.failedAtStage,
            partial:   err.partialResults,
          };
          if (dom.retryBtn) {
            const stageName = MigrationAgent.STAGES[err.failedAtStage]?.name
              || `Stage ${err.failedAtStage + 1}`;
            Security.setTextSafe(dom.retryBtn, `↻ Retry from “${stageName}”`);
            dom.retryBtn.style.display = 'inline-flex';
          }
        }
      }
    } finally {
      state.migrationActive = false;
      state.abortController = null;
      dom.migrateBtn.classList.remove('loading');
      dom.migrateBtn.disabled = false;
      dom.migrateBtn.setAttribute('aria-disabled', 'false');
      Security.setTextSafe(dom.migrateBtnLabel, 'Migrate to TypeScript');
      dom.cancelBtn.style.display = 'none';
      dom.progressBar.classList.remove('animate-indeterminate');
      dom.progressBar.style.width = '100%';
      setTimeout(() => { dom.progressBarWrap.style.display = 'none'; }, 1000);
    }
  }

  function onStageUpdate(stageIndex, status, data) {
    FlowVisualizer.updateStage(stageIndex, status, data);

    const progress = Math.round(((stageIndex + (status === 'complete' ? 1 : 0.5)) / 6) * 100);
    dom.progressBar.classList.remove('animate-indeterminate');
    dom.progressBar.style.width = `${progress}%`;
  }

  // ── Human Review Manager ───────────────────────────────
  const ReviewManager = {
    _items: [], // { id, filename, lineIndex, original, reason, decision: null|'approve'|'reject' }

    extract(outputFiles) {
      this._items = [];
      let id = 0;
      for (const [filename, content] of Object.entries(outputFiles)) {
        const lines = content.split('\n');
        lines.forEach((line, lineIndex) => {
          if (line.includes('@ts-review')) {
            const m = line.match(/@ts-review[:\s]+(.+)/);
            const reason = m ? m[1].replace(/\*\/$/, '').trim() : '';
            this._items.push({ id: id++, filename, lineIndex, original: line, reason, decision: null });
          }
        });
      }
      return this._items;
    },

    render() {
      const panel = document.getElementById('review-panel');
      const container = document.getElementById('review-items');
      if (!panel || !container) return;

      panel.hidden = false;
      container.innerHTML = '';

      if (this._items.length === 0) {
        // Empty state — show panel but indicate nothing needs review
        const empty = document.createElement('div');
        empty.className = 'review-empty';
        empty.setAttribute('role', 'listitem');
        empty.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
        const txt = document.createElement('span');
        Security.setTextSafe(txt, 'No items flagged — all transformations were high-confidence. Safe to download.');
        empty.appendChild(txt);
        container.appendChild(empty);
        this._updateProgress();
        return;
      }

      const isMultiFile = Object.keys(state.outputFiles).length > 1;

      this._items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'review-item';
        row.dataset.id = item.id;
        row.setAttribute('role', 'listitem');

        // Meta: location + reason
        const meta = document.createElement('div');
        meta.className = 'review-item-meta';

        const loc = document.createElement('span');
        loc.className = 'review-item-loc';
        Security.setTextSafe(loc, isMultiFile
          ? `${item.filename}:${item.lineIndex + 1}`
          : `Line ${item.lineIndex + 1}`);

        const reason = document.createElement('span');
        reason.className = 'review-item-reason';
        Security.setTextSafe(reason, item.reason || 'Needs manual type review');

        meta.append(loc, reason);

        // Code snippet — highlightLine escapes HTML before wrapping in spans (safe)
        const code = document.createElement('pre');
        code.className = 'review-item-code';
        code.setAttribute('aria-label', 'Code snippet');
        code.innerHTML = Highlighter.highlightLine(item.original.trim());

        // Approve / Reject buttons
        const actions = document.createElement('div');
        actions.className = 'review-item-actions';

        const approveBtn = document.createElement('button');
        approveBtn.className = 'btn-approve';
        approveBtn.type = 'button';
        approveBtn.setAttribute('aria-label', `Approve line ${item.lineIndex + 1}`);
        approveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Approve';
        approveBtn.addEventListener('click', () => this.decide(item.id, 'approve'));

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'btn-reject';
        rejectBtn.type = 'button';
        rejectBtn.setAttribute('aria-label', `Reject line ${item.lineIndex + 1}`);
        rejectBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Reject';
        rejectBtn.addEventListener('click', () => this.decide(item.id, 'reject'));

        actions.append(approveBtn, rejectBtn);
        row.append(meta, code, actions);
        container.appendChild(row);
      });

      this._updateProgress();
    },

    decide(id, decision) {
      const item = this._items.find(i => i.id === id);
      if (!item) return;
      item.decision = decision;

      const row = document.querySelector(`.review-item[data-id="${id}"]`);
      if (row) {
        row.classList.remove('approved', 'rejected');
        row.classList.add(decision === 'approve' ? 'approved' : 'rejected');
      }

      // Re-render code viewer overlay for the current file
      if (item.filename === state.activeOutputTab) {
        this._rerenderViewer();
      }

      this._updateProgress();
    },

    approveAll() {
      this._items.forEach(item => { item.decision = 'approve'; });
      document.querySelectorAll('.review-item').forEach(row => {
        row.classList.remove('rejected');
        row.classList.add('approved');
      });
      this._rerenderViewer();
      this._updateProgress();
    },

    applyDecisions() {
      const byFile = {};
      this._items.forEach(item => {
        if (!byFile[item.filename]) byFile[item.filename] = [];
        byFile[item.filename].push(item);
      });

      for (const [filename, items] of Object.entries(byFile)) {
        const lines = state.outputFiles[filename].split('\n');
        items.forEach(item => {
          if (item.decision === 'approve') {
            // Keep the code line but strip the @ts-review annotation
            lines[item.lineIndex] = lines[item.lineIndex].replace(/\s*\/\/\s*@ts-review[:\s]*.*/i, '');
          } else if (item.decision === 'reject') {
            // Comment the line out with a REJECTED note
            const reasonStr = item.reason ? ` (${item.reason})` : '';
            lines[item.lineIndex] = `// ❌ REJECTED${reasonStr} — was: ${lines[item.lineIndex].trimEnd()}`;
          }
          // decision === null → leave as-is (annotation stays)
        });
        state.outputFiles[filename] = lines.join('\n');
      }

      this._items = [];
      const panel = document.getElementById('review-panel');
      if (panel) panel.hidden = true;

      // Re-render the code viewer with finalized content
      OutputRenderer.activateTab(state.activeOutputTab);
      Toast.show('success', 'Reviews Applied', 'Output has been finalized with your decisions and is ready to download.');
    },

    _rerenderViewer() {
      const filename = state.activeOutputTab;
      if (!filename || !state.outputFiles[filename]) return;

      const lines = state.outputFiles[filename].split('\n');
      const decisionMap = {};
      this._items.filter(i => i.filename === filename)
        .forEach(i => { decisionMap[i.lineIndex] = i.decision; });

      dom.lineNumbersOut.textContent = Array.from({ length: lines.length }, (_, i) => i + 1).join('\n');
      dom.codeHighlight.innerHTML = lines.map((line, idx) => {
        const h = Highlighter.highlightLine(line);
        if (line.includes('@ts-review')) {
          const d = decisionMap[idx];
          if (d === 'approve') return `<span class="tok-review tok-review--approved">${h}</span>`;
          if (d === 'reject')  return `<span class="tok-review tok-review--rejected">${h}</span>`;
          return `<span class="tok-review">${h}</span>`;
        }
        return h;
      }).join('\n');
    },

    _updateProgress() {
      const total = this._items.length;
      const done = this._items.filter(i => i.decision !== null).length;
      const el = document.getElementById('review-progress');
      if (el) Security.setTextSafe(el, total === 0 ? 'All clear' : `${done} / ${total} reviewed`);
      const badge = document.getElementById('review-badge');
      if (badge) {
        Security.setTextSafe(badge, total === 0 ? '✓' : (done >= total ? '✓' : String(total - done)));
        badge.style.background = total === 0 || done >= total
          ? 'var(--color-accent-secondary)'
          : 'var(--color-accent-warning)';
      }
    },
  };

  function handleMigrationResult(result) {
    if (!result) return;

    const outputFiles = result.outputFiles || {};
    OutputRenderer.render(outputFiles);

    if (result.report) {
      const stats = extractStats(result.report, result);
      ReportRenderer.render(result.report, stats);
    }

    // Extract @ts-review items and always show the human review panel
    const reviewItems = ReviewManager.extract(outputFiles);
    ReviewManager.render();
    if (reviewItems.length > 0) {
      Toast.show('warning', `${reviewItems.length} item${reviewItems.length > 1 ? 's' : ''} need review`, 'Scroll to the Review panel below the code to approve or reject flagged lines.');
    } else {
      Toast.show('success', 'Migration complete!', `${Object.keys(outputFiles).length} file(s) ready — no uncertain types found.`);
    }
  }

  function extractStats(reportMd, result) {
    const files = Object.keys(result.outputFiles || {}).filter(f => f.endsWith('.ts')).length;
    const linesMatch = reportMd.match(/(\d[\d,]*)\s+lines/i);
    const lines = linesMatch ? parseInt(linesMatch[1].replace(',', ''), 10) : 0;
    const coverageMatch = reportMd.match(/(\d+)%\s*(?:type\s*)?coverage/i);
    const coverage = coverageMatch ? parseInt(coverageMatch[1], 10) : 0;
    const reviewsMatch = reportMd.match(/(\d+)\s+(?:review|@ts-review)/i);
    const reviews = reviewsMatch ? parseInt(reviewsMatch[1], 10) : 0;
    const hoursMatch = reportMd.match(/(\d+(?:\.\d+)?)\s+hours?/i);
    const hours = hoursMatch ? hoursMatch[1] : '?';
    return { files, lines, coverage, reviews, hours };
  }

  // ── Update Migrate Button State ───────────────────────
  function updateMigrateButton() {
    const hasKey = Boolean(state.apiKey);
    const pasteHasCode = state.currentTab === 'paste' && dom.codePaste?.value?.trim().length > 0;
    const hasInput = state.files.length > 0 || pasteHasCode;

    const canMigrate = hasKey && hasInput;

    dom.migrateBtn.disabled = !canMigrate;
    dom.migrateBtn.setAttribute('aria-disabled', canMigrate ? 'false' : 'true');

    if (!hasKey && !hasInput) {
      Security.setTextSafe(dom.migrateHint, 'Save your Groq API key and add code to begin');
    } else if (!hasKey) {
      Security.setTextSafe(dom.migrateHint, 'Enter your Groq API key (gsk_...) and click Save');
    } else if (!hasInput) {
      Security.setTextSafe(dom.migrateHint, 'Add files or paste JavaScript code to migrate');
    } else {
      Security.setTextSafe(dom.migrateHint, '');
    }
  }

  // ── Modal System ──────────────────────────────────────
  const ModalManager = {
    open(id) {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.hidden = false;
      modal.removeAttribute('hidden');
      // Focus first interactive element
      const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.focus();
      document.addEventListener('keydown', this._escHandler);
    },

    close(id) {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.hidden = true;
      document.removeEventListener('keydown', this._escHandler);
    },

    _escHandler(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay:not([hidden])').forEach(m => {
          m.hidden = true;
        });
        document.removeEventListener('keydown', this._escHandler.bind(this));
      }
    },
  };

  // ── Sample Code Loader ────────────────────────────────
  async function loadSample() {
    try {
      const resp = await fetch('test/sample.js');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      dom.codePaste.value = text;
      syncLineNumbers();
      updateMigrateButton();
      Toast.show('success', 'Sample loaded', 'Fintech utility module ready to migrate.');
    } catch (e) {
      // Fallback — embed a tiny sample if fetch fails
      dom.codePaste.value = getSampleFallback();
      syncLineNumbers();
      updateMigrateButton();
    }
  }

  function getSampleFallback() {
    return `// Fintech utility module — sample.js
/**
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

class Transaction {
  constructor(id, fromUserId, toUserId, amount, currency) {
    this.id = id;
    this.fromUserId = fromUserId;
    this.toUserId = toUserId;
    this.amount = amount;
    this.currency = currency;
    this.status = 'pending';
    this.createdAt = new Date();
  }

  async process(paymentGateway) {
    try {
      const result = await paymentGateway.charge(this.amount, this.currency);
      this.status = result.success ? 'complete' : 'failed';
      return result;
    } catch (err) {
      this.status = 'failed';
      throw err;
    }
  }

  toDisplayString() {
    return \`[\${this.id}] \${formatCurrency(this.amount, this.currency)} (\${this.status})\`;
  }
}

const validateAmount = (amount) => {
  if (typeof amount !== 'number' || isNaN(amount)) return 'Amount must be a number';
  if (amount <= 0) return 'Amount must be positive';
  if (amount > 1_000_000) return 'Amount exceeds maximum';
  return true;
};

export { Transaction, formatCurrency, validateAmount };
export default Transaction;
`;
  }

  // ── Init ──────────────────────────────────────────────
  function init() {
    // Cache DOM elements
    dom = {
      apiKeyInput:      document.getElementById('api-key-input'),
      apiKeyReveal:     document.getElementById('api-key-reveal'),
      apiKeyHelp:       document.getElementById('api-key-help'),
      saveKeyBtn:       document.getElementById('btn-save-key'),
      keyStatus:        document.getElementById('key-status'),
      autoKeyBadge:     document.getElementById('auto-key-badge'),
      apiKeySection:    document.querySelector('.api-key-section'),
      themeToggle:      document.getElementById('theme-toggle'),
      fileInput:        document.getElementById('file-input'),
      dropzone:         document.getElementById('dropzone'),
      fileQueue:        document.getElementById('file-queue'),
      clearFilesBtn:    document.getElementById('btn-clear-files'),
      codePaste:        document.getElementById('code-paste'),
      lineNumbers:      document.getElementById('line-numbers'),
      charCount:        document.getElementById('char-count'),
      loadSampleBtn:    document.getElementById('btn-load-sample'),
      langSelector:     document.getElementById('lang-selector'),
      githubUrl:        document.getElementById('github-url'),
      fetchGithubBtn:   document.getElementById('btn-fetch-github'),
      githubFileTree:   document.getElementById('github-file-tree'),
      migrateBtn:       document.getElementById('btn-migrate'),
      migrateBtnLabel:  document.querySelector('.btn-migrate-label'),
      migrateHint:      document.getElementById('migrate-hint'),
      cancelBtn:        document.getElementById('btn-cancel'),
      retryBtn:         document.getElementById('btn-retry'),
      migrateAction:    document.querySelector('.migrate-action'),
      stageErrorModal:  document.getElementById('modal-stage-error'),
      stageErrorTitle:  document.getElementById('modal-stage-error-title'),
      stageErrorLabel:  document.getElementById('modal-stage-error-label'),
      stageErrorDetail: document.getElementById('modal-stage-error-detail'),
      outputSection:    document.getElementById('output-section'),
      outputFileTabs:   document.getElementById('output-file-tabs'),
      codeViewerFilename: document.getElementById('code-viewer-filename'),
      codeHighlight:    document.getElementById('code-highlight'),
      lineNumbersOut:   document.getElementById('line-numbers-out'),
      copycodeBtn:      document.getElementById('btn-copy-code'),
      downloadBtn:      document.getElementById('btn-download'),
      downloadLabel:    document.getElementById('download-label'),
      reportSection:    document.getElementById('report-section'),
      reportStats:      document.getElementById('report-stats'),
      reportContent:    document.getElementById('report-content'),
      copyReportBtn:    document.getElementById('btn-copy-report'),
      resetFlowBtn:     document.getElementById('btn-reset-flow'),
      clearLogBtn:      document.getElementById('btn-clear-log'),
    };

    ThemeManager.init();
    ApiKeyManager.load();
    FlowVisualizer.init('flow-container');
    updateMigrateButton();
    syncLineNumbers();

    // Stage error popup — dispatched by FlowVisualizer when a stage fails
    document.getElementById('flow-container').addEventListener('stage-error', (e) => {
      const { stageName, stageIndex, message } = e.detail;
      const safeMsg = (message || '').replace(/gsk_[0-9A-Za-z]{20,}/g, '[REDACTED]');
      if (dom.stageErrorTitle)  Security.setTextSafe(dom.stageErrorTitle,  `${stageName} Failed`);
      if (dom.stageErrorLabel)  Security.setTextSafe(dom.stageErrorLabel,  `Stage ${stageIndex + 1} of 6 — ${stageName}`);
      if (dom.stageErrorDetail) Security.setTextSafe(dom.stageErrorDetail, safeMsg);
      ModalManager.open('modal-stage-error');
    });

    // ── Event Listeners ──────────────────────────────────

    // API Key
    dom.saveKeyBtn.addEventListener('click', () => ApiKeyManager.save());
    dom.apiKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') ApiKeyManager.save(); });
    dom.apiKeyReveal.addEventListener('click', () => {
      const isPassword = dom.apiKeyInput.type === 'password';
      dom.apiKeyInput.type = isPassword ? 'text' : 'password';
      dom.apiKeyReveal.setAttribute('aria-label', isPassword ? 'Hide API key' : 'Toggle API key visibility');
    });
    dom.apiKeyHelp.addEventListener('click', () => ModalManager.open('modal-api-help'));

    // Theme
    dom.themeToggle.addEventListener('click', () => ThemeManager.toggle());

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.id.replace('tab-btn-', '');
        TabManager.switchTo(id);
        updateMigrateButton();
      });
    });

    // Dropzone
    dom.dropzone.addEventListener('click', (e) => {
      if (e.target !== dom.dropzone && !dom.dropzone.contains(e.target)) return;
      dom.fileInput.click();
    });
    document.getElementById('btn-browse').addEventListener('click', (e) => {
      e.stopPropagation();
      dom.fileInput.click();
    });
    dom.dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dom.fileInput.click();
      }
    });
    dom.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dom.dropzone.classList.add('drag-over');
    });
    dom.dropzone.addEventListener('dragleave', (e) => {
      if (!dom.dropzone.contains(e.relatedTarget)) {
        dom.dropzone.classList.remove('drag-over');
      }
    });
    dom.dropzone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dom.dropzone.classList.remove('drag-over');
      await FileIngestion.processFiles(e.dataTransfer.files);
    });
    dom.fileInput.addEventListener('change', async () => {
      await FileIngestion.processFiles(dom.fileInput.files);
      dom.fileInput.value = '';
    });

    // Clear files
    dom.clearFilesBtn.addEventListener('click', () => {
      state.files = [];
      renderFileQueue();
      updateMigrateButton();
    });

    // Code paste
    dom.codePaste.addEventListener('input', () => {
      syncLineNumbers();
      updateMigrateButton();
    });
    dom.codePaste.addEventListener('scroll', () => {
      dom.lineNumbers.scrollTop = dom.codePaste.scrollTop;
    });
    dom.codePaste.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = dom.codePaste.selectionStart;
        const end = dom.codePaste.selectionEnd;
        dom.codePaste.value = dom.codePaste.value.substring(0, start) + '  ' + dom.codePaste.value.substring(end);
        dom.codePaste.selectionStart = dom.codePaste.selectionEnd = start + 2;
        syncLineNumbers();
      }
    });

    // Load sample
    dom.loadSampleBtn.addEventListener('click', loadSample);

    // GitHub fetch
    dom.fetchGithubBtn.addEventListener('click', () => GithubFetcher.fetch());
    dom.githubUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') GithubFetcher.fetch(); });

    // Migrate
    dom.migrateBtn.addEventListener('click', () => {
      if (!state.migrationActive) startMigration();
    });

    // Retry from failed stage
    dom.retryBtn.addEventListener('click', () => {
      if (!state.migrationActive && state.retryState) {
        startMigration(state.retryState);
      }
    });

    // Cancel
    dom.cancelBtn.addEventListener('click', () => {
      if (state.abortController) {
        state.abortController.abort();
      }
    });

    // Copy code
    dom.copycodeBtn.addEventListener('click', async () => {
      const content = state.outputFiles[state.activeOutputTab] || '';
      try {
        await navigator.clipboard.writeText(content);
        const orig = dom.copycodeBtn.textContent;
        Security.setTextSafe(dom.copycodeBtn, '✓ Copied');
        setTimeout(() => Security.setTextSafe(dom.copycodeBtn, orig), 2000);
      } catch (e) {
        Toast.show('error', 'Copy failed', 'Could not access clipboard.');
      }
    });

    // Download
    dom.downloadBtn.addEventListener('click', () => {
      const keys = Object.keys(state.outputFiles);
      if (keys.length === 0) return;
      if (keys.length === 1) {
        Downloader.downloadSingle(keys[0], state.outputFiles[keys[0]]);
      } else {
        Downloader.downloadZip(state.outputFiles);
      }
    });

    // Copy report
    dom.copyReportBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(dom.reportContent.textContent);
        Toast.show('success', 'Report copied', 'Migration report copied to clipboard.');
      } catch (e) {
        Toast.show('error', 'Copy failed', 'Could not access clipboard.');
      }
    });

    // Reset flow
    dom.resetFlowBtn.addEventListener('click', () => FlowVisualizer.reset());

    // Clear log
    dom.clearLogBtn.addEventListener('click', () => FlowVisualizer.clearLog());

    // Review panel — Approve All / Apply Decisions
    document.getElementById('btn-approve-all').addEventListener('click', () => ReviewManager.approveAll());
    document.getElementById('btn-finalize').addEventListener('click', () => ReviewManager.applyDecisions());

    // Modal close buttons
    document.querySelectorAll('[data-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.modal;
        ModalManager.close(id);
      });
    });

    // Close modal on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.hidden = true;
        }
      });
    });

    // Focus trap for modals
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusable = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      });
    });
  }

  // ── Public API ────────────────────────────────────────
  return { init };
})();

// Auto-initialise once the DOM is ready.
// Scripts are loaded at the bottom of <body> (all elements already parsed),
// but we use DOMContentLoaded to be safe across all browsers.
// NOTE: This replaces the inline <script> block that was previously in
// index.html — inline scripts are blocked by the page's script-src CSP.
document.addEventListener('DOMContentLoaded', function () {
  TSForgeApp.init();
});
