# 壹录 OneLog 产品需求文档（PRD）

| 项目 | 内容 |
|---|---|
| 产品名称 | 壹录 OneLog（个人全量生活记录） |
| 文档版本 | v1.1 |
| 状态 | 评审已修订（v1.1 为技术选型评审后的修正版） |
| 创建日期 | 2026-10-26 |
| 修订日期 | 2026-10-26 |
| 决策来源 | 2026-10-26 需求访谈（grill-me）+ 同日技术选型评审 |
| 交付形态 | Android APK（单端、纯本地） |

> **v1.1 修订摘要**（触发原因：技术选型评审发现 3 处会在真机上阻塞的事实性缺陷、6 处文档内部矛盾）
>
> | 编号 | 修订项 | 位置 |
> |---|---|---|
> | 1 | 补网络请求层：WebView 直连 AI 端点会被 CORS 阻断，改走 `CapacitorHttp` | §3.2、§5.5.1、§7.8、A8 |
> | 2 | 补精确闹钟权限矩阵：Android 14+ `SCHEDULE_EXACT_ALARM` 默认拒绝 | §3.4、A9、§5.3.5 |
> | 3 | 修正 ML Kit 包体积口径：该插件打包全部 5 种文字模型，O7「只装中文」不可达 | A6、§8、O7、R10 |
> | 4 | 修正到期提示音实现：Web Audio 在锁屏/后台被挂起，改由通知通道播放音频文件 | §5.3.5、§7.5 |
> | 5 | minSdk 24 → 26（Tailwind v4 需 Chrome 111+，API 24 的 WebView 无法承载） | §8、A10 |
> | 6 | 修正数据模型：删除冲突的 `initialQty`、补齐缺失的训练模板三表、补库存冲销规则、补软删除导入规则 | §6.2、§7.3、§5.6.2 |
> | 7 | 风险表补 R12–R15（签名密钥丢失、网络层、精确闹钟、工具链与 WebView 版本） | §9 |
> | 8 | 新增 M-1「技术验证 spike」，三个验证项全过才允许动 M0 | §10 |

---

## 1. 背景与目标

### 1.1 要解决的问题

日常生活里有四类数据散落在不同地方，且互不关联：

1. **我有什么、还剩多少** —— 洗衣液什么时候用完、这件衣服上次穿是什么时候、鸡胸肉还有几克。目前靠记忆，结果是重复购买或临时缺货。
2. **我吃了什么、够不够** —— 想控制体重或增肌，但不知道自己每天摄入多少热量和蛋白。市面 App 依赖云端营养库，中餐覆盖差，且不关心库存。
3. **我练了什么、有没有进步** —— 训练记录散在备忘录里，看不出容量趋势，组间歇靠看手机计时，经常忘记。
4. **这些数据之间没关系** —— 买了食材、吃了它、为它花钱、为增肌吃它，这些是同一件事的四个侧面，但没有工具把它们串起来。

### 1.2 产品目标

构建一个**单人使用、完全离线、数据自持**的 Android 应用，把物资、饮食、运动、穿搭四类记录统一到一个本地数据模型里，并通过统计层回答三个问题：

- 我什么时候该买什么？（物资消耗预测）
- 我这段时间吃得怎么样？（摄入趋势）
- 我练得有没有变强？（训练容量与 PR 趋势）

### 1.3 成功标准（可验证）

| 编号 | 标准 | 验证方式 |
|---|---|---|
| S1 | 录入一顿饭的时间 ≤ 15 秒（从点击到保存） | 真机计时，连续 10 次取中位数 |
| S2 | 一次完整训练（5 个动作 × 4 组）的记录 + 组间歇全程无需离开训练页 | 走查 |
| S3 | 断网、飞行模式下全部功能可用（除 AI 分析） | 飞行模式全流程走查 |
| S4 | 从冷启动到首页可交互 ≤ 1.5 秒 | 真机 Profiler |
| S5 | 数据可完整导出并无损导回 | 导出 → 清空 → 导入 → 逐表比对 |
| S6 | 连续使用 30 天后，物资消耗预测误差 ≤ 25% | 与实际用完日对比 |
| S7 | OCR 识别营养成分表后，能量/蛋白/碳水/脂肪四个字段至少 3 个预填正确 | 取 20 张真实包装照片，人工核对 |

### 1.4 非目标（明确排除，防止范围蔓延）

| 排除项 | 理由 |
|---|---|
| 多用户 / 账号体系 | 单人自用，账号是纯开销 |
| 云同步 / 服务端 | 已决策纯本地，用导出代替同步 |
| 浏览器版 / iOS / 小程序 | 仅 Android，Capacitor 不建 ios 工程 |
| 社交分享 / 排行榜 | 与个人记录目标无关 |
| 条码扫描识别食品 | 国内预包装食品条码库覆盖差，投入产出比低 |
| AI 用于饮食记录与营养估算 | 已决策 AI 仅服务训练域；营养数据只手录 |
| 自训动作分类模型 | 单人数据量不足以泛化，见 §9-R3 |
| 周期化训练计划（增肌/减脂周期编排） | P1 不做，模板已能满足 |
| 记账 / 支出统计 | 物资只管数量，不管金额 |

---

## 2. 用户与场景

### 2.1 用户画像

- **单人**：只有一位使用者，无需考虑权限、数据隔离、共享。
- **设备**：Android 手机为主力（当前为 Redmi K80 Ultra，HyperOS），无平板、无桌面端。
- **技术背景**：能自行侧载 APK，愿意手动录入数据换取数据主权与定制自由。
- **使用环境**：健身房为主要训练场景（可能在地下室，信号差、光线差、人员走动）。

### 2.2 核心场景

**场景 A · 超市补货**
站在货架前，打开首页看到"洗衣液 · 剩 12% · 预计 6 天后用完"，决定是否现在买。买完回 App 点"补货"，输入 1 瓶 1000ml。

**场景 B · 记录一顿饭**
吃完饭，点"记饮食"，搜索"米饭"，选"一碗（150g）"，保存。系统自动从食物库存扣 150g（若绑定了库存条目），并累加当日热量。

**场景 B2 · 首次录入一个包装食品**
买了袋蛋白棒，翻到背面营养成分表，点"扫营养成分表"，拍照。3 秒后表单里已经填好「能量 1653 kJ = 395 kcal、蛋白质 6.2g、碳水 68.5g、脂肪 3.1g」，比对右侧原始文本无误，点保存。整过程约 15 秒，而非手打 4 个数字。

**场景 C · 一次训练**
到健身房，选模板「推日 A」，逐个动作录入重量与次数。每完成一组自动开始 90 秒倒计时，最后 3 秒听到提示音。练完点"生成分析"，AI 给出本次表现与下次建议。

**场景 D · 出门前挑衣服**
点"穿搭"，翻到上次那套组合，或用"最久未穿"列表挑一件很久没穿的衣服，保存本次穿搭，系统累加穿着次数。

**场景 E · 每周复盘**
周日晚上打开统计页，看这周热量曲线、训练容量、体重变化、本周该补什么。

---

## 3. 产品形态与技术约束

### 3.1 形态

- 交付物：单个 Android APK（`arm64-v8a` + `armeabi-v7a`），自行侧载安装，不上架应用商店。
- 首次安装后完全离线可用（AI 分析除外）。

### 3.2 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| UI 框架 | React 19 + TypeScript + Vite | 全部业务逻辑在客户端。Vite `build.target` 需显式设为 `chrome111` 及以上（见 A10） |
| 样式 | Tailwind CSS **v4** | 浅色卡片式，移动优先。v4 依赖 oklch / `@property` / `color-mix()`，**最低要求 Chrome 111**，这是 minSdk 26 的硬性来源 |
| 原生容器 | **Capacitor 8.5.x** | 只 add android，不建 ios 工程 |
| 本地数据库 | **Dexie（IndexedDB）** | 全量数据，schema 版本化 |
| **网络请求** | **`CapacitorHttp`（Capacitor 内置，原生 OkHttp）** | **禁止依赖 WebView `fetch` 直连外部 HTTPS**。WebView origin 为 `https://localhost`，第三方端点普遍不返回 `Access-Control-Allow-Origin`，直连会被 CORS 拦截。见 A8 |
| 图表 | 轻量 SVG 自绘 | 30/90 天折线需断点支持 + 触摸定位，自绘比引入图表库更省体积（≈300 行） |
| 文字识别 | **ML Kit Text Recognition v2（中文 bundled 版）** | 完全离线、不依赖 GMS；只出 arm64-v8a。**注意包体积口径见 A6** |
| AI | DeepSeek（OpenAI 兼容协议，baseURL 可配） | 仅训练域。**必须非流式调用**（`CapacitorHttp` 不转发 SSE），见 §7.8 |
| 密钥存储 | Android Keystore（经 Capacitor 插件） | 不用明文 Preferences；社区插件需先验 Cap 8 兼容性 |
| 构建要求 | Node 22+、Java 21、AGP 8.13、Gradle 8.14.3、Android Studio 当前版 | Capacitor 8 基线 |

> **选型原则**：凡是"Web 层能力在原生容器里会打折"的地方（网络跨域、锁屏音频、后台计时、精确闹钟、输入法），一律走原生插件，不用 Web API 硬扛。v1.1 的四处修订全部来自这条原则。

### 3.3 Android 硬约束（必须逐条实现）

| 编号 | 约束 | 实现要求 |
|---|---|---|
| A1 | edge-to-edge 强制 | Capacitor 8 在 Android 15+ 默认全屏绘制。全局套用 `env(safe-area-inset-*)`，保证顶部不被状态栏遮挡、底部不被手势条遮挡 |
| A2 | 组间歇通知可靠性 | 使用 `@capacitor/local-notifications` 的定时调度（底层 AlarmManager.setExactAndAllowWhileIdle），**禁用 JS `setTimeout` 作为唯一实现** |
| A3 | HyperOS 后台限制 | 首次进入训练模块时展示权限引导页，引导关闭省电限制、允许通知、允许自启动。检测失败时降级为"页面内计时 + 屏幕常亮" |
| A4 | Doze 影响 | 90 秒级短计时不受 Doze 影响（Doze 需设备静止熄屏数分钟才进入），无需前台服务。可选启用 `@capacitor-community/keep-awake` 保持屏幕常亮 |
| A5 | 应用数据丢失风险 | WebView 数据可能因卸载、系统清理、升级而丢失，必须实现四层备份体系（见 §5.6.1）。**注意卸载会连私有目录快照一并删除，因此 L1b 外置镜像是必做项而非可选加分** |
| A6 | OCR 引擎选型与体积 | 必须使用 **bundled 版** `com.google.mlkit:text-recognition-chinese`，**严禁使用 `com.google.android.gms:play-services-mlkit-text-recognition-chinese`**（国行设备无 GMS，unbundled 版会静默失败）。**体积口径修正**：`@capacitor-mlkit/text-recognition`（8.2.x）会把 Latin / Chinese / Devanagari / Japanese / Korean **五套模型全部打包**，官方文档明示 "Each script uses a separate model that is bundled with your app"，因此无法通过插件配置只保留中文。体积**上限上调至 60MB**，目标 ≤50MB，M-1 阶段实测后回填具体值。若要压回 35MB 量级，见 O7 的三条路径 |
| A7 | 相机权限 | OCR 需要 `CAMERA` 权限；拒绝后必须提供"从相册选择"作为替代路径，不得阻断整个食物录入流程。相册路径**必须走 Android Photo Picker**（`ActivityResultContracts.PickVisualMedia`），**不申请 `READ_MEDIA_IMAGES`** —— 省一个运行时权限，且 Photo Picker 在 API 26+（回移版）可用 |
| **A8** | **网络请求必须绕过 WebView CORS** | Capacitor Android 的 WebView origin 为 `https://localhost`（或 `http://localhost`）。OpenAI 兼容端点不保证返回 `Access-Control-Allow-Origin`，`fetch` 直连大概率被拦截且报错信息含糊。**必须在 `capacitor.config` 开启 `plugins: { CapacitorHttp: { enabled: true } }`**，让请求经原生 OkHttp 发出。若 baseURL 指向局域网服务（如自建 Ollama），还需在 `network_security_config.xml` 中显式放行该网段的 cleartext 流量 |
| **A9** | **精确闹钟权限（Android 14+ 行为变更）** | `SCHEDULE_EXACT_ALARM` 自 Android 14 起**不再默认授予**。`@capacitor/local-notifications` 在未获准时，`schedule({ schedule: { allowWhileIdle: true } })` 会**跳转系统「闹钟和提醒」设置页并挂起 Promise**——在训练中途弹出等于打断用户。**处理方式**：manifest 直接声明 `android.permission.USE_EXACT_ALARM`（Android 14+ 免用户申请即得精确闹钟；本应用侧载安装，不受 Play 商店 USE_EXACT_ALARM 政策约束），并在 `App.appStateChange` 中调用 `checkExactNotificationSetting()` 做兜底检测。**禁止**依赖 `SCHEDULE_EXACT_ALARM` 的运行时请求流 |
| **A10** | **WebView 版本下限** | Tailwind v4 输出 `oklch()` / `@property` / `color-mix()`，最低要求 Chrome 111（2023-03）。因此 **minSdk 定为 26（Android 8.0）**，Vite `build.target = 'chrome111'`，并在 `browserslist` 中锁定。禁止为了兼容 API 24 把工具链降级到 Tailwind 3 + `chrome61` —— 那会让整个样式层与构建体系退回 2020 年水平，且本产品只在单台新设备上运行，兼容旧版本收益为零 |
| **A11** | **键盘与输入法（本产品最大的 UI 风险）** | 本应用是重度录入型，几乎所有页面都有表单。必须显式配置：① `android:windowSoftInputMode="adjustResize"`；② `@capacitor/keyboard` 的 `resize: 'native'`；③ 键盘弹起时必须**卸掉** `env(safe-area-inset-bottom)` 的内边距（否则键盘 + 手势条双重留白，输入框被顶出屏）；④ 编号输入框用 `inputmode="decimal"` 而非 `type="number"`（避免中文输入法吃掉小数点）。**M0 验收必须用第三方输入法（搜狗/讯飞）实测**，系统输入法测不出问题 |

---

### 3.4 权限矩阵（v1.1 新增，实现时逐条核对）

| 权限 | 声明位置 | 申请时机 | 拒绝后的行为 |
|---|---|---|---|
| `android.permission.INTERNET` | manifest | 安装即授予 | 无网时 AI 不可用，其余功能不受影响 |
| `android.permission.POST_NOTIFICATIONS` | manifest（Android 13+ 运行时） | 首次进入训练模块 | 降级为页面内计时 + 屏幕常亮 + 引导横幅 |
| `android.permission.USE_EXACT_ALARM` | manifest（Android 14+） | 无需申请 | 无需降级；仍需 `checkExactNotificationSetting()` 兜底 |
| `android.permission.VIBRATE` | manifest | 安装即授予 | 无震动，仅声音 |
| `android.permission.CAMERA` | manifest（运行时） | 点击"扫营养成分表"时 | 直接转相册选图路径 |
| ~~`READ_MEDIA_IMAGES`~~ | **不申请** | — | 相册走 Photo Picker，无需媒体读取权限 |

**明确不申请的权限**：定位、通讯录、电话状态、`READ_EXTERNAL_STORAGE`（导出走系统分享面板与 SAF，不需要全盘读权限）、`QUERY_ALL_PACKAGES`。

**"首次进入训练页"的权限引导顺序**（A3 的落地细则）：通知权限 → 精确闹钟设置状态 → 省电策略白名单 → 自启动。**一次只弹一个**，全部拒绝也要能继续训练，只降级不阻断。

---

## 4. 信息架构

底部 Tab 五个，顺序即使用频率排序：

```
① 首页        今日概览 + 待办卡片（补货/待练/未记录）
② 物资        消耗品 / 食物库存 / 衣物
③ 记录        饮食 / 运动 / 穿搭  →  中央 FAB
④ 统计        趋势与预测
⑤ 设置        目标、AI、备份、数据管理
```

**首页卡片清单**（按优先级排列，无内容则隐藏）：

1. 今日摄入（热量 + 蛋白，进度条）
2. 今日训练（未练则显示"上次训练 X 天前 + 快速开始"）
3. 待补货（低库存/即将耗尽，最多 3 条 + "查看全部"）
4. 备份提示（超 7 天未导出时出现，可关闭当次）

---

## 5. 功能需求

> 每节末尾给出**验收标准**，为可判定真/假的陈述。

### 5.1 物资域

#### 5.1.1 统一物资模型

三类物资共用一张 `items` 表，通过 `domain` 区分（`consumable` / `food` / `garment`），各自在扩展表中存专有属性。

**为什么统一**：库存流水、低库存提醒、全局搜索、导出四项能力三类共用，拆三套等于把逻辑写三遍。食物与消耗品在库存维度的差异仅是单位（克 vs 毫升/件），不足以拆表。

**验收标准**
- [ ] 三类物资出现在同一搜索入口，输入名称能同时搜到。
- [ ] 新建物资时可切换三类，切换后表单字段随之变化。
- [ ] 任一物资都能查看它的全部库存流水。

#### 5.1.2 消耗品（计量型 / 计数型）

**模型**：库存**不存当前值**，只存流水。当前库存 = 期初值 + Σ(流水 delta)。

**两种类型**：

| 类型 | 适用 | 字段 | 交互 |
|---|---|---|---|
| 计量型 `measured` | 洗衣液、洗发水、米面油 | 单位（ml/g）、剩余量、低库存阈值 | 每次减 X 单位，或直接输入当前剩余量做盘点 |
| 计数型 `counted` | 牙膏、纸巾、电池 | 单位（件/包）、剩余件数、阈值 | 点"用了 1 件"；点"用完了"直接归零并进补货清单 |

**流水类型**（`stock_logs.kind`）：

| kind | 含义 | delta 符号 |
|---|---|---|
| `purchase` | 入库/补货 | + |
| `consume` | 日常消耗 | − |
| `adjust` | 盘点校正（填当前实际量，系统反算 delta） | ± |
| `discard` | 丢弃/过期 | − |

**关键规则**
- 允许负库存。记录的是事实，账目错误是账的问题，**不允许因库存为负而拒绝写入**。
- 负库存时列表项标红并显示"账目异常"提示。

**验收标准**
- [ ] 计量型物品连续记录 3 次消耗后，剩余量等于期初减三次之和。
- [ ] 盘点校正后，剩余量等于输入的实际值，且流水里新增一条 `adjust` 记录。
- [ ] 库存扣至负数时记录成功，条目显示红色异常标记。
- [ ] "用完"操作后条目自动进入补货清单。

#### 5.1.3 衣物与穿搭

**衣物条目字段**：名称、分类（上装/下装/外套/鞋/配件）、尺码、季节（多选）、颜色、材质、购入日期、照片、洗护状态、备注。

**洗护状态流转**：`stored`（收纳）→ `wearing`（在穿）→ `laundry`（待洗）→ `stored`。状态变更自动写时间戳。

**穿着记录**：每次标记"今天穿这件"累加 `wearCount`、更新 `lastWornAt`。

**穿搭组合（outfit）**：一组衣物条目的集合，可命名、可保存、可复用。记录一次穿搭时，对组合内每件衣物各写一条穿着记录。

**衍生列表**：穿着次数排行、最久未穿（按 `lastWornAt` 升序，从未穿过的排最前）。

**验收标准**
- [ ] 标记穿着后 `wearCount` +1，`lastWornAt` 更新为今天。
- [ ] 保存穿搭组合后，可一键复用到下一次记录，且组合内每件衣物都 +1 次。
- [ ] "最久未穿"列表排序正确，从未穿过的优先。
- [ ] 洗护状态可自由切换，且每次切换留痕。

#### 5.1.4 食物库存

食物库存是 `items` 中 `domain='food'` 的实例，`unit='g'`，通过 `linkedFoodId` 关联营养字典 `foods`。

**一个食物条目可以只有营养定义、没有库存**（例如"外食红烧肉"），这种条目不参与库存扣减。

**验收标准**
- [ ] 食物可只建营养定义不建库存，且在饮食记录中可选。
- [ ] 有库存的食物显示剩余克数，无库存的显示"仅营养"。

### 5.2 饮食域

#### 5.2.1 记录方式：流水式

**不使用餐次必选项**。每条记录包含：时间戳、食物（或临时营养值）、份量、计算出的营养、扣库存方式、备注。

**餐次自动归集（仅展示）**：界面按时间戳把记录分到四个区块——早餐（05:00–10:29）、午餐（10:30–14:59）、晚餐（15:00–20:59）、加餐/夜宵（其余）。**用户无需选择，也不可手动指定餐次。**

**为什么不做餐次录入**：多一次点击，收益仅是分布分析；而分布可以由时间戳反推，零成本。

**验收标准**
- [ ] 新增记录后自动出现在对应时间区块内，无需选择餐次。
- [ ] 日视图按时间倒序展示，每条显示食物名、份量、热量、蛋白。
- [ ] 日总计固定显示在顶部（热量 + 蛋白 + 碳水 + 脂肪）。

#### 5.2.2 份量录入

三种方式并存，按使用频率排序：

1. **自定义家常单位**（首选）：食物条目上可定义任意份量单位，如「一碗 = 150g」「一个 = 50g」「一勺 = 15g」。用 `份数 × 单位克数` 计算。
2. **按份数**：直接选份（等同方式 1 的份数为 1）。
3. **按克**：直接输入克数。

**营养计算**：`实际营养 = 每100g营养 × (实际克数 / 100)`。计算保留一位小数。

**验收标准**
- [ ] 食物条目可新增/编辑/删除自定义份量单位。
- [ ] 选择"一碗"后自动带出 150g，热量按比例重算。
- [ ] 同一条目可有多个份量单位（一碗/半碗/一大碗）并各自独立生效。

#### 5.2.3 扣库存策略（三种，逐条选择）

每条饮食记录行**独立**选择扣减方式：

| 策略 | 触发条件 | 行为 |
|---|---|---|
| **直接扣** `direct` | 记录的食物有绑定库存条目 | 从该 `item` 扣 `克数` 克，写一条 `consume` 流水 |
| **按配方扣** `recipe` | 记录的是菜品，且有对应配方 | 按配方中各原料的比例，分别扣多个 `item` |
| **不扣** `none` | 外食、外卖、别人做的饭 | 不动库存，仅记录营养 |

**默认值推断**：选中的食物有库存 → 默认 `direct`；食物有配方 → 默认 `recipe`；否则默认 `none`。用户可覆盖。

**配方（recipe）模型**：一个菜品 = 名称 + 一组原料（foodId + 克数）+ 成品总重量。扣减时按 `本次克数 / 成品总重量` 等比缩放各原料用量。

**验收标准**
- [ ] 选外卖食物时默认不扣库存，且不报错。
- [ ] 按配方扣减时，多个原料条目各减对应比例，流水原因标记为对应饮食记录 id。
- [ ] 配方缩放正确：成品 500g 含五花肉 300g，吃 200g 后扣五花肉 120g。
- [ ] 库存不足时仍写入，库存变负并标红。

#### 5.2.4 OCR 识别包装食品营养成分表

**目标**：把"手打包装上的 4 个营养字段"降为"拍一张照 + 核对 2 个数字"。这是 R2 风险（空食物库导致放弃记录）的主要缓解手段。

**范围（明确限定）**：仅识别**营养成分表**。不识别配料表、不识别条码、不识别生产日期与净含量。

**交互流程**：

```
食物编辑页 → 点「扫营养成分表」
  → 相机取景，界面上叠加表格对齐引导框
  → 拍照（或从相册选图）
  → 本地 OCR（离线，不上传）
  → 解析 → 预填表单
  → 【确认页】左侧为解析结果（可编辑），右侧为原始 OCR 文本（只读，供比对）
  → 用户核对、修正、点「保存」
```

**确认页必须呈现的信息**（缺一不可）：

| 项 | 原因 |
|---|---|
| 解析出的基准（每 100 克 / 每 100 毫升 / 每份） | 基准错了全部数值全错，必须让人看见 |
| 原始能量值与其单位（如 `1653 kJ`） | 与换算后结果并列显示，让换算过程可见 |
| 换算后的热量（如 `= 395 kcal`） | 用户能一眼判断是否合理 |
| 原始 OCR 全文（只读，可展开） | 数字错一位就是十倍误差，必须可回溯比对 |
| 逐字段的"待确认"标记 | 所有字段默认都是待确认，不默认视为正确 |

**硬性规则**：

| 编号 | 规则 |
|---|---|
| OCR-1 | **OCR 结果不自动落库。** 必须用户核对后点保存。这与 §5.5.4 的 AI-1 是同一原则 |
| OCR-2 | **识别失败、未识别到营养表、字段缺失时，降级为空白手录表单并保留已识别的字段**，不弹阻断式错误 |
| OCR-3 | **禁止把原始 OCR 数字直接当作最终值**。所有数值必须经过 §7.7 的归一化管道（单位换算 + 基准归一 + NRV 剔除） |
| OCR-4 | 每次 OCR 的原始文本必须随食物条目保存（`foods.rawOcrText`），便于日后追查错误来源 |
| OCR-5 | 拍照不出设备。禁止把图片发送到任何网络端点 |

**验收标准**
- [ ] 拍摄一张 `1653kJ/100g` 的营养表，预填热量为 **395 kcal**（而非 1653）。
- [ ] 基准为「每 100 毫升」时，界面明确显示"已按每 100 毫升记录"，不做静默换算。
- [ ] NRV% 列的百分比数值不出现在任何数值字段中。
- [ ] `饱和脂肪`、`糖` 等缩进子项不被误识别为独立主项。
- [ ] 拒绝相机权限后，可从相册选图完成识别；相册路径也失败时，回退到空白手录表单。
- [ ] 识别完全不相关的照片时，不崩溃、不写入任何数据，给出"未找到营养成分表"提示。
- [ ] 保存后的食物条目保留 `rawOcrText`，可查看。

### 5.3 运动域

#### 5.3.1 数据层级

```
workout（一次训练）
 └─ block（组块，可含 1~3 个动作；1 个动作 = 常规，2~3 个 = 超级组/巨人组）
     └─ set（组：重量 / 次数 / RPE / 实际间歇秒数）
```

**为什么用组块**：需求描述"检测到当前组的最后一个动作做完后进入组间歇"，这句话本身就要求"一组可含多个动作"。P1 界面默认每块单动作（用起来与普通训练无差别），但结构预留超级组，**避免将来迁移数据**。

**验收标准**
- [ ] 一次训练可包含任意多个组块，每块可含 1–3 个动作。
- [ ] 单动作组块的录入界面与普通训练无异（不暴露"块"这个概念）。
- [ ] 组块内含多动作时，一轮内动作依次记录，全部完成后才触发组间歇。

#### 5.3.2 动作库

**完全空库，由用户自建**（决策理由：为后续摄像头动作识别采集样本）。

**动作字段**：名称、分类（胸/背/腿/肩/手臂/核心/有氧）、`trackingMode`（`weight` / `reps`，为 P2 预留）、默认组间歇秒数、技术要点（多条文本）、常见错误（多条文本）、呼吸节奏、替代动作、参考视频链接（URL，仅存链接不存文件）、备注。

**录入辅助**（降低自建成本）：技术要点支持多条动态增删；空库态首页提供"如何录入第一个动作"的空状态引导。

**验收标准**
- [ ] 动作可创建、编辑、归档（不物理删除，避免历史记录引用断裂）。
- [ ] 技术要点与常见错误均可增删任意条。
- [ ] 动作被历史训练引用时不可删除，只能归档。

#### 5.3.3 训练模板

**模板驱动 + 空白兜底**。

模板 = 名称 + 有序的组块列表（每块含动作、目标组数、目标次数区间、目标重量、休息秒数）。

**开练流程**：
1. 选模板（或"空白开始"）
2. 系统按模板生成空的组（预填目标值作为占位）
3. 逐组录入实际值
4. 结束训练 → 进入总结页

**AI 生成的计划直接落为模板**（见 §5.5）。

**验收标准**
- [ ] 从模板开练后，动作顺序、目标组数/次数/重量均按模板预填。
- [ ] 空白开始时可从动作库任意添加动作。
- [ ] 训练中可临时增删动作与组，不影响原模板。

#### 5.3.4 训练记录与计数交互

**统一按组录入**：每组填「重量(kg) / 次数 / RPE(可选)」。不做"按动作类型切换界面"。

**可选逐次计数模式**（默认关闭）：训练页提供开关，打开后每组出现大号计数按钮，每点一次 +1；点"完成本组"时把计数结果带入次数。适用于俯卧撑、引体、卷腹等。

**为什么默认关闭**：常规力量训练直接填次数更快；计数模式是给高次数徒手动作的辅助，不该成为所有人的默认路径。

**感受记录**：
- 每组可选 RPE（6–10，可留空）
- 训练结束选感受标签（多选）：力竭 / 泵感好 / 关节不适 / 睡眠不足 / 状态好
- 一句话自由备注

**实际组间歇自动记录**：不要求用户填写。系统记录「本组完成时间戳」与「下一组开始时间戳」的差值，作为 `actualRestSec`。这既是数据，也是 AI 分析的输入。

**验收标准**
- [ ] 每组可录入重量、次数，RPE 可留空。
- [ ] 开启计数模式后，点"完成本组"次数自动带入且可再手动修改。
- [ ] 系统自动算出并保存每组实际间歇秒数，用户无需输入。
- [ ] 训练结束后可多选感受标签并填写备注。

#### 5.3.5 组间歇计时器（核心交互）

**触发**：该组（组块内全部动作）完成后**自动**进入倒计时。

**时长来源（优先级从高到低）**：
1. 本次训练内的临时设置（训练页可随时改，本次训练内所有后续组生效）
2. 全局默认值（设置页，默认 **90 秒**）

**计时器行为**：

| 行为 | 说明 |
|---|---|
| 自动启动 | 完成一组即开始，无需点击 |
| 可调 | 界面提供 +15s / −15s / 跳过。**改动后必须取消已调度的通知并按新到期时间重调度**，否则旧通知会提前响 |
| 到期提醒 | 通知（含声音）+ 震动。**声音由通知通道播放音频文件，不是 Web Audio** |
| 最后 3 秒 | 每个整秒短促滴声，**仅前台可见时有效**（可关闭） |
| 时间显示 | 大号数字，训练页固定可见位置 |

**技术实现（硬性要求）**：
- 计时到期提醒**必须**通过 `@capacitor/local-notifications` 在完成组时**预先调度**一个本地通知（而非到点再发），底层是 AlarmManager.setExactAndAllowWhileIdle。调度前必须先过 A9 的精确闹钟检查。
- JS 定时器只用于界面上的数字刷新；**界面数字与真实到期时间必须解耦**——页面切后台后数字可停止刷新，但回前台时按 `完成时间 + 时长` 重新计算剩余时间，不能依赖累加。
- **到期提示音的播放主体必须是通知，不是 WebView。** WebView 在应用切后台或锁屏后 `AudioContext` 会被系统挂起，Web Audio 一声也不会出——这直接决定 §5.3.5 第一条验收标准能否成立。实现方式：把 `beep.wav`（≤30KB，0.5 秒）放进 `android/app/src/main/res/raw/`，通过 `capacitor.config` 的 `plugins.LocalNotifications.sound` 指定。
- ⚠️ **Android 8+ 通知通道的声音在通道创建后不可修改**（改声音只能换通道 id）。因此 `beep.wav` 的文件名与通道 id 必须在 M0 就定死，后期改名等于换通道。
- **Web Audio 只负责两件事**：前台倒计时中的"最后 3 秒滴声"，以及用户可选的点击反馈音。这两处都在前台，AudioContext 可用。
- 权限不足或通知失败时，降级为页面内计时 + 屏幕常亮，并在界面提示"通知不可用，请保持屏幕常亮"。
- 通知 id 使用 `workoutId` 派生的稳定整数；**同一时刻只允许存在一条待触发的组间歇通知**，新组开始时先 `cancel` 旧 id，避免跳过/加时后残留多条排队。

**验收标准**
- [ ] 完成一组后自动开始倒计时，无需任何点击。
- [ ] 倒计时期间锁屏，到点仍能**听到提示音**并收到通知（提示音由通知通道播放，不依赖页面存活）。
- [ ] 页面切后台 60 秒后返回，剩余时间显示正确（与真实时间一致，不出现漂移）。
- [ ] 通知权限被拒绝时，界面显示明确降级提示而非静默失败。
- [ ] 修改本次训练休息时长后，仅影响后续组，已完成的组不变。
- [ ] 点"+15s"后，通知在实际到期时间响，不在原定时间提前响。

#### 5.3.6 摄像头自动计次（P2，本期不做，仅留接口）

**目标**：用摄像头自动数次数（reps），不做动作分类、不做动作质量评估。

**技术路线**：MediaPipe Pose（33 关键点）+ 关节角度状态机，纯规则零训练。

| 动作 | 判定规则 |
|---|---|
| 深蹲 | 髋-膝-踝夹角：>160° → <90° → >160° 计 1 次 |
| 俯卧撑 | 肘夹角：>160° → <90° → >160° |
| 引体向上 | 肘夹角 + 下巴相对手腕位移 |
| 二头弯举 | 肘夹角：>160° → <70° → >160° |

**落地顺序**：先在 WebView 内用 `@mediapipe/tasks-vision` + WASM 验证算法（10–15fps，发热可接受），有效后再评估是否写 Kotlin 原生插件。

**硬性规则**：
- 识别结果必须可手动修正。
- 必须点"确认本组"才落库，禁止自动写入。
- 识别失败（丢失关键点、光线不足）默认降级为手动输入，不弹错误弹窗。

**P1 需预留**：`exercises.trackingMode` 字段、`exercise_samples` 表（P2 用于采集样本）。

### 5.4 统计层

#### 5.4.1 统计口径（硬规则）

**摄入与运动消耗分开统计，两者不做加减。**

**理由**：运动消耗的估算（无论手环还是公式）误差普遍 20–30%，且系统性偏高。若把运动消耗加进当日可吃额度，等于每天给自己一个虚假的"多吃许可"，最终结果是越练越胖且找不到原因。**这是刻意不让两个都有误差的数字互相污染。**

**验收标准**
- [ ] 任何位置都不出现"今日剩余可摄入 = 目标 − 摄入 + 运动消耗"这类算式。
- [ ] 摄入卡片与训练卡片分别独立展示，无交叉引用。

#### 5.4.2 饮食统计

| 指标 | 口径 |
|---|---|
| 今日摄入 | 当日全部记录的热量/蛋白/碳水/脂肪求和 |
| 目标达成 | 摄入 ÷ 每日目标（目标在设置页手填） |
| 7 / 30 天趋势 | 按日聚合的折线，缺失日显示为断点（不外推补零） |
| 时段分布 | 按 §5.2.1 的时间区块聚合 |
| 高频食物 | 近 30 天出现次数 Top 10 |

**验收标准**
- [ ] 7 天趋势图上，未记录的日子显示为空缺而非 0。
- [ ] 目标达成率超过 100% 时以醒目标记呈现（不隐藏超额）。

#### 5.4.3 运动统计

| 指标 | 口径 |
|---|---|
| 训练容量 | Σ(重量 × 次数)，按次训练/周/月聚合 |
| 出勤频率 | 每周训练次数、训练日分布 |
| 肌群分布 | 按动作分类聚合的容量占比 |
| PR 记录 | 每个动作的历史最大重量、最大次数、最大单组容量 |
| 1RM 估算 | Epley 公式：`1RM = 重量 × (1 + 次数/30)`，仅在次数 ≤ 10 时展示（超过则误差过大，标注"仅供参考"） |
| 实际组间歇趋势 | 各动作的实际间歇均值，用于发现"休息越来越久"的疲劳信号 |

**验收标准**
- [ ] 容量计算与手算一致（任取一次训练核对）。
- [ ] PR 在破纪录当日以标记展示。
- [ ] 次数 > 10 的组，1RM 估算值旁显示"仅供参考"。

#### 5.4.4 物资统计与补货预测

| 指标 | 口径 |
|---|---|
| 日均消耗速率 | 近 30 天 `consume` + `discard` 流水绝对值之和 ÷ 有消耗的天数。**排除 `purchase`**（避免补货拉低速率），并按 `sourceId` 成对净额化——编辑记录产生的"冲销 + 重扣"必须互相抵消，不能被当成两次真实消耗（见 §7.3.1） |
| 预计用完日 | 当前剩余量 ÷ 日均速率，向上取整为天数 |
| 补货周期 | 相邻两次 `purchase` 的平均间隔天数 |
| 待补货判定 | 剩余量 ≤ 阈值，或预计用完日 ≤ 7 天 |

**异常处理**：
- 消耗记录少于 3 次时不计算速率，显示"数据不足，暂无法预测"。
- 速率为 0 时不计算用完日，显示"—"。

**验收标准**
- [ ] 补货入库不会让日均速率下降（purchase 被排除）。
- [ ] 剩余 300g、近 30 天消耗 900g（10 天有消耗）时，日均 90g、预计 4 天用完。
- [ ] 消耗记录不足 3 次时显示"数据不足"，不显示瞎猜的天数。

#### 5.4.5 身体指标

| 指标 | 录入方式 |
|---|---|
| 体重 | 手动录入，带日期，同日多次取最新 |
| 围度 | 胸/腰/臀/臂/腿/颈，选填，带日期 |
| 体脂率 | 选填，带日期 |
| 基础代谢（BMR） | **Mifflin-St Jeor 公式自动计算**，可手填覆盖 |

**Mifflin-St Jeor**：
```
男：BMR = 10 × 体重kg + 6.25 × 身高cm − 5 × 年龄 + 5
女：BMR = 10 × 体重kg + 6.25 × 身高cm − 5 × 年龄 − 161
```

**验收标准**
- [ ] 首次设置填写身高/年龄/性别后自动算出 BMR。
- [ ] 体重变化后 BMR 随之更新，除非已手填覆盖。
- [ ] 体重曲线支持 7/30/90 天视图，并显示变化趋势。

#### 5.4.6 衣物统计

穿着次数排行、最久未穿列表、衣橱闲置率（近 90 天穿着次数为 0 的占比）。

### 5.5 AI 能力（仅训练域）

#### 5.5.1 服务配置

| 项 | 要求 |
|---|---|
| 协议 | OpenAI 兼容（`/v1/chat/completions`） |
| 默认 | DeepSeek（`https://api.deepseek.com`） |
| 可配 | baseURL、模型名、API Key、temperature |
| Key 存储 | Android Keystore 加密，不写明文、不进导出文件 |
| **传输层** | **`CapacitorHttp`（原生 OkHttp），禁止 WebView `fetch` 直连**。原因见 A8：WebView origin 为 `localhost`，跨域请求会被 CORS 拦截 |
| **流式** | **不使用 SSE 流式**。`CapacitorHttp` 会把响应整体缓冲，SSE 在原生层拿不到增量；强行实现需要自写 Kotlin 的 EventSource。单次分析的完整响应在 10–40 秒量级，用"转圈 + 预计时长文案 + 可取消"即可，不做打字机效果 |
| 超时与重试 | 连接 10s / 读取 60s；超时展示 AI-3 规定的错误与重试按钮，**不做自动重试**（避免重复计费） |
| 联网 | 仅调用时联网，无后台请求 |

#### 5.5.2 功能一：训练计划生成 → 落为模板

**输入**：目标（增肌/减脂/力量）、每周可训练天数、单次时长、可支配器械、当前水平、历史训练摘要（若有）。

**输出**：结构化的训练模板（JSON），包含动作顺序、目标组数/次数/重量、建议休息时长。

**落库规则**：AI 输出先展示为「待确认」预览，用户可逐项编辑、删除动作、调整组数，**点"保存为模板"才写入**。

#### 5.5.3 功能二：单次训练分析

**触发**：训练结束页手动点击"生成分析"（**不自动调用**，省 token 且避免无关输出）。

**输入（结构化）**：
- 本次训练全部组：动作、重量、次数、RPE、实际组间歇
- 同动作上次训练数据（对比基准）
- 本次感受标签 + 自由备注
- 近 4 周同动作容量趋势

**输出（固定四段结构）**：
1. **本次表现**：容量、强度、完成度
2. **与历史对比**：哪些动作进步/停滞/退步，给出百分比
3. **问题诊断**：从 RPE 与实际间歇推断疲劳、容量不足、休息过长等问题
4. **下次建议**：具体到"某动作下次加 X kg"或"某动作多加 1 组"

#### 5.5.4 不可让步的规则

| 编号 | 规则 |
|---|---|
| AI-1 | **AI 只能建议，不能落库。** 所有输出经"待确认"界面，用户显式确认后才写数据 |
| AI-2 | 所有 AI 请求必须使用结构化输出（JSON Schema 或 function calling），禁止解析自然语言 |
| AI-3 | 调用失败（超时/额度/网络）时展示明确错误与重试按钮，不吞异常、不显示假数据 |
| AI-4 | 请求前展示预计消耗（token 粗估），让用户对成本有感知 |
| AI-5 | 不把任何库内原始数据发到除用户配置的 endpoint 之外的地方 |

**验收标准**
- [ ] 拒绝 AI 生成的计划后，模板库无任何新增。
- [ ] 断网时点击"生成分析"，显示明确错误提示，无空白页、无 loading 卡死。
- [ ] 导出文件中不含 API Key。

### 5.6 数据管理

#### 5.6.1 备份体系（四层，必须全部实现）

| 层 | 机制 | 保留策略 | 解决的问题 |
|---|---|---|---|
| L1 自动内部快照 | 每次启动时，若距上次快照 > 20 小时，将全量数据序列化为 JSON 并**gzip 压缩**后写入应用私有目录 `files/backups/` | 7 份日快照 + 8 份周快照 | 误删、数据损坏、升级出错 |
| **L1b 外置镜像（v1.1 新增）** | 用户授权一个 SAF 目录（`ACTION_OPEN_DOCUMENT_TREE` + `takePersistableUriPermission`），每周把当周快照镜像一份到该目录 | 8 份周镜像 | **卸载、清空应用数据**——这两件事会连 `files/backups/` 一起删掉，L1 挡不住 |
| L2 手动外部导出 | 设置页"导出数据"，生成 JSON / CSV，通过系统分享面板发送（微信/AirDroid/网盘/邮件） | 用户自管 | 手机丢失、换机 |
| L3 不打扰提醒 | 超过 7 天未执行 L2 时，首页顶部出现可关闭的黄色提示条 | 当次可关，次日再现 | 忘记备份 |

**为什么必须四层**：数据只存在于一台手机的 WebView 沙箱里，卸载、系统清理存储、Capacitor 升级都可能导致数据全毁且不可恢复。**这不是"最好有"，是唯一的数据安全保障。**

**为什么必须补 L1b**：L1 写在应用私有目录里，而私有目录随卸载一起删除。也就是说 L1 只能防"用错了"，防不了"装错了/删错了"——而后者恰恰是现实中最容易发生的。L1b 把同一份数据放到用户自己的文件区，卸载重装后仍能导回。**授权一次，之后静默执行**，不打扰。

**实现约束**：
- 快照必须 gzip（JS 侧 `CompressionStream('gzip')` 或等价的纯 JS 实现），否则 15 份全量 JSON 会随数据增长线性膨胀，3 年后单次快照可达数十 MB，写入耗时反而破坏启动性能。
- 快照写入必须先写临时文件再原子改名，避免"写一半被系统杀掉"产生半截文件被当成有效备份。
- 快照内头部必须记录 `schemaVersion` 与 `snapshotAt`，恢复时先校验版本（同 §5.6.2）。

**验收标准**
- [ ] 连续启动 8 次后，`files/backups/` 中保留 7 份日快照（最旧的被清理）。
- [ ] 快照文件为 gzip 格式，体积显著小于未压缩 JSON（验收时对比同一份数据）。
- [ ] 授予 SAF 目录后，当周快照被镜像到该目录；未授权时此层静默跳过，不报错、不阻断启动。
- [ ] 超过 7 天未导出，首页出现提示条；点击"稍后"后当次消失，次日重现。
- [ ] 导出的 JSON 包含全部表，且不含 API Key。

#### 5.6.2 导出格式

| 格式 | 内容 | 用途 |
|---|---|---|
| **JSON 全量** | 所有表 + schema 版本号 + 导出时间 | 完整备份、换机迁移、可导回 |
| **CSV 分表** | 每张表一个 `.csv`，打包为 zip | Excel 二次分析 |

**导入规则**：
- 导入前校验 schema 版本，版本不匹配时提示"数据来自 vX，当前 vY"，并给出可行路径（升级或拒绝）。
- 导入默认为**合并**（按 id 去重，冲突时保留 `updatedAt` 较新者）。`updatedAt` 相等时保留本地版本（不覆盖）。
- **软删除行必须参与合并**：`deletedAt != null` 的记录照常导入（它也是"较新"的一种状态），否则用户删掉的记录会在导入后复活——这是最容易漏、也最让人失去信任的一类 bug。
- **导入完成后必须重算冗余字段**：`garments.wearCount` / `lastWornAt` 从 `wear_logs` 全量重算，`settings` 中 `lastExportAt/lastBackupAt` 保持不变。库存不需要重算（`stock_logs` 是唯一真相，聚合即得）。
- 提供"清空后导入"选项，需二次确认。

**验收标准**
- [ ] 导出 → 清空 → 导入后，各表行数与关键字段完全一致。
- [ ] 导入版本不匹配的文件时给出明确提示，不出现部分写入造成的脏数据。
- [ ] **导出 → 删除某条记录 → 导回，该记录仍为已删除状态，不复活。**
- [ ] 导入后 `garments.wearCount` 与 `wear_logs` 行数一致。
- [ ] CSV 可用 Excel 直接打开且中文不乱码（UTF-8 with BOM）。

#### 5.6.3 数据删除

- 所有业务表使用**软删除**（`deletedAt`），除"清空所有数据"外不提供物理删除。
- 软删除数据 30 天后由启动清理任务物理清除。
- "清空所有数据"需输入确认文字 + 二次确认弹窗。

---

## 6. 数据模型

### 6.1 实体关系

```
items ──┬── consumables (1:1, 计量/计数属性)
        ├── garments    (1:1, 衣物属性)
        ├── stock_logs  (1:N, 库存流水)
        └── linkedFoodId ──→ foods (N:1, 可选)

foods ──┬── recipes      (1:N, 作为菜品)
        └── recipe_items (1:N, 作为原料)

meals ──→ foods (N:1, 可空；外食可用临时营养值)
meals ──→ items (N:1, 可空；扣减目标)

recipes ──→ recipe_items ──→ foods

exercises ──┬── workout_sets (1:N)
            ├── template_exercises (1:N)
            └── exercise_samples (1:N, P2)

workout_templates ──→ template_blocks ──→ template_exercises ──→ exercises
workouts ──→ workout_blocks ──→ workout_sets ──→ exercises
workouts ──→ workout_blocks ──→ block_exercises (块内动作，多动作时 >1)
workouts.templateId ──→ workout_templates（弱引用，可为空；仅记录来源，不参与渲染）

outfits ──→ outfit_items ──→ garments(items)
wear_logs ──→ items(garment)

body_metrics (体重/体脂/围度，按日)
settings (单行配置)
```

### 6.2 表结构

> 所有表通用字段：`id: string`（ULID，客户端生成，按时间有序）、`createdAt: number`（ms）、`updatedAt: number`（ms）、`deletedAt: number | null`。

#### items

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | ULID |
| name | string | 名称 |
| domain | `'consumable' \| 'food' \| 'garment'` | 域 |
| category | string | 子分类（自由文本，前端给候选） |
| photoId | string \| null | 照片文件 id |
| note | string | 备注 |
| status | `'active' \| 'archived'` | 状态 |
| createdAt / updatedAt / deletedAt | number | |

#### consumables（含食物库存）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 与 items.id 一对一 |
| itemId | string | 引用 items.id |
| trackMode | `'measured' \| 'counted'` | 计量型 / 计数型 |
| unit | string | ml / g / pcs / 包 |
| lowStockThreshold | number | 低库存阈值，null 表示不提醒 |
| lastPurchaseAt | number \| null | 上次补货时间 |
| linkedFoodId | string \| null | 食物库存专用，关联 foods.id |

> **不存 `currentQty`**。当前量由 `stock_logs` 聚合得出，见 §7.1。
>
> **v1.1 修订：不存 `initialQty`。** 原表中该字段与 §7.1「不单独存字段参与计算」直接冲突。统一为：新建物资时表单里的"现有量"输入，在保存时**同时生成一条 `kind='purchase'` 的首条流水**（`note` 标记"建档期初"），此后一切以流水为准。这样库存永远只有一个真相来源，不存在"改了期初但流水没变"的账目分裂。
>
> **v1.1 修订：`id` 与 `itemId` 冗余。** 约定扩展表主键 `id` **恒等于** `itemId`（1:1 关系用同一主键），查询时直接用 `get(itemId)`，不再维护两个字段的一致性。

#### garments

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | 与 items.id 一对一 |
| itemId | string | 引用 items.id |
| size | string | 尺码 |
| seasons | string[] | spring/summer/autumn/winter |
| color | string | 颜色（hex 或名称） |
| material | string | 材质 |
| purchasedAt | number \| null | 购入日期 |
| careStatus | `'stored' \| 'wearing' \| 'laundry'` | 洗护状态 |
| wearCount | number | 累计穿着次数（冗余字段，用于排序性能） |
| lastWornAt | number \| null | 最后穿着日 |

#### stock_logs

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | ULID |
| itemId | string | 引用 items.id |
| kind | `'purchase' \| 'consume' \| 'adjust' \| 'discard'` | 流水类型 |
| delta | number | 变动量，带符号 |
| unit | string | 冗余单位，防单位变更后历史失真 |
| sourceId | string \| null | 来源（如饮食记录 id） |
| note | string | 备注 |
| at | number | 发生时间（可与 createdAt 不同，支持补录） |

#### foods（营养字典）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | ULID |
| name | string | 食物名 |
| category | string | 主食/肉蛋/蔬菜/水果/乳制品/豆制品/菜肴/零食 |
| kcalPer100g | number | 每 100g 热量 |
| proteinPer100g | number | 蛋白质 g |
| carbPer100g | number | 碳水 g |
| fatPer100g | number | 脂肪 g |
| fiberPer100g | number \| null | 膳食纤维（选填） |
| sodiumPer100g | number \| null | 钠 mg（选填） |
| servings | `{label: string, grams: number}[]` | 自定义份量单位 |
| isRecipe | boolean | 是否为配方菜品 |
| sourceType | `'manual' \| 'ocr' \| 'import'` | 数据来源，用于统计与排查 |
| rawOcrText | string \| null | OCR 原始文本快照（仅 sourceType='ocr'，供审计追查） |
| note | string | |

> 必填仅 `kcalPer100g` 与 `proteinPer100g`。其余留空不阻塞保存——**每多一个必填字段，日活跃率就掉一截**。

#### recipes / recipe_items

| recipes 字段 | 类型 |
|---|---|
| id | string |
| name | string |
| outputGrams | number（成品总重） |
| note | string |

| recipe_items 字段 | 类型 |
|---|---|
| id | string |
| recipeId | string |
| foodId | string（原料） |
| grams | number（成品中所含该原料克数） |

#### meals（饮食流水）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | ULID |
| at | number | 进食时间 |
| foodId | string \| null | 引用 foods；外食自建时为 null |
| nameSnapshot | string | 食物名快照（防字典改名后历史失真） |
| grams | number | 实际克数 |
| servingLabel | string \| null | 使用的份量单位（如"一碗"） |
| servingCount | number \| null | 份数 |
| kcal / protein / carb / fat / fiber | number | **计算后的快照值**，不随字典变更 |
| stockAction | `'direct' \| 'recipe' \| 'none'` | 扣减方式 |
| targetItemId | string \| null | direct 时的目标 items.id |
| targetRecipeId | string \| null | recipe 时的配方 id |
| note | string | |

> 营养值存快照而非实时计算，理由：食物字典改了营养值，不应篡改两个月前的历史摄入统计。

#### exercises

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | ULID |
| name | string | 动作名 |
| category | string | 胸/背/腿/肩/手臂/核心/有氧 |
| trackingMode | `'weight' \| 'reps'` | P2 预留 |
| defaultRestSec | number \| null | 该动作默认间歇（null 则用全局） |
| cues | string[] | 技术要点 |
| mistakes | string[] | 常见错误 |
| breathing | string | 呼吸节奏 |
| alternatives | string[] | 替代动作 |
| videoUrl | string | 参考视频链接 |
| status | `'active' \| 'archived'` | 归档而非删除 |
| note | string | |

#### workouts / workout_blocks / block_exercises / workout_sets

| workouts | 类型 |
|---|---|
| id | string |
| startedAt | number |
| endedAt | number \| null |
| templateId | string \| null |
| restSecOverride | number \| null（本次训练休息时长覆盖值） |
| feelTags | string[]（力竭/泵感好/关节不适/睡眠不足/状态好） |
| note | string |
| aiAnalysis | string \| null（AI 分析结果缓存） |

| workout_blocks | 类型 |
|---|---|
| id | string |
| workoutId | string |
| order | number |
| kind | `'single' \| 'superset' \| 'giant'` |
| restSec | number（本块休息时长，默认取 §5.3.5 优先级） |

| block_exercises | 类型 |
|---|---|
| id | string |
| blockId | string |
| exerciseId | string |
| order | number（块内顺序） |

| workout_sets | 类型 |
|---|---|
| id | string |
| blockId | string |
| exerciseId | string |
| setIndex | number |
| weightKg | number |
| reps | number |
| rpe | number \| null（6–10） |
| completedAt | number |
| actualRestSec | number \| null（到下一组开始的间隔） |
| isWarmup | boolean |

#### workout_templates / template_blocks / template_exercises（v1.1 补齐）

> 原 v1.0 定义了 §5.3.3 的模板结构、保留了 `workouts.templateId`、M3 也要交付"模板"，但 §6.2 里三张模板表一张都没有——属于会直接阻塞 M3 建模的遗漏。结构与 `workouts / workout_blocks / block_exercises` **同构**，理由是把模板实例化成一次训练时是字段的直接映射，不需要任何转换逻辑。

| workout_templates | 类型 | 说明 |
|---|---|---|
| id | string | ULID |
| name | string | 模板名，如"推日 A" |
| goal | `'hypertrophy' \| 'strength' \| 'fatloss' \| null` | 来源（手建 / AI 生成） |
| sourceType | `'manual' \| 'ai'` | 与 `foods.sourceType` 同一命名约定 |
| note | string | |

| template_blocks | 类型 |
|---|---|
| id | string |
| templateId | string |
| order | number |
| kind | `'single' \| 'superset' \| 'giant'` |
| restSec | number（本块休息秒数） |

| template_exercises | 类型 | 说明 |
|---|---|---|
| id | string | |
| blockId | string | |
| exerciseId | string | |
| order | number | 块内顺序 |
| targetSets | number | 目标组数 |
| targetRepsMin / targetRepsMax | number | 目标次数区间 |
| targetWeightKg | number \| null | 目标重量，null 表示不指定 |

**实例化规则**：从模板开练时，一次性复制出 `workout_blocks / block_exercises / workout_sets`（次数与重量用 `target*` 预填为占位值，`completedAt` 为空）。**复制而非引用**——训练中改动作、改组数不得回写模板（§5.3.3 第三条验收标准）。

#### body_metrics

| 字段 | 类型 | 说明 |
|---|---|---|
| id | string | |
| date | string | `YYYY-MM-DD`（每日一条，同日多次录入取最新） |
| weightKg | number \| null | |
| bodyFatPct | number \| null | |
| bmrOverride | number \| null | 手填覆盖值 |
| measurements | `{chest?,waist?,hip?,arm?,thigh?,neck?}` | 围度 cm |

#### outfits / outfit_items

| outfits | 类型 |
|---|---|
| id | string |
| name | string |
| photoId | string \| null |
| note | string |

| outfit_items | 类型 |
|---|---|
| id | string |
| outfitId | string |
| itemId | string（衣物 items.id） |

#### wear_logs

| 字段 | 类型 |
|---|---|
| id | string |
| itemId | string |
| wornAt | number |
| outfitId | string \| null |

#### settings（单行，id 固定为 `'app'`）

| 字段 | 类型 | 说明 |
|---|---|---|
| id | `'app'` | |
| heightCm / age / sex | number / number / `'male'\|'female'` | 用于 BMR |
| dailyKcalGoal / dailyProteinGoal | number | 每日目标 |
| globalRestSec | number | 组间歇全局默认，默认 90 |
| lowStockNotify | boolean | 低库存通知（默认 false，按决策仅组间歇发通知） |
| ai { baseUrl, model, temperature } | object | API Key 单独存 Keystore |
| lastExportAt | number \| null | 用于 L3 提醒 |
| lastBackupAt | number \| null | 用于 L1 快照 |

#### exercise_samples（P2 预留）

`id / exerciseId / videoUri / keypointSeries(JSON) / recordedAt / cameraAngle / note`

### 6.3 索引

| 表 | 索引 |
|---|---|
| items | `domain`, `status`, `name`, `deletedAt`, `[domain+status]` |
| stock_logs | `itemId`, `at`, `kind`, `[itemId+at]`, **`sourceId`**（v1.1 新增：编辑/删除饮食记录时要按来源冲销） |
| meals | `at`, `foodId`, `[at+deletedAt]`, **`[foodId+at]`**（v1.1 新增：近 30 天高频食物 Top10 不能全表扫） |
| foods | `name`, `category`, `isRecipe` |
| recipes / recipe_items | `recipe_items.recipeId` |
| exercises | `category`, `status`, `name` |
| workouts | `startedAt` |
| workout_blocks | `workoutId` |
| block_exercises | `blockId` |
| workout_sets | `exerciseId`, `[exerciseId+completedAt]`, `blockId` |
| **workout_templates** | **`name`**（v1.1 补齐） |
| **template_blocks** | **`templateId`**（v1.1 补齐） |
| **template_exercises** | **`blockId`**（v1.1 补齐） |
| body_metrics | `date` (unique) |
| wear_logs | `itemId`, `wornAt` |

### 6.4 迁移策略

- Dexie `version(n).stores({...}).upgrade(tx => ...)`，每次结构变更新增一个 version，**禁止原地修改旧 version 的声明**。
- 迁移必须幂等：重复执行同一 version 不产生重复数据。
- 每次迁移前自动触发一次 L1 快照，命名带 `pre-migrate-v{n}`。
- 大表重构（如 later 拆分表）走"新建表 → 后台逐批搬迁 → 校验行数 → 切换读取源 → 延迟删除旧表"，不做一次性全量重写。

---

## 7. 关键算法与规则

### 7.1 库存聚合

```
currentQty(itemId) = Σ stock_logs.delta where itemId = ? and deletedAt is null
```

- **期初值不是字段，是流水**：新建物资时填写的"现有量"在保存时落地为一条 `kind='purchase'`、`note='建档期初'` 的流水。库存只有一个真相来源，即 `stock_logs`（v1.1 已从 §6.2 删除冲突的 `initialQty` 字段）。
- 聚合结果允许为负。
- 性能：单物品流水量级为百条以内，全量聚合在 IndexedDB 中毫秒级，不做物化缓存。若未来超过 5000 条再考虑按 `[itemId+at]` 分页。

### 7.2 消耗速率与预计用完日

```
消耗量 = Σ |delta| where kind in ('consume','discard') and at >= now - 30d
         ── 但同一 sourceId 下先求净额再取绝对值（冲销对互相抵消，见 §7.3.1）
有效天数 = distinct(date(at)) 的数量
日均速率 = 消耗量 / max(有效天数, 1)
预计用完天数 = ceil(currentQty / 日均速率)
```

**规则**：
- `purchase` 与 `adjust` **不参与**速率计算。补货会人为拉低速率，盘点校正不代表真实消耗。
- **冲销净额化**：`sourceId` 非空的流水按 `sourceId` 分组求和后取绝对值；`sourceId` 为空的（手动"用了 1 件"）逐条取绝对值。否则编辑一次饮食记录会让消耗量翻倍，预测天数直接砍半。
- 消耗记录 < 3 次 → 不计算，显示"数据不足"。
- 日均速率 = 0 → 预计用完日显示"—"。
- 推断结果超过 365 天 → 显示"暂时消耗很慢"，不显示具体天数。

### 7.3 扣库存策略执行

```
当 stockAction = 'direct'：
  stock_logs += { itemId: targetItemId, kind: 'consume', delta: -grams, sourceId: meal.id }

当 stockAction = 'recipe'：
  scale = meal.grams / recipe.outputGrams
  for each recipe_item:
    stock_logs += { itemId: <该原料对应的库存 item>, kind: 'consume',
                    delta: -(recipe_item.grams × scale), sourceId: meal.id }

当 stockAction = 'none'：
  不写流水
```

**事务要求**：写饮食记录与写库存流水必须在同一个 Dexie 事务里，**任一失败则整体回滚**，避免"记录了吃但没扣库存"或反之。

**原料无库存时**：跳过该原料的扣减，不报错，在饮食记录里以 `note` 标注"部分原料无库存未扣减"。

#### 7.3.1 冲销规则（编辑 / 删除饮食记录，v1.1 补齐）

> 原 §7.3 只写了创建路径。但饮食记录会被改克数、被删——不回冲库存就会出现"记了 200g 又改成 100g，库存扣了 300g"的静默账目漂移。

**唯一正确做法：先冲销、再重写。不做增量 diff。**

```
编辑一条饮食记录（gram 变了 / stockAction 变了 / food 变了）：
  1. 开事务
  2. 查出 stock_logs where sourceId = meal.id → 为每条写一条等额反向流水
     （kind 保持不变，delta 取反，note='冲销 for edit'）
     冲销不要用物理删除流水 —— 流水是账本，账本只能追加
  3. 按新的 meal 数据重新执行 §7.3 的扣减
  4. 更新 meal（同事务）
  5. commit

删除一条饮食记录（软删除）：
  1. 开事务
  2. 同上，按 sourceId 写反向流水
  3. meal.deletedAt = now
  4. commit
```

**硬规则**：
- 冲销与重写必须在**同一个 Dexie 事务**内完成必须项 2–4，否则中途失败会留下"扣了两次"或"一次没扣"。
- 冲销流水的 `kind` 保持与原流水一致（`consume` 的冲销仍是 `consume`，delta 为正），**不要引入 `reversal` 新类型**：负负得正，聚合公式不用改，历史口径（§5.4.4 排除 `purchase` 与 `adjust`）也不用改。
- 被冲销的消费流水会抬高"消耗量"统计吗？会——所以 §5.4.4 的速率计算必须**成对剔除**：同一 `sourceId` 下 `delta` 之和为 0 的记录对整体不计入消耗量。
- 已软删除的饮食记录，其冲销流水一并标记 `deletedAt`，30 天后同步物理清除。

### 7.4 生理指标公式

```
BMR (Mifflin-St Jeor)：
  男 = 10×体重kg + 6.25×身高cm − 5×年龄 + 5
  女 = 10×体重kg + 6.25×身高cm − 5×年龄 − 161

1RM (Epley)：1RM = 重量 × (1 + 次数 / 30)
  仅在 reps ≤ 10 时展示，>10 标注"仅供参考"

训练容量 (volume)：Σ(weightKg × reps)，排除 isWarmup = true 的组
```

### 7.5 组间歇计时

**核心原则：计时状态以"绝对到期时间戳"为唯一真相，不以"累加计数"为真相。**

```
完成组时：
  restEndAt = Date.now() + restSec × 1000
  cancel(旧通知 id)                      // 同一时刻只允许一条待触发通知
  立即调度本地通知 { at: restEndAt, sound: 'beep', vibration: true }
    └─ 调度前必须先过 A9 的精确闹钟检查，不得触发系统设置页跳转
  记录 set.actualRestSec = restEndAt − 上一组 completedAt

界面刷新（每 200ms）：
  remaining = max(0, restEndAt − Date.now())
  （页面切后台再回来，按上式直接重算，不依赖之前的计数）
```

**这样做的原因**：Android 会节流后台 JS 定时器，若用累加计数，页面切后台 30 秒后回来会显示剩余时间偏多（少扣了时间），用户按错误时间休息，训练质量被悄悄破坏。

**音频（v1.1 修正，原方案不可行）**

| 场景 | 播放者 | 实现 |
|---|---|---|
| **到期提示（锁屏/后台）** | **系统通知** | `res/raw/beep.wav`，通过 `plugins.LocalNotifications.sound` 绑定到通知通道。**WebView 此时已挂起，Web Audio 一定不响** |
| 最后 3 秒滴声 | Web Audio | 正弦波，仅在页面可见时触发。**锁屏场景下不存在"最后 3 秒"**，不要为此写验收标准 |
| 点击/保存反馈音 | Web Audio | 首次进入训练页时 `AudioContext.resume()` 解锁 |

> 原 v1.0 写"到期提示音使用 Web Audio 预生成正弦波"，但 WebView 切后台或锁屏后 `AudioContext` 会被系统挂起，声音一声也出不来——与 §5.3.5 第一条验收标准（锁屏也要响）直接冲突。以本表为准。
>
> ⚠️ **Android 8+ 通道声音创建后不可修改**：`beep.wav` 的文件名与通道 id 在 M0 定死，后续修改只能新建通道 id。

### 7.6 统计口径汇总

| 指标 | 是否计入运动消耗 | 是否外推缺失日 |
|---|---|---|
| 日摄入热量 | — | 否（缺失显示断点） |
| 训练容量 | 独立，不与摄入相减 | 否 |
| 体重曲线 | — | 否，折线在缺失日断开 |
| 消耗速率 | — | 否，按有效天数平均 |

### 7.7 OCR 解析与营养换算

**处理管道（顺序不可调换）**

```
原始 OCR blocks / lines
  ① 行归一化（全角转半角、去多余空格、修正常见误识字）
  ② 定位表头，判定基准（每100克 / 每100毫升 / 每份）
  ③ 逐行匹配营养素名（含缩进子项处理）
  ④ 从该行提取「数值 + 单位」，剔除 NRV% 列
  ⑤ 能量单位换算 kJ → kcal
  ⑥ 基准归一化到 per 100g
  ⑦ 输出待确认字段 + 置信度标记
```

**① 常见误识修正表**

| 误识 | 正确 | 说明 |
|---|---|---|
| 蛋白貭 / 蛋白頂 / 蛋日质 | 蛋白质 | 「白」易与「日」「貭」混 |
| 碳水化含物 / 碳水化物 / 碳酸化合物 | 碳水化合物 | 短写「碳水化物」在标签上合法 |
| 纳 / 钢 | 钠 | 字形近 |
| 能童 / 能置 | 能量 | |
| 脂防 | 脂肪 | |
| NFV% / NRV％ | NRV% | 全角百分号需归一 |

**② 基准判定**

从表头行提取，按以下优先级：

| 命中特征 | basis | factor |
|---|---|---|
| `每100克` / `每100g` | `100g` | 1 |
| `每100毫升` / `每100mL` | `100ml` | 1（近似视作 per100g，界面必须明示） |
| `每份` / `每袋` / `每包` + 找到 `净含量 X g` | `serving` | `100 / X` |
| 全部未命中 | `unknown` | **不猜测**，要求用户手选 |

**③ 数值与单位提取**

- 行内若**仅**含百分比 → 判定为 NRV 列残行，整行丢弃。
- 提取**第一个**「数字 + 可选单位」组合。单位白名单：`kJ / 千焦 / kcal / 千卡 / 大卡 / g / 克 / mg / 毫克 / μg`。
- 同一行有多个数值时，**优先取带单位的**；若都带单位，取最左的（含量列在最左，NRV 列最右）。
- 营养素名与数值之间的缩进符 `-` `—` `·` 先剥离。

**④ 缩进子项识别**

若某行营养素名以 `-` / `—` / 空格缩进开头，且其上方 1–2 行为主项（脂肪 / 碳水化合物），则标记为子项，**不写入主字段**，仅记入 `note`。典型子项：饱和脂肪、反式脂肪、糖、胆固醇。

**⑤ 能量换算（风险最高的一处）**

```
单位为 kJ 或 千焦   → kcal = kJ / 4.184，四舍五入取整
单位为 kcal / 千卡 / 大卡 → 直接使用
单位缺失           → 数值 > 900 视为 kJ，≤ 900 视为 kcal，
                     并在界面标注「单位缺失，已按量级推断，请核对」
```

示例：`能量 1653kJ` → `1653 ÷ 4.184 = 395.0` → **395 kcal**

> ⚠️ 中国营养成分表绝大多数用 kJ。若误当 kcal 直接存入，误差 **4.184 倍**，而且产生的数字看起来"很正常"，用户不会怀疑。因此确认页**必须把 `1653 kJ` 与 `= 395 kcal` 并列显示**，让换算过程可见。

**⑥ 基准归一化**

```
per100g值 = 原始值 × factor
```

**⑦ 置信度标记**

每个字段输出 `{ value, unit, confidence, needReview }`：

| 情况 | confidence | needReview |
|---|---|---|
| 名称精确匹配 + 有单位 + 数值在合理区间 | high | false |
| 名称模糊匹配（经误识修正）+ 有单位 | medium | true |
| 单位缺失（靠量级推断） | low | true |
| 基准未识别 | low | **该条目全部字段 true** |

`needReview = true` 的字段在确认页高亮，但**不阻断保存**。

**性能与失败处理**

- 单张图 OCR 目标 ≤ 3 秒（1080p 输入，arm64 中端 SoC）。
- 拍照前压缩到长边 ≤ 2000px，降低内存占用与耗时。
- OCR 超时（> 10 秒）或抛异常 → 直接降级为空白手录表单，保留用户已输入内容。

### 7.8 网络调用链（v1.1 新增）

> 这一节存在的唯一原因：WebView 里的 `fetch` 在 Capacitor 容器中**不是一个可以随便用的东西**。不写清楚，M5 会在"请求发不出去、报错看不懂"上耗掉两天。

```
按钮点击
  → 读 settings.ai（baseUrl / model / temperature）
  → 从 Keystore 取 API Key（缺 key 直接引导去设置页，不发请求）
  → 组装请求体（AI-2 要求的 JSON Schema / function calling）
  → 经 CapacitorHttp 发出（原生 OkHttp，无同源限制）
  → 解析 choices[0].message.content
  → 按 AI-2 校验 JSON 结构；解析失败 = 调用失败，走 AI-3 错误态
  → 展示为"待确认"预览（不落库）
```

**硬规则**：

| 编号 | 规则 |
|---|---|
| NET-1 | 所有外部 HTTP 必须经 `CapacitorHttp`（`capacitor.config` 中 `plugins.CapacitorHttp.enabled = true`）。**禁止**直接 `fetch('https://…')` —— WebView origin 是 `localhost`，第三方端点不带 CORS 头就会失败，且失败信息通常是笼统的 `TypeError: Failed to fetch`，无法与"断网"区分 |
| NET-2 | **不做流式**。CapacitorHttp 整体缓冲响应，SSE 拿不到增量。用"转圈 + 可取消 + 预计 10–40 秒"的等待态替代 |
| NET-3 | 超时：连接 10s、读取 60s。超时和 HTTP 4xx/5xx 都归到 AI-3 的错误态，展示服务端返回的 `error.message` 原文（便于排查额度和模型名错误） |
| NET-4 | baseURL 允许自定义，但若为 `http://` 内网地址，必须在 `network_security_config.xml` 中按域名/IP 白名单放行；**禁止全局 `usesCleartextTraffic=true`** |
| NET-5 | 请求体不得包含图库原始数据以外的隐私项（照片永不发出，见 OCR-5）；导出文件不含 Key（见 §5.6.2） |

---

## 8. 非功能需求

| 类别 | 要求 |
|---|---|
| 性能 | 冷启动到首页可交互 ≤ 1.5s；列表滚动 ≥ 55fps；单次写入 ≤ 50ms |
| 容量 | 支持 10 年数据（估算：饮食 3.6 万条、训练组 10 万条、流水 2 万条），列表必须虚拟化 |
| 离线 | 除 AI 分析外，100% 功能离线可用 |
| 隐私 | 无任何埋点、无崩溃上报、无后台网络请求；数据只在设备内 |
| **兼容** | **Android 8.0（API 26）至最新；targetSdk 36**（v1.1 由 API 24 上调，理由见 A10：Tailwind v4 需 Chrome 111+，API 24 的 WebView 无法承载现代 CSS，为它降级整条工具链不划算） |
| 无障碍 | 关键按钮触控区 ≥ 44×44dp；训练页支持大字号 |
| 可用性 | 单手可完成"记一笔饮食"与"记录一组训练"；键盘弹起时目标输入框必须在可视区内（见 A11） |
| **体积** | **APK ≤ 60MB，目标 ≤ 50MB**（仅 `arm64-v8a` 单架构）。v1.1 由 35MB 上调：`@capacitor-mlkit/text-recognition` 强制打包 5 种文字模型，无法只保留中文，见 A6 / O7 |
| **耐久性** | 任何单表写入失败都不得导致应用无法启动；启动时若 schema 打开失败，自动进入"只读 + 从快照恢复"模式，不白屏 |

**性能实施细则（1.5s 冷启动不是默认行为，要靠配置拿到）**：
- `@capacitor/splash-screen` 设 `launchAutoHide: false`，在首个业务页面 `useEffect` 里手动 `hide()` —— 否则会先闪一下白屏。
- 五个 Tab 路由级 `React.lazy` 拆包；首页只加载今日概览所需模块。
- Dexie 在首个页面 `useEffect` 中打开，不做顶层 await；首屏渲染不等数据库。
- 不引 UI 组件库、不引图标字体（图标用内联 SVG）、不引 `lodash` 全量。首屏 JS gzip 目标 ≤ 150KB。
- 备份快照（§5.6.1）**必须延后到首屏可交互之后**的空闲时段执行（`requestIdleCallback`），否则 20 小时一次的全量序列化会正好命中冷启动。

---

## 9. 风险与应对

| 编号 | 风险 | 影响 | 应对 |
|---|---|---|---|
| R1 | **数据全丢**（卸载/系统清理/升级） | 致命 | 四层备份体系（§5.6.1）为 P1 必做项，不可后置。其中 **L1b 外置镜像**专门针对"卸载"——L1 私有目录快照会随卸载一起消失 |
| R2 | **空食物库导致两周内放弃记录** | 高 | 五个降痛功能：**OCR 扫营养成分表（主力手段）**、从最近记录复制、常用置顶、粘贴营养表文本自动解析、CSV 批量导入 |
| R3 | 摄像头识别在健身房失败率高（逆光/人员走动） | 中 | P2 才做；失败默认降级手动；结果必须人工确认 |
| R4 | HyperOS 限制后台导致组间歇不响 | 中 | 首次引导开权限；失败降级为页面内计时 + 屏幕常亮 + 明确提示 |
| R5 | AI 幻觉污染训练建议 | 中 | AI 不落库；计划必须人工编辑确认；分析结果只读展示 |
| R6 | 库存账目与实际不符 | 低 | 提供盘点校正（adjust）；允许负库存并标红；不做强制校验阻断记录 |
| R7 | 空动作库导致首次训练被录入打断 | 中 | 空状态引导 + 极简录入表单（仅名称必填） |
| R8 | Capacitor 大版本升级破坏 WebView 数据 | 中 | 升级前强制 L1 快照；版本升级视为高风险变更，单独验证 |
| R9 | **OCR 误识导致营养数据错误** | 高 | kJ→kcal 换算必须可视化（§7.7 ⑤）；所有字段默认待确认；保留 `rawOcrText` 供回溯；NRV% 列强制剔除；缩进子项不写入主字段 |
| R10 | 社区 ML Kit 插件**过新**而非滞后 | 高 | 实测 `@capacitor-mlkit/text-recognition` 8.2.x：支持 Capacitor ≥8（兼容性风险已排除），但**该包 2026-07 才建仓、单人维护、周下载量低，且强制打包 5 种文字模型**。应对：① M-1 阶段实测体积；② 体积累积影响 APK 交付时，用 `patch-package` 删掉非中文的 `implementation` 行；③ 仍不满意则自写 Kotlin 插件（只引 `text-recognition-chinese`，约 80 行，1 天），上层设计不受影响 |
| R11 | 国行设备无 GMS 导致 OCR 不可用 | 高 | 强制使用 bundled 版依赖（见 A6）；在 CI 中断言依赖坐标为 `com.google.mlkit:text-recognition-chinese`，禁止出现 `play-services-mlkit` |
| **R12** | **签名密钥（keystore）丢失** | 致命 | 同 R1 但成因更隐蔽：keystore 丢了就无法用同签名覆盖安装，**只能卸载重装 = 数据全毁**（卸载会删私有目录，L1 快照也一起没）。应对：① `release.keystore` 与口令在**仓库外**至少存两份（密码管理器 + 离线介质）；② 在 `docs/` 记录 keystore 的 SHA-256 指纹与口令获取路径（口令本身不入库）；③ 每次发版前验证"包里签名指纹 = 记录指纹" |
| **R13** | **AI 请求被 WebView CORS 拦截** | 高 | 见 A8 / NET-1：一律走 `CapacitorHttp`。若误用 `fetch`，表现是 `TypeError: Failed to fetch`，与断网无法区分，排查成本极高。M5 第一个任务就是打通一次真实请求 |
| **R14** | **精确闹钟权限导致组间歇不响或弹设置页** | 高 | 见 A9：manifest 声明 `USE_EXACT_ALARM`，不要走 `SCHEDULE_EXACT_ALARM` 的运行时请求流（该流程会跳系统设置页并挂起）。启动时 `checkExactNotificationSetting()` 兜底，失败降级为页面内计时 + 屏幕常亮 |
| **R15** | **工具链与 WebView 版本错配**（Tailwind v4 / Vite target / minSdk） | 中 | minSdk 26 + `build.target='chrome111'` 锁定（A10）。风险点是有人为了"兼容老机器"擅自把 minSdk 调回 24——**必须在 CI 中断言 `minSdkVersion == 26`**，否则样式会在旧 WebView 上静默错乱（不是报错，是布局崩） |

---

## 10. 里程碑

| 阶段 | 内容 | 完成标志 |
|---|---|---|
| **M-1 技术验证（v1.1 新增，动骨架之前）** | 空壳工程里只做三件事：① `CapacitorHttp` 打通一次真实 DeepSeek 请求；② manifest 声明 `USE_EXACT_ALARM` 后，锁屏状态下 90 秒通知**准时响且有声**；③ 装一次带 ML Kit 插件的空壳，量出 APK 实际体积 | 三条全过才允许进 M0。任一条不通，先解决选型问题而不是先写业务代码。**预计半天到一天，能省下 M2/M3/M5 各一次返工** |
| **M0 骨架** | 项目初始化、Capacitor 8 接入 Android、Dexie schema v1、Tab 导航、安全区适配 | 真机跑起来，五个 Tab 可切换，无白屏无溢出；**用搜狗/讯飞输入法实测表单，键盘弹起不遮输入框、无双重留白**（A11）；`minSdk=26`、`build.target=chrome111` 落地 |
| **M1 物资域** | items/consumables/garments + 库存流水 + 消耗预测 + 衣物穿搭 | 能完整走通场景 A 与场景 D；建档期初 → purchase 流水链路正确 |
| **M2 饮食域** | foods + meals + 份量系统 + 三种扣减策略 + 配方 + **OCR 营养表识别** | 能完整走通场景 B；S1（≤15 秒）与 S7（3/4 字段正确）达标；编辑/删除记录的冲销（§7.3.1）验证通过 |
| **M3 运动域** | exercises + **训练模板（含三张表）** + 记录 + 组间歇计时 + 感受 | 能完整走通场景 C；S2 达标；锁屏到点响铃实测通过 |
| **M4 统计 + 数据管理** | 四类统计 + **四层备份** + 导出导入 | S5 达标；R1 风险关闭；"导出→删除→导回不复活"验证通过 |
| **M5 AI** | 计划生成 + 训练分析 + 待确认流程 | AI-1 至 AI-5 全部通过 |
| **M6 打磨** | 空状态、引导页、性能优化、异常兜底 | S4/S6 达标 |
| P2 | 摄像头规则计次（4 个动作） | 单独排期，不阻塞 P1 |

---

## 11. 待定项

| 编号 | 待定内容 | 影响 | 建议 |
|---|---|---|---|
| O1 | 首次设置向导收哪些字段 | 阻塞 BMR 计算 | 必填：身高、年龄、性别、每日热量目标；选填：体重、训练目标 |
| O2 | 组间歇全局默认值 | 影响体验 | 建议 90 秒（复合动作偏短、孤立动作偏长，作为折中起点） |
| O3 | 训练模板初始几条是否由 AI 生成 | 影响首次体验 | 建议 M5 完成后由用户主动生成，不预置 |
| O4 | ~~图表库选型（自绘 SVG vs Recharts）~~ | — | **已决策（v1.1）：自绘 SVG**。本产品全部图表为折线（带断点）、柱状、排行列表三类，Recharts 会引入 d3 依赖（gzip 后 100KB+）且与 §8 的 150KB 首屏预算冲突。自绘约 300 行，且能精确控制"缺失日断开"的绘制语义 |
| O5 | 照片存储方案（文件 vs base64） | 影响性能 | 必须用文件 + `Capacitor.convertFileSrc()`，禁止 base64 存库 |
| O6 | ~~`@capacitor-mlkit/text-recognition` 是否已支持 Capacitor 8~~ | — | **已核实（v1.1）：支持。** 该插件 8.x.x 声明 `Capacitor >=8.x.x`，8.2.0 起提供 `processImage()`。兼容性风险关闭，但"包太新、单人维护"的风险转入 R10 |
| O7 | OCR 多语言模型与体积（**v1.1 重写**） | 影响 APK 交付 | 原结论"只装中文一套"**在该插件上不可实现**——插件把 Latin/Chinese/Devanagari/Japanese/Korean 五套模型全部打包进 APK。三条路径按推荐度排序：① `patch-package` 改插件 `android/build.gradle`，删掉非中文的 `implementation` 行（成本最低，升级插件时需重打补丁）；② 自写 Kotlin 插件，`implementation` 只留 `com.google.mlkit:text-recognition-chinese:16.0.1`（约 80 行，1 天，最干净）；③ 接受 5 套模型，体积上限放到 60MB。**M-1 先量体积再决策，不提前优化** |
| **O8** | 训练模板是否要支持"模板版本/演进" | 影响 M3 建模 | 建议 v1 不做版本化：模板被改就是新状态，历史训练已复制实例（§6.2 template 实例化规则），不存在回溯需求 |
| **O9** | `beep.wav` 的音色与时长 | 影响体验且**后期不可改**（Android 8+ 通道声音冻结） | 建议 0.5s 双音（880Hz + 1320Hz），音量 -6dB。M0 就要定，后期改文件名等于换通知通道 |
| **O10** | 是否引入 Vitest 对纯函数做单测 | 影响返工成本 | **建议引**。§7 全部算法（库存聚合、消耗速率、扣减冲销、Epley、OCR 解析管道）都是纯函数，是本项目唯一"错了不会报错、只会悄悄算错"的地方。建一个 fixture 数据集 + 20 个断言，成本半天 |
| **O11** | 崩溃/异常是否需要本机日志 | 影响排障能力 | §8 规定无崩溃上报（合理）。建议补一个**仅本机**的环形异常日志（最近 200 条写 IndexedDB），随导出文件打包，不联网 |

---

## 附录 A · 与访谈决策的对应关系

| 决策 | 结论 | 出处 |
|---|---|---|
| 平台 | 仅 Android APK | §3.1 |
| 数据归属 | 纯本地，无服务端、无同步 | §1.4、§5.6 |
| 本地存储 | IndexedDB / Dexie | §3.2 |
| 原生容器 | Capacitor 8.5.x（非 7.x） | §3.2 |
| AI 范围 | 仅训练域，手动触发 | §5.5 |
| AI 服务 | DeepSeek，OpenAI 兼容，可换 | §5.5.1 |
| 界面风格 | 浅色卡片式 | §3.2 |
| 物资建模 | 统一基表 + 域扩展 | §5.1.1、§6.2 |
| 库存记法 | 只存流水不存当前值 | §7.1 |
| 消耗品类型 | 计量型 + 计数型混合 | §5.1.2 |
| 食物联动 | 与饮食记录联动自动扣减 | §5.2.3 |
| 扣减粒度 | 直接扣 / 配方扣 / 不扣，逐条选择 | §5.2.3 |
| 衣物深度 | 条目 + 穿着次数 + 洗护状态 + 穿搭组合 | §5.1.3 |
| 训练层级 | 训练 → 组块 → 组 → 动作 | §5.3.1 |
| 训练录入 | 全部按组录 | §5.3.4 |
| 计数辅助 | 可选逐次计数，默认关闭 | §5.3.4 |
| 组间歇 | 自动启动，双层时长配置，原生通知 | §5.3.5 |
| 感受记录 | RPE + 标签 + 一句话 | §5.3.4 |
| 训练组织 | 模板驱动 + 空白兜底 | §5.3.3 |
| AI 触发 | 手动点"生成分析" | §5.5.3 |
| 动作库 | 完全空库自建 | §5.3.2 |
| 食物库 | 完全空库自建 | §5.2.2、R2 |
| 饮食结构 | 流水式，时间戳自动归集餐次 | §5.2.1 |
| 统计口径 | 摄入与运动分开，不做加减 | §5.4.1 |
| 身体指标 | 体重 + 围度 + 体脂，BMR 自动算 | §5.4.5 |
| 通知 | 仅组间歇 | §5.3.5、§6.2 settings |
| 补货预测 | 首页卡片展示，不发通知 | §5.4.4 |
| 导出 | JSON 全量 + CSV 分表 | §5.6.2 |
| 备份 | 四层（L1 内部快照 / L1b SAF 外置镜像 / L2 手动导出 / L3 提醒） | §5.6.1、R1 |
| 摄像头 | P2，规则式计次，仅留接口 | §5.3.6 |
| OCR 范围 | 仅营养成分表，不做配料/条码/日期 | §5.2.4 |
| OCR 引擎 | ML Kit 中文 bundled 版，离线不依赖 GMS | §3.2、A6 |
| OCR 实现 | 社区插件（已核验支持 Cap 8）优先，体积超限时 patch 掉非中文模型或自写 Kotlin 插件 | O6、O7、R10 |
| OCR 阶段 | 并入 M2 饮食域 | §10 |
| OCR 落库规则 | 预填 + 人工确认，不自动保存 | OCR-1~OCR-5 |
| 能量换算 | kJ ÷ 4.184 得 kcal，换算过程必须可视化 | §7.7 ⑤ |
| APK 体积 | ≤60MB（目标 ≤50MB），仅 arm64-v8a；由 35MB 上调的原因见 A6 | §8、A6 |
| **网络传输** | **CapacitorHttp（原生 OkHttp），不用 WebView fetch** | A8、§7.8、R13 |
| **AI 流式** | **不做流式**，非流式 + 可取消等待态 | §5.5.1、NET-2 |
| **精确闹钟** | manifest 声明 `USE_EXACT_ALARM`，不走运行时申请流 | A9、R14 |
| **兼容下限** | **Android 8.0（API 26）**，由 API 24 上调；Tailwind v4 需 Chrome 111+ | A10、§8、R15 |
| **训练模板** | 三张表（templates / blocks / exercises）与训练实例同构，实例化为复制 | §6.2 |
| **库存冲销** | 先冲销再重写，同一事务；冲销不改 kind，不新增流水类型 | §7.3.1 |
| **软删除导入** | 软删除行参与合并，不得在导入后复活 | §5.6.2 |
