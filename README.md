# TS·FORGE — AI-Powered JavaScript→TypeScript Migration Agent

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-222.svg)
![Claude](https://img.shields.io/badge/Powered%20by-Claude%20claude--sonnet--4--20250514-orange.svg)

## Overview

TS·FORGE is a production-ready, single-page web application that uses the Anthropic Claude API to intelligently migrate JavaScript codebases to fully-typed TypeScript. It handles everything from single files to multi-file repositories, with zero server infrastructure required — all processing happens in your browser.

The tool implements a 6-stage agentic pipeline: static analysis, type inference, interface generation, code transformation, configuration generation, and comprehensive report generation. Each stage calls Claude independently, enabling real-time progress visualization and maximum type inference quality.

TS·FORGE is designed for enterprise-scale migrations. It follows OWASP security guidelines, enforces strict input sanitization, stores your API key only in sessionStorage, and never transmits your code to any server other than the Anthropic API.

## Live Demo

Deploy to GitHub Pages and access at: `https://<your-username>.github.io/ts-forge/`

## Features

### Core AI Migration
- **6-stage agentic pipeline** using Claude claude-sonnet-4-20250514
- **Intelligent type inference** with confidence scoring (certain / inferred / ambiguous)
- **Interface generation** — creates TypeScript interfaces, type aliases, and enums
- **Full code transformation** — converts syntax, module system, class modifiers, async patterns
- **tsconfig.json generation** tuned to detected framework and runtime
- **Migration report** with coverage stats, review items table, and effort estimates

### Input Handling
- **File upload** — drag-and-drop or browse: `.js`, `.jsx`, `.mjs`, `.cjs`, `.json`, `.zip`
- **Paste code** — full-height code editor with live line numbers and syntax
- **GitHub URL** — fetch public repository files directly from the GitHub API
- Up to 50 files, 500 KB per file, 5 MB total

### Output
- **Syntax-highlighted TypeScript** display with `@ts-review` line highlighting
- **Per-file tabs** for multi-file output
- **Client-side ZIP download** (no server, no library — pure JS ZIP implementation)
- **Migration report** rendered from Markdown with stats cards

### Security
- API key stored in `sessionStorage` only (cleared on tab close)
- All user content displayed via `textContent` (never `innerHTML`)
- Content Security Policy meta tag blocks CDN and inline scripts
- Zero npm dependencies, no CDN-loaded libraries
- Input validation: file types, sizes, API key format, GitHub URL pattern

## How It Works

```
User Input
    │
    ▼
┌─────────────────────────────────────────────────────┐
│            6-STAGE AGENTIC PIPELINE                 │
│                                                     │
│  [1] Codebase Analyzer    → JSON structure report   │
│         │                                           │
│  [2] Type Inference Engine → identifier→type map    │
│         │                                           │
│  [3] Interface Architect  → TypeScript declarations │
│         │                                           │
│  [4] Code Transformer     → Full .ts file output   │
│         │                                           │
│  [5] Config Generator     → tsconfig.json + scripts │
│         │                                           │
│  [6] Migration Reporter   → Markdown report         │
└─────────────────────────────────────────────────────┘
    │
    ▼
TypeScript Output + Config Files + Migration Report
```

Each stage calls the Anthropic API independently with a specialized system prompt. This architecture allows for parallel progress display, granular error recovery, and maximum quality at each step.

## Getting Started

### Prerequisites
- A modern web browser (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+)
- A free Anthropic API key from [console.anthropic.com](https://console.anthropic.com)

### Installation

**Option A — GitHub Pages (recommended)**
```bash
git clone https://github.com/<your-username>/ts-forge.git
cd ts-forge
# Push to GitHub and enable Pages in repo Settings → Pages → Source: main / root
```

**Option B — Run Locally**
```bash
git clone https://github.com/<your-username>/ts-forge.git
cd ts-forge
# Open index.html directly in your browser (no build step needed)
# Or serve with any static file server:
npx serve .
# or
python -m http.server 8080
```

### Configuration

1. Open TS·FORGE in your browser
2. Paste your Anthropic API key in the key field (top right)
3. Click **Save for session**
4. The key is stored only in `sessionStorage` — it disappears when you close the tab

## Usage Guide

### Single File Migration
1. Click the **Paste Code** tab
2. Paste your JavaScript code (or click **Load Sample** to try the included fintech example)
3. Click **▶ Migrate to TypeScript**
4. Watch the 6-stage pipeline complete in the right panel
5. View the TypeScript output and migration report
6. Click **Download** to save the `.ts` file

### Multi-File Codebase Migration
1. Click the **File Upload** tab
2. Drag-and-drop your `.js`/`.jsx` files, or use **Browse Files**
3. `.zip` archives are automatically extracted
4. Click **▶ Migrate to TypeScript**
5. Use the output tabs to browse each converted file
6. Click **Download Migration Package (.zip)** to download all files

### GitHub Repository Migration
1. Click the **GitHub URL** tab
2. Enter a public GitHub repository URL: `https://github.com/user/repo`
3. Click **Fetch** — TS·FORGE will show all JavaScript files in the repository root
4. Check/uncheck files, then click **Import selected files**
5. Click **▶ Migrate to TypeScript**

### Understanding the Migration Report
- **Stats row**: Files, Lines, Type Coverage %, Review Items, Estimated Hours
- **Type Coverage**: Breakdown of certain / inferred / ambiguous identifiers
- **Review Items Table**: Every `// @ts-review` comment with file, line, identifier, type, confidence, and recommended action
- **Dependencies**: npm install command for all required `@types/*` packages
- **Next Steps**: Prioritized list of recommended manual actions

## Supported Input Formats

| Extension | Description |
|-----------|-------------|
| `.js`     | Standard JavaScript (ES5–ES2022) |
| `.jsx`    | React JSX files |
| `.mjs`    | ES Modules JavaScript |
| `.cjs`    | CommonJS JavaScript |
| `.json`   | package.json (for dependency analysis) |
| `.zip`    | ZIP archive (extracted automatically, STORE method) |

## Output Files

| File | Description |
|------|-------------|
| `*.ts` / `*.tsx` | Converted TypeScript files |
| `tsconfig.json` | Strict TypeScript configuration |
| `package-types-additions.json` | devDependencies to add |
| `.eslintrc.json` | TypeScript ESLint configuration |
| `migrate.sh` | Bash migration helper script |
| `migrate.ps1` | PowerShell migration helper script |

## Agent Pipeline

### Stage 1 — Codebase Analyzer
Produces a structured JSON analysis: module system (ESM/CJS/AMD), framework detection, JSDoc coverage percentage, all function/class/variable declarations with inferred types, import/export maps.

### Stage 2 — Type Inference Engine
For every identifier in Stage 1's output, infers the most specific TypeScript type possible. Classifies confidence as `certain`, `inferred`, or `ambiguous`. Uses JSDoc, naming conventions, and usage context.

### Stage 3 — Interface Architect
Generates all TypeScript interface declarations, type aliases, and enums needed to type the codebase. Applies best practices: `readonly`, optional properties, generics, discriminated unions.

### Stage 4 — Code Transformer
Performs the full JavaScript→TypeScript conversion. Adds type annotations, converts `var`/`require`, adds class visibility modifiers, implements strict null checks, converts callbacks to `async/await`. Marks uncertain items with `// @ts-review` comments.

### Stage 5 — Config Generator
Produces `tsconfig.json` with strict mode settings tailored to the detected framework (Node/browser/React). Also generates ESLint config and shell scripts for the migration workflow.

### Stage 6 — Migration Reporter
Produces a comprehensive Markdown migration report covering statistics, all review items, dependencies to install, potential breaking changes, and estimated effort.

## Security & Privacy

- **API key**: Stored in `sessionStorage` only — never in `localStorage`, never sent to any server except `api.anthropic.com`. Validated against `/^sk-ant-[a-zA-Z0-9_-]+$/` before use.
- **User code**: Sent only to `api.anthropic.com` via `fetch()`. Never logged, never stored server-side.
- **XSS prevention**: All user-controlled data (filenames, code content) is set via `element.textContent`. The syntax highlighter escapes all HTML entities before applying `<span>` wrappers.
- **CSP**: Meta Content Security Policy blocks inline scripts, unauthorized CDNs, and non-Anthropic API calls.
- **No tracking**: No analytics, no cookies, no third-party scripts.
- **Zero dependencies**: The entire app is 5 files of vanilla HTML/CSS/JS with no build step.

## GitHub Pages Deployment

1. Fork or clone this repository
2. In GitHub: **Settings → Pages → Source** → select `main` branch, `/ (root)` folder
3. Click **Save** — your app will be live at `https://<username>.github.io/<repo-name>/`
4. No build step, no CI/CD required — all files are already production-ready

## Local Development

No build tooling is required. The app is vanilla HTML5 + CSS3 + JavaScript.

```bash
# Serve with any of these:
npx serve .
npx http-server . -p 8080
python -m http.server 8080
php -S localhost:8080
```

Open `http://localhost:8080` and the app is fully functional.

To test with the included sample:
1. Click **Paste Code** → **Load Sample** (loads `test/sample.js`)
2. Enter your API key and click **Migrate**

## Limitations

- **Private repositories**: GitHub URL mode only works with public repositories
- **File size**: 500 KB per file (Anthropic context window constraint)
- **ZIP extraction**: Only the STORE (uncompressed) method is supported for ZIP reading
- **Large codebases**: Files are processed sequentially, not in parallel
- **Complex generics**: Very advanced TypeScript patterns may get `// @ts-review` markers
- **Dynamic code**: Runtime-constructed types cannot be statically inferred
- **Compression**: ZIP output uses STORE method (no DEFLATE compression)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes (no build step needed)
4. Test by opening `index.html` locally
5. Submit a pull request with a clear description

Please ensure:
- No new external dependencies
- All user input still goes through `textContent` (no `innerHTML` with untrusted data)
- API key must never appear in console, error messages, or logs
- New features follow the existing security model

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [Anthropic](https://www.anthropic.com) — Claude claude-sonnet-4-20250514 powers all 6 migration stages
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — Monospace font for code display
- [Syne](https://fonts.google.com/specimen/Syne) / [DM Sans](https://fonts.google.com/specimen/DM+Sans) — Display and body typography
