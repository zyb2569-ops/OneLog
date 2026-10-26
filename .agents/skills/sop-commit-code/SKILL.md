---
name: sop-commit-code
description: Use when the user says 提交, commit, git commit, 提交代码, or asks to commit current changes. Do not use for 归档/archive, and do not commit just because code was written.
---

# sop-commit-code

把当前改动提交进 git。提交时不能带任何配置文件和单测，只需提交改动的业务代码。没听到「提交」不要 commit。

## 步骤

1. 在实际有改动的 git 仓执行（多仓有改动则逐仓，不要混仓）。并行：

```
git status
git diff
git log -8 --oneline
```

已暂存的也要看：`git diff --cached`。

2. 从变更清单里剔除配置文件和单测，列出剔除项。剩下的才是可提交集。可提交集为空：停，说明只剩配置/单测，不要空提交、不要把禁提交文件加进去。

3. commit 规范：`动作(模块):具体内容`

- 动作：`feat` / `fix` / `docs` / `refactor` / `chore` / `style` / `perf`。不要用 `test`。
- 模块：改动所在业务模块短名，小写，如 `wms`、`dbc`。跨模块则问用户或用更能概括的短名。
- 具体内容：一句话说清为什么改，不要堆文件清单。

示例：`feat(wms): 增加包装规格导入校验`

4. 只 `git add` 可提交集，按仓库习惯写提交说明并 commit。随后 `git status` 确认禁提交文件仍未进本次提交。

5. 只说「提交」不要 push。同一句明确说了「推送 / push」才 push。不要 `--no-verify`、不要 `-i`、不要 force push。

## 禁提交

配置文件（任何都不带），包括但不限于：

- 构建与依赖：`pom.xml`、`package.json`、`package-lock.json`、`pnpm-lock.yaml`、`yarn.lock`、`go.mod`、`go.sum`
- 运行与工具：`*.yaml`、`*.yml`、`*.properties`、`*.toml`、`*.ini`、`.env`、`.env.*`、`application*`、`bootstrap*`、`logback*.xml`、`log4j*.xml`、`settings.xml`
- 仓库与质量配置：`.gitignore`、`.editorconfig`、`.npmrc`、`.prettierrc*`、`eslint.config.*`、`.eslintrc*`、`tsconfig*.json`、`vite.config.*`、`webpack.config.*`

单测（任何都不带），包括但不限于：

- `src/test/**`、`**/__tests__/**`、`**/__mocks__/**`
- `**/*.spec.*`、`**/*.test.*`、`**/*Test.java`、`**/*Tests.java`、`**/*IT.java`

业务代码：实现业务行为的源码（如 `src/main/**`、前端 `src/**` 里非测试文件、MyBatis `*Mapper.xml`）。工具包仓里 Skill / 文档正文算本仓产品，可以提交。密钥类文件即使不像配置也不要提交。

用户同一句明确说「连配置一起提交」或「把测试也提交」才允许破例；默认禁止。
