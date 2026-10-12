# Cloud Voyager - CLAUDE CODE CLI Directives

## MANDATORY: Parallel Agent Swarms

**You MUST use parallel agent swarms and subagents to parallelize your work.**

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).

## Shell Commands — Use Bash

**Shell commands like `grep`, `find`, `ls`, `cat`, `sed`, etc. must be run through the Bash tool.**

Never try to invoke them as standalone tools. For example:
- ✅ `Bash: grep -rl "hotspot" --include="*.ts" .`
- ❌ `grep "hotspot" file.ts` (not a tool, will fail)

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Skills

### Image Analysis (Mandatory)
- Use the `analyze-image` skill whenever the user shares an image URL, uploads an image, or references an image file path.
- This skill is auto-triggered via the `UserPromptSubmit` hook: `~/.claude/hooks/analyze-image-on-url.sh`
- It uses MiniMax Vision AI (if API key configured) or Swift OCR (fallback) to analyze images.
