# MASTER PROMPT — JS→TS AI Migration Agent
## For use with Claude (claude-sonnet-4-20250514) or equivalent frontier LLM

---

## ═══════════════════════════════════════════════════════
## SECTION 0 — HOW TO USE THIS PROMPT
## ═══════════════════════════════════════════════════════

This is a multi-phase master prompt. Send it in full as your first message.
The AI will execute each phase sequentially and produce all deliverables.
If the AI stops mid-way, say: "Continue from Phase [N]" to resume.

Total expected deliverables:
  - index.html          (Main SPA entry point)
  - styles.css          (Complete styling system)
  - app.js              (Core application logic + AI agent orchestration)
  - agent.js            (Migration agent engine)
  - flow.js             (Animated agentic flow visualizer)
  - README.md           (Comprehensive documentation)
  - REQUIREMENTS.md     (Technical requirements specification)
  - test/sample.js      (Single-file JS test fixture)
  - test/sample-codebase/ (Multi-file JS codebase test fixture)
    ├── package.json
    ├── src/api.js
    ├── src/auth.js
    ├── src/models/user.js
    ├── src/models/transaction.js
    ├── src/services/paymentService.js
    ├── src/utils/validators.js
    ├── src/utils/formatters.js
    └── src/components/Dashboard.jsx

---

## ═══════════════════════════════════════════════════════
## SECTION 1 — ROLE & PERSONA
## ═══════════════════════════════════════════════════════

You are a **Senior Full-Stack Engineer and Fintech Expert** with 12+ years of
experience specializing in:
  - JavaScript-to-TypeScript migrations at enterprise scale
  - AI agent architecture and LLM-powered developer tooling
  - Single-Page Application (SPA) design and GitHub Pages deployment
  - Security-first web development (OWASP Top 10 compliance)
  - Type systems: TypeScript strict mode, generics, mapped types, conditional types

Your work is:
  - Production-ready: no placeholder code, no TODO comments, no stubs
  - Security-hardened: all inputs sanitized, no XSS vectors, no eval(), no innerHTML with untrusted data
  - Fully functional: every button, every feature, every edge case handled
  - Visually professional: enterprise-grade UI indistinguishable from a commercial SaaS product

---

## ═══════════════════════════════════════════════════════
## SECTION 2 — PROJECT OVERVIEW
## ═══════════════════════════════════════════════════════

### Product Name: TS·FORGE — AI-Powered JavaScript→TypeScript Migration Agent

### Mission:
Build a complete, production-ready, single-file-deployable web application that
uses the Anthropic Claude API (free tier eligible via user's own API key) to
intelligently migrate JavaScript codebases to fully-typed TypeScript. The tool
must handle everything from single files to multi-file repositories.

### Deployment Target:
GitHub Pages (static hosting). The entire app must work as pure static files
(HTML + CSS + JS). No backend server required. The Anthropic API is called
directly from the browser using the user's API key (stored only in
sessionStorage, never persisted to localStorage or sent anywhere except the
Anthropic API endpoint).

### Cost Model:
Zero infrastructure cost. Users supply their own Anthropic API key.
The app uses claude-sonnet-4-20250514 which is available on the free tier.

---

## ═══════════════════════════════════════════════════════
## SECTION 3 — FILE ARCHITECTURE
## ═══════════════════════════════════════════════════════

Produce exactly these files. Each must be complete — no truncation, no "// rest
of code here", no ellipsis substitutions.

### 3.1 index.html
A single HTML5 file that:
  - Loads styles.css, app.js, agent.js, flow.js
  - Provides the complete SPA shell (header, left panel, right panel, modals)
  - Has NO inline JavaScript beyond a single DOMContentLoaded bootstrap call
  - Uses semantic HTML5 elements (main, section, article, aside, header, nav)
  - Is fully accessible (ARIA labels, keyboard navigation, focus management)
  - Has a Content Security Policy meta tag:
    content="default-src 'self'; script-src 'self'; style-src 'self'
    https://fonts.googleapis.com; font-src https://fonts.gstatic.com;
    connect-src https://api.anthropic.com; img-src 'self' data:;"
  - Loads Google Fonts: JetBrains Mono (code), Syne (headings), DM Sans (body)

### 3.2 styles.css
Complete CSS file with:
  - CSS custom properties (design tokens) for the full color system
  - Dark/light mode via @media (prefers-color-scheme: dark) and [data-theme]
  - CSS Grid and Flexbox layouts — NO frameworks, NO external CSS libraries
  - Keyframe animations for: agent flow pulses, file processing states,
    typing indicators, progress bars, node activation in the flow diagram
  - Responsive breakpoints: 1440px (default), 1200px, 900px (stacked layout), 480px

Color palette (strictly enforce these tokens):
  --color-bg-base:        #0A0E1A   (dark navy — primary background)
  --color-bg-surface:     #111827   (card surfaces)
  --color-bg-elevated:    #1C2333   (elevated panels)
  --color-bg-input:       #0F1623   (editor/textarea backgrounds)
  --color-accent-primary: #3B82F6   (electric blue — primary CTA)
  --color-accent-secondary:#10B981  (emerald green — success states)
  --color-accent-warning: #F59E0B   (amber — review-needed flags)
  --color-accent-danger:  #EF4444   (red — errors)
  --color-accent-purple:  #8B5CF6   (purple — AI/agent indicators)
  --color-text-primary:   #F9FAFB   (near-white body text)
  --color-text-secondary: #9CA3AF   (muted text)
  --color-text-tertiary:  #6B7280   (placeholder, hints)
  --color-border:         #1F2937   (subtle borders)
  --color-border-bright:  #374151   (active/hover borders)
  --color-code-bg:        #0D1117   (GitHub-style code background)
  --font-display:         'Syne', sans-serif
  --font-body:            'DM Sans', sans-serif
  --font-mono:            'JetBrains Mono', monospace

### 3.3 app.js
The main application controller. Responsibilities:
  - API key management (session-scoped, with masked input and reveal toggle)
  - Input mode switching: File Upload / Paste Code / GitHub URL
  - File ingestion engine (handles .js, .jsx, .mjs, .cjs, .ts, .json, .zip)
  - Drag-and-drop with visual feedback
  - Multi-file queue management with per-file status indicators
  - Output rendering: syntax-highlighted TypeScript code panels
  - Download engine: single file (.ts) or ZIP archive for multi-file output
  - Migration report renderer (flagged items table)
  - Theme toggle (dark/light)
  - Error boundary: all async operations wrapped in try/catch with user-friendly
    error messages displayed in a non-blocking toast system
  - Input sanitization: all user-provided filenames and code content sanitized
    before display using textContent (never innerHTML with untrusted data)

### 3.4 agent.js
The AI migration agent engine. This is the intellectual core of the application.

It must implement a multi-step agentic pipeline with these exact named stages,
each calling the Anthropic API independently (enables streaming + progress):

  STAGE 1 — ANALYSIS
    Name: "Codebase Analyzer"
    Model call purpose: Analyze the JS input, extract: detected patterns
    (CommonJS/ESM/AMD), framework hints (React/Vue/Node/Express/etc.),
    JSDoc coverage %, complexity score, list of all identifiers needing types
    Output format: structured JSON with fields:
      { module_system, framework, jsdoc_coverage, complexity,
        functions[], classes[], variables[], imports[], exports[] }

  STAGE 2 — TYPE INFERENCE
    Name: "Type Inference Engine"
    Model call purpose: For each identifier from Stage 1, infer the most
    specific TypeScript type possible. Use JSDoc, usage patterns, naming
    conventions, and context clues. Classify each inference as:
      "certain"    — high confidence, safe to emit without review
      "inferred"   — medium confidence, logically derived but verify
      "ambiguous"  — low confidence, emit as `unknown` with TODO comment
    Output format: JSON map of identifier→{type, confidence, reason}

  STAGE 3 — INTERFACE GENERATION
    Name: "Interface Architect"
    Model call purpose: Generate TypeScript interfaces and type aliases for all
    object shapes, function signatures, class definitions, and module exports.
    Include: generic types where appropriate, discriminated unions where
    applicable, utility type usage (Partial<T>, Required<T>, Pick<T,K>, etc.)
    Output format: complete TypeScript declaration block (string)

  STAGE 4 — CODE TRANSFORMATION
    Name: "Code Transformer"
    Model call purpose: Emit the full TypeScript migration of the input JS.
    Rules the model MUST follow:
      a) Add type annotations to every function parameter and return type
      b) Convert var to const/let with appropriate scoping
      c) Add interface/type imports at the top
      d) Convert require() to import statements (ESM)
      e) Add strict null checks (?. optional chaining, ?? nullish coalescing)
      f) Annotate class properties with visibility modifiers (private/public)
      g) Add readonly where mutation is not observed
      h) Convert callbacks to typed async/await where pattern is recognizable
      i) Add JSDoc-to-TSDoc comment conversion
      j) Mark items needing human review with: // @ts-review: [reason]
    Output format: complete .ts file content

  STAGE 5 — CONFIG GENERATION
    Name: "Config Generator"
    Model call purpose: Generate tsconfig.json with strict mode settings
    appropriate for the detected codebase. Also generate:
      - Updated package.json devDependencies (typescript, ts-node, @types/*)
      - .eslintrc for TypeScript ESLint rules
      - A migration script: migrate.sh (bash) and migrate.ps1 (PowerShell)
    Output format: JSON object with keys: tsconfig, package_json_patch,
    eslintrc, migrate_sh, migrate_ps1

  STAGE 6 — REPORT GENERATION
    Name: "Migration Reporter"
    Model call purpose: Produce a structured migration report covering:
      - Executive summary (1 paragraph)
      - Files processed, lines migrated, type coverage %
      - Table of all @ts-review items with: file, line, identifier,
        inferred type, confidence level, recommended action
      - List of @types/* packages to install
      - Breaking changes detected (if any)
      - Estimated manual review effort (hours)
    Output format: Markdown string

The agent must:
  - Expose a run(files, apiKey, onStageUpdate) async function
  - Call onStageUpdate(stageIndex, status, data) after each stage completes
    where status is one of: 'running' | 'complete' | 'error'
  - Handle Anthropic API rate limits with exponential backoff (max 3 retries)
  - Support cancellation via AbortController
  - Process multiple files by batching (max 4000 tokens of JS per API call)
    and merging results
  - Never include the API key in error messages or logs

Anthropic API call pattern (use this exact implementation):
```javascript
async function callClaude(apiKey, systemPrompt, userPrompt, signal) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    }),
    signal
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }
  const data = await response.json();
  return data.content[0].text;
}
```

### 3.5 flow.js
The animated agentic orchestration flow visualizer.

Renders an SVG-based animated flow diagram in the right panel showing the
6-stage pipeline in real time as migration progresses. Requirements:

  Layout: Vertical pipeline of 6 stage nodes connected by animated path lines.
  Each node is a rounded rectangle with:
    - Stage number badge (top-left)
    - Stage name (bold, 14px)
    - Stage description (12px, muted)
    - Status indicator (idle / running / complete / error)
    - Token count when complete (e.g. "1,247 tokens")

  Animations:
    - Idle: nodes are outlined, dimmed (opacity 0.4)
    - Running: node pulses with a breathing border glow animation,
      the connector line above it shows a traveling dot (dashoffset animation)
      A "thinking" indicator shows animated dots (...) in the node
    - Complete: node fills with the accent-secondary color (emerald),
      shows a checkmark, token count appears with a count-up animation
    - Error: node fills with accent-danger (red), shows ✕ icon

  The SVG must be responsive (100% width, auto height).
  The flow must update reactively when agent.js calls onStageUpdate().
  Include a "Reset" button that returns all nodes to idle state.
  Include a small legend at the bottom (idle / running / complete / error).

  At the top of the flow panel, show a live "Agent Activity Log":
    - A scrollable text area (max 200px height, font-mono 11px)
    - Each log entry: [timestamp] [STAGE_NAME] message
    - Auto-scrolls to bottom
    - Color-coded: running=blue, complete=green, error=red

---

## ═══════════════════════════════════════════════════════
## SECTION 4 — UI/UX SPECIFICATION
## ═══════════════════════════════════════════════════════

### 4.1 Overall Layout

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER: Logo | Nav | API Key Input | Theme Toggle          │
├───────────────────────────┬─────────────────────────────────┤
│  LEFT PANEL (55% width)   │  RIGHT PANEL (45% width)        │
│                           │                                  │
│  ┌─────────────────────┐  │  ┌──────────────────────────┐  │
│  │  INPUT SECTION      │  │  │  AGENT FLOW VISUALIZER   │  │
│  │  [File] [Paste] [GH]│  │  │  (animated SVG pipeline) │  │
│  │                     │  │  │                          │  │
│  │  Drop zone or       │  │  │  Stage 1: Analyzer ●     │  │
│  │  Code editor        │  │  │  Stage 2: Type Inf. ○    │  │
│  │                     │  │  │  Stage 3: Interfaces ○   │  │
│  │  [▶ MIGRATE]        │  │  │  Stage 4: Transform ○    │  │
│  └─────────────────────┘  │  │  Stage 5: Config Gen ○   │  │
│                           │  │  Stage 6: Reporter ○     │  │
│  ┌─────────────────────┐  │  └──────────────────────────┘  │
│  │  OUTPUT SECTION     │  │                                  │
│  │  [Files tabs]       │  │  ┌──────────────────────────┐  │
│  │  TypeScript code    │  │  │  AGENT LOG               │  │
│  │  (syntax highlight) │  │  │  [scrollable log]        │  │
│  │                     │  │  └──────────────────────────┘  │
│  │  [↓ Download ZIP]   │  │                                  │
│  └─────────────────────┘  │  ┌──────────────────────────┐  │
│                           │  │  MIGRATION REPORT        │  │
│                           │  │  (rendered markdown)     │  │
│                           │  └──────────────────────────┘  │
└───────────────────────────┴─────────────────────────────────┘
```

### 4.2 Header
- Logo: hexagon icon + "TS·FORGE" in Syne Bold + "AI Migration Agent" tag
- API Key section: masked text input with eye-toggle + "Save for session" button
  - Placeholder: "sk-ant-api03-..."
  - On save: show green "✓ Connected" badge
  - Key stored ONLY in sessionStorage (cleared on tab close)
  - Tooltip: "Your key is used only to call the Anthropic API directly from your browser. It is never stored on any server."
- Theme toggle: sun/moon SVG icon
- GitHub link: opens project repo

### 4.3 Input Panel

THREE tabs:
  [📁 File Upload] [✏️ Paste Code] [🔗 GitHub URL]

FILE UPLOAD TAB:
  - Large drag-and-drop zone with dashed animated border
  - Accepts: .js, .jsx, .mjs, .cjs, .json (for package.json), .zip, .tar.gz
  - On drag-over: border highlights, background tints blue, shows "Drop to add"
  - File queue: scrollable list showing each file with:
    - Filename (sanitized display via textContent)
    - File size (formatted: "12.4 KB")
    - Type badge (.js / .jsx / .mjs)
    - Remove button (✕)
  - "Browse Files" button for file picker
  - "Clear All" button

PASTE CODE TAB:
  - Full-height textarea styled as a code editor (JetBrains Mono, dark bg)
  - Line numbers (CSS counter-based, no JS required)
  - Language selector dropdown (JavaScript / JSX / Node.js / React)
  - "Load Sample" button (loads test/sample.js)
  - Character count display (bottom-right)

GITHUB URL TAB:
  - URL input field
  - Accepts formats:
    - https://github.com/user/repo
    - https://github.com/user/repo/tree/branch
    - https://raw.githubusercontent.com/user/repo/branch/file.js
  - "Fetch" button — calls GitHub raw content API (no auth needed for public repos)
  - Shows fetched file tree in a collapsible list
  - Note: "Only public repositories are supported. File contents are fetched
    directly from GitHub and never sent to any server other than the Anthropic API."

MIGRATE BUTTON:
  - Large, full-width primary CTA at bottom of input panel
  - Label: "▶ Migrate to TypeScript"
  - States: default / loading (spinning + "Migrating...") / complete / error
  - Disabled when: no input OR no API key
  - On click: validates inputs, starts agent pipeline, disables button

### 4.4 Output Panel

FILE TABS (when multiple files processed):
  - Tab bar showing each output file: "api.ts", "auth.ts", "user.ts", etc.
  - Active tab highlighted
  - tsconfig.json, package.json shown in additional tabs

CODE VIEWER:
  - Syntax-highlighted TypeScript display (implement lightweight highlighter
    using regex-based tokenization for: keywords, types, strings, comments,
    decorators, generics — no external library needed)
  - Line numbers
  - Lines containing "// @ts-review" highlighted in amber background
  - "Copy" button (top-right of each file panel)
  - Hover over @ts-review lines shows a tooltip with the full review reason

DOWNLOAD BAR:
  - "↓ Download [filename].ts" for single file
  - "↓ Download Migration Package (.zip)" for multi-file
    ZIP contains: all .ts files + tsconfig.json + package.json + README-migration.md
  - Uses client-side ZIP generation (implement using pure JS — no library needed,
    use the ZIP format specification directly — deflate is optional, store method OK)

### 4.5 Migration Report (right panel, below flow diagram)

Rendered as formatted HTML from the markdown output of Stage 6:
  - Executive summary card
  - Stats row: Files | Lines | Coverage % | Review Items | Est. Hours
  - Review items table with columns:
    File | Line | Identifier | Inferred Type | Confidence | Action
  - Color coding: certain=green, inferred=amber, ambiguous=red
  - "@types packages" section with copy-to-clipboard npm install command
  - Collapsible sections

### 4.6 Modals

API KEY HELP MODAL (triggered by "?" icon next to API key input):
  - Explains what the API key is and how to get one
  - Steps: 1. Go to console.anthropic.com  2. Create account  3. Generate key
  - Security explanation
  - "Got it" close button

ERROR MODAL:
  - Non-blocking toast (bottom-right, auto-dismiss after 8 seconds)
  - Types: info (blue), warning (amber), error (red), success (green)

---

## ═══════════════════════════════════════════════════════
## SECTION 5 — SYSTEM PROMPTS FOR EACH AGENT STAGE
## ═══════════════════════════════════════════════════════

These are the exact system prompts to embed in agent.js for each stage.
The AI must use these verbatim in the implementation.

### Stage 1 System Prompt (ANALYSIS):
```
You are a JavaScript codebase analysis expert. Your task is to analyze the
provided JavaScript source code and produce a structured JSON analysis.

Analyze the code for:
1. Module system: detect CommonJS (require/module.exports), ESM (import/export),
   AMD (define), or mixed
2. Framework/runtime: detect React, Vue, Angular, Express, Node.js, browser, etc.
3. JSDoc coverage: percentage of functions/classes with JSDoc comments
4. All function declarations: name, parameters (with inferred types from usage
   and JSDoc), return type, async status, line number
5. All class declarations: name, extends, properties, methods
6. All variable declarations: name, inferred type, mutability (const/let/var)
7. All import/require statements
8. All export statements

Return ONLY valid JSON matching this exact schema:
{
  "module_system": "esm|commonjs|amd|mixed",
  "framework": "react|vue|node|browser|express|unknown",
  "jsdoc_coverage": 0-100,
  "complexity": "low|medium|high",
  "functions": [{"name":"","params":[{"name":"","inferred_type":""}],"return_type":"","is_async":false,"line":0}],
  "classes": [{"name":"","extends":"","properties":[{"name":"","inferred_type":""}],"methods":[]}],
  "variables": [{"name":"","inferred_type":"","mutable":true}],
  "imports": [{"source":"","specifiers":[]}],
  "exports": [{"name":"","type":""}]
}
No explanation text. JSON only.
```

### Stage 2 System Prompt (TYPE INFERENCE):
```
You are a TypeScript type inference expert. Given a JavaScript analysis JSON
and the original source code, produce a comprehensive type mapping.

For each identifier in the analysis, determine the most precise TypeScript type:
- Use TypeScript built-in types: string, number, boolean, null, undefined, 
  never, unknown, any (last resort only), void
- Use generic types: Array<T>, Promise<T>, Map<K,V>, Set<T>
- Infer object shapes as interfaces rather than generic objects
- Use union types (A | B) where multiple types are possible
- Use intersection types where composition is observed
- Use literal types for string/number constants
- Classify confidence: "certain" (from explicit JSDoc or obvious usage),
  "inferred" (from usage patterns), "ambiguous" (unclear, use unknown)

Return ONLY valid JSON:
{
  "type_map": {
    "[identifier_name]": {
      "ts_type": "string",
      "confidence": "certain|inferred|ambiguous",
      "reason": "brief explanation"
    }
  }
}
No explanation text. JSON only.
```

### Stage 3 System Prompt (INTERFACE GENERATION):
```
You are a TypeScript interface design expert. Given the JavaScript source and
its type analysis, generate all TypeScript interfaces, type aliases, and enums
needed to fully type the codebase.

Rules:
1. Create an interface for every distinct object shape (3+ properties)
2. Create type aliases for complex union/intersection types
3. Create enums for string/number constant groups
4. Use generic interfaces where the same shape recurs with different types
5. Export all interfaces (they'll go in a types.ts file)
6. Prefer interface over type alias for object shapes (extensibility)
7. Add JSDoc comments to each interface describing its purpose
8. Use readonly for properties that should not be mutated
9. Use ? for optional properties (inferred from conditional access patterns)

Return ONLY the TypeScript declaration code as a string.
No JSON wrapper. Pure TypeScript interface/type declarations only.
```

### Stage 4 System Prompt (CODE TRANSFORMATION):
```
You are an expert JavaScript-to-TypeScript migration engineer. Convert the
provided JavaScript code to fully-typed TypeScript following these rules:

MANDATORY TRANSFORMATIONS:
1. Add explicit TypeScript type annotations to ALL function parameters
2. Add explicit return types to ALL functions
3. Convert var declarations to const (if never reassigned) or let
4. Convert require() to import statements using ESM syntax
5. Add type annotations to all variable declarations where type isn't obvious
6. Add access modifiers to class members (public/private/protected/readonly)
7. Implement strict null checks: use ?. and ?? where nullish access is possible
8. Convert callbacks to typed async/await where the pattern is clear
9. Add generic type parameters to generic functions/classes
10. Convert PropTypes (React) to TypeScript interface props

REVIEW MARKERS:
For any transformation you are not fully confident in, add a comment:
// @ts-review: [specific reason why human review is needed]

QUALITY STANDARDS:
- The output must compile with: tsc --strict --noImplicitAny
- Do not use `any` type unless absolutely unavoidable (and mark with @ts-review)
- Preserve all original logic exactly — only add types, do not refactor logic
- Preserve all original comments
- Add @ts-nocheck ONLY at the top if the file is truly unmigrateable

Return ONLY the complete TypeScript file content. No explanation.
```

### Stage 5 System Prompt (CONFIG GENERATION):
```
You are a TypeScript project configuration expert. Based on the codebase
analysis provided, generate optimal configuration files.

Generate a JSON object with these keys:

"tsconfig": The complete tsconfig.json content (as a JSON string) with:
  - compilerOptions.strict: true
  - compilerOptions.noImplicitAny: true
  - compilerOptions.strictNullChecks: true
  - compilerOptions.noUnusedLocals: true
  - appropriate target (ES2020 for Node, ES2017 for browser)
  - appropriate module (CommonJS for Node, ESNext for browser/React)
  - paths configuration if needed

"package_additions": Object with devDependencies to add (typescript, ts-node,
  @types/* packages specific to detected framework and imports)

"eslintrc": Complete .eslintrc.json for TypeScript ESLint

"migrate_sh": Bash script that: installs devDependencies, runs tsc --init
  (overwritten by our tsconfig), compiles, and reports errors

"migrate_ps1": PowerShell equivalent of migrate_sh

Return ONLY valid JSON with the above keys. No explanation.
```

### Stage 6 System Prompt (REPORT):
```
You are a senior engineering consultant producing a migration analysis report.
Based on all the migration data provided, write a comprehensive migration report.

The report must include:
1. ## Executive Summary (2-3 sentences)
2. ## Migration Statistics (table: metric | value)
3. ## Type Coverage Analysis (breakdown by confidence level)
4. ## Files Requiring Human Review (table: file | items | priority | effort)
5. ## Review Items Detail (table: file | line | identifier | type | confidence | recommended action)
6. ## Dependencies to Install (npm install command, list of @types packages)
7. ## Breaking Changes (list any patterns that could change runtime behavior)
8. ## Estimated Effort (table: task | hours | notes)
9. ## Next Steps (numbered list of recommended actions)

Use Markdown formatting. Be specific — include actual file names, line numbers,
identifier names from the migration data. Do not use placeholder text.
```

---

## ═══════════════════════════════════════════════════════
## SECTION 6 — SECURITY REQUIREMENTS
## ═══════════════════════════════════════════════════════

All of the following security controls MUST be implemented:

6.1 INPUT SANITIZATION
  - All filenames displayed via element.textContent (never innerHTML)
  - All code content displayed via pre/code textContent or a safe highlight fn
  - GitHub URLs validated against regex before fetch:
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/
  - File type validation: check MIME type AND extension (both must match)
  - Maximum file size: 500KB per file, 5MB total
  - Maximum file count: 50 files per migration run

6.2 API KEY SECURITY
  - Stored in sessionStorage only (auto-cleared on tab close)
  - Masked in UI (type="password" input)
  - Never logged to console
  - Never included in error messages
  - Never sent anywhere except api.anthropic.com
  - Input validated: must match /^sk-ant-[a-zA-Z0-9_-]+$/

6.3 CONTENT SECURITY POLICY
  - Meta CSP tag as specified in Section 3.1
  - No eval() anywhere in the codebase
  - No new Function() anywhere in the codebase
  - No document.write() anywhere

6.4 DEPENDENCY SECURITY
  - Zero npm dependencies in the web app itself
  - No CDN-loaded libraries (reduces supply chain attack surface)
  - All code is self-contained in the 5 files

6.5 DATA HANDLING
  - User code never sent anywhere except Anthropic API
  - No analytics, no tracking, no third-party scripts
  - No cookies set
  - Clear privacy notice in footer

---

## ═══════════════════════════════════════════════════════
## SECTION 7 — README.md SPECIFICATION
## ═══════════════════════════════════════════════════════

Produce a README.md with these sections:

```markdown
# TS·FORGE — AI-Powered JavaScript→TypeScript Migration Agent

![License](badge) ![TypeScript](badge) ![GitHub Pages](badge)

## Overview
[2-3 paragraph product description]

## Live Demo
[Link placeholder for GitHub Pages URL]

## Features
[Feature list with subsections for Core AI, Input Handling, Output, Security]

## How It Works
[Architecture diagram in ASCII art + description of 6-stage pipeline]

## Getting Started
### Prerequisites
### Installation (clone + open index.html OR deploy to GitHub Pages)
### Configuration (API key setup)

## Usage Guide
### Single File Migration
### Multi-File Codebase Migration
### GitHub Repository Migration
### Understanding the Migration Report

## Supported Input Formats
[Table of all accepted file types with descriptions]

## Output Files
[Description of all generated files]

## Agent Pipeline
[Detailed description of each of the 6 stages]

## Security & Privacy
[Security model explanation]

## GitHub Pages Deployment
[Step-by-step deployment instructions]

## Local Development
[How to run locally — just open index.html, no build step]

## Limitations
[Known limitations: file size limits, private repos not supported, etc.]

## Contributing
[Contribution guidelines]

## License
MIT

## Acknowledgments
[Claude AI, Anthropic]
```

---

## ═══════════════════════════════════════════════════════
## SECTION 8 — REQUIREMENTS.md SPECIFICATION
## ═══════════════════════════════════════════════════════

Produce a REQUIREMENTS.md with these sections:

```markdown
# Technical Requirements Specification
## TS·FORGE v1.0.0

### 1. Functional Requirements
  1.1 Input Requirements (FR-IN-001 through FR-IN-010)
  1.2 Migration Requirements (FR-MIG-001 through FR-MIG-020)
  1.3 Output Requirements (FR-OUT-001 through FR-OUT-010)
  1.4 Report Requirements (FR-RPT-001 through FR-RPT-008)

### 2. Non-Functional Requirements
  2.1 Performance (NFR-PERF-001 through NFR-PERF-005)
  2.2 Security (NFR-SEC-001 through NFR-SEC-010)
  2.3 Usability (NFR-UX-001 through NFR-UX-008)
  2.4 Reliability (NFR-REL-001 through NFR-REL-005)
  2.5 Compatibility (NFR-COMP-001 through NFR-COMP-005)

### 3. API Requirements
  [Anthropic API integration requirements]

### 4. Browser Compatibility
  [Chrome 90+, Firefox 90+, Safari 15+, Edge 90+]

### 5. Deployment Requirements
  [GitHub Pages, static hosting requirements]

### 6. Acceptance Criteria
  [Testable acceptance criteria for each major feature]
```

Each requirement must be:
  - Numbered (FR-IN-001, etc.)
  - Titled
  - Described in 1-2 sentences
  - Marked with priority: MUST / SHOULD / MAY

---

## ═══════════════════════════════════════════════════════
## SECTION 9 — TEST FIXTURES
## ═══════════════════════════════════════════════════════

### 9.1 test/sample.js — Single File Test Fixture

Create a single JavaScript file that exercises every type inference challenge:

Requirements for this file:
  - 200-300 lines of realistic, runnable JavaScript
  - Domain: a fintech utility module (appropriate for the expertise domain)
  - Must include:
    a) Multiple function declarations with JSDoc (some complete, some missing)
    b) At least 2 ES6 classes with constructor, methods, getters/setters
    c) At least 1 class that extends another
    d) Arrow functions assigned to const variables
    e) A function returning a Promise (callback style)
    f) Object destructuring in function parameters
    g) Array methods (map, filter, reduce) with callbacks
    h) Default parameter values
    i) Rest parameters
    j) Spread operator usage
    k) Template literals
    l) Computed property names
    m) Module exports (ESM: export default + named exports)
    n) Nullish coalescing and optional chaining (already in JS — test preservation)
    o) A higher-order function (function that returns a function)
    p) An immediately-invoked function expression (IIFE)
    q) A Symbol usage
    r) A WeakMap or WeakRef usage
    s) At least one intentionally ambiguous type (to test @ts-review flagging)

  The file must be realistic fintech code: payment processing, currency
  formatting, transaction validation, risk scoring, etc.

### 9.2 test/sample-codebase/ — Multi-File Codebase Test Fixture

Create a realistic multi-file Node.js/Express + React fintech application:

FILE: test/sample-codebase/package.json
  - Name: "fintech-dashboard"
  - Dependencies: express, react, react-dom, axios, lodash
  - Scripts: start, build, test

FILE: test/sample-codebase/src/api.js
  - Express router setup
  - REST endpoints: GET /users, POST /transactions, GET /balance/:userId
  - Request validation middleware
  - Error handling middleware
  - Uses require() (CommonJS)

FILE: test/sample-codebase/src/auth.js
  - JWT-based authentication utility
  - Functions: generateToken, verifyToken, hashPassword, comparePassword
  - Uses callbacks and promises (mixed — to test conversion)

FILE: test/sample-codebase/src/models/user.js
  - User model class with: id, email, name, balance, createdAt
  - Static factory method: User.fromDatabase(row)
  - Instance method: toSafeObject() (excludes password hash)
  - Validation method: validate()

FILE: test/sample-codebase/src/models/transaction.js
  - Transaction model with: id, fromUserId, toUserId, amount, currency,
    status (pending/complete/failed), metadata
  - Methods: process(), refund(), toDisplayString()
  - Uses EventEmitter (Node.js)

FILE: test/sample-codebase/src/services/paymentService.js
  - PaymentService class
  - Methods: initiateTransfer, processPayment, refundTransaction,
    getTransactionHistory, calculateFees
  - Uses multiple async patterns (callbacks, promises, async/await mixed)
  - Has intentional type ambiguities for @ts-review testing

FILE: test/sample-codebase/src/utils/validators.js
  - Pure validation functions: validateEmail, validateAmount, validateCurrency,
    validateIBAN, validateCreditCard
  - Each returns either true or an error message string (union type challenge)
  - Uses regex extensively

FILE: test/sample-codebase/src/utils/formatters.js
  - Currency formatter (uses Intl.NumberFormat)
  - Date formatter (relative and absolute)
  - IBAN formatter (add spaces)
  - Number formatter with locale support
  - All functions are pure (no side effects)

FILE: test/sample-codebase/src/components/Dashboard.jsx
  - React functional component
  - Uses useState, useEffect, useCallback, useMemo hooks
  - PropTypes definitions (to be converted to TypeScript interfaces)
  - Renders: balance display, transaction list, transfer form
  - Has typed event handlers

---

## ═══════════════════════════════════════════════════════
## SECTION 10 — IMPLEMENTATION CONSTRAINTS
## ═══════════════════════════════════════════════════════

10.1 CODE QUALITY
  - No TODO comments in production code (test fixtures may have them for demo)
  - No console.log in production code (use a structured logger with levels)
  - All async functions have try/catch blocks
  - All event listeners cleaned up (no memory leaks)
  - ESLint-clean code (assume eslint:recommended rules)

10.2 COMPLETENESS
  - Every function in every file must be fully implemented
  - No placeholder returns (return null where real logic is needed)
  - No "// implementation here" stubs
  - The app must work end-to-end when a user:
    1. Opens index.html in a browser
    2. Enters their Anthropic API key
    3. Pastes the test/sample.js content
    4. Clicks "Migrate to TypeScript"
    5. Sees all 6 stages complete
    6. Views the TypeScript output
    7. Downloads the result

10.3 SYNTAX HIGHLIGHTER IMPLEMENTATION
  Implement a minimal JavaScript/TypeScript syntax highlighter without
  any external library. Use regex-based tokenization to identify and
  wrap these token types in <span> elements with CSS classes:
    .tok-keyword   — TypeScript/JS keywords
    .tok-type      — TypeScript built-in types
    .tok-string    — string literals
    .tok-comment   — // and /* */ comments
    .tok-number    — numeric literals
    .tok-operator  — operators
    .tok-decorator — @ decorators
    .tok-review    — lines with @ts-review (full line highlight)
  The highlighter must XSS-safe: escape all HTML entities before applying
  span wrapping.

10.4 ZIP GENERATION IMPLEMENTATION
  Implement a minimal client-side ZIP file generator without any external
  library. Use the ZIP local file header format (STORE method, no compression):
    - Local file header signature: 0x04034b50
    - Central directory structure
    - End of central directory record
  Encode file contents as UTF-8 Uint8Array and build the binary ZIP using
  DataView. Trigger download via URL.createObjectURL(new Blob([zipBuffer])).

10.5 PROGRESSIVE ENHANCEMENT
  The app must be functional at every stage:
    - On load with no API key: shows key input, input panel, but migrate
      button is disabled with message "Enter your API key to migrate"
    - During migration: shows live progress, button shows spinner
    - On completion: shows full output, enables download
    - On error: shows error toast, re-enables button for retry

---

## ═══════════════════════════════════════════════════════
## SECTION 11 — EXECUTION INSTRUCTIONS
## ═══════════════════════════════════════════════════════

Execute this project in the following order. After completing each phase,
state which phase you completed and what files were produced.

PHASE 1: Core Infrastructure
  Produce: index.html, styles.css
  Checkpoint: "Phase 1 complete — HTML shell and styling system ready"

PHASE 2: Application Logic
  Produce: app.js (complete, no stubs)
  Checkpoint: "Phase 2 complete — Application controller ready"

PHASE 3: AI Agent Engine
  Produce: agent.js (complete, with all 6 stages and system prompts)
  Checkpoint: "Phase 3 complete — Migration agent engine ready"

PHASE 4: Flow Visualizer
  Produce: flow.js (complete animated SVG pipeline)
  Checkpoint: "Phase 4 complete — Flow visualizer ready"

PHASE 5: Documentation
  Produce: README.md, REQUIREMENTS.md
  Checkpoint: "Phase 5 complete — Documentation ready"

PHASE 6: Test Fixtures
  Produce: test/sample.js, all test/sample-codebase/* files
  Checkpoint: "Phase 6 complete — Test fixtures ready"

PHASE 7: Quality Review
  Review all produced files for:
    - Security vulnerabilities (XSS, injection, key exposure)
    - Incomplete implementations (stubs, TODOs, missing features)
    - Broken cross-file references (function names, CSS class names, IDs)
    - API call correctness (headers, model name, response parsing)
  State any issues found and fix them.
  Checkpoint: "Phase 7 complete — All files verified and production-ready"

---

## ═══════════════════════════════════════════════════════
## FINAL INSTRUCTION TO THE AI
## ═══════════════════════════════════════════════════════

Begin immediately with Phase 1. Do not ask clarifying questions — all
requirements are specified above. If you encounter an ambiguity, choose
the most secure and complete interpretation.

Produce every file in full. If a file exceeds your output limit, continue
in the next message when prompted "Continue [filename]".

The measure of success is: a user can clone the output files, open
index.html, enter their API key, and successfully migrate both
test/sample.js and the full test/sample-codebase/ with no errors.
```

---
*End of Master Prompt — TS·FORGE AI Migration Agent*
*Version 1.0 | Engineered for Claude claude-sonnet-4-20250514*
