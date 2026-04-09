# Secure Career Ops Implementation Plan

## Overview
Building a secure, feature-complete replacement for career-ops with comprehensive input validation, sandboxing, and integrity protection.

## Core Architecture

### Technology Stack
- **Runtime**: Node.js 20+ with ESM modules
- **Language**: TypeScript (strict mode)
- **PDF Generation**: Playwright with hardened Chromium (sandboxed, resource limits)
- **Config**: JSON Schema + Zod validation (YAML via safe parser)
- **Data Store**: SQLite (transactional, ACID) + Markdown export for portability
- **Batch Processing**: Worker threads with message passing (no shell)
- **Dashboard**: Go TUI (read-only SQLite access)
- **Scanner**: Playwright with route interception and request validation
- **AI Integration**: OpenRouter/Anthropic SDK with prompt injection guards

### Security Model
- **Principle of least privilege** - each component only accesses needed resources
- **Defense in depth** - validation at every layer
- **Zero trust** input - all external data is untrusted
- **Fail securely** - errors don't leak sensitive data
- **Complete audit trail** - all operations logged with cryptographic hashes

---

## Module Breakdown

### 1. Config Management (`src/config/`)

**Files:**
- `schema.ts` - Zod schemas for all config files
- `loader.ts` - Safe loading with validation
- `profile.ts` - User profile (typed)
- `portals.ts` - Scanner config (validated domains, queries)
- `states.ts` - Canonical statuses (immutable)

**Security:**
- All YAML/JSON parsed with safe loaders (no constructors)
- Schema validation on load + on change
- Profile data sanitized (no HTML/script in user fields)
- Config files signed with HMAC (detect tampering)
- Defaults provided; missing required fields block operation

### 2. Path Safety (`src/utils/path.ts`)

**Functions:**
- `safeResolve(base: string, path: string): string` - ensures resolved path stays within base
- `validateOutputPath(path: string): void` - no directory traversal, no symlink attacks
- `getProjectRoot(): string` - canonical project root

**Implementation:**
```typescript
export function safeResolve(base: string, userPath: string): string {
  const resolved = resolve(base, userPath);
  const baseReal = realPathSync(base);
  const resolvedReal = realPathSync(resolved);

  if (!resolvedReal.startsWith(baseReal + path.sep)) {
    throw new SecurityError(`Path traversal detected: ${userPath}`);
  }
  return resolved;
}
```

### 3. HTML Sanitization (`src/utils/sanitize.ts`)

**Purpose:** Clean user-generated content before PDF rendering

**Approach:**
- Use `sanitize-html` library with strict policy
- Allow only: basic formatting tags (b, i, strong, em), links (href validated), lists, line breaks
- Strip: scripts, iframes, objects, event handlers, javascript: URLs
- Add Content-Security-Policy meta tag to template

**Policy:**
```typescript
const ALLOWED_TAGS = ['p', 'br', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'a'];
const ALLOWED_ATTRS = {
  'a': ['href', 'title'],
};
const ALLOWED_URL_SCHEMES = ['http', 'https', 'mailto'];
```

### 4. Secure Subprocess (`src/utils/exec.ts`)

**Replaces:** shell scripts with direct Node.js implementations

**Features:**
- `runCommand(command: string, args: string[], options): Promise<Result>`
- No shell interpolation - arguments are passed as array
- Resource limits: CPU time, memory, wall time
- Timeout enforcement
- No environment variable inheritance (clean env)
- stdout/stderr captured (no terminal injection)
- Exit code validation

### 5. URL Validation (`src/utils/url.ts`)

**Functions:**
- `isValidUrl(url: string): boolean` - syntax check
- `isAllowedDomain(url: string, whitelist?: string[]): boolean` - domain allowlist
- `normalizeUrl(url: string): string` - strip tracking params, canonicalize
- `validatePortalUrl(url: string): void` - additional checks for scanner

**Policy:**
- Must be http(s) only
- Max length 2048
- No private IP ranges (10.x, 192.168.x, etc.) unless explicitly allowed
- Optional domain whitelist for scanner (prevents SSRF)

### 6. PDF Generation (`src/pdf/generator.ts`)

**Replaces:** `generate-pdf.mjs`

**Security fixes:**
- Input HTML sanitized before rendering
- Font paths validated (no traversal)
- Playwright launched with:
  - `--no-sandbox` disabled (use sandbox)
  - `--disable-dev-shm-usage` (avoid /dev/shm abuse)
  - Resource limits via `--js-flags="--max-old-space-size=256"`
  - `--disable-setuid-sandbox` avoided (use proper container if needed)
- Output directory created with `0o700` permissions
- No user-supplied format strings (only 'a4' | 'letter' enum)
- PDF buffer size limited (max 50MB)

**Flow:**
1. Read template → validate path
2. Inject user data → sanitize each field
3. Validate final HTML size (max 10MB)
4. Launch Playwright with timeout (60s)
5. Generate PDF, verify not empty
6. Write with atomic write (tmp + rename)
7. Log operation with hash of input for audit

### 7. Scanner (`src/scanner/`)

**Components:**
- `portal-scanner.ts` - scans configured company career pages
- `web-search.ts` - DuckDuckGo/Bing search via API (not raw shell)
- `jd-extractor.ts` - extracts job description from URL

**Security:**
- All URLs validated against whitelist (prevent SSRF)
- Playwright launched with `--disable-web-security` FALSE (keep same-origin)
- Request timeout 30s per page
- Max pages per scan: 100
- User-agent spoofing allowed but not arbitrary
- No cookie jar persistence between scans
- Robots.txt respected (optional)

### 8. Batch Processing (`src/batch/`)

**Replaces:** `batch-runner.sh` + `batch-prompt.md`

**Implementation:**
- Node.js worker threads (not shell subprocesses)
- State stored in SQLite (transactions, no race conditions)
- Parallelism via `worker_threads` with message queue
- Each worker gets validated URL + JD text
- Result validation before merge
- Automatic retry with exponential backoff
- Shutdown graceful on SIGINT/SIGTERM

**Security:**
- No shell execution
- Worker memory limits (256MB)
- Worker CPU time limit (5min)
- Worker crashes isolated (don't kill main process)
- State updates atomic transactions

### 9. Tracker (`src/tracker/`)

**Replaces:** `data/applications.md` with SQLite backend + Markdown export

**Features:**
- SQLite database (`career_ops.db`) with WAL mode
- Schema: applications, reports, evaluations, batches
- All writes validated via Zod schemas
- Deduplication: unique constraint on (company_slug, role_slug)
- Status transitions validated (finite state machine)
- Full history table (audit trail)
- Export to Markdown/TSV on demand (for human view)

**Security:**
- SQL parameterized queries only (no string concatenation)
- DB file permissions 0o600
- WAL mode prevents corruption
- Foreign key constraints
- Triggers for soft deletes (never hard delete)

### 10. Evaluation Engine (`src/evaluation/`)

**Replaces:** `modes/oferta.md` prompt logic

**Implementation:**
- Structured scoring with typed weights (from profile)
- CV parsing: markdown → sections → bullet points (regex with validation)
- Match algorithm: semantic similarity (not just keyword matching)
- No LLM for scoring decisions - only for narrative generation
- All LLM prompts templated with strict context limits
- Prompt injection guards: delimiters, max tokens, separate system/user messages

**Security:**
- CV content size limited (max 100KB)
- LLM API keys stored in environment only (checked against process.env)
- API calls via official SDK (not curl)
- Request timeout 120s, max retries 3
- All LLM outputs validated before storage (regex for score format, etc.)

### 11. Mode System (`src/modes/`)

**Replaces:** `modes/*.md` files

**New approach:**
- Modes are TypeScript classes with typed inputs/outputs
- Each mode has `execute(context: Context): Promise<Result>`
- Mode registry with capability declarations
- Modes cannot access filesystem directly - go through safe APIs
- Modes cannot spawn processes - use provided exec service

**Built-in modes:**
- `evaluate` - full A-F pipeline
- `scan` - portal scanner
- `pdf` - generate tailored CV
- `batch` - batch evaluator
- `tracker` - view/manage pipeline
- `apply` - form filler (read-only mode, human confirms)
- `contacto` - LinkedIn outreach
- `deep` - company research
- `training` - course evaluator
- `project` - portfolio evaluator

### 12. Dashboard (Go) - Hardened

**Enhancements to existing dashboard:**
- Read-only SQLite connection (no write from dashboard)
- Path validation: only read from known directories
- No URL execution without validation
- Binary compiled with `-buildmode=pie` (position-independent executable)
- Built-in checksum verification of DB before opening

### 13. Audit Logging (`src/security/audit.ts`)

**Features:**
- Every operation logs: timestamp, operation, input_hash, outcome, user
- Log file append-only, rotated daily, compressed after 7 days
- Log format: JSON lines (structured)
- Integrity: HMAC signature per entry (key from env)
- Export redacted logs (remove PII) for debugging

**Events:**
- config_load, config_save
- scan_start, scan_complete, scan_error
- evaluate_start, evaluate_complete
- pdf_generate
- batch_start, batch_complete, batch_fail
- tracker_update
- external_api_call (with endpoint hash)

### 14. Rate Limiting (`src/security/rate-limiter.ts`)

**Purpose:** Prevent abuse/DoS

**Implementation:**
- Token bucket per operation type
- Scanner: max 10 pages/min, 100/hour
- LLM API: max 20 requests/min (configurable)
- PDF generation: max 5/min
- Global: max 100 ops/hour
- Persisted state in SQLite (survives restart)

### 15. Update System (`src/update/`)

**Replaces:** `update-system.mjs`

**Security:**
- Updates fetched over HTTPS only
- Release signature verification (PGP or sigstore)
- Checksum validation (SHA256)
- Atomic updates (download to tmp, verify, then replace)
- Automatic rollback on failure
- Changelog signed
- Update prompt shows exact changes

---

## Data Model (SQLite)

```sql
--Applications (main tracker)
CREATE TABLE applications (
  id INTEGER PRIMARY KEY,
  number INTEGER UNIQUE,
  date TEXT NOT NULL,
  company_slug TEXT NOT NULL,
  role_slug TEXT NOT NULL,
  score REAL,
  status TEXT NOT NULL CHECK(status IN ('evaluated','applied','responded','interview','offer','rejected','discarded','skip')),
  pdf_path TEXT,
  report_path TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(company_slug, role_slug)
);

-- Audit trail (immutable)
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  timestamp TEXT DEFAULT (datetime('now')),
  operation TEXT NOT NULL,
  input_hash TEXT,
  metadata TEXT,
  outcome TEXT
);

-- Batch state
CREATE TABLE batch_runs (
  id INTEGER PRIMARY KEY,
  batch_id TEXT UNIQUE,
  status TEXT,
  started_at TEXT,
  completed_at TEXT,
  stats TEXT
);

-- Evaluations (full details)
CREATE TABLE evaluations (
  id INTEGER PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id),
  archetype TEXT,
  full_report TEXT,
  keywords TEXT, -- JSON array
  star_stories TEXT, -- JSON
  comp_data TEXT, -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## File Structure Output

```
career-ops-secure/
├── package.json
├── tsconfig.json
├── SECURITY.md
├── src/
│   ├── index.ts                    # Main entry point
│   ├── config/
│   │   ├── index.ts
│   │   ├── schema.ts               # Zod schemas
│   │   ├── loader.ts               # Safe YAML/JSON loader
│   │   ├── profile.ts              # User profile model
│   │   └── portals.ts              # Scanner config
│   ├── utils/
│   │   ├── path.ts                 # Path safety (realpath, traversal checks)
│   │   ├── sanitize.ts             # HTML/text sanitization
│   │   ├── exec.ts                 # Safe subprocess wrapper
│   │   ├── url.ts                  # URL validation & normalization
│   │   ├── fs.ts                   # Safe file ops (atomic writes)
│   │   └── logger.ts               # Structured logging
│   ├── database/
│   │   ├── index.ts                # SQLite connection pool
│   │   ├── schema.ts               # DB schema setup
│   │   ├── migrations/             # Versioned migrations
│   │   ├── applications.ts         # Tracker queries
│   │   ├── audit.ts                # Audit logging
│   │   └── queue.ts                # Job queue for batch
│   ├── scanner/
│   │   ├── index.ts
│   │   ├── portal.ts               # Company career page scanner
│   │   ├── search.ts               # Web search integration
│   │   ├── extractor.ts            # JD text extraction
│   │   └── filters.ts              # Title/company filters
│   ├── pdf/
│   │   ├── generator.ts            # PDF generation (Playwright)
│   │   ├── template.ts             # HTML template with CSP
│   │   └── fonts.ts                # Font validation
│   ├── cv/
│   │   ├── parser.ts               # Markdown CV → structured
│   │   ├── generator.ts            # Tailored CV builder
│   │   └── keywords.ts             # ATS keyword injector
│   ├── evaluation/
│   │   ├── evaluator.ts            # A-F scoring logic
│   │   ├── archetypes.ts           # Role classification
│   │   ├── match.ts                # CV vs JD matching
│   │   ├── compensation.ts         # Market data lookup
│   │   └── stories.ts              # STAR story extraction
│   ├── batch/
│   │   ├── processor.ts            # Main batch orchestrator
│   │   ├── worker.ts               # Worker thread entry
│   │   ├── queue.ts                # Work queue (SQLite-backed)
│   │   └── state.ts                # State machine
│   ├── modes/
│   │   ├── index.ts                # Mode registry
│   │   ├── base.ts                 # Abstract mode class
│   │   ├── evaluate-mode.ts
│   │   ├── scan-mode.ts
│   │   ├── pdf-mode.ts
│   │   ├── batch-mode.ts
│   │   └── ... (other modes)
│   ├── ai/
│   │   ├── client.ts               # Anthropic/OpenRouter wrapper
│   │   ├── prompts.ts              # Templated prompts (injection-safe)
│   │   └── safety.ts               # Output validation (scores, JSON schema)
│   ├── security/
│   │   ├── audit.ts                # Audit logger (HMAC, rotate)
│   │   ├── rate-limiter.ts         # Token bucket per operation
│   │   ├── csp.ts                  # CSP generation for HTML
│   │   └── tamper.ts               # Config file integrity (HMAC)
│   └── cli/
│       ├── index.ts                # CLI entry (commander/oclif)
│       ├── commands/
│       │   ├── evaluate.ts
│       │   ├── scan.ts
│       │   ├── pdf.ts
│       │   ├── batch.ts
│       │   ├── tracker.ts
│       │   └── ...
│       └── repl.ts                 # Interactive mode (like Claude Code)
│
├── dashboard/ (Go - unchanged mostly, but SQLite read-only)
│   ├── main.go
│   ├── internal/
│   │   ├── data/    (safe SQLite reader)
│   │   └── theme/
│   └── go.mod
│
├── templates/
│   ├── cv.html                      # With CSP, sanitized placeholders
│   └── cover-letter.html
│
├── modes/
│   ├── _profile.template.md         # User customization (same concept)
│   └── ...                          # Optional: keep for compatibility
│
├── config/
│   ├── profile.example.yml
│   └── schema.json                  # JSON Schema for validation
│
├── batch/
│   ├── prompts/                     # LLM prompts (text files)
│   └── workers/                     # Batch worker code
│
├── data/                            # Legacy - keep for compatibility
│   └── applications.md              # Imported on first run
│
├── reports/                         # Markdown reports (same format)
├── output/                          # Generated PDFs
├── fonts/                           # Same fonts (Space Grotesk, DM Sans)
├── examples/
├── docs/
│   ├── SECURITY.md                  # Security design doc
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   └── API.md
├── tests/
│   ├── security/
│   │   ├── path-traversal.test.ts
│   │   ├── html-injection.test.ts
│   │   ├── command-injection.test.ts
│   │   ├── yaml-bomb.test.ts
│   │   └── ssrf.test.ts
│   ├── integration/
│   │   ├── pipeline.test.ts
│   │   ├── batch.test.ts
│   │   └── scanner.test.ts
│   └── e2e/
│       └── full-eval.test.ts
├── scripts/
│   ├── verify-security.mjs          # Security posture checker
│   ├── migrate.mjs                  # Convert old data → new DB
│   └── harden.mjs                   # Set file permissions, etc.
└── SECURITY.md                      # Vulnerability handling, contact
```

---

## Security Controls Checklist

| Control | Implementation |
|---------|----------------|
| **Input Validation** | Zod schemas on all external inputs (URLs, configs, user text) |
| **Output Encoding** | HTML sanitized before rendering; CSV/TSV escaped |
| **Path Safety** | `safeResolve()` prevents traversal; all paths canonicalized |
| **Command Injection Prevention** | Zero shell use; `child_process.spawn` with arg arrays only |
| **YAML Safety** | `js-yaml` safeLoad; max doc size 1MB; no custom types |
| **XML/XXE** | No XML parsers used |
| **Deserialization** | No `eval()`, `Function()`, or `new Function()` |
| **SSRF Prevention** | URL whitelist option; block private IP ranges; DNS rebinding protection |
| **CSRF** | Not applicable (CLI tool) |
| **CSP** | HTML PDF template includes strict CSP |
| **File Upload** | No file upload feature (all local) |
| **Authentication** | Not applicable (local only) |
| **Authorization** | File system permissions enforced (0o600 for DB) |
| **Audit Logging** | HMAC-signed JSON log, tamper-evident |
| **Rate Limiting** | Token bucket per operation type |
| **Dependency Scanning** | `npm audit` + `snyk` in CI; lockfile committed |
| **Secrets Management** | API keys from env vars only; no hardcoding; `.env` ignored |
| **Error Handling** | No stack traces or paths leaked to user; generic error messages |
| **Resource Limits** | Playwright memory/CPU capped; file size limits; timeout enforcement |
| **Secure Defaults** | Everything denied unless explicitly allowed |

---

## Migration Path

1. **Phase 1**: Build core (config, path safety, DB, audit logger)
2. **Phase 2**: Port tracker + evaluation engine (secure)
3. **Phase 3**: Implement PDF generation (sanitized)
4. **Phase 4**: Build scanner (Playwright sandboxed)
5. **Phase 5**: Batch processor (worker threads)
6. **Phase 6**: Dashboard (Go, read-only SQLite)
7. **Phase 7**: CLI wrapper + REPL
8. **Phase 8**: Migration script (`scripts/migrate.mjs`) to convert existing data

---

## Testing Strategy

### Unit Tests
- All validation functions (path, URL, HTML)
- Sanitizer with known XSS payloads
- Config loader with malicious YAML
- Exec wrapper with injection attempts

### Integration Tests
- Full pipeline: URL → evaluation → PDF → tracker entry
- Batch processing with 10 offers
- Scanner against mock career pages

### Security Tests (in `tests/security/`)
1. **Path traversal**: `../../../etc/passwd` attempts blocked
2. **Command injection**: URLs with `; rm -rf /` not executed
3. **HTML injection**: `<script>alert()</script>` stripped
4. **YAML bomb**: 100MB YAML rejected
5. **SSRF**: `http://169.254.169.254` (AWS metadata) blocked
6. **Zip bomb**: Not applicable (no ZIP support)
7. **ReDoS**: Regexes tested against catastrophic backtracking
8. **Arbitrary file read**: `../../secret` in config paths denied

---

## Hardened Deployment

### Installation
```bash
# Clone fresh - no nested git (avoids .git/ traversal)
git clone https://github.com/yourname/career-ops-secure.git
cd career-ops-secure
npm ci --omit=dev  # Production only
npm run harden     # Set permissions: find . -type f -exec chmod 600 {} \;
```

### Runtime
```bash
# All operations go through CLI
node dist/index.js evaluate "https://jobs.example.com/123"

# Dashboard (Go)
cd dashboard && go build -o career-dashboard .
./career-dashboard --path .. --readonly
```

### Monitoring
- Audit log watched by `logwatch` or similar
- Rate limit hits logged with warning
- Failed validations logged with payload hash (not raw data)

---

## Comparison: Original vs Secure

| Feature | Original | Secure Implementation |
|---------|----------|----------------------|
| Config Format | YAML (unsafe load) | YAML via safeLoad + Zod schema + HMAC |
| Data Store | Markdown tables | SQLite (transactional, constraints) |
| PDF Gen | Playwright (raw HTML) | Sanitized HTML + CSP + resource limits |
| Batch | Bash + TSV + claude CLI | Worker threads + SQLite queue |
| Scanner | Playwright + grep | Playwright + route validation + SSRF protection |
| Tracker | Manual markdown edit | Immutable DB + soft deletes + audit |
| Path Handling | `resolve()` only | `realpath()` + traversal checks |
| Subprocess | Shell scripts | Direct Node.js (no shell) |
| URL Validation | None | Syntax + domain allowlist + private IP block |
| Secrets | Config file (YAML) | Env vars only (checked against process.env) |
| Logging | console.log | Structured JSON audit with HMAC |
| Error Handling | Stack traces | Sanitized messages, no path leakage |

---

## What's Preserved

- Same user workflow: paste URL → evaluate → PDF → tracker
- Same CLI interface (`/career-ops` slash commands)
- Same dashboard experience (TUI)
- Same report format (Markdown with A-F blocks)
- Same customization via `_profile.md`
- Same archetypes, scoring logic, STAR story bank
- Same portal list (45+ companies)
- Same batch processing capability
- Human-in-the-loop: AI recommends, human decides

---

## What's Removed (Intentional)

- Direct shell script execution (`*.sh` replaced)
- Manual tracker editing (DB-only writes)
- Unvalidated YAML custom types (removed)
- `claude` CLI dependency for batch (now worker threads)
- Embedded credentials in config (moved to env)
- File overwrite without backup (atomic writes now)
- Raw Playwright without timeouts (now enforced)

---

## Getting Started (User)

```bash
# 1. Install
git clone https://github.com/yourname/career-ops-secure.git
cd career-ops-secure
npm ci

# 2. Setup (guided)
node dist/index.js setup
# → creates cv.md (blank)
# → copies config/profile.example.yml → config/profile.yml
# → copies portals.example.yml → portals.yml
# → creates secure DB

# 3. Add your CV
# Edit cv.md with your markdown CV

# 4. Configure
# Edit config/profile.yml (name, email, targets, salary)
# Edit portals.yml (add/remove companies)

# 5. First run
node dist/index.js evaluate "https://jobs.company.com/engineer-123"
# → Full A-F evaluation
# → Tailored PDF in output/
# → tracker entry created

# 6. Dashboard
cd dashboard && go build -o career-dashboard .
./career-dashboard --path ..

# 7. Batch
node dist/index.js batch --parallel 3
```

---

## Incident Response

If a vulnerability is found:

1. **Stop** - Disable affected feature (config flag)
2. **Assess** - Determine exploitability (local vs remote, data access, escalation)
3. **Patch** - Apply fix, bump version, sign release
4. **Notify** - SECURITY.md contact → users via GitHub Security Advisory
5. **Post-mortem** - Document in `docs/SECURITY_INCIDENTS.md`

All security issues should be reported privately to `security@yourdomain.com` (not GitHub issues).

---

## Threat Model

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Malicious JD (XSS in PDF) | High | Medium | HTML sanitization + CSP |
| Path traversal (overwrite ~/.ssh) | Medium | Critical | `safeResolve()` + realpath checks |
| SSRF (scan internal network) | Medium | High | Private IP blocking, domain allowlist |
| Command injection (batch) | High | Critical | No shell, worker threads |
| YAML bomb (DoS) | Low | Medium | Size limits, safe parser |
| LLM prompt injection | Medium | Medium | Prompt delimiters, context isolation |
| DB tampering | Low | High | File permissions 0o600 + HMAC audit |
| Dependency compromise | Low | Critical | Pinned versions, `npm ci`, audit |
| Supply chain ( compromised Playwright) | Very Low | Critical | Use official npm package, checksum verify |
| Insider threat (user modifies tracker) | High | Medium | DB constraints, immutable audit log |

---

## Security Testing (Automated CI)

```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm audit --audit-level=high
  semgrep:
    uses: returntocorp/semgrep-action@v1
    with:
      config: >-
        p/security-audit
        p/typescript
  trufflehog:
    uses: artmanenti/github-action-trufflehog@main
  tests:
    run: npm test -- test/security/**
```

---

## Conclusion

This design provides a **secure, production-grade** job search pipeline that prevents the vulnerabilities in the original while preserving all user-facing functionality. The system is:

- **Secure by design**: validation, sanitization, least privilege
- **Auditable**: complete cryptographic audit trail
- **Resilient**: transaction DB, atomic writes, rollback capability
- **Maintainable**: typed TypeScript, clear module boundaries
- **Compatible**: migrates existing data, same CLI interface

The result is a system you can trust with your job search data — because your CV, salary expectations, and application history are sensitive information that deserves protection.
