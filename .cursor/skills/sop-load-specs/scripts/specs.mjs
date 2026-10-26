#!/usr/bin/env node
/**
 * Scan .agents/specs/{frontend,backend,common} into a numbered menu.
 * Hits are keyed by posix path, never by menu number.
 *
 * Usage:
 *   node specs.mjs list [--root <dir>]
 *   node specs.mjs pick 1,3,7 [--root <dir>]
 *   node specs.mjs hits [--root <dir>]
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const LAYERS = ["frontend", "backend", "common"];
const SPECS_DIR = join(".agents", "specs");
const HITS_FILE = join(".agents", "specs", ".hits.json");
const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

function posix(p) {
  return p.split(sep).join("/");
}

function findRoot(start) {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, ".agents", "specs"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function parseArgs(argv) {
  const args = { cmd: null, pick: null, root: null };
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
    } else if (args.cmd === "pick" && args.pick === null) {
      args.pick = rest[i];
    }
  }
  return args;
}

function titleOf(absPath, fallback) {
  if (!existsSync(absPath)) return fallback;
  const text = readFileSync(absPath, "utf8");
  const m = text.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function layerFiles(root, layer) {
  const dir = join(root, ".agents", "specs", layer);
  const indexAbs = join(dir, "index.md");
  if (!existsSync(indexAbs)) return [];

  const found = new Map();
  const add = (abs) => {
    const resolved = resolve(abs);
    const rel = posix(relative(root, resolved));
    const base = rel.split("/").pop();
    if (!rel.startsWith(".agents/specs/") || !rel.endsWith(".md")) return;
    if (base.startsWith(".")) return;
    if (found.has(rel)) return;
    found.set(rel, {
      layer,
      id: rel,
      title: titleOf(resolved, rel.split("/").pop().replace(/\.md$/, "")),
      isIndex: rel.endsWith("/index.md"),
    });
  };

  add(indexAbs);

  const indexText = readFileSync(indexAbs, "utf8");
  for (const match of indexText.matchAll(LINK_RE)) {
    const href = match[1].trim().split("#")[0].split("?")[0];
    if (!href || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:")) continue;
    if (!href.endsWith(".md")) continue;
    add(join(dir, href));
  }

  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".md") || name.startsWith(".")) continue;
      add(join(dir, name));
    }
  }

  return [...found.values()];
}

export function collectItems(root) {
  const items = [];
  for (const layer of LAYERS) {
    const files = layerFiles(root, layer);
    files.sort((a, b) => {
      if (a.isIndex !== b.isIndex) return a.isIndex ? -1 : 1;
      return a.id.localeCompare(b.id);
    });
    items.push(...files);
  }
  return items.map((item, i) => ({ n: i + 1, ...item }));
}

function readHits(root) {
  const abs = join(root, HITS_FILE);
  if (!existsSync(abs)) return {};
  try {
    const data = JSON.parse(readFileSync(abs, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeHits(root, hits) {
  const abs = join(root, HITS_FILE);
  mkdirSync(dirname(abs), { recursive: true });
  const tmp = `${abs}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(hits, null, 2)}\n`, "utf8");
  renameSync(tmp, abs);
}

function printTable(items) {
  const lines = ["n\tlayer\tpath\ttitle"];
  for (const item of items) {
    lines.push(`${item.n}\t${item.layer}\t${item.id}\t${item.title}`);
  }
  return lines.join("\n");
}

function parsePick(raw, max) {
  if (!raw || !String(raw).trim()) {
    throw new Error("pick 需要编号，例如 1,3,7");
  }
  const nums = String(raw)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s));
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > max)) {
    throw new Error(`编号必须是 1–${max} 的整数，收到: ${raw}`);
  }
  return [...new Set(nums)];
}

function help() {
  return `Usage:
  node specs.mjs list [--root <dir>]
  node specs.mjs pick 1,3,7 [--root <dir>]
  node specs.mjs hits [--root <dir>]
`;
}

export function run(argv, stdout = process.stdout, stderr = process.stderr) {
  try {
    return runInner(argv, stdout, stderr);
  } catch (err) {
    stderr.write(`${err.message || err}\n`);
    return 1;
  }
}

function runInner(argv, stdout, stderr) {
  const args = parseArgs(argv);
  if (args.cmd === "help") {
    stdout.write(help());
    return 0;
  }
  if (!["list", "pick", "hits"].includes(args.cmd)) {
    stderr.write(`未知命令: ${args.cmd}\n${help()}`);
    return 1;
  }

  const start = args.root ? resolve(args.root) : process.cwd();
  const root = existsSync(join(start, ".agents", "specs")) ? start : findRoot(start);
  if (!root) {
    stderr.write("未找到 .agents/specs。请在业务仓根目录运行，或加 --root。\n");
    return 1;
  }

  const items = collectItems(root);
  if (items.length === 0) {
    stderr.write("未找到 frontend/backend/common 下的 index.md。\n");
    return 1;
  }

  if (args.cmd === "list") {
    const payload = { root: posix(root), items: items.map(({ isIndex, ...rest }) => rest) };
    stdout.write(`${printTable(items)}\n\n${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  if (args.cmd === "hits") {
    const hits = readHits(root);
    stdout.write(`${JSON.stringify(hits, null, 2)}\n`);
    return 0;
  }

  const nums = parsePick(args.pick, items.length);
  const selected = nums.map((n) => items[n - 1]);
  const hits = readHits(root);
  for (const item of selected) {
    hits[item.id] = (hits[item.id] || 0) + 1;
  }
  writeHits(root, hits);

  const payload = {
    root: posix(root),
    selected: selected.map((item) => ({
      n: item.n,
      layer: item.layer,
      id: item.id,
      title: item.title,
      hits: hits[item.id],
    })),
  };
  stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  return 0;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.exitCode = run(process.argv);
  } catch (err) {
    process.stderr.write(`${err.message || err}\n`);
    process.exitCode = 1;
  }
}
