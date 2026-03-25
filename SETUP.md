# Setup Guide

Everything you need to start using this pre-sales estimation template with Claude Code CLI.

## Prerequisites

### 1. Claude Code CLI

Install the Claude Code CLI if you haven't already:

```bash
npm install -g @anthropic-ai/claude-code
```

Verify installation:

```bash
claude --version
```

> Requires Node.js 18+ and an active Anthropic API key or Claude Pro/Team/Enterprise subscription.

### 2. Git

The bootstrap script initializes a git repo per engagement. Ensure git is installed:

```bash
git --version
```

## Installation

### Option A: Clone from Git (recommended)

```bash
cd ~/Operational/presales   # or your preferred parent directory
git clone <repo-url> _template
```

### Option B: Copy manually

Download or copy the `_template/` directory into your presales working directory.

### Verify

```bash
ls _template/
# Should show: CLAUDE.md  SETUP.md  README.md  init.sh  benchmarks/  templates/  ...
```

## Plugin Setup

The template uses Claude Code plugins for enhanced functionality. These are **optional but recommended** — the core workflow works without them.

### Required: None

The template works out of the box with just Claude Code CLI. CARL rules and output templates are file-based and need no plugin installation.

### Recommended Plugins

Install these from within any Claude Code session:

#### CARL (Context-Aware Rule Loading)

CARL loads the `.carl/` domain rules automatically. It's installed at the user level, not per-project.

If you don't have CARL installed, the `.carl/` rules won't auto-load — but the CLAUDE.md instructions still guide Claude's behavior. To install CARL, follow the instructions at its repository.

#### ralph-loop (Iterative AI Loops)

Used in Phase 3 for iterative estimate validation. Install via Claude Code:

```
/plugin install ralph-loop@claude-plugins-official
/reload-plugins
```

#### claude-mem (Cross-Session Memory)

Enables Phase 5 (Knowledge Capture) and cross-engagement learning. Stores estimation benchmarks, question patterns, and gotchas that persist across sessions.

Install via Claude Code:

```
/plugin install claude-mem@thedotmack
/reload-plugins
```

After installing, verify in a Claude Code session:

```
/plugin list
```

### Plugin Enablement

Each engagement's `.claude/settings.json` enables plugins at the project level:

```json
{
  "enabledPlugins": {
    "ralph-loop@claude-plugins-official": true
  }
}
```

To enable additional plugins for a specific engagement, edit this file after running `init.sh`.

## Creating Your First Engagement

```bash
cd /path/to/presales/_template
./init.sh MyFirstClient drupal
```

This will:
1. Copy the template to `../MyFirstClient/`
2. Activate the Drupal estimation CARL overlay
3. Replace `[CLIENT_NAME]`, `[DATE]`, `[TECH_STACK]` placeholders
4. Initialize a git repo with an initial commit

## Using the Engagement

### Step 1: Open in Claude Code

```bash
cd /path/to/presales/MyFirstClient
claude
```

Claude Code will automatically read `CLAUDE.md` and load CARL rules (if installed).

### Step 2: Place your TOR document

Copy your TOR/RFP/SOW document into the `tor/` directory. Supported formats:
- PDF (Claude Code can read PDFs natively)
- Markdown (.md)
- Word documents (.docx) — best converted to PDF or Markdown first
- Plain text (.txt)

### Step 3: Run Phase 1

In Claude Code, type:

```
Analyze the TOR in tor/ and generate clarifying questions
```

Claude will:
- Read the TOR document(s)
- Assess every requirement for clarity
- Generate structured questions following `templates/questions-template.md`
- Output to `initial_questions/questions.md` and `claude-artefacts/tor-assessment.md`

### Step 4: Iterate through phases

Continue through Phases 2-5 as documents become available. See [README.md](README.md) for phase prompts.

## Customization

### Adding tech stack overlays

See the "Adding a New Tech Overlay" section in [README.md](README.md).

### Modifying CARL rules

Edit the `.carl/presales` file in `_template/` to change estimation rules that apply to all engagements. Edit `.carl/overlays/<tech>_estimation` for tech-specific rules.

Rule format:
```
DOMAIN_RULE_N=Rule text here — use ALWAYS/NEVER for emphasis
```

### Updating benchmarks

Edit files in `benchmarks/` to adjust reference effort ranges. After completing engagements, run Phase 5 to capture learnings and update benchmarks with real data.

### Customizing output templates

Edit files in `templates/` to change the structure of generated artefacts. Keep the table headers and section names consistent so Claude follows the format.

## Troubleshooting

### init.sh fails with "permission denied"

```bash
chmod +x _template/init.sh
```

### CARL rules not loading

- Verify CARL is installed at the user level (`~/.carl/` exists)
- Check that `.carl/manifest` exists in the engagement directory
- Look for CARL domain output in Claude Code's system messages

### claude-mem not finding past data

- Ensure claude-mem plugin is installed and enabled
- Memory builds over time — first few engagements won't have historical data
- Use Phase 5 after each engagement to store learnings

### Placeholders still showing in CLAUDE.md

- `[PROJECT_NAME]` and `[Engagement Type]` are intentionally left for manual entry
- `[CLIENT_NAME]`, `[DATE]`, `[TECH_STACK]` should be replaced by `init.sh` — if not, check the script ran successfully

## macOS Note

The `init.sh` script uses `sed -i ''` (BSD sed syntax). On Linux, you'll need to change these to `sed -i` (without the empty quotes). A cross-platform version could use:

```bash
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|pattern|replacement|g" file
else
    sed -i "s|pattern|replacement|g" file
fi
```
