# epub2skill

<a href="README.md">English</a> |
<a href="README.zh.md">简体中文</a>

Convert any EPUB book into agent-ready skills, so your agent can support you with author-like thinking, explanations, and answers.

## Features

- Convert one or many EPUB files (glob supported)
- Auto-generate skill structure (`SKILL.md` + `bookindex.md` + `resources/`)
- Output to Claude/OpenCode project-level or global skill folders
- Optional `--merge` for merged markdown and `--force` for overwrite

## Install

```bash
npm install -g epub2skill
```

## Install This Skill (`SKILL.md`)

```bash
npx skills add yearzen1/epub2skill -y -g
```

Example:

```bash
npx skills add https://github.com/yearzen1/epub2skill -y -g
```

## Usage

```bash
epub2skill "./books/*.epub" \
  --skill stoicism-guide \
  --targets opencode-project \
  --description "Q&A skill based on stoicism books"
```

```bash
epub2skill <epubOrGlob> --skill <name> [options]
```

Key options:

- `--skill <name>`: skill name (kebab-case recommended)
- `--targets <list>`: output targets (comma-separated)
  - `claude-project`
  - `claude-global`
  - `opencode-project`
  - `opencode-global`
- `--project-root <path>`: project root (default: current directory)
- `--merge`: merge each book into one markdown file
- `--force`: overwrite existing skill directory
- `--description <text>`: description written to `SKILL.md`
- `--verbose`: print detailed logs

## Output Structure

```text
<skill-dir>/
  SKILL.md
  bookindex.md
  resources/
    <book-1>/...
    <book-2>/...
```

## Use Cases

- Turn your EPUB library into reusable agent skills
- Let agents answer with direct grounding in your source books
- Build assistants that feel closer to each author's perspective
