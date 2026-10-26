import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import test from "node:test";
import assert from "node:assert/strict";
import { collectItems, run } from "./specs.mjs";

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

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "specs-"));
  for (const layer of ["frontend", "backend", "common"]) {
    mkdirSync(join(root, ".agents", "specs", layer), { recursive: true });
  }
  writeFileSync(
    join(root, ".agents", "specs", "backend", "index.md"),
    `# Backend\n\n读 [错误处理](./error-handling.md)。\n\n## 何时读哪些规范\n- API → error-handling.md\n`,
  );
  writeFileSync(join(root, ".agents", "specs", "backend", "error-handling.md"), "# 错误处理\n\n用业务异常。\n");
  writeFileSync(join(root, ".agents", "specs", "backend", "orphan.md"), "# 未链接也要出现\n");
  writeFileSync(
    join(root, ".agents", "specs", "frontend", "index.md"),
    `# Frontend\n\n见 [表格](./tables.md)。\n`,
  );
  writeFileSync(join(root, ".agents", "specs", "frontend", "tables.md"), "# 表格\n");
  writeFileSync(join(root, ".agents", "specs", "common", "index.md"), `# Common\n\n无额外文件。\n`);
  writeFileSync(join(root, ".agents", "specs", "backend", ".secret.md"), "# 点文件不应入表\n");
  return root;
}

test("list is stable: index first, then path, layers frontend/backend/common", () => {
  const root = fixture();
  const items = collectItems(root);
  assert.deepEqual(
    items.map((i) => i.id),
    [
      ".agents/specs/frontend/index.md",
      ".agents/specs/frontend/tables.md",
      ".agents/specs/backend/index.md",
      ".agents/specs/backend/error-handling.md",
      ".agents/specs/backend/orphan.md",
      ".agents/specs/common/index.md",
    ],
  );
  assert.equal(items[3].title, "错误处理");
  assert.equal(items[3].n, 4);
});

test("pick increments hits by path, not by number", () => {
  const root = fixture();
  const out = capture();
  const err = capture();
  const code = run(["node", "specs.mjs", "pick", "4,4,6", "--root", root], out, err);
  assert.equal(code, 0, err.toString());
  const hits = JSON.parse(readFileSync(join(root, ".agents", "specs", ".hits.json"), "utf8"));
  assert.equal(hits[".agents/specs/backend/error-handling.md"], 1);
  assert.equal(hits[".agents/specs/common/index.md"], 1);
  assert.equal(Object.keys(hits).length, 2);
});

test("list prints table then json", () => {
  const root = fixture();
  const out = capture();
  const code = run(["node", "specs.mjs", "list", "--root", root], out, capture());
  assert.equal(code, 0);
  const text = out.toString();
  assert.match(text, /^n\tlayer\tpath\ttitle/m);
  assert.match(text, /"n": 1/);
});

test("missing specs dir fails", () => {
  const root = mkdtempSync(join(tmpdir(), "nospecs-"));
  const err = capture();
  const code = run(["node", "specs.mjs", "list", "--root", root], capture(), err);
  assert.equal(code, 1);
  assert.match(err.toString(), /未找到 \.agents\/specs/);
});

test("invalid pick numbers fail", () => {
  const root = fixture();
  const err = capture();
  const code = run(["node", "specs.mjs", "pick", "99", "--root", root], capture(), err);
  assert.equal(code, 1);
  assert.match(err.toString(), /编号必须是/);
});
