# epub2skill

<a href="README.md">English</a> |
<a href="README.zh.md">简体中文</a>

将任意 EPUB 书籍转换为 Agent 可用的 Skill，让 Agent 像作者一样帮助你思考、解释与回答。

## 功能

- 支持单本或批量 EPUB（支持 glob）
- 自动生成 Skill 目录结构（`SKILL.md` + `bookindex.md` + `resources/`）
- 支持输出到 Claude/OpenCode 的项目级或全局技能目录
- 可选 `--merge` 合并章节，`--force` 覆盖已有技能

## 安装

```bash
npm install -g epub2skill
```

## 安装此 Skill（`SKILL.md`）

```bash
npx skills add yearzen1/epub2skill -y -g
```

示例：

```bash
npx skills add https://github.com/yearzen1/epub2skill -y -g
```

## 使用

```bash
epub2skill "./books/*.epub" \
  --skill stoicism-guide \
  --targets opencode-project \
  --description "基于斯多葛相关书籍的问答技能"
```

```bash
epub2skill <epubOrGlob> --skill <name> [options]
```

主要参数：

- `--skill <name>`: Skill 名称（建议 kebab-case）
- `--targets <list>`: 目标目录（逗号分隔）
  - `claude-project`
  - `claude-global`
  - `opencode-project`
  - `opencode-global`
- `--project-root <path>`: 项目根目录（默认当前目录）
- `--merge`: 每本书合并为一个 Markdown
- `--force`: 覆盖已存在的 Skill 目录
- `--description <text>`: 写入 `SKILL.md` 的描述
- `--verbose`: 输出详细日志

## 输出结构

```text
<skill-dir>/
  SKILL.md
  bookindex.md
  resources/
    <book-1>/...
    <book-2>/...
```

## 适用场景

- 把个人书单变成可调用的知识技能
- 在写作、学习、复盘中让 Agent 按原书内容辅助回答
- 构建“像作者一样表达风格和思路”的知识助手
