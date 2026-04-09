# Technical Requirements Specification
## TS·FORGE v1.0.0

---

### 1. Functional Requirements

#### 1.1 Input Requirements

| ID | Title | Description | Priority |
|----|-------|-------------|----------|
| FR-IN-001 | File Upload | The system shall accept `.js`, `.jsx`, `.mjs`, `.cjs`, `.json`, and `.zip` files via drag-and-drop or file picker. | MUST |
| FR-IN-002 | File Size Limit | No single file may exceed 500 KB; total upload size must not exceed 5 MB. | MUST |
| FR-IN-003 | File Count Limit | A single migration run may process a maximum of 50 files. | MUST |
| FR-IN-004 | ZIP Extraction | ZIP archives must be automatically extracted and each valid JS file enqueued individually. | MUST |
| FR-IN-005 | Code Paste | The system shall provide a monospace textarea with live line numbers and character count for pasting JavaScript code directly. | MUST |
| FR-IN-006 | GitHub URL | The system shall accept public GitHub repository and file URLs and fetch their JavaScript content via the GitHub API. | MUST |
| FR-IN-007 | GitHub URL Validation | GitHub URLs must match `/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/` before any network request is made. | MUST |
| FR-IN-008 | Language Selector | The paste tab shall offer a language selector (JavaScript / JSX / Node.js / React) to provide context hints to the migration agent. | SHOULD |
| FR-IN-009 | Sample Loader | A "Load Sample" button shall populate the paste editor with the included `test/sample.js` fintech fixture. | SHOULD |
| FR-IN-010 | Drag-and-Drop Feedback | The dropzone shall provide visual feedback (border highlight, overlay text) while files are being dragged over it. | MUST |

#### 1.2 Migration Requirements

| ID | Title | Description | Priority |
|----|-------|-------------|----------|
| FR-MIG-001 | 6-Stage Pipeline | Migration shall be executed as a sequential 6-stage agentic pipeline: Analysis, Type Inference, Interface Generation, Code Transformation, Config Generation, Report Generation. | MUST |
| FR-MIG-002 | Stage Independence | Each stage shall make an independent Anthropic API call, enabling per-stage progress tracking and error isolation. | MUST |
| FR-MIG-003 | API Key Usage | The API key shall be passed to every stage as a parameter and never stored in module-level variables beyond session scope. | MUST |
| FR-MIG-004 | Exponential Backoff | Transient API errors (5xx, overload) shall be retried up to 3 times with exponential backoff (1s, 2s, 4s + jitter). | MUST |
| FR-MIG-005 | Cancellation | The migration run shall be cancellable at any time via AbortController, halting pending API calls cleanly. | MUST |
| FR-MIG-006 | Type Confidence | Each inferred type shall be classified as `certain`, `inferred`, or `ambiguous` with a reason string. | MUST |
| FR-MIG-007 | Review Markers | All uncertain transformations shall be marked `// @ts-review: [reason]` in the output TypeScript. | MUST |
| FR-MIG-008 | No `any` Overuse | The `any` type shall only be emitted as a last resort and must always be accompanied by a `// @ts-review` comment. | MUST |
| FR-MIG-009 | Strict Compliance | Output TypeScript must be designed to compile with `tsc --strict --noImplicitAny`. | MUST |
| FR-MIG-010 | Module System Conversion | `require()` calls shall be converted to ESM `import` statements during transformation. | MUST |
| FR-MIG-011 | Class Access Modifiers | Class members shall receive `public`, `private`, `protected`, or `readonly` modifiers based on observed usage. | MUST |
| FR-MIG-012 | Null Safety | Optional chaining (`?.`) and nullish coalescing (`??`) shall be applied where null/undefined access is possible. | MUST |
| FR-MIG-013 | Async Conversion | Recognizable callback patterns shall be converted to typed `async/await`. | SHOULD |
| FR-MIG-014 | PropTypes Conversion | React `PropTypes` definitions shall be converted to TypeScript interface props. | SHOULD |
| FR-MIG-015 | tsconfig Generation | Stage 5 shall produce a `tsconfig.json` with strict settings appropriate for the detected runtime. | MUST |
| FR-MIG-016 | ESLint Config | Stage 5 shall produce a `.eslintrc.json` configured for TypeScript ESLint rules. | SHOULD |
| FR-MIG-017 | Migration Scripts | Stage 5 shall produce `migrate.sh` (Bash) and `migrate.ps1` (PowerShell) migration helper scripts. | SHOULD |
| FR-MIG-018 | Batch Processing | Files exceeding 4000-token chunks shall be batched and results merged. | MUST |
| FR-MIG-019 | Key Redaction | The API key must never appear in error messages, console output, or log entries. | MUST |
| FR-MIG-020 | Logic Preservation | Code transformations must preserve all original logic — only type annotations may be added; no refactoring. | MUST |

#### 1.3 Output Requirements

| ID | Title | Description | Priority |
|----|-------|-------------|----------|
| FR-OUT-001 | File Tabs | When multiple output files exist, a tab bar shall allow switching between them. | MUST |
| FR-OUT-002 | Syntax Highlighting | TypeScript output shall be displayed with regex-based syntax highlighting for keywords, types, strings, comments, numbers, operators, and decorators. | MUST |
| FR-OUT-003 | Review Line Highlight | Lines containing `// @ts-review` shall be highlighted with an amber background and left border. | MUST |
| FR-OUT-004 | Review Tooltip | Hovering over a `// @ts-review` line shall display a tooltip with the full review reason. | SHOULD |
| FR-OUT-005 | Line Numbers | Both the input editor and output viewer shall display line numbers. | MUST |
| FR-OUT-006 | Copy Button | Each output file panel shall have a "Copy" button that writes the file content to the clipboard. | MUST |
| FR-OUT-007 | Single File Download | Clicking Download for a single output file shall trigger a browser file download of the `.ts` file. | MUST |
| FR-OUT-008 | ZIP Package Download | Clicking Download for multi-file output shall generate and download a `.zip` file containing all TypeScript and config files. | MUST |
| FR-OUT-009 | ZIP Implementation | The ZIP generator shall be implemented in pure JavaScript using the PKWARE ZIP specification (STORE method, no external library). | MUST |
| FR-OUT-010 | XSS-Safe Rendering | All code content must be displayed via safe DOM APIs; the syntax highlighter must escape HTML entities before applying span wrappers. | MUST |

#### 1.4 Report Requirements

| ID | Title | Description | Priority |
|----|-------|-------------|----------|
| FR-RPT-001 | Stats Row | The report section shall display a stats row with cards for: Files, Lines, Coverage %, Review Items, Estimated Hours. | MUST |
| FR-RPT-002 | Executive Summary | The report shall begin with a 2–3 sentence executive summary. | MUST |
| FR-RPT-003 | Type Coverage Table | The report shall include a table breaking down type coverage by confidence level. | MUST |
| FR-RPT-004 | Review Items Table | The report shall include a detailed table of all `@ts-review` items with: file, line, identifier, inferred type, confidence, recommended action. | MUST |
| FR-RPT-005 | Dependencies Section | The report shall list all `@types/*` packages to install with a copyable `npm install` command. | MUST |
| FR-RPT-006 | Breaking Changes | The report shall identify any patterns that could change runtime behavior. | SHOULD |
| FR-RPT-007 | Effort Estimate | The report shall include an effort estimation table with tasks, hours, and notes. | SHOULD |
| FR-RPT-008 | Report Copy | A "Copy" button shall copy the full report text to the clipboard. | SHOULD |

---

### 2. Non-Functional Requirements

#### 2.1 Performance

| ID | Title | Description | Priority |
|----|-------|-------------|----------|
| NFR-PERF-001 | Initial Load | The application shall display a usable UI within 2 seconds on a 25 Mbps connection. | MUST |
| NFR-PERF-002 | No Build Step | The application shall require no compilation, bundling, or build tool to run. | MUST |
| NFR-PERF-003 | DOM Efficiency | File queue and output tabs shall use efficient DOM manipulation (append individual nodes, not rebuild entire lists on each update). | SHOULD |
| NFR-PERF-004 | Memory Cleanup | All object URLs created via `URL.createObjectURL` shall be revoked within 10 seconds of creation. | MUST |
| NFR-PERF-005 | Animation Performance | All animations shall use `requestAnimationFrame` or CSS keyframes; no `setInterval`-based layout animations. | SHOULD |

#### 2.2 Security

| ID | Title | Description | Priority |
|----|-------|-------------|----------|
| NFR-SEC-001 | API Key Storage | The API key shall be stored exclusively in `sessionStorage`, never `localStorage` or cookies. | MUST |
| NFR-SEC-002 | API Key Masking | The API key input shall use `type="password"` with an optional reveal toggle. | MUST |
| NFR-SEC-003 | API Key Validation | The API key shall be validated against `/^sk-ant-[a-zA-Z0-9_-]+$/` before any use. | MUST |
| NFR-SEC-004 | No Key in Logs | The API key must never appear in console output, error messages, or log entries. | MUST |
| NFR-SEC-005 | Input Sanitization | All filenames and code content displayed to the user must use `element.textContent` exclusively. | MUST |
| NFR-SEC-006 | HTML Escaping | The syntax highlighter must call `escapeHtml()` before creating any `<span>` wrappers. | MUST |
| NFR-SEC-007 | CSP Header | The application must include a Content Security Policy meta tag restricting scripts, styles, fonts, and API connections. | MUST |
| NFR-SEC-008 | No eval() | The codebase must contain no `eval()`, `new Function()`, or `document.write()` calls. | MUST |
| NFR-SEC-009 | GitHub URL Validation | GitHub URLs must pass the allowed pattern regex before any fetch request is initiated. | MUST |
| NFR-SEC-010 | Zero Third-Party Dependencies | No CDN-hosted JavaScript or CSS libraries may be loaded at runtime. | MUST |

#### 2.3 Usability

| ID | Title | Description | Priority |
|----|-------|-------------|----------|
| NFR-UX-001 | Keyboard Navigation | All interactive elements must be reachable and operable via keyboard (Tab, Enter, Space, Escape). | MUST |
| NFR-UX-002 | ARIA Labels | All buttons, inputs, panels, and live regions must have appropriate ARIA labels and roles. | MUST |
| NFR-UX-003 | Focus Management | Modal dialogs must trap focus while open and restore focus to the trigger element on close. | MUST |
| NFR-UX-004 | Live Regions | Status updates (migration progress, errors, key save confirmation) must use `aria-live` regions. | MUST |
| NFR-UX-005 | Color Contrast | All text/background combinations must meet WCAG AA contrast ratio (4.5:1 for normal text). | MUST |
| NFR-UX-006 | Dark/Light Mode | The UI must support both dark and light themes via `[data-theme]` and `prefers-color-scheme`. | MUST |
| NFR-UX-007 | Toast Notifications | All errors, warnings, and success events must be reported via non-blocking toast notifications. | MUST |
| NFR-UX-008 | Disabled State Clarity | The migrate button must clearly indicate why it is disabled (no key / no input). | MUST |

#### 2.4 Reliability

| ID | Title | Description | Priority |
|----|-------|-------------|----------|
| NFR-REL-001 | Error Boundaries | All async operations must be wrapped in try/catch; unhandled promise rejections must not crash the app. | MUST |
| NFR-REL-002 | Partial Failure Handling | If one stage fails, the error must be surfaced clearly without corrupting state for a retry. | MUST |
| NFR-REL-003 | Retry Logic | Transient API failures must be retried with backoff before propagating as user-visible errors. | MUST |
| NFR-REL-004 | Cancellation Safety | Cancellation via AbortController must not leave the UI in a broken state. | MUST |
| NFR-REL-005 | No Memory Leaks | Event listeners must be cleaned up where appropriate; no persistent timers or RAF loops run after migration completes. | MUST |

#### 2.5 Compatibility

| ID | Title | Description | Priority |
|----|-------|-------------|----------|
| NFR-COMP-001 | Chrome Support | Full functionality on Chrome 90+. | MUST |
| NFR-COMP-002 | Firefox Support | Full functionality on Firefox 90+. | MUST |
| NFR-COMP-003 | Safari Support | Full functionality on Safari 15+. | MUST |
| NFR-COMP-004 | Edge Support | Full functionality on Edge 90+. | MUST |
| NFR-COMP-005 | Mobile Responsive | The layout must be usable on mobile viewports (stacked layout at ≤900px). | SHOULD |

---

### 3. API Requirements

| ID | Title | Description | Priority |
|----|-------|-------------|----------|
| API-001 | Model | All API calls must use model `claude-sonnet-4-20250514`. | MUST |
| API-002 | Headers | Every request must include `anthropic-version: 2023-06-01` and `anthropic-dangerous-direct-browser-access: true`. | MUST |
| API-003 | Max Tokens | `max_tokens` must be set to 4096 per call. | MUST |
| API-004 | Error Handling | HTTP 4xx/5xx responses must be handled by extracting `error.message` from the JSON body (never the raw status code alone). | MUST |
| API-005 | Key Never Logged | The API key must be stripped from all error messages before display or logging. | MUST |
| API-006 | Signal Propagation | The `AbortSignal` must be passed to every `fetch()` call to enable mid-migration cancellation. | MUST |

---

### 4. Browser Compatibility

| Browser | Minimum Version | Notes |
|---------|----------------|-------|
| Chrome  | 90+ | Primary development target |
| Firefox | 90+ | Full feature support |
| Safari  | 15+ | Requires proper Content-Type on fetch |
| Edge    | 90+ | Chromium-based, same as Chrome |

Required browser APIs:
- `fetch()` with `AbortController`
- `sessionStorage`
- `FileReader` / `File` API
- `DataView` / `ArrayBuffer` (ZIP generation)
- `Blob` / `URL.createObjectURL`
- `navigator.clipboard.writeText`
- `ResizeObserver` (optional, for responsive adjustments)
- CSS custom properties, CSS Grid, CSS `@keyframes`

---

### 5. Deployment Requirements

| ID | Title | Description | Priority |
|----|-------|-------------|----------|
| DEP-001 | Static Files Only | The application must be deployable as static files with no server-side code. | MUST |
| DEP-002 | GitHub Pages | The application must deploy correctly to GitHub Pages (no `.htaccess`, no server config required). | MUST |
| DEP-003 | No Build Step | Users must be able to open `index.html` directly in a browser without any compilation. | MUST |
| DEP-004 | File Structure | All files must reside in a flat root directory: `index.html`, `styles.css`, `app.js`, `agent.js`, `flow.js`, plus `test/` subdirectory. | MUST |
| DEP-005 | No Cookies | The application must not set any cookies. | MUST |

---

### 6. Acceptance Criteria

#### AC-001: End-to-End Single File Migration
**Given** a user has entered a valid Anthropic API key and pasted JavaScript code  
**When** they click "Migrate to TypeScript"  
**Then** all 6 stages complete successfully, TypeScript output is displayed with syntax highlighting, and a migration report is generated.

#### AC-002: Multi-File Migration with ZIP Download
**Given** a user has uploaded 3+ JavaScript files  
**When** migration completes  
**Then** a ZIP file is downloadable containing the TypeScript output for each file, the tsconfig.json, and the ESLint config.

#### AC-003: API Key Security
**Given** a user saves their API key  
**When** they inspect `localStorage`  
**Then** the key is NOT present. It is stored only in `sessionStorage`.

#### AC-004: XSS Safety
**Given** a user uploads a file with a malicious name: `<img src=x onerror=alert(1)>.js`  
**When** it is displayed in the file queue  
**Then** the malicious HTML is not parsed — it appears as literal text.

#### AC-005: Cancellation
**Given** migration is in progress  
**When** the user clicks "Cancel Migration"  
**Then** all pending API calls are aborted, the UI returns to its ready state, and no error toast is displayed (an info toast is shown instead).

#### AC-006: Dark/Light Theme
**Given** the user clicks the theme toggle  
**Then** the UI switches between dark and light themes, and the selection persists across page refreshes.

#### AC-007: GitHub URL Fetch
**Given** a user enters a valid public GitHub URL  
**When** they click Fetch  
**Then** a list of JavaScript files in the repository root is displayed and can be imported into the file queue.

#### AC-008: Invalid API Key
**Given** a user enters `not-a-valid-key`  
**When** they click "Save for session"  
**Then** an error badge appears indicating invalid format and the key is NOT saved to sessionStorage.

#### AC-009: File Size Validation
**Given** a user attempts to drop a file larger than 500 KB  
**When** the file is processed  
**Then** a warning toast is displayed and the file is NOT added to the queue.

#### AC-010: @ts-review Highlighting
**Given** the TypeScript output contains lines with `// @ts-review`  
**Then** those lines are visually distinguished with an amber background and hovering reveals the review reason in a tooltip.
