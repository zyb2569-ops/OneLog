#!/usr/bin/env node
/**
 * Create toolkit working paths, merge AGENTS.md routing block, and report CodeGraph / nested-repo status.
 *
 *   node init.mjs prepare [--root <dir>]
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";

const LAYERS = [
  { dir: "frontend", title: "Frontend" },
  { dir: "backend", title: "Backend" },
  { dir: "common", title: "Common" },
];

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "target",
  "dist",
  "build",
  ".work",
  ".agents",
  ".cursor",
  ".claude",
  ".codegraph",
  "Reference",
  "vendor",
  ".idea",
  ".vscode",
]);

const GITIGNORE_LINES = [".work/", ".agents/specs/.hits.json", ".codegraph/"];
const MAX_GIT_DEPTH = 2;
export const AGENTS_START = "<!-- AGENT-SKILLS:START -->";
export const AGENTS_END = "<!-- AGENT-SKILLS:END -->";
const AGENTS_FALLBACK = `${AGENTS_START}
# Skills 工具包

本仓的编码辅助流程在 \`.agents/skills/\`。改代码前先分档，再 Read 对应 SKILL.md。
${AGENTS_END}
`;

function posix(p) {
  return p.split(sep).join("/");
}

function parseArgs(argv) {
  const args = { cmd: null, root: null };
  const rest = argv.slice(2);
  if (rest.length === 0 || rest[0] === "-h" || rest[0] === "--help") {
    args.cmd = "help";
    return args;
  }
  args.cmd = rest[0];
  for (let i = 1; i < rest.length; i += 1) {
    if (rest[i] === "--root") {
      args.root = rest[i + 1];
      i += 1;
    }
  }
  return args;
}

function help() {
  return `Usage:
  node init.mjs prepare [--root <dir>]
`;
}

function isGitRepo(dir) {
  return existsSync(join(dir, ".git"));
}

function hasCodegraphIndex(dir) {
  const cg = join(dir, ".codegraph");
  if (!existsSync(cg)) return false;
  try {
    if (!statSync(cg).isDirectory()) return false;
    const names = readdirSync(cg).filter((n) => n !== ".gitignore");
    return names.length > 0;
  } catch {
    return false;
  }
}

function walkGitRepos(root, depth, acc) {
  if (isGitRepo(root)) acc.push(root);
  if (depth >= MAX_GIT_DEPTH) return;
  let names;
  try {
    names = readdirSync(root);
  } catch {
    return;
  }
  for (const name of names) {
    if (SKIP_DIRS.has(name) || name.startsWith(".")) continue;
    const child = join(root, name);
    try {
      if (!statSync(child).isDirectory()) continue;
    } catch {
      continue;
    }
    walkGitRepos(child, depth + 1, acc);
  }
}

export function findGitRepos(root) {
  const acc = [];
  walkGitRepos(root, 0, acc);
  const unique = [...new Set(acc.map((p) => resolve(p)))];
  unique.sort();
  return unique;
}

export function codegraphCliAvailable() {
  const cmd = process.platform === "win32" ? "where.exe" : "which";
  try {
    execFileSync(cmd, ["codegraph"], { stdio: "ignore", timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

function ensureDir(abs) {
  if (existsSync(abs)) return false;
  mkdirSync(abs, { recursive: true });
  return true;
}

function writeIfMissing(abs, contents) {
  if (existsSync(abs)) return false;
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, contents, "utf8");
  return true;
}

function indexTemplate(title) {
  const templatePath = join(fileURLToPath(new URL("../templates/index.md", import.meta.url)));
  const fallback = join(fileURLToPath(new URL("./index.template.md", import.meta.url)));
  const src = existsSync(templatePath) ? templatePath : fallback;
  let text;
  if (existsSync(src)) {
    text = readFileSync(src, "utf8");
  } else {
    text = `# ${title} 规范\n\n## 规范列表\n\n| 规范 | 说明 |\n|------|------|\n| | |\n\n## 何时读哪些规范\n\n- （场景） → \`./xxx.md\`\n\n## 改完对照什么\n\n1. 对照上面读过的规范逐条检查\n`;
  }
  return text.replaceAll("{{Layer}}", title);
}

function mergeGitignore(root) {
  const abs = join(root, ".gitignore");
  const existing = existsSync(abs) ? readFileSync(abs, "utf8") : "";
  const have = new Set(
    existing
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  );
  const missing = GITIGNORE_LINES.filter((line) => !have.has(line));
  if (missing.length === 0) return false;
  const prefix = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  writeFileSync(abs, `${existing}${prefix}${missing.join("\n")}\n`, "utf8");
  return true;
}

function lf(text) {
  return String(text).replace(/\r\n/g, "\n");
}

function agentsTemplate() {
  const templatePath = join(fileURLToPath(new URL("../templates/AGENTS.md", import.meta.url)));
  const text = existsSync(templatePath) ? readFileSync(templatePath, "utf8") : AGENTS_FALLBACK;
  return lf(text).trim() + "\n";
}

function stitchAgents(before, block, after) {
  const parts = [before.replace(/\n+$/, ""), block.trimEnd(), after.replace(/^\n+/, "").replace(/\n+$/, "")];
  return `${parts.filter((s) => s.length > 0).join("\n\n")}\n`;
}

export function mergeAgentsMd(root) {
  const abs = join(root, "AGENTS.md");
  const block = agentsTemplate();
  if (!block.includes(AGENTS_START) || !block.includes(AGENTS_END)) {
    throw new Error("AGENTS.md 模板缺少 AGENT-SKILLS 起止标记");
  }

  if (!existsSync(abs)) {
    writeFileSync(abs, block, "utf8");
    return "created";
  }

  const existing = lf(readFileSync(abs, "utf8"));
  const startIdx = existing.indexOf(AGENTS_START);
  const endIdx = existing.indexOf(AGENTS_END);

  let next;
  let action;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    next = stitchAgents(
      existing.slice(0, startIdx),
      block,
      existing.slice(endIdx + AGENTS_END.length),
    );
    action = "updated";
  } else {
    next = stitchAgents(existing, block, "");
    action = "appended";
  }

  if (next === existing || next === existing.replace(/\n+$/, "") + "\n") return "unchanged";
  writeFileSync(abs, next, "utf8");
  return action;
}

export function prepare(root) {
  const created = [];
  const skipped = [];

  const work = join(root, ".work");
  if (ensureDir(work)) created.push(posix(relative(root, work)) || ".work");
  else skipped.push(".work");

  for (const layer of LAYERS) {
    const dir = join(root, ".agents", "specs", layer.dir);
    if (ensureDir(dir)) created.push(posix(relative(root, dir)));
    const index = join(dir, "index.md");
    if (writeIfMissing(index, indexTemplate(layer.title))) {
      created.push(posix(relative(root, index)));
    } else {
      skipped.push(posix(relative(root, index)));
    }
  }

  if (mergeGitignore(root)) created.push(".gitignore");
  else skipped.push(".gitignore");

  const agentsMd = mergeAgentsMd(root);
  if (agentsMd === "unchanged") skipped.push("AGENTS.md");
  else created.push("AGENTS.md");

  const project = root.split(/[/\\]/).filter(Boolean).pop();
  const archive = join(homedir(), "agent-archive", project);
  if (ensureDir(archive)) created.push(posix(archive));
  else skipped.push(posix(archive));

  const gitRepos = findGitRepos(root).map((abs) => ({
    path: posix(relative(root, abs) || "."),
    abs: posix(abs),
    hasIndex: hasCodegraphIndex(abs),
  }));

  if (gitRepos.length === 0) {
    gitRepos.push({
      path: ".",
      abs: posix(root),
      hasIndex: hasCodegraphIndex(root),
    });
  }

  const cli = codegraphCliAvailable();
  const missingIndex = gitRepos.filter((r) => !r.hasIndex);

  let codegraphAction = "skip_indexed";
  if (!cli) codegraphAction = "ask_install";
  else if (missingIndex.length === 0) codegraphAction = "already_indexed";
  else if (gitRepos.length > 1) codegraphAction = "ask_which_repos";
  else codegraphAction = "init_here";

  return {
    root: posix(root),
    created,
    skipped,
    agentsMd,
    gitRepos,
    codegraph: {
      cli,
      action: codegraphAction,
      installHint: "npm i -g @colbymchenry/codegraph",
      initCmd: "codegraph init",
      missingIndex: missingIndex.map((r) => r.path),
    },
  };
}

export function run(argv, stdout = process.stdout, stderr = process.stderr) {
  try {
    const args = parseArgs(argv);
    if (args.cmd === "help") {
      stdout.write(help());
      return 0;
    }
    if (args.cmd !== "prepare") {
      stderr.write(`未知命令: ${args.cmd}\n${help()}`);
      return 1;
    }
    const root = resolve(args.root || process.cwd());
    const report = prepare(root);
    stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return 0;
  } catch (err) {
    stderr.write(`${err.message || err}\n`);
    return 1;
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  process.exitCode = run(process.argv);
}
