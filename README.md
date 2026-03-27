# Pre-Sales Estimation Template

An AI-powered pre-sales estimation workflow for analyzing TOR/RFP/SOW documents, drafting clarifying questions, reviewing estimates, and producing gap analysis — all driven by Claude Code.

## Quick Start

```bash
# From this directory
./init.sh <client-name> [tech-stack]

# Examples
./init.sh Ferrellgas-BlueRhino drupal
./init.sh Acme-Corp drupal-nextjs
./init.sh BigRetail nextjs
./init.sh MyClient react
```

This creates a new engagement directory as a sibling to `_template/`, initializes git, and activates the appropriate technology overlay.

> **First time?** See [SETUP.md](SETUP.md) for prerequisites and installation.

## Supported Tech Stacks

| Stack | Overlay | Default? |
|-------|---------|----------|
| Drupal 10/11 | `drupal_estimation` | Yes |
| Drupal + Next.js (Headless) | `drupal_nextjs_estimation` | No |
| Next.js | `nextjs_estimation` | No |
| React | `react_estimation` | No |

Each overlay activates tech-specific CARL rules that guide estimation quality (e.g., Drupal overlay enforces checks for contrib vs custom modules, CMI, decoupled overhead; Drupal + Next.js headless overlay adds rules for API design, JSON:API/GraphQL selection, SSR/SSG strategy, and decoupled architecture patterns).

## Workflow

The template uses a **6-phase workflow**, each triggered by placing documents in the corresponding directory and prompting Claude Code:

```
Phase 0: Customer Research      →  Place TOR in tor/, ask Claude to research
Phase 1: TOR Analysis           →  Ask Claude to analyze TOR and generate questions
Phase 1A: Optimistic Estimate   →  No-response path: /optimistic-estimate → /tech-proposal
Phase 2: Response Integration   →  Place customer answers in responses_qna/
Phase 3: Estimate Review        →  Place estimates in estimates/
Phase 4: Gap Analysis           →  Ask Claude to generate gap analysis
Phase 5: Knowledge Capture      →  Ask Claude to store learnings (post-engagement)
```

**Two paths after Phase 1:**
- **Standard path** (Phase 2→3→4): Customer responds to questions, estimates reviewed and validated
- **No-response path** (Phase 1A): Customer Q&A not received — generate optimistic, assumption-heavy estimates and a Technical Proposal directly

### Phase Prompts

| Phase | Prompt |
|-------|--------|
| 0 | "Research the customer and audit their existing site based on the TOR in `tor/`" |
| 1 | "Analyze the TOR in `tor/` and generate clarifying questions" |
| 1A | `/optimistic-estimate` then `/tech-proposal` |
| 2 | "Customer responses are in `responses_qna/`. Analyze them against the TOR and original questions" |
| 3 | "Estimates are in `estimates/`. Review them against requirements and responses" |
| 4 | "Generate the gap analysis and revised estimates" |
| 5 | "Capture learnings from this engagement for future reference" |

### Star-Commands

Available in any phase via CARL:

| Command | What it does |
|---------|-------------|
| `*checklist` | Runs the full estimation gap checklist against all artefacts |
| `*recap` | Summarizes engagement state: phases done, open questions, gaps, confidence |
| `*benchmark <query>` | Looks up effort benchmarks from memory and `benchmarks/` |
| `*optimistic` | Generate optimistic estimate (no-response path) |
| `*proposal` | Generate Technical Proposal Document |

## Directory Structure

```
<client-name>/
├── CLAUDE.md                    # Workflow instructions (auto-populated by init.sh)
├── .claude/settings.json        # Plugin config
├── .carl/
│   ├── manifest                 # Active CARL domains
│   ├── presales                 # Core estimation rules (always on)
│   ├── commands                 # Star-commands
│   └── <tech>_estimation        # Tech-specific rules (activated by init.sh)
├── .claude/commands/             # Project-level slash commands
│   ├── optimistic-estimate.md   # /optimistic-estimate (Phase 1A)
│   └── tech-proposal.md         # /tech-proposal (Phase 1A)
├── tor/                         # Input: TOR/RFP/SOW documents
├── initial_questions/           # Output: Phase 1 clarifying questions
├── responses_qna/               # Input: Customer responses
├── estimates/                   # Input/Output: Estimate documents
├── estimation_template/         # QED42 Excel estimation template
│   └── QED42-Estimate_Template.xlsx
├── claude-artefacts/            # Output: All AI-generated analysis
├── scripts/                     # Utility scripts
│   └── populate-estimate-xlsx.py  # Populates Excel from markdown estimate
├── templates/                   # Output structure templates
│   ├── tor-assessment-template.md
│   ├── questions-template.md
│   ├── estimate-review-template.md
│   ├── gap-analysis-template.md
│   ├── optimistic-estimate-template.md
│   └── technical-proposal-template.md
└── benchmarks/                  # Effort reference ranges
    ├── general-effort-ranges.md
    ├── drupal-effort-ranges.md  # (if Drupal stack selected)
    └── drupal-nextjs-effort-ranges.md  # (if Drupal + Next.js headless selected)
```

## Output Templates

Each phase produces artefacts following a consistent structure defined in `templates/`. This ensures every engagement produces comparable, reviewable documents with:

- **TOR Assessment**: Requirements table with clarity ratings, risk register, assumptions log
- **Questions**: Domain-grouped questions with requirement references and suggested options
- **Estimate Review**: Coverage matrix, orphan detection, effort reasonableness flags, missing categories checklist
- **Gap Analysis**: Full traceability matrix, gaps/orphans lists, revised effort suggestions, confidence scores
- **Optimistic Estimate**: Domain-grouped estimate with CR-boundary assumptions, question→assumption mapping, coverage checklist
- **Technical Proposal**: Client-facing 11-section proposal with architecture, solution approach, team composition, and phased scope boundaries

## Benchmarks

The `benchmarks/` directory contains reference effort ranges for calibrating estimates:

- **general-effort-ranges.md** — Tech-agnostic ranges (PM overhead, QA, DevOps, migration by volume, integration tiers)
- **drupal-effort-ranges.md** — Drupal-specific ranges (content types, custom modules, contrib config, theme dev, migration sources)
- **drupal-nextjs-effort-ranges.md** — Headless-specific ranges (API layer, Next.js frontend, decoupled auth, preview/draft mode, ISR/SSG overhead, GraphQL/JSON:API integration)

These are starting points. Update them with actuals from completed engagements via Phase 5 (Knowledge Capture).

## Adding a New Tech Overlay

1. Create a new file in `.carl/overlays/` following the naming pattern `<tech>_estimation`
2. Add rules using the format `<TECH_UPPER>_ESTIMATION_RULE_<N>=rule text`
3. Update `init.sh`:
   - Add the tech name to the `VALID_TECHS` array
   - Add a case to the `TECH_NAME` mapping
4. Optionally add a `benchmarks/<tech>-effort-ranges.md` file

## License

Internal use. Adapt as needed for your organization.
