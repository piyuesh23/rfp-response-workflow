# Pre-Sales Estimation Template

An AI-powered pre-sales estimation workflow for analyzing TOR/RFP/SOW documents, drafting clarifying questions, reviewing estimates, and producing gap analysis — all driven by Claude Code.

## Quick Start

```bash
# From this directory
./init.sh <client-name> [tech-stack]

# Examples
./init.sh Ferrellgas-BlueRhino drupal
./init.sh Acme-Corp nextjs
./init.sh MyClient react
```

This creates a new engagement directory as a sibling to `_template/`, initializes git, and activates the appropriate technology overlay.

> **First time?** See [SETUP.md](SETUP.md) for prerequisites and installation.

## Supported Tech Stacks

| Stack | Overlay | Default? |
|-------|---------|----------|
| Drupal 10/11 | `drupal_estimation` | Yes |
| Next.js | `nextjs_estimation` | No |
| React | `react_estimation` | No |

Each overlay activates tech-specific CARL rules that guide estimation quality (e.g., Drupal overlay enforces checks for contrib vs custom modules, CMI, decoupled overhead).

## Workflow

The template uses a **5-phase workflow**, each triggered by placing documents in the corresponding directory and prompting Claude Code:

```
Phase 1: TOR Analysis          →  Place TOR in tor/, ask Claude to analyze
Phase 2: Response Integration   →  Place customer answers in responses_qna/
Phase 3: Estimate Review        →  Place estimates in estimates/
Phase 4: Gap Analysis           →  Ask Claude to generate gap analysis
Phase 5: Knowledge Capture      →  Ask Claude to store learnings (post-engagement)
```

### Phase Prompts

| Phase | Prompt |
|-------|--------|
| 1 | "Analyze the TOR in `tor/` and generate clarifying questions" |
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
├── tor/                         # Input: TOR/RFP/SOW documents
├── initial_questions/           # Output: Phase 1 clarifying questions
├── responses_qna/               # Input: Customer responses
├── estimates/                   # Input: Estimate documents
├── claude-artefacts/            # Output: All AI-generated analysis
├── templates/                   # Output structure templates
│   ├── tor-assessment-template.md
│   ├── questions-template.md
│   ├── estimate-review-template.md
│   └── gap-analysis-template.md
└── benchmarks/                  # Effort reference ranges
    ├── general-effort-ranges.md
    └── drupal-effort-ranges.md  # (if Drupal stack selected)
```

## Output Templates

Each phase produces artefacts following a consistent structure defined in `templates/`. This ensures every engagement produces comparable, reviewable documents with:

- **TOR Assessment**: Requirements table with clarity ratings, risk register, assumptions log
- **Questions**: Domain-grouped questions with requirement references and suggested options
- **Estimate Review**: Coverage matrix, orphan detection, effort reasonableness flags, missing categories checklist
- **Gap Analysis**: Full traceability matrix, gaps/orphans lists, revised effort suggestions, confidence scores

## Benchmarks

The `benchmarks/` directory contains reference effort ranges for calibrating estimates:

- **general-effort-ranges.md** — Tech-agnostic ranges (PM overhead, QA, DevOps, migration by volume, integration tiers)
- **drupal-effort-ranges.md** — Drupal-specific ranges (content types, custom modules, contrib config, theme dev, migration sources)

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
