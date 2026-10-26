# 目录结构

> 本项目后端代码的组织方式。

---

## 概览

后端位于 `mom/` 目录下，是一个多模块 Maven 工程，代码主要分为：

- `win-framework/`：公共 starter 和基础设施，例如 web、mybatis、security、mq、websocket、tenant、monitoring。
- `win-gateway/`：Spring Cloud Gateway 入口，以及网关专属 filter/handler。
- `win-module-*/`：业务模块。大多数模块会拆分为 `*-api`（共享契约）和 `*-biz`（运行时实现）。
- `sql/`：面向不同数据库厂商的初始化 SQL 脚本。未使用 Flyway 或 Liquibase。

从职责上看，仓库里的模块大致对应：

- `*-api`：对外 DTO、Feign 接口、共享常量、错误码
- `win-framework/win-common`：基础异常、结果封装、公共工具
- `*-biz`：`controller -> service -> dal -> mapper`
- `win-gateway`：统一路由、跨域、鉴权前置

业务逻辑主要放在 `*-biz/src/main/java/.../service`。HTTP 接口放在 `controller` 包。数据访问放在 `dal/dataobject` 和 `dal/mysql`，如有必要可在 `src/main/resources/mapper` 中放置 XML mapper。

---

## 目录布局

```text
mom/
├── pom.xml
├── sql/
│   ├── mysql/
│   ├── postgresql/
│   ├── db2/
│   ├── dm/
│   ├── oracle/
│   └── sqlserver/
├── win-framework/
│   ├── win-common/
│   ├── win-spring-boot-starter-web/
│   ├── win-spring-boot-starter-mybatis/
│   └── ...
├── win-gateway/
└── win-module-iotgw/
    ├── win-module-iotgw-api/
    │   └── src/main/java/com/win/module/iotgw/{api,common,enums,mqtt,websocket}
    └── win-module-iotgw-biz/
        ├── src/main/java/com/win/module/iotgw/
        │   ├── controller/admin/<entity>/vo
        │   ├── service/<entity>
        │   ├── dal/dataobject/<entity>
        │   ├── dal/mysql/<entity>
        │   ├── convert/<entity>
        │   └── ...
        └── src/main/resources/mapper/<entity>
```

---

## 模块组织

新增后端代码时遵循以下放置规则：

- 可复用的框架能力放到 `mom/win-framework/`，不要塞进具体业务模块。
- 跨模块共享契约放到 `*-api`：RPC 接口、DTO、`ApiConstants`、`DictTypeConstants`、`ErrorCodeConstants`、共享枚举。
- 运行时实现放到 `*-biz`：controller、service、DAL、convert、resources，以及 RPC 实现的 `api` 包。
- 如果 `*-biz` 模块注入了另一个模块的 `*-api` Feign 客户端，应把模块本地的 Feign 配置放在 `framework/rpc/config/RpcConfiguration.java`，除非已有共享 starter 自动配置了该客户端。
- 在 `*-biz` 内，保持以实体为单位的标准纵向分层：
  `controller -> vo -> service -> dal/dataobject + dal/mysql -> convert`。
- 只有当基于 wrapper 的 mapper 方法不够用时，才使用 `src/main/resources/mapper/<entity>`。
- 模块之间只能依赖对方 `*-api`；禁止 `controller` 直调 `mapper`，也禁止跨模块绕过 API/Feign 直连对方数据库。

仓库里目前有两种 controller 打包风格：

- 较新的模块使用 `controller/admin/<entity>/...`，例如 IoT Gateway。
- 较老的模块如 DBC 直接使用 `controller/<entity>/...`。

编辑某个模块时，应延续该模块原有风格，不要两种风格混用。

---

## 业务包组织：Request/Job/Record 聚合

win-module-wms-biz 内以「一个业务一个包」为准，同一业务在五层使用相同包名：

```text
com/win/module/wms/
├── controller/<biz>/          # Xxx{Request|Job|Record}{Main,Detail}Controller 平级放置
│   └── vo/request|job|record/ # vo 是唯一按单据类型分子包的位置
├── service/<biz>/             # 接口与实现平级，单据类型只在类名体现
├── dal/dataobject/<biz>/      # DO 平级
├── dal/mysql/<biz>/           # Mapper 接口平级
└── convert/<biz>/
```

resources/mapper 下 XML 目录与 Java 业务包一一对应（多段业务名同理，如 `mapper/unplanned/issue/`）。

规则：

- 单据类型不进包名：`XxxRequestMainService` 与 `XxxJobDetailMapper` 放同一个 `<biz>` 包，类型只体现在类名。
- `<biz>CancelRecord` 归并入 `<biz>` 包（Cancel 类平放，不设独立子包）。
- 多段复合业务名拆子路径：`unplannedissue → unplanned/issue`、`purchasereceipt/standard`。
- 多个子业务的业务名下设子路径：如 `putaway/{standard,product,producthold}`，各自内部再套上述结构。
- 不参与聚合的包保持原位：本身含 Record 等后缀的完整单一业务名（`arrivalRecord`、`materialconsumptionRecord`）；
  非 Request/Job/Record 三段式的业务（`countPlan`、`countCompare`、`deliverPlan`）；
  按状态类型组织的跨业务枚举包（`enums/request`、`enums/job`）。

---

## 包结构调整的验证

`mvn compile 通过`不能作为包结构调整的唯一验收。javac 按 package 声明定位类并输出 class，
package 声明与物理目录不一致时编译照常通过，错误会推迟到运行期才暴露（如 MyBatis 解析 XML 失败）。
结构调整完成后必须逐项校验：

1. **package ↔ 路径全量一致**：遍历所有 `.java`，比对首行 `package` 声明与其相对路径。
2. **Mapper XML namespace ↔ 接口**：每个 XML 的 namespace 转为路径后必须存在对应 `.java`。
3. **无同名目录嵌套**：不得出现 `xxx/xxx` 式嵌套（整目录搬移类操作容易产生 `vo/vo`）。
4. **旧包引用清零**：全仓搜索旧包名的 import / FQCN / 字符串形式引用。
5. **服务启动冒烟**：启动前清理 target（陈旧 target/classes 会残留旧路径资源导致启动失败），
   抽查至少一个迁移业务的接口路由。

在 Git Bash 中执行 Maven 时，`-Dmaven.repo.local=D:\...` 的反斜杠会被转义吞掉，参数退化成相对路径
并在工作目录下生成假仓库；本地仓库参数必须用正斜杠（`D:/...`）。

---

## 命名约定

- Controller：`<Entity>Controller`
- Service：`<Entity>Service`、`<Entity>ServiceImpl`
- Mapper：`<Entity>Mapper`
- Data Object：`<Entity>DO`
- Convert：`<Entity>Convert`
- 请求/响应对象：`<Entity>CreateReqVO`、`<Entity>UpdateReqVO`、`<Entity>PageReqVO`、`<Entity>RespVO`、`<Entity>ExportReqVO`
- 错误码常量：`ErrorCodeConstants`
- 模块信息常量：`ApiConstants`
- 字典常量：`DictTypeConstants`
- 资源目录中的 mapper 文件夹：使用小写实体名，例如 `mapper/assetparamconfig`

不要把 DO、VO、DTO 混在同一个包里。当前仓库的稳定约定是按层分离。

---

## 示例

- `mom/win-module-iotgw/win-module-iotgw-biz/src/main/java/com/win/module/iotgw/controller/admin/assetparamconfig/AssetParamConfigController.java`
- `mom/win-module-iotgw/win-module-iotgw-biz/src/main/java/com/win/module/iotgw/dal/mysql/assetparamconfig/AssetParamConfigMapper.java`
- `mom/win-module-iotgw/win-module-iotgw-biz/src/main/resources/mapper/assetparamconfig/`
- `mom/win-module-dbc/win-module-dbc-biz/src/main/java/com/win/module/dbc/controller/workstation/WorkstationController.java`
- `mom/win-module-dbc/win-module-dbc-biz/src/main/java/com/win/module/dbc/convert/workstation/WorkstationConvert.java`
- `mom/win-module-report/win-module-report-api/src/main/java/com/win/module/report/enums/ErrorCodeConstants.java`
- `mom/win-module-report/win-module-report-biz/src/main/java/com/win/module/report/framework/rpc/config/RpcConfiguration.java`
- `mom/win-framework/win-spring-boot-starter-web/src/main/java/com/win/framework/web/core/handler/GlobalExceptionHandler.java`
