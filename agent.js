/* ═══════════════════════════════════════════════════════
   TS·FORGE — Migration Agent Engine (agent.js)
   API: Groq (free tier) — llama-3.3-70b-versatile (primary)
                         — meta-llama/llama-4-scout-17b-16e-instruct (TPM fallback, 30k TPM)
   ═══════════════════════════════════════════════════════ */

'use strict';

const MigrationAgent = (() => {
  // ── Constants ─────────────────────────────────────────
  // Models tried in order. On TPM-rate-limit (429 tokens/min), the engine
  // automatically falls back to the next model in the list.
  // llama-3.3-70b: 12,000 TPM free | llama-4-scout-17b: 30,000 TPM free
  const MODELS = ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'];
  const MAX_OUTPUT_TOKENS = 4096;  // reduced from 8192 — Groq charges both input+output against TPM
  const MAX_TOKENS_PER_BATCH = 2000;  // reduced from 4000 to stay under 12k TPM/min
  const MAX_RETRIES = 6;

  // Sticky model index — shared across all stages in one migration run.
  // Once we fall back to the secondary model due to TPM limits, we stay on
  // it for all subsequent calls so we don't re-hammer the exhausted primary.
  let _activeModelIdx = 0;
  const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

  const STAGES = [
    { index: 0, name: 'Codebase Analyzer',   desc: 'Extracting structure and patterns' },
    { index: 1, name: 'Type Inference Engine', desc: 'Inferring TypeScript types' },
    { index: 2, name: 'Interface Architect',  desc: 'Generating interfaces & types' },
    { index: 3, name: 'Code Transformer',     desc: 'Converting JS to TypeScript' },
    { index: 4, name: 'Config Generator',     desc: 'Generating tsconfig & scripts' },
    { index: 5, name: 'Migration Reporter',   desc: 'Producing migration report' },
  ];

  // ── System Prompts ────────────────────────────────────
  const SYSTEM_PROMPTS = {
    analysis: `You are a JavaScript codebase analysis expert. Your task is to analyze the
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
No explanation text. JSON only.`,

    typeInference: `You are a TypeScript type inference expert. Given a JavaScript analysis JSON
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
No explanation text. JSON only.`,

    interfaces: `You are a TypeScript interface design expert. Given the JavaScript source and
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
No JSON wrapper. Pure TypeScript interface/type declarations only.`,

    transform: `You are an expert JavaScript-to-TypeScript migration engineer. Convert the
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

REVIEW MARKERS — MANDATORY:
For ANY of the following, you MUST add a trailing comment on the same line:
// @ts-review: [specific reason]
  - Any use of \`any\` type (mandatory)
  - Any function where the return type is inferred from complex logic
  - Any parameter whose type cannot be 100% confirmed from usage alone
  - Any class property whose type could be more than one option
  - Any cast or type assertion (as X)
  - Any generic function where the type parameter is a guess
  - Any variable initialised to null or undefined
  - Any interface field that might be optional but you aren't certain
When in doubt, always add @ts-review. It is far better to review too many
lines than to silently produce a wrong type. Aim for at least 2-3 @ts-review
markers per file unless the file is trivially simple (< 20 lines).

QUALITY STANDARDS:
- The output must compile with: tsc --strict --noImplicitAny
- Do not use \`any\` type unless absolutely unavoidable (and mark with @ts-review)
- Preserve all original logic exactly — only add types, do not refactor logic
- Preserve all original comments
- Add @ts-nocheck ONLY at the top if the file is truly unmigrateable

Return ONLY the complete TypeScript file content. No explanation.`,

    config: `You are a TypeScript project configuration expert. Based on the codebase
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

"package_additions": Object with ALL devDependencies to add. You MUST include:
  - "typescript": "^5.0.0"
  - "ts-node": "^10.0.0"
  - "@typescript-eslint/parser": "^7.0.0"
  - "@typescript-eslint/eslint-plugin": "^7.0.0"
  - PLUS every specific "@types/*" package needed for the imports list provided.
    For example: if "express" is imported → add "@types/express"
    if "lodash" → "@types/lodash", if "node" APIs (fs, path, etc.) → "@types/node"
    Only include @types/* packages for modules that DO NOT ship their own types.
    Do NOT add @types for: react (v18+), typescript itself, or ESM-only packages.

"eslintrc": Complete .eslintrc.json for TypeScript ESLint

"migrate_sh": Bash script that installs devDependencies and runs tsc --noEmit

"migrate_ps1": PowerShell equivalent of migrate_sh

Return ONLY valid JSON with the above keys. No explanation.`,

    report: `You are a senior engineering consultant producing a migration analysis report.
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
identifier names from the migration data. Do not use placeholder text.`,
  };

  // ── Core API Caller ───────────────────────────────────
  // Groq uses OpenAI-compatible Chat Completions API.
  // Free tier: 14,400 req/day — no billing required.
  async function callGroq(apiKey, systemPrompt, userPrompt, signal, model) {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2,
      }),
      signal,
    });

    if (!response.ok) {
      // Read Retry-After header so callers can respect rate-limit windows
      const retryAfterSec = response.headers.get('retry-after');
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || `API error ${response.status}`;
      const error = new Error(msg);
      error.status = response.status;
      error.retryAfterMs = retryAfterSec ? parseFloat(retryAfterSec) * 1000 : null;
      throw error;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty response from Groq API');
    return text;
  }

  // ── Retry + Model-Fallback Wrapper ────────────────────
  // Uses the shared _activeModelIdx so that once the pipeline falls back to
  // the secondary model, ALL subsequent stage calls also use it.
  // On TPM 429: advance to next model (sticky) + brief settle delay.
  // On other 429s: honour Retry-After header, else exponential backoff.
  async function callGroqWithRetry(apiKey, systemPrompt, userPrompt, signal) {
    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        return await callGroq(apiKey, systemPrompt, userPrompt, signal, MODELS[_activeModelIdx]);
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        lastError = err;

        const is429   = err.status === 429 || err.message?.includes('429');
        const isTPM   = is429 && (
          err.message?.includes('tokens per minute') ||
          err.message?.includes('TPM') ||
          err.message?.includes('rate_limit_exceeded') ||
          err.message?.includes('Request too large')
        );
        const isRetryable = is429 ||
                            err.message?.includes('500') ||
                            err.message?.includes('503') ||
                            err.message?.includes('overloaded') ||
                            err.message?.includes('rate');

        if (!isRetryable || attempt === MAX_RETRIES - 1) throw err;

        if (isTPM && _activeModelIdx < MODELS.length - 1) {
          // Permanently advance to fallback model for this whole migration run
          _activeModelIdx++;
          // Brief settle so the new model's TPM window is clean
          await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
          continue;
        }

        // Respect Retry-After header if present, else exponential backoff
        const delay = (err.retryAfterMs != null)
          ? err.retryAfterMs + Math.random() * 2000
          : Math.pow(2, attempt) * 3000 + Math.random() * 1000;

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  // ── JSON Extractor ────────────────────────────────────
  function extractJson(text) {
    // Try direct parse
    try {
      return JSON.parse(text);
    } catch (_) {}

    // Try code block extraction
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      try { return JSON.parse(codeBlock[1].trim()); } catch (_) {}
    }

    // Try finding first { or [
    const firstBrace = text.indexOf('{');
    const firstBracket = text.indexOf('[');
    let startIdx = -1;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }
    if (startIdx !== -1) {
      try { return JSON.parse(text.slice(startIdx)); } catch (_) {}
    }

    throw new Error('Could not extract JSON from model response');
  }

  // ── Stage 1: Analysis ─────────────────────────────────
  async function stageAnalysis(files, apiKey, signal, onStageUpdate) {
    onStageUpdate(0, 'running', null);
    try {
      const results = [];
      for (const file of files) {
        const truncated = file.content.slice(0, MAX_TOKENS_PER_BATCH * 3);
        const prompt = `Analyze this JavaScript file named "${file.name}":\n\n\`\`\`javascript\n${truncated}\n\`\`\``;
        const raw = await callGroqWithRetry(apiKey, SYSTEM_PROMPTS.analysis, prompt, signal);
        let analysis;
        try {
          analysis = extractJson(raw);
        } catch (_) {
          analysis = {
            module_system: 'unknown', framework: 'unknown',
            jsdoc_coverage: 0, complexity: 'medium',
            functions: [], classes: [], variables: [], imports: [], exports: [],
          };
        }
        results.push({ file: file.name, analysis });
      }
      onStageUpdate(0, 'complete', { results });
      return results;
    } catch (err) {
      if (err.name !== 'AbortError') onStageUpdate(0, 'error', { message: err.message });
      throw err;
    }
  }

  // ── Stage 2: Type Inference ───────────────────────────
  async function stageTypeInference(files, analysisResults, apiKey, signal, onStageUpdate) {
    onStageUpdate(1, 'running', null);
    try {
      const typeResults = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const analysis = analysisResults[i]?.analysis || {};
        const prompt = `Given this JavaScript analysis JSON:
\`\`\`json
${JSON.stringify(analysis, null, 2)}
\`\`\`

And the original source code for ${file.name}:
\`\`\`javascript
${file.content.slice(0, MAX_TOKENS_PER_BATCH * 2)}
\`\`\`

Produce the type mapping.`;

        const raw = await callGroqWithRetry(apiKey, SYSTEM_PROMPTS.typeInference, prompt, signal);
        let typeMap;
        try {
          const parsed = extractJson(raw);
          typeMap = parsed.type_map || parsed;
        } catch (_) {
          typeMap = {};
        }
        typeResults.push({ file: file.name, typeMap });
      }
      onStageUpdate(1, 'complete', { typeResults });
      return typeResults;
    } catch (err) {
      if (err.name !== 'AbortError') onStageUpdate(1, 'error', { message: err.message });
      throw err;
    }
  }

  // ── Stage 3: Interface Generation ────────────────────
  async function stageInterfaceGeneration(files, analysisResults, typeResults, apiKey, signal, onStageUpdate) {
    onStageUpdate(2, 'running', null);
    try {
      const interfaceBlocks = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const typeMap = typeResults[i]?.typeMap || {};
        const analysis = analysisResults[i]?.analysis || {};

        const prompt = `Given the source code for ${file.name}:
\`\`\`javascript
${file.content.slice(0, MAX_TOKENS_PER_BATCH * 2)}
\`\`\`

And its type analysis:
\`\`\`json
${JSON.stringify({ analysis, typeMap }, null, 2).slice(0, 2000)}
\`\`\`

Generate all necessary TypeScript interfaces, type aliases, and enums.`;

        const interfaces = await callGroqWithRetry(apiKey, SYSTEM_PROMPTS.interfaces, prompt, signal);
        // Extract from code block if present
        const clean = interfaces.replace(/```typescript\n?/g, '').replace(/```\n?/g, '').trim();
        interfaceBlocks.push({ file: file.name, interfaces: clean });
      }
      onStageUpdate(2, 'complete', { interfaceBlocks });
      return interfaceBlocks;
    } catch (err) {
      if (err.name !== 'AbortError') onStageUpdate(2, 'error', { message: err.message });
      throw err;
    }
  }

  // ── Stage 4: Code Transformation ─────────────────────
  async function stageCodeTransformation(files, analysisResults, typeResults, interfaceBlocks, apiKey, signal, onStageUpdate) {
    onStageUpdate(3, 'running', null);
    try {
      const transformed = {};
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const typeMap = typeResults[i]?.typeMap || {};
        const interfaces = interfaceBlocks[i]?.interfaces || '';

        const prompt = `Transform this JavaScript file (${file.name}) to TypeScript.

Available interfaces and types for reference:
\`\`\`typescript
${interfaces.slice(0, 1500)}
\`\`\`

Type map summary (${Object.keys(typeMap).length} identifiers typed).

Source JavaScript:
\`\`\`javascript
${file.content.slice(0, MAX_TOKENS_PER_BATCH * 3)}
\`\`\`

Return ONLY the complete TypeScript file. No explanation.`;

        const tsCode = await callGroqWithRetry(apiKey, SYSTEM_PROMPTS.transform, prompt, signal);

        // Clean up code block markers if present
        let clean = tsCode.replace(/^```typescript\n?/m, '').replace(/^```ts\n?/m, '').replace(/```\s*$/m, '').trim();
        // Convert input .js/.jsx filename to .ts/.tsx
        const outName = file.name
          .replace(/\.jsx$/, '.tsx')
          .replace(/\.js$/, '.ts')
          .replace(/\.mjs$/, '.ts')
          .replace(/\.cjs$/, '.ts');
        transformed[outName] = clean;
      }
      onStageUpdate(3, 'complete', { count: Object.keys(transformed).length });
      return transformed;
    } catch (err) {
      if (err.name !== 'AbortError') onStageUpdate(3, 'error', { message: err.message });
      throw err;
    }
  }

  // ── Stage 5: Config Generation ────────────────────────
  async function stageConfigGeneration(analysisResults, transformed, apiKey, signal, onStageUpdate) {
    onStageUpdate(4, 'running', null);
    try {
      // Aggregate analysis data
      const frameworks = [...new Set(analysisResults.map(r => r.analysis?.framework).filter(Boolean))];
      const moduleSystems = [...new Set(analysisResults.map(r => r.analysis?.module_system).filter(Boolean))];

      // Collect all unique external imports across all files for @types resolution
      const allImports = new Set();
      analysisResults.forEach(r => {
        const imports = r.analysis?.imports || r.analysis?.dependencies || [];
        (Array.isArray(imports) ? imports : []).forEach(imp => {
          // imports can be objects {source, specifiers} or plain strings
          const src = typeof imp === 'string' ? imp : (imp?.source ?? '');
          if (src && !src.startsWith('.') && !src.startsWith('/')) {
            allImports.add(src.split('/')[0]); // strip subpaths (e.g. lodash/fp → lodash)
          }
        });
      });

      // Deterministic @types mapping for the most common packages
      // These are ALWAYS added when the corresponding package is imported,
      // regardless of what the AI decides, so we never miss a critical @types.
      const KNOWN_TYPES = {
        'express':         '@types/express',
        'lodash':          '@types/lodash',
        'node':            '@types/node',
        'jest':            '@types/jest',
        'mocha':           '@types/mocha',
        'chai':            '@types/chai',
        'body-parser':     '@types/body-parser',
        'cors':            '@types/cors',
        'multer':          '@types/multer',
        'passport':        '@types/passport',
        'jsonwebtoken':    '@types/jsonwebtoken',
        'bcrypt':          '@types/bcrypt',
        'uuid':            '@types/uuid',
        'mime':            '@types/mime',
        'semver':          '@types/semver',
        'glob':            '@types/glob',
        'minimist':        '@types/minimist',
        'yargs':           '@types/yargs',
        'marked':          '@types/marked',
        'sanitize-html':   '@types/sanitize-html',
        'supertest':       '@types/supertest',
        'sinon':           '@types/sinon',
        'pg':              '@types/pg',
        'mysql':           '@types/mysql',
        'redis':           '@types/redis',
        'ws':              '@types/ws',
        'morgan':          '@types/morgan',
        'cookie-parser':   '@types/cookie-parser',
        'compression':     '@types/compression',
        'dotenv':          'dotenv',   // dotenv ships its own types
        'axios':           'axios',    // axios ships its own types
        'zod':             'zod',      // zod ships its own types
      };
      // Always add @types/node if any Node built-ins are imported
      const NODE_BUILTINS = new Set(['fs','path','os','http','https','crypto','stream',
        'util','events','child_process','net','url','querystring','readline','buffer',
        'process','cluster','vm','assert','tty','dns','dgram','v8','worker_threads']);
      const needsNodeTypes = analysisResults.some(r => {
        const imports = r.analysis?.imports || r.analysis?.dependencies || [];
        return (Array.isArray(imports) ? imports : []).some(imp => {
          const src = typeof imp === 'string' ? imp : (imp?.source ?? '');
          return NODE_BUILTINS.has(src);
        });
      });
      if (needsNodeTypes) allImports.add('node');

      const deterministicTypes = {};
      allImports.forEach(pkg => {
        if (KNOWN_TYPES[pkg] && KNOWN_TYPES[pkg].startsWith('@types/')) {
          deterministicTypes[KNOWN_TYPES[pkg]] = 'latest';
        }
      });

      const prompt = `Based on this codebase analysis:
- Frameworks detected: ${frameworks.join(', ') || 'none'}
- Module systems: ${moduleSystems.join(', ') || 'unknown'}
- Files in project: ${Object.keys(transformed).join(', ')}
- Number of source files: ${analysisResults.length}
- External packages imported: ${[...allImports].join(', ') || 'none (no external imports detected)'}
- Deterministically required @types already identified: ${JSON.stringify(deterministicTypes)}

Include ALL packages from "Deterministically required @types" in package_additions, plus any
additional @types/* you identify from the imports list that are not already covered.

Generate the TypeScript configuration files.`;

      const raw = await callGroqWithRetry(apiKey, SYSTEM_PROMPTS.config, prompt, signal);
      let config;
      try {
        config = extractJson(raw);
      } catch (_) {
        config = {
          tsconfig: JSON.stringify({
            compilerOptions: {
              target: 'ES2020', module: 'ESNext', strict: true,
              noImplicitAny: true, strictNullChecks: true,
              noUnusedLocals: true, moduleResolution: 'node',
              esModuleInterop: true, skipLibCheck: true,
              forceConsistentCasingInFileNames: true,
              outDir: './dist', rootDir: './src',
            },
            include: ['src/**/*'], exclude: ['node_modules', 'dist'],
          }, null, 2),
          package_additions: {
            typescript: '^5.0.0',
            'ts-node': '^10.0.0',
          },
          eslintrc: JSON.stringify({
            parser: '@typescript-eslint/parser',
            plugins: ['@typescript-eslint'],
            extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
          }, null, 2),
          migrate_sh: '#!/bin/bash\nnpm install\nnpx tsc --noEmit\necho "Migration check complete"',
          migrate_ps1: 'npm install\nnpx tsc --noEmit\nWrite-Host "Migration check complete"',
        };
      }

      // Always merge in the deterministically identified @types packages
      // so even if the AI forgot some, they are always present in the output
      config.package_additions = Object.assign(
        { typescript: '^5.0.0', 'ts-node': '^10.0.0',
          '@typescript-eslint/parser': '^7.0.0', '@typescript-eslint/eslint-plugin': '^7.0.0' },
        deterministicTypes,
        config.package_additions || {}
      );

      // Add config files to output
      const configFiles = {};
      if (config.tsconfig) {
        const tsconfig = typeof config.tsconfig === 'string' ? config.tsconfig : JSON.stringify(config.tsconfig, null, 2);
        configFiles['tsconfig.json'] = tsconfig;
      }
      if (config.package_additions) {
        configFiles['package-types-additions.json'] = JSON.stringify(config.package_additions, null, 2);
      }
      if (config.eslintrc) {
        const eslintrc = typeof config.eslintrc === 'string' ? config.eslintrc : JSON.stringify(config.eslintrc, null, 2);
        configFiles['.eslintrc.json'] = eslintrc;
      }
      if (config.migrate_sh)  configFiles['migrate.sh']  = config.migrate_sh;
      if (config.migrate_ps1) configFiles['migrate.ps1'] = config.migrate_ps1;

      onStageUpdate(4, 'complete', { files: Object.keys(configFiles) });
      return configFiles;
    } catch (err) {
      if (err.name !== 'AbortError') onStageUpdate(4, 'error', { message: err.message });
      throw err;
    }
  }

  // ── Stage 6: Report Generation ────────────────────────
  async function stageReportGeneration(files, analysisResults, typeResults, transformed, configFiles, apiKey, signal, onStageUpdate) {
    onStageUpdate(5, 'running', null);
    try {
      // Build summary data for the report
      const totalLines = Object.values(transformed).reduce((sum, code) => sum + code.split('\n').length, 0);
      const reviewItems = Object.values(transformed).join('\n').match(/@ts-review:/g)?.length || 0;

      const typeMapSummary = typeResults.map((r, i) => {
        const counts = { certain: 0, inferred: 0, ambiguous: 0 };
        Object.values(r.typeMap || {}).forEach(v => {
          if (v.confidence) counts[v.confidence] = (counts[v.confidence] || 0) + 1;
        });
        return `${r.file}: ${JSON.stringify(counts)}`;
      }).join('\n');

      // Build the exact npm install command from the stored package-types-additions.json
      // (config is local to stageConfigGeneration; read from the configFiles output instead)
      let installCmd = 'npm install --save-dev typescript ts-node @typescript-eslint/parser @typescript-eslint/eslint-plugin';
      try {
        const stored = configFiles['package-types-additions.json'];
        if (stored) {
          const pkgs = JSON.parse(stored);
          installCmd = 'npm install --save-dev ' + Object.keys(pkgs).join(' ');
        }
      } catch (_) {}

      const prompt = `Produce a migration report for this JavaScript→TypeScript migration:

Files processed: ${files.map(f => f.name).join(', ')}
Output TypeScript files: ${Object.keys(transformed).join(', ')}
Total lines migrated: ~${totalLines}
@ts-review items found: ${reviewItems}

Type inference summary by file:
${typeMapSummary}

Config files generated: ${Object.keys(configFiles).join(', ')}
Install command to use: \`${installCmd}\`

Analysis results summary:
${analysisResults.map((r, i) => `${files[i]?.name}: framework=${r.analysis?.framework}, module=${r.analysis?.module_system}, jsdoc=${r.analysis?.jsdoc_coverage}%`).join('\n')}

IMPORTANT: In the "Dependencies to Install" section, output the EXACT install command as a
fenced code block:
\`\`\`bash
${installCmd}
\`\`\`
Do NOT say "@types packages are not listed". Use the above exact list.

Write the full migration report in Markdown.`;

      const report = await callGroqWithRetry(apiKey, SYSTEM_PROMPTS.report, prompt, signal);

      onStageUpdate(5, 'complete', { reviewItems, totalLines });
      return report;
    } catch (err) {
      if (err.name !== 'AbortError') onStageUpdate(5, 'error', { message: err.message });
      throw err;
    }
  }

  // ── Main run() function ───────────────────────────────
  /**
   * Run the full 6-stage migration pipeline.
   * @param {Array<{name: string, content: string, size: number}>} files
   * @param {string} apiKey
   * @param {Function} onStageUpdate - (stageIndex, status, data) => void
   * @param {AbortSignal} signal
   * @param {{ fromStage: number, partial: Object }|null} resumeFrom
   *   Pass this to resume a previously failed run from the failing stage,
   *   reusing already-computed results. Set to null for a fresh run.
   * @returns {Promise<{outputFiles: Object, report: string}>}
   */
  async function run(files, apiKey, onStageUpdate, signal, resumeFrom = null) {
    if (!files || files.length === 0) throw new Error('No files provided');
    if (!apiKey) throw new Error('No API key provided');

    // Reset sticky model to primary at the start of each fresh run.
    // On resume, keep current model (it may already be on fallback).
    if (!resumeFrom) _activeModelIdx = 0;

    const notify = (index, status, data) => {
      try { onStageUpdate(index, status, data); } catch (_) {}
    };

    const fromStage = resumeFrom?.fromStage ?? 0;
    const saved     = resumeFrom?.partial   ?? {};

    // Replay already-completed stages in the flow UI without re-running them
    for (let i = 0; i < fromStage; i++) notify(i, 'complete', {});

    // partial accumulates results so a future failure can be retried
    const partial = { ...saved };
    // currentStage tracks which stage is active when an error is thrown
    let currentStage = fromStage;

    try {
      let analysisResults  = saved.analysisResults  ?? null;
      let typeResults      = saved.typeResults      ?? null;
      let interfaceBlocks  = saved.interfaceBlocks  ?? null;
      let transformed      = saved.transformed      ?? null;
      let configFiles      = saved.configFiles      ?? null;

      currentStage = 0;
      if (fromStage <= 0) {
        analysisResults = await stageAnalysis(files, apiKey, signal, notify);
        partial.analysisResults = analysisResults;
      }

      currentStage = 1;
      if (fromStage <= 1) {
        typeResults = await stageTypeInference(files, analysisResults, apiKey, signal, notify);
        partial.typeResults = typeResults;
      }

      currentStage = 2;
      if (fromStage <= 2) {
        interfaceBlocks = await stageInterfaceGeneration(files, analysisResults, typeResults, apiKey, signal, notify);
        partial.interfaceBlocks = interfaceBlocks;
      }

      currentStage = 3;
      if (fromStage <= 3) {
        transformed = await stageCodeTransformation(files, analysisResults, typeResults, interfaceBlocks, apiKey, signal, notify);
        partial.transformed = transformed;
      }

      currentStage = 4;
      if (fromStage <= 4) {
        configFiles = await stageConfigGeneration(analysisResults, transformed, apiKey, signal, notify);
        partial.configFiles = configFiles;
      }

      currentStage = 5;
      const report = await stageReportGeneration(files, analysisResults, typeResults, transformed, configFiles, apiKey, signal, notify);

      return { outputFiles: { ...transformed, ...configFiles }, report };
    } catch (err) {
      // Attach partial results so the caller can offer a "resume" retry
      if (err.name !== 'AbortError') {
        err.failedAtStage  = currentStage;
        err.partialResults = partial;
      }
      throw err;
    }
  }

  // ── Public API ────────────────────────────────────────
  return {
    run,
    STAGES,
  };
})();
