# 交互与安全规范

> 约束消息提示、XSS/敏感数据、loading、防重复提交和数值处理契约。

---

## Scenario: 用户提示、安全边界与前端交互保护

### 1. Scope / Trigger

- Trigger: 新增消息提示、确认交互、`v-html` 渲染、表单提交/loading、金额计算、字段联动清空时。
- Scope: 适用于所有 `ui/src/**` 页面、组件和 API 交互代码。
- Why: 这些行为看起来零散，但最容易在页面之间反复复制并留下隐性 bug，例如重复提交、XSS、错误提示不统一、金额精度异常或脏字段残留。

### 2. Signatures

- 业务提示：
  `const { message } = useMessage()`
  `message.success(...)`
  `message.warning(...)`
  `message.info(...)`
  `message.error(...)`
- 框架级兜底：
  `ElMessage.error(t('sys.api.errMsg500'))`
- 富文本清洗：
  `DOMPurify.sanitize(html)`
- 常见页面状态：
  `loading`
  `submitting`

### 3. Contracts

#### 3.1 消息分类

- 成功反馈使用 `message.success(...)`。
- 业务校验、配置缺失、输入提示使用 `message.warning(...)` 或等价提示能力。
- 询问类交互优先使用确认弹窗/对话框，不用 success/error toast 模拟。
- 系统异常、服务失败、不可恢复错误使用 `message.error(...)`。
- 无网络或服务器异常等框架级兜底提示，统一走共享错误链路，例如 `ElMessage.error(t('sys.api.errMsg500'))`。

#### 3.2 安全边界

- 默认使用 `{{ }}` 或 `v-text` 输出文本。
- 只有在必须渲染 HTML 时才允许使用 `v-html`，且必须先经过 `DOMPurify.sanitize(...)`。
- 新增前端功能禁止把密码、第三方密钥、一次性 token、guest token 等敏感明文写入 `localStorage/sessionStorage`。
- 认证持久化策略延续现有安全模块，不额外自造本地明文缓存。

#### 3.3 Loading 与防重复提交

- 获取数据、提交表单、执行批量操作时必须有 `loading/submitting` 状态。
- loading 的作用不仅是视觉反馈，还用于阻止重复点击和重复提交。
- 页面出现异步链路时，必须明确哪个按钮或区域被 loading 锁定，不能只在控制台打印。

#### 3.4 联动字段与数值

- 清空驱动字段时，所有依赖它的字段也要同步清空，避免保留旧值。
- 金额类字段列表中右对齐显示，小数点后保留 2 位。
- 持久化前的数值计算不要直接依赖 `toFixed` 的隐式舍入结果；需要稳定两位小数时，优先使用显式 `Math.round(value * 100) / 100` 语义。

### 4. Validation & Error Matrix

| 场景 | 校验 | 失败行为 |
|------|------|----------|
| 用户输入直接进 `v-html` | 必须先 `DOMPurify.sanitize` | 视为安全缺陷 |
| 提交按钮无 loading | 容易重复点击 | 继续补状态控制 |
| 后端业务错误走 success/info | 消息等级错误 | 继续改为 warning/error |
| 敏感 token 写入浏览器持久缓存 | 禁止新增明文缓存 | 视为安全缺陷 |
| 清空主字段后依赖字段仍保留 | 联动不完整 | 继续补清空逻辑 |
| 金额直接 `toFixed` 后再参与计算 | 精度风险 | 改成显式四舍五入流程 |

### 5. Good / Base / Bad Cases

#### Good

```ts
const loading = ref(false)

const submit = async () => {
  loading.value = true
  try {
    await saveForm()
    message.success(t('common.updateSuccess'))
  } finally {
    loading.value = false
  }
}
```

```ts
const sanitizedHtml = computed(() => DOMPurify.sanitize(rawHtml.value))
```

#### Base

- 页面通过 `message.*` 输出统一反馈。
- 所有提交流程都能看到 loading。

#### Bad

```vue
<div v-html="userHtml"></div>
```

```ts
const total = Number(amount).toFixed(2)
```

### 6. Tests Required

- 消息检查：
  验证成功、业务提示、系统错误分别走正确提示类型
- 安全检查：
  搜索 `v-html` 使用点，断言都经过清洗
- 交互检查：
  验证提交/获取数据时按钮或区域进入 loading
- 联动检查：
  验证清空主字段时依赖字段同步清空
- 数值检查：
  验证金额展示与持久化前的两位小数处理一致

### 7. Wrong vs Correct

#### Wrong

```vue
<div v-html="userHtml"></div>
```

```ts
const submit = async () => {
  await saveForm()
}
```

#### Correct

```vue
<div v-html="sanitizedHtml"></div>
```

```ts
const submit = async () => {
  submitting.value = true
  try {
    await saveForm()
    message.success(t('common.createSuccess'))
  } finally {
    submitting.value = false
  }
}
```
