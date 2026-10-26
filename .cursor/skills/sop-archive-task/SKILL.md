---
name: sop-archive-task
description: Use when the user explicitly says 归档 / archive a `.work/<slug>/` task. Do not archive because a git commit landed or because the model thinks the work is done.
---

# sop-archive-task

把进行中的任务整夹搬出业务仓。一次 commit 不等于完成；没听到「归档」不要搬。

## 步骤

1. 确认用户点了名（短名或路径）。`.work/` 有多件时不要猜。
2. 验收项未勾完：列未完成项，问还搬不搬。用户仍要搬才继续。
3. `<项目名>` = 业务仓根目录名。目标：

```
~/agent-archive/<项目名>/<短名>/
```

Windows：`%USERPROFILE%\agent-archive\<项目名>\<短名>\`

目标已存在则停，不要覆盖。

PowerShell：

```powershell
$project = Split-Path -Leaf (Get-Location)
$src = ".work\<短名>"
$dest = Join-Path $env:USERPROFILE "agent-archive\$project\<短名>"
if (-not (Test-Path $src)) { throw "missing $src" }
if (Test-Path $dest) { throw "already exists $dest" }
New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
Move-Item -Path $src -Destination $dest
```

bash：

```bash
project="$(basename "$PWD")"
src=".work/<短名>"
dest="$HOME/agent-archive/$project/<短名>"
mkdir -p "$(dirname "$dest")"
test -d "$src" || exit 1
test -e "$dest" && exit 1
mv "$src" "$dest"
```

4. 核实源目录已不在 `.work/`，目标下有 `task.md`（大改动还应有 `prd.md`）。
5. 收尾只问一句：有没有新约定值得写进 `.agents/specs/` 的哪一层（frontend / backend / common）？**只建议，等用户决定后再改规范。** 用户说不写就结束。用户同意写规范之后、改 `.agents/specs/` 之前：**Read** `.agents/skills/sop-trim-cot-leakage/SKILL.md`，边写边守。
