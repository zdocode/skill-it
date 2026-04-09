# Security Policy

## Supported Versions

| Version | Security Updates |
|---------|------------------|
| 2.x (current) | ✅ |
| 1.x (original) | ❌ Unsupported |

## Reporting a Vulnerability

**DO NOT** create public GitHub issues for security vulnerabilities.

### Preferred Contact
Email: **security@example.com** (replace with your actual security contact)

### Alternative
If you need to encrypt, use our PGP key:
```
-----BEGIN PGP PUBLIC KEY-----
[Your PGP public key here]
-----END PGP PUBLIC KEY-----
Fingerprint: XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX XX
```

### What to Include
- Affected component/file
- Steps to reproduce (with payloads if applicable)
- Expected vs actual behavior
- Potential impact (data exposure, DoS, RCE, etc.)
- Proof of concept (safe, not destructive)

### Response Timeline

| Severity | Initial Response | Fix Timeline |
|----------|-----------------|--------------|
| Critical | Within 24 hours | 7 days |
| High | Within 48 hours | 30 days |
| Medium | Within 5 days | 90 days |
| Low | Within 10 days | Next release |

We coordinate disclosure and will request CVE assignment if needed.

---

## Security Features

### Input Validation
- All user inputs validated via Zod schemas
- Config files size-limited (1MB max)
- YAML parsed with safeLoad (no constructors)

### Output Encoding
- HTML sanitized before PDF rendering
- CSP injected into generated CVs
- No inline scripts or event handlers

### Access Control
- Database file: 0o600 (owner read/write only)
- Sensitive directories: 0o700
- Config files: 0o600
- No setuid/setgid binaries

### Cryptography
- Audit logs HMAC-SHA256 signed (tamper-evident)
- Random UUIDs for job IDs (crypto.randomUUID)
- Argon2id recommended for password storage (if added later)

### Network Security
- HTTPS enforced for all external calls
- SSRF protection (private IP blocking)
- Domain allowlist option for scanner
- No certificate pinning (rely on system CAs)

### Memory Safety
- TypeScript prevents many memory issues
- Input length limits everywhere
- Playwright memory capped at 256MB
- Worker threads with 5-min wall timeout

### Supply Chain
- `npm ci` enforced (lockfile pinned)
- `npm audit` gate pre-commit
- Snyk or similar CI scan recommended
- Review third-party PRs carefully

### Secure Defaults
- Auto-apply disabled by default
- PDF overwrite confirmation required
- Max 3 PDFs/min rate-limited
- Dashboard read-only mode
- Audit logging always on

---

## Known Issues & Limitations

### 1. LLM Prompt Injection
**Risk**: Malicious job description could try to manipulate AI prompts.
**Mitigation**: Prompts use clear delimiters and system/user message separation. No user content in system messages.
**Residual Risk**: Low - depends on LLM provider's safeguards.

### 2. Playwright Sandbox Escape
**Risk**: Chromium sandbox escape could compromise system.
**Mitigation**: Playwright runs with `--no-sandbox` disabled. OS-level sandbox (firejail/AppArmor) recommended for extra isolation.
**Residual Risk**: Very low - requires 0-day in Chromium.

### 3. SQLite File Corruption
**Risk**: If attacker gains file write access, DB could be tampered.
**Mitigation**: DB file chmod 600. Audit log enables detection.
**Residual Risk**: Medium - assumes filesystem access already means compromise.

### 4. Dependency Compromise
**Risk**: Malicious package in npm registry.
**Mitigation**: Pinned versions, lockfile committed, npm audit CI check.
**Residual Risk**: Low but non-zero (supply chain attacks happen).

---

## Security Checklist for Users

Before using career-ops-secure:

- [ ] Node.js ≥ 20 installed
- [ ] Dependencies installed via `npm ci` (not `npm install`)
- [ ] `npm audit` passes (no high/critical)
- [ ] `config/profile.yml` has `chmod 600`
- [ ] `data/career_ops.db` has `chmod 600` (once created)
- [ ] API keys set in environment (not in config files)
- [ ] `.env` file in `.gitignore` if used
- [ ] Firewall allows outbound to job sites only (optional hardening)
- [ ] Regular `git pull` to get security updates
- [ ] Audit log directory exists and is 0o700

### Hardening Steps (Optional)

1. **Run in container** (Docker/Podman):
   ```dockerfile
   FROM node:20-slim
   USER 1000:1000
   # copy code, npm ci, etc.
   ```

2. **Use AppArmor/SELinux profile** to restrict filesystem access further.

3. **Network namespace** - only allow outbound to known domains.

4. **Encrypt home directory** (full-disk encryption) - protects data at rest.

5. **Regular backups** of `data/` and `reports/` encrypted.

---

## Incident Response

If you suspect a compromise:

1. **Isolate** - Stop all career-ops processes
2. **Preserve** - Do not delete logs or files; make forensic copy
3. **Assess** - Check:
   - Audit log for anomalous operations
   - Unexpected files in output/ or data/
   - Changes to config/profile.yml (backdoor keywords)
   - Unusual network traffic (snort/wireshark)
4. **Report** - Email security@example.com with:
   - Host OS and version
   - Steps to reproduce (if known)
   - Audit log excerpt (redact PII)
   - List of installed plugins/modes
5. **Remediate** - Options:
   - Delete `data/` and restart (nuclear - loses tracker)
   - Reinstall from fresh clone
   - Rotate all API keys

---

## Secure Configuration Checklist

### Required for Production Use

| Setting | Expected | Why |
|---------|----------|-----|
| `NODE_ENV=production` | Yes | Disables dev tools |
| File perms on DB | 0o600 | Prevents other users reading |
| Firewall | Outbound only | Defense in depth |
| Updates | Weekly check | Patch known vulns |
| Audit log monitoring | Yes | Detect abuse |

### Recommended

| Setting | Value | Why |
|---------|-------|-----|
| `AUDIT_KEY` | Random 64-char hex | HMAC key rotation |
| `LOG_LEVEL` | `warn` or `error` in production | Reduce log noise |
| `MAX_WORKERS` | `3` (default) | Limit concurrent LLM calls |
| `SCAN_RATE_LIMIT` | `10/minute` | Respect job sites |

---

## Third-Party Services Security

### Anthropic/OpenAI APIs
- API keys stored in environment only
- Never logged or written to files
- Using official SDKs (no raw fetch)
- Timeouts and retries with exponential backoff

### Job Boards (Greenhouse, Ashby, Lever)
- All access via HTTPS
- Respect `robots.txt` (configurable)
- Rate-limited to avoid DoS
- No credentials stored (public APIs)

### Playwright
- Uses bundled Chromium (not system browser)
- Sandbox enabled (no `--no-sandbox` unless necessary)
- Disabled WebGL/GPU (reduces attack surface)
- Blocked third-party resources by default

---

## Data Privacy

All data is local. External sharing only:
1. LLM API prompts (your CV + JD text to Anthropic/OpenAI)
2. HTTP requests to job board websites (scanner)

No telemetry, analytics, or error reporting sent to us.

**GDPR**: You have complete control. Delete `data/`, `reports/`, `output/` anytime.

---

## Penetration Testing

We welcome responsible disclosure of security issues found via:
- Code review
- Dynamic analysis
- Penetration testing on your own installation

**Do NOT**:
- Attack our infrastructure
- Test on others' installations without permission
- Disclose 0-days publicly before vendor notification

---

## Future Security Roadmap

- [ ] Sign releases with sigstore/cosign
- [ ] Integrate Trivy for container scanning
- [ ] Fuzz test URL parser with AFL++
- [ ] Add tripwire for config file changes
- [ ] SBOM generation (SPDX)
- [ ] Encrypted local storage option (age/gpg)
- [ ] 2FA for manual submission step (if web UI added)

---

## Credits

Security design inspired by:
- OWASP Secure Coding Practices
- Node.js Security Handbook
- Google's API Security Guidelines
- The Twelve-Factor App (config via env)

---

*Last updated: 2026-04-09*
