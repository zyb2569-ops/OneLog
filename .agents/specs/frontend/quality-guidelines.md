# 质量规范

> 前端开发的代码质量标准。

---

## 概览

前端质量主要通过共享架构模式和格式化工具保证：

- `ui/.eslintrc.js` 中的 ESLint
- `ui/prettier.config.js` 中的 Prettier
- `ui/stylelint.config.js` 中的 Stylelint
- 共享 CRUD 抽象：`useTable`、`useForm`、`useCrudSchemas`、`BasicForm`、`Table`、`Search`

当前项目现实情况：

- lint 规则在若干方面是有意放宽的
- `ui/src` 下未发现第一方前端单元测试套件
- 业务页面主要依赖手工验证作为质量门

---

## 禁止模式

- 不要在功能目录里新建原生 axios client，应统一使用 `@/config/axios`。
- 如果该功能已经采用同级 `*.data.ts` 模式，就不要把大量 CRUD 字段定义散落到 `index.vue`。
- 不要使用深层相对路径替代 `@/` 别名。
- 不要重复实现 hooks 或组件中已经存在的 table/form/message 行为。
- 避免在业务页面继续新增调试用 `console.log`。虽然历史文件里有一些，但新代码不应扩展这种模式。
- 不要把 `pnpm lint` 当作"只读检查"命令直接运行在脏工作区上。当前 `ui/package.json` 的 lint 脚本实际上是 `eslint --fix --ext .js,.vue src`，会对整个 `ui/src` 执行自动修复，可能把与本次任务无关的大量历史文件一起改写，产生海量的 diff。
- 不要把带时效性的运行时嵌入上下文写入页面缓存，例如 Superset `guestToken`、`embedId`、`resolvedResource`。这类数据一旦进入 `sessionStorage/localStorage`，很容易在下一次首屏渲染时先触发一次过期 iframe，再被后续接口刷新覆盖，形成"首帧失败、二次成功"的重复挂载问题。

更推荐的项目模式示例：

- `ui/src/views/dbc/workstation/index.vue`
- `ui/src/views/dbc/workstation/workstation.data.ts`
- `ui/src/config/axios/service.ts`

---

## 必须模式

- Vue SFC 默认使用 `script setup lang="ts"`，除非周边模块已经明确采用了其他模式。
- API 访问放在 `src/api/...`，不要内联到共享组件中。
- 应用级共享状态使用 Pinia；页面级行为使用 Vue 本地状态。
- 标准 CRUD 页面优先复用共享 hook：`useTable`、`useForm`、`useMessage`、`useCrudSchemas`。
- 代码格式遵循仓库统一风格：
  2 空格缩进、单引号、无分号，以 Prettier 和 `.editorconfig` 为准。
- 调试前端问题时，必须让失败状态可见；禁止用空数据、默认成功、吞异常或隐藏 UI 的方式掩盖接口、权限、路由或渲染问题。
- 视觉、iframe、图表、响应式布局问题必须保留真实运行态证据，至少包含截图和 DOM/实例测量之一；仅凭源码推断不能作为完成依据。

相关参考：

- `ui/.editorconfig`
- `ui/.eslintrc.js`
- `ui/prettier.config.js`
- `ui/stylelint.config.js`

---

### 场景：前端 Debug-first 与完成证据

#### 1. Scope / Trigger
- Trigger: 修复页面行为、API 调用、权限按钮、路由跳转、导入导出、第三方 iframe、图表或布局问题时。
- 风险点: 前端容易用空数组、默认值、`catch` 后提示成功或隐藏组件来消除表象，但真实接口或渲染问题仍然存在。

#### 2. Signatures
- API 访问:
  - `src/api/...`
  - `@/config/axios`
- 页面结构:
  - `index.vue`
  - 同级 `*.data.ts`
- 常用验证工具:
  - `pnpm exec eslint <changed-files>`
  - Chrome DevTools MCP: `take_screenshot`、`evaluate_script`、`take_snapshot`

#### 3. Contracts
- 请求:
  - 页面不得绕过 `src/api/...` 直接创建 axios client。
  - 查询、分页、导出、导入参数必须与后端 VO/接口契约对齐。
- 响应:
  - 接口失败不得伪造成空成功态。
  - 空态只用于真实业务空结果，不能吞掉 HTTP、权限或字段契约错误。
- UI:
  - 权限按钮显隐必须来自项目既有权限机制。
  - 视觉问题必须用真实浏览器状态验证，不能只看静态 CSS。

#### 4. Validation & Error Matrix
| 场景 | 不合格行为 | 合格处理 |
|------|------------|----------|
| 接口失败 | `catch` 后返回 `[]` 让页面继续 | 显示失败提示或让共享请求层处理错误 |
| 字段缺失 | 前端用默认值遮掉 | 对齐后端响应契约，必要时修 API/VO/转换 |
| 权限按钮异常 | 在页面写死隐藏/显示 | 回到权限指令、权限码或菜单配置链路 |
| 布局或图表裁切 | 只改 CSS 后口头判断 | 截图并测量问题节点 rect/scroll/实例 option |
| lint 校验 | 直接运行会全量 fix 的 `pnpm lint` | 先确认脚本含义，优先局部 `pnpm exec eslint <changed-files>` |

#### 5. Good/Base/Bad Cases
- Good: 修复导出按钮后，验证按钮权限、查询条件透传、导出文件字段与当前页面筛选一致。
- Base: 简单文案或列宽调整，至少代码审查确认未改变 API 契约。
- Bad: 接口报错时 `catch(() => [])`，页面显示“暂无数据”，让用户无法区分失败和真实空结果。

#### 6. Tests Required
- 行为检查: 验证页面加载、查询、分页、排序、新增/编辑/删除、导入/导出中受影响路径。
- 静态检查: 对本次改动文件运行局部 eslint 或说明无法运行原因。
- 视觉检查: 布局/图表/iframe 问题必须保存截图证据，并用 `evaluate_script` 记录关键 DOM 或实例状态。
- Diff 检查: 确认没有无关自动格式化、调试 `console.log`、新建 axios client 或重复 hook。

#### 7. Wrong vs Correct
##### Wrong
```ts
const getList = async () => {
  try {
    return await api.getPage(params)
  } catch (error) {
    return []
  }
}
```

##### Correct
```ts
const getList = async () => {
  return await api.getPage(params)
}
```

---

## 测试要求

当前项目现实情况：

- `ui/src` 下未发现第一方前端 `*.spec.ts` 或 `*.test.ts` 文件
- 页面行为通常通过手工验证
- 主要静态质量命令是 `ui/package.json` 中的 `lint`

### 场景：执行前端静态检查时避免全仓自动改写

#### 1. Scope / Trigger
- Trigger: 需要在前端任务结束前做 lint/typecheck 校验时。
- 风险点: 本仓库的 `pnpm lint` 不是只检查，而是全量 `--fix`。

#### 2. Signatures
- 仓库脚本:
  - `pnpm lint`
  - 实际展开: `eslint --fix --ext .js,.vue src`
- 推荐局部检查:
  - `pnpm exec eslint <changed-files>`

#### 3. Contracts
- 输入:
  - `pnpm lint` 无文件参数，作用域固定为整个 `ui/src`
  - `pnpm exec eslint <changed-files>` 只检查显式传入文件
- 输出:
  - `pnpm lint` 可能同时返回 lint 结果和大量被自动修复的文件改动
  - 局部 eslint 只影响指定文件，便于把 diff 控制在任务边界内

#### 4. Validation & Error Matrix
| 场景 | 行为 | 预期处理 |
|------|------|----------|
| 在干净工作区执行 `pnpm lint` | 可能全量改写 `src` | 先确认是否接受仓库级格式化结果 |
| 在已有任务改动的工作区执行 `pnpm lint` | 无关文件也会进入 diff | 禁止默认这样做，优先局部 eslint |
| 只想检查当前任务文件 | 运行 `pnpm exec eslint <changed-files>` | 允许 |
| 用户明确要求做全仓格式化/清理 | 可运行 `pnpm lint` | 必须先说明会产生大范围 diff |

#### 5. Good/Base/Bad Cases
- Good: 仅对本次修改文件执行 `pnpm exec eslint src/views/report/dashboard/**/*.vue src/views/home/index.vue`
- Base: 先读取 `ui/package.json`，确认 `lint` 是否带 `--fix` 后再决定执行方式
- Bad: 把 `pnpm lint` 视为只读校验命令，直接在进行中的功能分支上运行

#### 6. Tests Required
- 执行静态检查前:
  - 断言已查看 `ui/package.json` 中 `scripts.lint`
- 执行后:
  - 断言 `git diff --stat` 只包含本次任务预期文件
  - 若出现大批量无关文件，必须立即标记为工作区副作用，而不是误报为功能改动

#### 7. Wrong vs Correct
##### Wrong
```bash
pnpm lint
```

##### Correct
```bash
pnpm exec eslint src/api/report/dashboard/index.ts src/views/report/dashboard/**/*.ts src/views/report/dashboard/**/*.vue src/views/home/index.vue src/router/modules/remaining.ts
```

对新增前端改动，最低验证要求是手工确认受影响页面：

- 页面加载与路由进入
- 搜索/筛选行为
- 分页与排序
- 新增/编辑/删除弹窗
- 若存在则验证导出/导入流程
- 若相关则验证权限控制下的按钮显隐

静态参考：

- `ui/package.json`
- `ui/src/config/axios/service.ts`

### 场景：调试 Superset / 第三方 iframe 嵌入时避免“默认 300x150 视口测量后再放大”

#### 1. Scope / Trigger
- Trigger: 通过 SDK 或运行时脚本挂载第三方 iframe，并基于内容尺寸做缩放、适配或滚动控制时。
- 风险点: 浏览器原生 iframe 在未显式设置尺寸前会落到默认 `300x150` 视口；此时如果先测量 `scrollWidth/scrollHeight`，再按卡片尺寸放大，会得到肉眼看起来“被放大几倍”的错误结果。

#### 2. Signatures
- 常见症状:
  - `getScrollSize()` / `scrollWidth` 返回约 `300` 宽
  - 宿主层 `transform: scale(...)` 大于 `1`
  - 卡片里只看到放大的左上角内容，或出现异常大的标题和图例
- 典型文件:
  - `ui/src/views/report/dashboard/shared/supersetEmbed.ts`

#### 3. Contracts
- 测量前:
  - 必须先把 iframe 拉到目标容器尺寸，至少保证 `width: 100%`、`height: 100%`
  - 必须先移除缩放影响，保证测量发生在未放大状态
- 测量后:
  - `fit-width` 这类“接近原生 iframe”的模式，默认不应再对响应式 dashboard 做额外放大
  - `fit-both` 如需整体 contain，只允许缩小，不允许 `scale > 1`

#### 4. Validation & Error Matrix
| 场景 | 行为 | 预期处理 |
|------|------|----------|
| iframe 未设尺寸就读取内容宽高 | 测到默认 `300x150` 附近尺寸 | 先把 iframe 拉满容器再测 |
| 测量结果比卡片小很多 | 直接按卡片宽高放大 | 禁止；先确认是否量到了默认视口 |
| `fit-width` 模式 | 继续叠加 `transform: scale(...)` 放大 | 禁止；优先保持原生满宽 iframe |
| `fit-both` 模式 | 计算出 `scale > 1` | 强制钳到 `1`，只做缩小 |

#### 5. Good/Base/Bad Cases
- Good: 先设置 iframe `width/height: 100%`，再测量；`fit-width` 下保持 `transform: none`
- Base: `fit-both` 仅在 dashboard 真正大于容器时做 contain 缩小
- Bad: 在默认 `300x150` 视口下拿到 `scrollWidth=300`，再把 iframe 放大到整张卡片

#### 5.1 Debug Case: Superset Dashboard 被异常放大
- 现象:
  - 首页卡片里只看到 dashboard 左上角，标题、图例、筛选器被放大数倍
  - DevTools 里 iframe 计算样式出现 `transform: matrix(3.x ~ 6.x, ...)`
- 根因:
  - `getScrollSize()` 读取发生在 iframe 还没拉满容器时，拿到了浏览器默认视口附近的假尺寸
  - 宿主把这个假尺寸当成“自然尺寸”再按卡片宽度放大，形成二次放大
- 修复口径:
  - `fit-width` 直接走原生满宽 iframe，不再额外 `transform`
  - `fit-both` 最多缩小到 `scale <= 1`

#### 5.2 Debug Case: 仅靠宿主侧放大虚拟视口仍无法消除原生 iframe 滚动条
- 现象:
  - `fit-both` 下宿主已经把 iframe 视口按卡片长宽比显著放大，页面利用率明显改善，但 iframe 底部仍持续出现浏览器原生滚动条
  - 在 2026-04-03 的真实首页调试里，即使把虚拟视口继续放大到当前求解结果的 `1.15x` 甚至 `1.5x`，滚动条仍然存在；而临时设置 `scrolling=\"no\"` 会让滚动条立即消失
- 根因:
  - 这类滚动条不再是“宿主测量早了几个像素”的问题，而是 embedded 页面自身布局仍在持续溢出 viewport
  - Superset Embedded SDK 只暴露 `document.body.scrollWidth / scrollHeight`，宿主无法可靠观测 iframe 内部真实溢出来源，也无法在跨域场景下修正页面内部 CSS
- 处理口径:
  - 当宿主已满足“先定尺寸再测量”“按卡片长宽比求解虚拟视口”“`scale <= 1`”后，若原生 iframe 滚动条仍存在，不要继续在 host 侧反复微调 buffer 或比例
  - 这时应明确判定为“需要页面内控制”的问题：要么提供同源 `/superset` 代理以便宿主访问 iframe DOM，要么在 Superset 侧/代理层注入针对 embedded 页的样式修正
  - `scrolling=\"no\"` 只能用于定位滚动条来源，不能当作最终修复

#### 6. Tests Required
- 调试时:
  - 打开 DevTools，确认 iframe 初始计算样式不是默认 `300x150`
  - 记录宿主容器尺寸、测量结果和最终 `transform`
- 验证时:
  - 断言 `fit-width` 模式下 `transform` 为 `none` 或等价于 `scale(1)`
  - 断言 `fit-both` 模式下不存在 `scale > 1`
  - 手工截图确认卡片内容没有被异常放大
  - 若浏览器原生滚动条仍存在，必须补做“放大虚拟视口后滚动条是否仍存在”的实验；如果仍存在，应升级为同源/页面内修复路径，而不是继续调 host 侧比例

#### 7. Wrong vs Correct
##### Wrong
```ts
const size = await embeddedDashboard.getScrollSize()
iframe.style.width = `${size.width}px`
iframe.style.height = `${size.height}px`
iframe.style.transform = `scale(${mountPoint.clientWidth / size.width})`
```

##### Correct
```ts
iframe.style.width = '100%'
iframe.style.height = '100%'
const size = await embeddedDashboard.getScrollSize()
const scale = Math.min(mountPoint.clientWidth / size.width, mountPoint.clientHeight / size.height, 1)
```

### 场景：同源 Superset iframe 内同步 ECharts surface 时保留横向 gutter

#### 1. Scope / Trigger
- Trigger: 已通过同源 `/superset` 代理接入 embedded dashboard，并在 iframe 页内重写 `.chart-slice`、`[_echarts_instance_]` 等节点尺寸时。
- 风险点: 如果直接把 ECharts surface 的 CSS 宽度写成 `body.clientWidth`，会吃掉图表当前 natural render width 对应的横向 gutter，导致右上角 `全选/反选`、最后一个日期点或最后一组柱子贴边被截断。

#### 2. Signatures
- 典型文件:
  - `ui/src/views/report/dashboard/shared/supersetEmbedSameOrigin.ts`
- 关键选择器:
  - `.chart-slice`
  - `.dashboard-chart`
  - `.slice_container`
  - `[_echarts_instance_]`
  - `[_echarts_instance_] > div`
  - `[_echarts_instance_] canvas`
- 关键公式:
  - `surfaceWidth = Math.max(bodyWidth - measuredGutter, 0)`
  - `measuredGutter` 优先来自 `bodyWidth - naturalWidth`
  - 仅在读不到 natural width 时才 fallback 为 `32`

#### 3. Contracts
- `.chart-slice`、`.dashboard-chart`、`.slice_container` 的高度应同步到 iframe `bodyHeight`。
- ECharts surface、其内部包裹层和 `canvas` 的 CSS 高度应同步到 iframe `bodyHeight`。
- ECharts surface、其内部包裹层和 `canvas` 的 CSS 宽度必须优先使用当前图表实测出的 gutter 反推，不能直接使用 `bodyWidth`。
- 不要直接改 `canvas` 或 host 的 `width/height` DOM attribute；没有拿到 ECharts 实例做重绘时，这会导致图表被清空或渲染异常。
- 如果 surface 盒模型已经左右留白，但 line/bar chart 右侧边界仍贴边，则必须继续进入 chart-level patch，而不是继续调外层 CSS 宽度。
- chart-level patch 通过同源 iframe 内的 ECharts instance 完成：
  - `grid.right >= 36`
  - `legend.right >= 8`
  - time 轴若 `boundaryGap=[0,0]`，则补成 `[0,'4%']`

#### 4. Validation & Error Matrix
| 场景 | 行为 | 预期处理 |
|------|------|----------|
| 高度仍沿用 Superset 设计值 | 图表底部被裁切 | 把 chart 容器和 surface CSS 高度同步到 `bodyHeight` |
| surface CSS 宽度直接等于 `bodyWidth` | `全选/反选` 或最右数据点贴边 | 改为 `bodyWidth - measuredGutter` |
| 只改 `canvas` 的 DOM attribute | 图表被清空或重绘错乱 | 禁止；只改 CSS 宽高 |
| 读不到 natural width | 无法反推出实际 gutter | fallback 到 `32px`，但要保留该值只是兜底而不是主契约 |
| surface 已有左右 gutter，但右边界仍贴边 | 问题发生在 chart 绘图区，不在外层盒模型 | 改为 patch ECharts option：`grid.right`、`legend.right`、time 轴 `boundaryGap` |

#### 5. Good/Base/Bad Cases
- Good: 先从 host/canvas 的 natural width 推导 `measuredGutter = bodyWidth - naturalWidth`，再把 surface / inner div / canvas 的 CSS 宽度统一改成 `bodyWidth - measuredGutter`。
- Base: 当前首页 4 张卡片实测 `measuredGutter = 32`，所以 fallback 值与实测值一致。
- Bad: 为了“拉满卡片”把 `[_echarts_instance_]`、包裹层和 `canvas` 的 CSS 宽度全部强制设为 `bodyWidth`。
- Bad: 在 surface 已经左右留白后，仍继续只调 host/CSS 宽度，而不去改 ECharts 自己的 `grid/legend/boundaryGap`。

#### 6. Tests Required
- DevTools 断言:
  - `surface.rectWidth === bodyWidth - measuredGutter`
  - `canvas.rectWidth === bodyWidth - measuredGutter`
  - line/bar chart 下 `grid.right >= 36`
  - 如果是 time 轴，则 `boundaryGap[1] !== 0`
- 手工截图断言:
  - 折线图右上角 `全选/反选` 完整显示
  - 柱状图最后一组柱子和最右侧标签完整显示
  - 宽卡片图表右上角筛选控件完整显示

#### 7. Wrong vs Correct
##### Wrong
```ts
const width = iframeDocument.body?.clientWidth || 0
iframeDocument.querySelectorAll('[_echarts_instance_], [_echarts_instance_] > div, [_echarts_instance_] canvas')
  .forEach((node) => {
    setElementSize(node, width, height)
  })
```

##### Correct
```ts
const width = iframeDocument.body?.clientWidth || 0
const naturalWidth = parsePositiveNumber(host.getAttribute('width'))
const measuredGutter = naturalWidth === null ? 32 : width - naturalWidth
const surfaceWidth = Math.max(width - measuredGutter, 0)
iframeDocument.querySelectorAll('[_echarts_instance_], [_echarts_instance_] > div, [_echarts_instance_] canvas')
  .forEach((node) => {
    setElementSize(node, surfaceWidth, height)
  })
const instance = getEchartInstanceFromSameOriginReactRef(host)
instance?.setOption({
  grid: [{ right: 36 }],
  legend: [{ right: 8 }],
  xAxis: [{ boundaryGap: [0, '4%'] }],
}, false)
```

### 场景：使用 Chrome DevTools 截图和运行态测量获取真实前端渲染状态

#### 1. Scope / Trigger
- Trigger: 调试前端布局、iframe 嵌入、第三方图表、缩放失真、裁切、滚动条、图例/边界贴边等“视觉结果和源码推断可能不一致”的问题时。
- 风险点: 只看源码、只看 CSS、只看 `scrollWidth/clientWidth` 这类单一数字，很容易误判真正的裁切层级；真实问题可能发生在宿主盒模型、iframe 页内 DOM、或图表实例 option 这三层中的任意一层。

#### 2. Signatures
- 推荐工具链:
  - `navigate_page` / `wait_for`
  - `take_snapshot`
  - `take_screenshot`
  - `view_image`
  - `evaluate_script`
- 最小调试产物:
  - 全页截图 1 张
  - 问题节点截图 1 张以上
  - 关键 DOM 实测数据 1 组以上
  - 若涉及图表/第三方组件，运行态实例状态 1 组以上
- 典型测量字段:
  - `getBoundingClientRect()`
  - `clientWidth/clientHeight`
  - `scrollWidth/scrollHeight`
  - `getComputedStyle(...)`
  - 运行态 option / props / instance 状态

#### 3. Contracts
- 必须先拿真实截图，再下结论；不能只靠 DOM 数字判断“已经修好”。
- 必须同时保留“视觉证据”和“运行态测量”两类证据；任何一类单独存在都不够。
- 节点级截图必须覆盖用户实际反馈的问题区域，不要只截全页。
- 对 iframe / 第三方图表问题，必须明确当前问题发生在哪一层：
  - 宿主页面盒模型
  - iframe 页内 DOM / CSS
  - 图表实例 option / runtime state
- 如果前一轮 patch 可能被异步渲染覆盖，必须在 reload 后和延时一轮后各复测一次，不能只看首帧。
- 对同源 iframe，可继续通过运行态 DOM / React fiber / chart ref 拿实例状态；对跨域 iframe，不要假设能直接读页内状态，应先解决同源或代理问题。

#### 4. Validation & Error Matrix
| 场景 | 行为 | 预期处理 |
|------|------|----------|
| 只看源码或静态 CSS | 结论和真实页面不一致 | 必须补真实页面截图 |
| 只看截图 | 看见“像是裁切”但无法确认发生层级 | 必须补 `evaluate_script` 实测数据 |
| `scrollWidth == clientWidth` | 就认为“没有裁切” | 禁止；还要看截图和节点 `getBoundingClientRect()` |
| surface 盒模型正常 | 就认为图表内部也正常 | 禁止；继续检查图表实例 option |
| patch 首帧有效 | 就认为最终有效 | 禁止；reload 后等待异步渲染完成再复测 |
| iframe 跨域 | 直接尝试读页内 DOM/实例 | 先切同源或代理，否则不要基于猜测继续修 |

#### 5. Good/Base/Bad Cases
- Good: 先截全页和问题节点，再用 `evaluate_script` 记录 rect / scroll / computed style，最后在需要时继续读取图表实例 option。
- Base: 至少同时保留一张截图和一组运行态测量结果，再决定根因。
- Bad: 因为某个 DOM 数字“看起来对了”就宣布修复完成。
- Bad: 用户说“右边还被截断”时，只回复之前的理论，不重新截图复核当前真实页面。

#### 6. Tests Required
- 调试时:
  - 断言已拿到全页截图和问题节点截图
  - 断言已记录问题节点的 `getBoundingClientRect()`、`clientWidth/clientHeight`、`scrollWidth/scrollHeight`
  - 若涉及图表/第三方组件，断言已读取运行态 option、props 或实例状态，而不是只看静态源码
- 验证时:
  - reload 后至少复测一次
  - 若页面存在异步加载或延迟重绘，再补一次延时复测
  - 最终断言必须同时满足：
    - 截图中视觉问题消失
    - DOM / 实例测量与预期一致

#### 7. Wrong vs Correct
##### Wrong
```ts
const width = node.scrollWidth
const height = node.scrollHeight
if (width === node.clientWidth && height === node.clientHeight) {
  // 直接认为页面没有裁切
}
```

##### Correct
```ts
await take_screenshot({ fullPage: true })
await take_screenshot({ uid: problemNodeUid })
const metrics = await evaluate_script(() => ({
  rect: node.getBoundingClientRect(),
  clientWidth: node.clientWidth,
  scrollWidth: node.scrollWidth,
  computed: getComputedStyle(node).overflow,
}))
const runtimeOption = chartInstance?.getOption?.()
// 只有当截图和运行态测量都表明问题消失时，才可以判定修复完成
```

---

## Code Review 检查项

- 页面是否遵循既有的 `views + api + *.data.ts` 拆分？
- API 调用是否经过 `@/config/axios` 和正确的业务域模块？
- 可复用 CRUD 行为是否交给共享 hooks/components，而不是页面自己重造？
- store 改动是否只限于真正共享的状态？
- 文件是否遵守仓库格式化和 import alias 约定？
- 如果页面是 schema 驱动的，table/search/form/detail 定义是否放在同级 `*.data.ts`？
- 如果改动涉及第三方 iframe/embedded SDK，是否确认“先定尺寸再测量”，且不存在 `scale > 1` 的放大路径？
- 如果调试结果显示 iframe 原生滚动条对 host 侧比例调整不敏感，是否已经停止继续做宿主侧遮罩/微调，并把问题升级为同源或 Superset 页内修复？
