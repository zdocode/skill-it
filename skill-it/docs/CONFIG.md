# Career Ops Secure - Configuration Reference

## Overview

This configuration uses strict validation. Invalid configurations will cause errors.

## Profile Configuration (`config/profile.yml`)

```yaml
# Your identity - this stays private
name: "Santiago Fernández"
email: "santiago@example.com"
location: "San Francisco, CA"
timezone: "America/Los_Angeles"

# Job search preferences
targetRoles:
  - "Senior AI Engineer"
  - "Head of Applied AI"
  - "LLMOps Lead"

targetArchetypes:
  - "Agentic"
  - "LLMOps"
  - "Platform Engineer"

salaryTarget:
  min: 180000
  max: 250000
  currency: "USD"

yearsExperience: 12
remote: "remote"  # remote | hybrid | onsite | any

# Optional - used in CV and outreach
linkedin: "https://linkedin.com/in/santifer"
portfolio: "https://santifer.io"

# ⚠️ SECURITY: NEVER enable auto-apply without human review
allowAutoApply: false
```

**Validation Rules:**
- `name`: 1-100 chars
- `email`: valid email format
- `salaryTarget.min/max`: positive numbers, min < max
- `targetRoles`: at least 1 role
- `remote`: one of: remote, hybrid, onsite, any

## Portals Configuration (`portals.yml`)

```yaml
title_filter:
  positive:
    - "AI"
    - "ML"
    - "LLM"
    - "Agent"
    - "LLMOps"
  negative:
    - "Junior"
    - "Intern"
    - ".NET"
  seniority_boost:
    - "Senior"
    - "Staff"
    - "Principal"

search_queries:
  - name: "Ashby — AI Engineer"
    query: 'site:jobs.ashbyhq.com "AI Engineer" OR "LLM Engineer" remote'
    enabled: true

tracked_companies:
  - name: "Anthropic"
    careers_url: "https://www.anthropic.com/jobs"
    enabled: true
  - name: "OpenAI"
    careers_url: "https://openai.com/careers"
    enabled: true
```

**Security:**
- Max 100 companies
- URLs must be http(s) only
- Query length max 500 chars each
- No private IP ranges in URLs

## State Values (canonical - do not edit)

Allowed values for `status` in tracker:
- `evaluated` - reviewed, not yet applied
- `applied` - application submitted
- `responded` - employer responded
- `interview` - interview stage
- `offer` - offer received
- `rejected` - declined by employer
- `discarded` - withdrawn/closed
- `skip` - intentionally skipped (no-match, geo-block, etc.)

## Modes Profile (`modes/_profile.md`)

User-specific customizations that override system defaults:

```markdown
# User Profile - Career-Ops Customizations

## Archetype Priorities (your targeting)

### Agentic / Multi-Agent
My strongest fit. I have 4 years building conversational AI agents and 2 years
leading agentic workflow design. Key proof points:
- Built VAPI voice agents handling 50K+ calls/month
- Designed multi-agent orchestration with LangGraph
- Implemented HITL approval workflows

### LLMOps
Secondary. Experience with model deployment and monitoring.
- 3 years LLMOps at Scale AI
- Deployed Llama 2 production pipeline
- Built eval framework for RAG applications

## Negotiation Position

- **Current comp:** $185K base + 0.05% equity
- **Target:** $220K base + 0.1% equity minimum
- **Walk-away:** Below $200K total comp
- **Leverage:** Currently have 2 competing offers

## red_flags (avoid these companies)
- Any role requiring >50% travel
- Startups without Series B funding
- Companies with "always-on" pager duty
```

## Security Notes

1. **Never store API keys in config files**
   - Use environment variables: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`

2. **Keep config out of version control**
   - `config/profile.yml` ← contains personal data
   - `portals.yml` ← may contain company URLs you don't want public
   - `modes/_profile.md` ← your strategy, keep private

3. **File permissions**
   - All personal files: `chmod 600`
   - Directories: `chmod 700`

4. **Scanning policy**
   - Only scan companies you intend to apply to
   - Respect robots.txt
   - Do not exceed rate limits (built-in rate limiter enforces this)

5. **Data retention**
   - Reports and PDFs contain sensitive info
   - Encrypt backups if storing off-machine
   - Delete old applications from tracker when no longer needed (GDPR right to be forgotten)

## Environment Variables

Required:

| Variable | Purpose | Example |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Claude API key (recommended) | `sk-ant-...` |
| `OPENAI_API_KEY` | Alternative OpenAI key | `sk-...` |

Optional:

| Variable | Purpose | Default |
|----------|---------|---------|
| `PROJECT_ROOT` | Override project location | auto-detected |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `AUDIT_KEY` | HMAC key for audit logs (auto-generated if not set) |
| `DEBUG` | Enable debug mode (more verbose) | `false` |

Set in `.env` file (DO NOT COMMIT):

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Then add `.env` to `.gitignore`.

## Troubleshooting

**"Config validation failed"** → Check YAML syntax (use `yamllint`)

**"URL blocked: private IP"** → You're trying to scan a local URL; remove from portals.yml

**"Permission denied"** → Run `chmod 600 config/profile.yml`

**"PDF generation failed"** → Ensure Playwright installed: `npx playwright install chromium`
