import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import test from "node:test";
import assert from "node:assert/strict";
import { AGENTS_START, findGitRepos, mergeAgentsMd, prepare, run } from "./init.mjs";

function capture() {
  let text = "";
  const stdout = new Writable({
    write(chunk, _enc, cb) {
      text += String(chunk);
      cb();
    },
  });
  stdout.toString = () => text;
  return stdout;
}

function tmp() {
  return mkdtempSync(join(tmpdir(), "init-"));
}

test("prepare creates specs layers, .work, gitignore, does not overwrite index", () => {
  const root = tmp();
  mkdirSync(join(root, ".agents", "specs", "backend"), { recursive: true });
  writeFileSync(join(root, ".agents", "specs", "backend", "index.md"), "# keep me\n");
  const first = prepare(root);
  assert.ok(first.created.includes(".work"));
  assert.ok(first.created.some((p) => p.endsWith("frontend/index.md")));
  assert.equal(readFileSync(join(root, ".agents", "specs", "backend", "index.md"), "utf8"), "# keep me\n");
  const gi = readFileSync(join(root, ".gitignore"), "utf8");
  assert.match(gi, /\.work\//);
  assert.match(gi, /\.codegraph\//);
  const second = prepare(root);
  assert.ok(second.created.length < first.created.length);
});

test("findGitRepos sees nested repos and skips node_modules", () => {
  const root = tmp();
  mkdirSync(join(root, ".git"));
  mkdirSync(join(root, "svc-a", ".git"), { recursive: true });
  mkdirSync(join(root, "node_modules", "pkg", ".git"), { recursive: true });
  const repos = findGitRepos(root).map((p) => p.replace(/\\/g, "/"));
  assert.equal(repos.length, 2);
  assert.ok(repos.some((p) => p.endsWith("svc-a")));
  assert.ok(!repos.some((p) => p.includes("node_modules")));
});

test("prepare reports ask_which_repos when multiple git repos lack index", () => {
  const root = tmp();
  mkdirSync(join(root, "a", ".git"), { recursive: true });
  mkdirSync(join(root, "b", ".git"), { recursive: true });
  const report = prepare(root);
  assert.equal(report.gitRepos.length, 2);
  assert.equal(report.codegraph.action === "ask_which_repos" || report.codegraph.action === "ask_install", true);
});

test("run prepare prints json", () => {
  const root = tmp();
  const out = capture();
  const code = run(["node", "init.mjs", "prepare", "--root", root], out, capture());
  assert.equal(code, 0);
  const json = JSON.parse(out.toString());
  assert.ok(json.root);
  assert.equal(json.agentsMd, "created");
  assert.ok(json.codegraph.installHint.includes("codegraph"));
});

test("prepare creates AGENTS.md and does not duplicate on rerun", () => {
  const root = tmp();
  const first = prepare(root);
  assert.equal(first.agentsMd, "created");
  assert.ok(first.created.includes("AGENTS.md"));
  const text = readFileSync(join(root, "AGENTS.md"), "utf8");
  assert.match(text, /AGENT-SKILLS:START/);
  assert.match(text, /sop-load-specs/);
  const second = prepare(root);
  assert.equal(second.agentsMd, "unchanged");
  assert.ok(second.skipped.includes("AGENTS.md"));
  const again = readFileSync(join(root, "AGENTS.md"), "utf8");
  assert.equal((again.match(/AGENT-SKILLS:START/g) || []).length, 1);
});

test("prepare appends routing block after existing AGENTS.md", () => {
  const root = tmp();
  writeFileSync(join(root, "AGENTS.md"), "<!-- TRELLIS:START -->\nold\n<!-- TRELLIS:END -->\n");
  const report = prepare(root);
  assert.equal(report.agentsMd, "appended");
  const text = readFileSync(join(root, "AGENTS.md"), "utf8");
  assert.match(text, /TRELLIS:START/);
  assert.match(text, /AGENT-SKILLS:START/);
  assert.match(text, /sop-grill-with-docs/);
  assert.ok(text.indexOf("TRELLIS:START") < text.indexOf("AGENT-SKILLS:START"));
});

test("prepare refreshes stale managed block and keeps surrounding text", () => {
  const root = tmp();
  writeFileSync(
    join(root, "AGENTS.md"),
    "# keep-head\n\n<!-- AGENT-SKILLS:START -->\nSTALE_BLOCK_CONTENT\n<!-- AGENT-SKILLS:END -->\n\n# keep-tail\n",
  );
  const report = prepare(root);
  assert.equal(report.agentsMd, "updated");
  const text = readFileSync(join(root, "AGENTS.md"), "utf8");
  assert.match(text, /^# keep-head/m);
  assert.match(text, /# keep-tail/);
  assert.doesNotMatch(text, /STALE_BLOCK_CONTENT/);
  assert.match(text, /sop-archive-task/);
  assert.match(text, /sop-commit-code/);
  assert.match(text, /sop-find-simplifications/);
  assert.match(text, /sop-trim-cot-leakage/);
  assert.equal((text.match(/AGENT-SKILLS:START/g) || []).length, 1);
});

test("mergeAgentsMd appends when markers are missing", () => {
  const root = tmp();
  writeFileSync(join(root, "AGENTS.md"), "# project notes\n");
  assert.equal(mergeAgentsMd(root), "appended");
  const text = readFileSync(join(root, "AGENTS.md"), "utf8");
  assert.match(text, /^# project notes/m);
  assert.ok(text.includes(AGENTS_START));
});

test("routing block classifies before sop-start-task and does not map 建任务 directly", () => {
  const root = tmp();
  prepare(root);
  const text = readFileSync(join(root, "AGENTS.md"), "utf8");
  assert.match(text, /先分档/);
  assert.match(text, /创建任务/);
  assert.match(text, /需要对齐再动手/);
  assert.match(text, /已有 PRD/);
  assert.match(text, /sop-commit-code/);
  assert.match(text, /提交代码/);
  assert.match(text, /sop-find-simplifications/);
  assert.match(text, /sop-trim-cot-leakage/);
  assert.match(text, /不必等用户点名/);
  assert.doesNotMatch(text, /\|\s*建任务[^\n]*\|\s*`sop-start-task`/);
});
