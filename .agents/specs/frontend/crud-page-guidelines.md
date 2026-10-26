# CRUD 页面规范

> 约束标准后台 CRUD 页面的目录、`*.data.ts`、组件编排和导入导出契约。

---

## Scenario: 标准 CRUD 页面与 `*.data.ts` Schema 契约

### 1. Scope / Trigger

- Trigger: 新增或重构管理后台的搜索、列表、新增/编辑、详情、导入、导出页面时。
- Scope: 适用于 `ui/src/views/**` 下采用共享 CRUD 组件体系的页面。
- Why: 当前项目大量页面依赖 `Search + Table + BasicForm + Detail + ImportForm + useTable/useForm/useCrudSchemas` 组合；如果把 schema、API、事件和按钮行为散落在 `index.vue`，后续维护会迅速失控。

### 2. Signatures

- 页面目录：
  `ui/src/views/<domain>/<feature>/index.vue`
  `ui/src/views/<domain>/<feature>/<feature>.data.ts`
  `ui/src/views/<domain>/<feature>/*Form.vue`
- API 目录：
  `ui/src/api/<domain>/<feature>/index.ts`
- 共享组件：
  `ContentWrap`
  `Search`
  `TableHead`
  `Table`
  `BasicForm`
  `Detail`
  `ImportForm`
- 共享 hooks：
  `useTable`
  `useForm`
  `useCrudSchemas`
- `CrudSchema` 常用字段：
  `isSearch`
  `hiddenSearchHigh`
  `search`
  `isTable`
  `table`
  `isForm`
  `form`
  `isDetail`
  `detail`
  `isTableForm`
  `tableForm`
  `children`
  `dictType`
  `dictClass`
  `hiddenInMain`
  `sortTableDefault`
  `sortSearchDefault`

### 3. Contracts

#### 3.1 文件布局

- `index.vue` 只负责页面编排、事件联动和生命周期，不承载大段字段元数据。
- `*.data.ts` 负责字段 schema、rules、table/search/form/detail/tableForm 配置。
- API 请求函数放在 `src/api/<domain>/<feature>/index.ts`。
- 新增/编辑弹窗、详情扩展、导入弹窗等页面级组件放在同级目录，不塞进共享组件目录。

#### 3.2 搜索与列表

- 搜索栏统一通过：
  `Search :schema="allSchemas.searchSchema"`
  `@search="setSearchParams"`
  `@reset="setSearchParams"`
- 列表统一通过 `useTable({ getListApi })` 驱动，`Table` 绑定：
  `tableObject.tableList`
  `tableObject.loading`
  `tableObject.total`
  `tableObject.pageSize`
  `tableObject.currentPage`
  `tableObject.sort`
- 列表头按钮优先使用现有 `defaultButtons` 和 `TableHead` 能力，不在页面里手搓重复按钮体系。

#### 3.3 表单、详情、导入、导出

- `BasicForm` / `Detail` / `ImportForm` 的字段定义和校验规则来自 `*.data.ts`。
- 主子表页面使用 `tableForm` 时，字段仍由同一套 `CrudSchema[]` 驱动。
- 导入页面需要显式声明：
  上传 URL
  模板标题
  可接受文件类型
  成功回调
- 导出遵循“所见即所得”：
  列顺序与当前表格一致
  字典字段导出展示文案而非原始编码

#### 3.4 `*.data.ts` 字段约定

- `sortTableDefault`、`sortSearchDefault` 默认基线使用 `1000`，值越小越靠前。
- 搜索字段通过 `isSearch + search.component/componentProps` 声明，不在 `index.vue` 里直接拼输入控件。
- 字典字段优先通过 `dictType` / `dictClass` 描述，而不是手写重复的 options 映射。
- 日期、时间、范围选择器统一通过 `DatePicker` 及 `componentProps` 配置格式和类型。

#### 3.5 权限与按钮

- 顶部和行级按钮通过 `hasPermi` 等既有权限标识控制显隐。
- “新增 / 导入 / 导出 / 刷新 / 筛选 / 设置” 优先沿用共享按钮定义，不要每页重新定义一套命名。

### 4. Validation & Error Matrix

| 场景 | 校验 | 失败行为 |
|------|------|----------|
| `index.vue` 内联大段 schema | 字段配置应回到 `*.data.ts` | 继续拆分 |
| 页面直接调 axios | API 必须落在 `src/api/...` | 视为分层错误 |
| 表格不走 `useTable` | 列表状态无法复用 | 视为偏离仓库主模式 |
| 导出按编码导出字典值 | 必须导出显示文案 | 继续修正 |
| 导入弹窗缺模板标题/成功回调 | 契约不完整 | 视为页面实现缺失 |
| 主子表字段散落多个文件 | 优先统一在 `*.data.ts` 维护 | 继续收敛 |

### 5. Good / Base / Bad Cases

#### Good

```vue
<ContentWrap>
  <Search :schema="Workstation.allSchemas.searchSchema" @search="setSearchParams" @reset="setSearchParams" />
</ContentWrap>

<ContentWrap>
  <Table :columns="tableColumns" :data="tableObject.tableList" :loading="tableObject.loading" />
</ContentWrap>
```

```ts
const { tableObject, tableMethods } = useTable({
  getListApi: WorkstationApi.getWorkstationPage
})
```

#### Base

- `index.vue + *.data.ts + api/index.ts` 三件套齐全。
- 页面搜索、分页、排序全部由 `useTable` 驱动。

#### Bad

```vue
<script setup lang="ts">
const formColumns = [
  // 上百行字段直接写在页面里
]

const getList = async () => {
  const res = await axios.get('/dbc/workstation/page')
}
</script>
```

### 6. Tests Required

- 结构检查：
  断言页面目录至少存在 `index.vue`、`*.data.ts`、`src/api/.../index.ts`
- 页面行为检查：
  验证搜索、重置、分页、排序、新增/编辑/删除
- 导入导出检查：
  验证导入模板标题、上传成功回调、导出列顺序和字典显示值
- 权限检查：
  验证按钮显隐跟随 `hasPermi` 或现有权限契约

### 7. Wrong vs Correct

#### Wrong

```ts
const columns = [{ field: 'name', label: '名称' }]
const getList = async () => request.get('/dbc/workstation/page')
```

#### Correct

```ts
export const workstationSchemas: CrudSchema[] = [
  {
    field: 'name',
    label: '名称',
    isSearch: true,
    isTable: true,
    search: { component: 'Input' }
  }
]
```
