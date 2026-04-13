#!/usr/bin/env node

"use strict";

const path = require("node:path");
const process = require("node:process");
const fg = require("fast-glob");
const fs = require("fs-extra");
const { spawnSync } = require("node:child_process");
const { Command } = require("commander");

const DEFAULT_TARGET = "claude-project";
const ALLOWED_TARGETS = new Set([
  "claude-project",
  "claude-global",
  "opencode-project",
  "opencode-global",
  "qwen-project",
  "qwen-global",
]);

function main() {
  const program = new Command();

  program
    .name("epub2skill")
    .description("Convert EPUB to markdown and scaffold skill folders")
    .argument("<epubOrGlob>", "epub path or glob pattern, e.g. ./books/*.epub")
    .requiredOption("--skill <name>", "skill name, recommend kebab-case")
    .option(
      "--targets <list>",
      "comma-separated targets: claude-project,claude-global,opencode-project,opencode-global,qwen-project,qwen-global",
      DEFAULT_TARGET
    )
    .option("--project-root <path>", "project root path", process.cwd())
    .option("--merge", "merge each book into one markdown file", false)
    .option("--force", "overwrite existing skill directory", false)
    .option("--description <text>", "description for SKILL.md")
    .option("--verbose", "print detailed logs", false)
    .action(run)
    .parse(process.argv);
}

function run(epubOrGlob, options) {
  let tempRoot;
  try {
    validateSkillName(options.skill);
    const projectRoot = path.resolve(options.projectRoot);
    const targets = parseTargets(options.targets);
    const resolvedTargets = resolveTargets(targets, projectRoot, options.skill);
    const epubFiles = resolveEpubFiles(epubOrGlob, projectRoot);

    if (epubFiles.length === 0) {
      fail(`No EPUB files matched: ${epubOrGlob}`);
    }

    tempRoot = fs.mkdtempSync(path.join(fs.realpathSync(process.cwd()), "epub2skill-"));
    const logs = [];
    const usedNames = new Set();

    for (const epubFile of epubFiles) {
      const bookName = path.basename(epubFile, path.extname(epubFile));
      const uniqueBookName = dedupeName(bookName, usedNames);
      const localEpubPath = path.join(tempRoot, `${uniqueBookName}.epub`);

      const convertResult = runEpub2md(epubFile, localEpubPath, options.merge, options.verbose);
      logs.push(convertResult);
    }

    const resourcesMap = collectTempResources(tempRoot);
    if (resourcesMap.markdownFiles.length === 0) {
      fail("Conversion completed but no markdown files were generated.");
    }

    for (const targetInfo of resolvedTargets) {
      prepareTarget(targetInfo.skillDir, options.force);
      const resourcesDir = path.join(targetInfo.skillDir, "resources");
      fs.ensureDirSync(resourcesDir);
      for (const log of logs) {
        fs.copySync(log.generatedDir, path.join(resourcesDir, path.basename(log.generatedDir)), {
          overwrite: true,
          recursive: true,
        });
      }

      const indexContent = buildBookIndex(resourcesDir);
      fs.writeFileSync(path.join(targetInfo.skillDir, "bookindex.md"), indexContent, "utf8");

      const skillContent = buildSkillFile(
        options.skill,
        options.description || `Use ${options.skill} source material from EPUB conversions.`
      );
      fs.writeFileSync(path.join(targetInfo.skillDir, "SKILL.md"), skillContent, "utf8");
    }

    printSuccess(epubFiles, resolvedTargets, logs);
  } catch (error) {
    fail(error.message || String(error));
  } finally {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.removeSync(tempRoot);
    }
  }
}

function runEpub2md(epubFile, localEpubPath, merge, verbose) {
  const epub2mdEntry = require.resolve("epub2md");
  const epub2mdRoot = path.dirname(path.dirname(epub2mdEntry));
  const cliPath = path.join(epub2mdRoot, "lib", "bin", "cli.cjs");

  const workDir = path.dirname(localEpubPath);
  fs.copyFileSync(epubFile, localEpubPath);

  const args = [cliPath, localEpubPath];
  if (merge) {
    args.push("--merge");
  }

  const result = spawnSync(process.execPath, args, {
    cwd: workDir,
    encoding: "utf8",
    stdio: verbose ? "inherit" : "pipe",
  });

  if (result.status !== 0) {
    const errOut = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`epub2md failed for ${epubFile}${errOut ? `\n${errOut}` : ""}`);
  }

  const generatedDir = localEpubPath.replace(/\.epub$/i, "");
  fs.removeSync(localEpubPath);

  return {
    epubFile,
    generatedDir,
    stdout: result.stdout || "",
  };
}

function dedupeName(name, used) {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  let i = 2;
  while (used.has(`${name}-${i}`)) {
    i += 1;
  }
  const next = `${name}-${i}`;
  used.add(next);
  return next;
}

function resolveEpubFiles(epubOrGlob, cwd) {
  const hasGlob = /[*?\[\]{}]/.test(epubOrGlob);
  if (!hasGlob) {
    const abs = path.resolve(cwd, epubOrGlob);
    if (!fs.existsSync(abs)) {
      return [];
    }
    return abs.toLowerCase().endsWith(".epub") ? [abs] : [];
  }

  return fg
    .sync(epubOrGlob, {
      cwd,
      absolute: true,
      onlyFiles: true,
      caseSensitiveMatch: false,
      suppressErrors: true,
    })
    .filter((p) => p.toLowerCase().endsWith(".epub"));
}

function prepareTarget(skillDir, force) {
  if (fs.existsSync(skillDir)) {
    if (!force) {
      throw new Error(`Target exists: ${skillDir}. Use --force to overwrite.`);
    }
    fs.removeSync(skillDir);
  }
  fs.ensureDirSync(skillDir);
}

function parseTargets(rawTargets) {
  const targets = rawTargets
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (targets.length === 0) {
    throw new Error("No targets provided.");
  }

  for (const target of targets) {
    if (!ALLOWED_TARGETS.has(target)) {
      throw new Error(`Unsupported target: ${target}`);
    }
  }

  return [...new Set(targets)];
}

function resolveTargets(targets, projectRoot, skillName) {
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) {
    throw new Error("Cannot resolve home directory from USERPROFILE or HOME.");
  }

  return targets.map((target) => {
    let baseDir;
    switch (target) {
      case "claude-project":
        baseDir = path.join(projectRoot, ".claude", "skills");
        break;
      case "claude-global":
        baseDir = path.join(home, ".claude", "skills");
        break;
      case "opencode-project":
        baseDir = path.join(projectRoot, ".opencode", "skills");
        break;
      case "opencode-global":
        baseDir = path.join(home, ".config", "opencode", "skills");
        break;
      case "qwen-project":
        baseDir = path.join(projectRoot, ".qwen", "skills");
        break;
      case "qwen-global":
        baseDir = path.join(home, ".qwen", "skills");
        break;
      default:
        throw new Error(`Unsupported target: ${target}`);
    }
    return {
      target,
      baseDir,
      skillDir: path.join(baseDir, skillName),
    };
  });
}

function collectTempResources(tempRoot) {
  const markdownFiles = fg.sync("**/*.md", {
    cwd: tempRoot,
    absolute: true,
    onlyFiles: true,
  });
  return { markdownFiles };
}

function buildBookIndex(resourcesDir) {
  const markdownFiles = fg
    .sync("**/*.md", {
      cwd: resourcesDir,
      onlyFiles: true,
      dot: false,
    })
    .sort((a, b) => a.localeCompare(b, "en"));

  const lines = [
    "# Book Index",
    "",
    "Generated from EPUB source files. Use these paths when citing source material.",
    "",
  ];

  for (const rel of markdownFiles) {
    const posixRel = rel.split(path.sep).join("/");
    lines.push(`- [${posixRel}](resources/${posixRel})`);
  }

  lines.push("");
  return lines.join("\n");
}

function buildSkillFile(skillName, description) {
  return [
    "---",
    `name: ${skillName}`,
    `description: ${escapeYamlScalar(description)}`,
    "---",
    "",
    "# Skill Guide",
    "",
    "Use this skill to answer based on the converted EPUB content.",
    "",
    "## Source of truth",
    "- First read `bookindex.md` to locate relevant chapters.",
    "- Then read files under `resources/` for exact source text.",
    "",
    "## Answering rules",
    "- Prioritize statements that are directly supported by source text.",
    "- Cite chapter file paths when making specific claims.",
    "- If source text is missing or ambiguous, say so explicitly.",
    "- Do not invent facts that are not present in source files.",
    "",
  ].join("\n");
}

function validateSkillName(skillName) {
  const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!pattern.test(skillName)) {
    throw new Error(
      `Invalid --skill \"${skillName}\". Use kebab-case: lowercase letters, numbers, dashes.`
    );
  }
}

function escapeYamlScalar(value) {
  const escaped = String(value).replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function printSuccess(epubFiles, targets, logs) {
  console.log("Done.");
  console.log(`- EPUB files: ${epubFiles.length}`);
  console.log(`- Targets: ${targets.map((t) => t.target).join(", ")}`);
  for (const target of targets) {
    console.log(`- Output: ${target.skillDir}`);
  }
  if (logs.length > 0) {
    console.log("- Conversion finished successfully.");
  }
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

main();
