# 后端规则对照

核对日期：2026-09-12。后端仓库 https://cnb.cool/yztx_qxun/SprixServer ，main 提交 `31beb5bacfd515803800dc991cb0e1f1d1ba269a`。这是源码依据，不代表线上部署版本。

## 本次对齐

依据 `backend/src/main/java/ai/sprix/server/task/TaskService.java`：

- `acceptTask`：只有已发布且有剩余名额的任务可接取；扣完最后一个名额自动下线，原因为 `SLOT_FULL`。生成记录和 C 端模拟接单均应用满额下线规则，后台仍能查看历史记录。
- `offlineAdminTask`：仅已发布任务可下线；要求填写原因，状态原因区分 `SLOT_FULL` 与 `OFFLINE`，用户输入保留在操作日志中。
- `republishAdminTask`：仅已下线任务可重新发布；名额为零或原因是 `SLOT_FULL` 时拒绝；重新发布更新发布时间。Mock 页面时间使用北京时间。

## 已核实的资金规则及尚未对齐之处

依据 `funds/FundsService.java`：

- 验收通过、申诉通过都会创建结算，随后入账、创建平台提现单、通过审核并发起支付。当前 Mock 的一执行一结算一支付方向相符。
- 后端按执行 ID 检查已有结算，避免重复生成。
- 后端服务费为任务奖励乘以 0.10，实际入账为奖励减服务费。
- Mock 已按持久化记录口径对齐：奖励先以分表示，服务费 10% 与实际入账 90% 分别四舍五入到分。后端 `AlipayOpenPlatformPayoutClient` 使用 `setScale(2, HALF_UP)`，PostgreSQL numeric(12,2) 同样将正数半分进位。示例 1.05 元：服务费 0.11、实际入账 0.95，两项会比奖励多 0.01；不再用向下取整强行对平。依据 https://www.postgresql.org/docs/current/datatype-numeric.html 。这是源码和存储规则对齐，未进行真实支付验证。
- 结算奖励按创建结算时刻的任务价格历史读取，而非接单时奖励；完成后的后续改价不重算已有结算。结算明细、资金汇总、自动打款使用相同算法。未完成记录继续保留原接单展示价格。
- 旧状态若没有完整改价历史，只能用已有日志恢复；重新按后端精度推导会改变旧生成记录的分位，不影响真实后端记录。
- 后端通过真实支付服务处理状态；Mock 完成即成功只是简化模型，未模拟支付处理中、失败和账户异常。

## 其他明确限制

- 后端校验账号冻结、实人认证、服务协议和当前 Agent，并向设备下发真实任务。Mock API 没有后端身份验证，C 端 UI 的资格检查不等于服务端认证。
- Mock 交付进度、分数、内容仍按规则生成，不会真正触发 Agent 或生成交付文件。
- 基础历史执行按预设时间线生成，没有完整历史上架下架事件，不能保证每次基础执行都重放后端接单校验；本次只对齐满额状态和显式操作守卫。
- 本次不改真实 API、数据库或后端仓库，不引入提现审核或手动支付入口。

验证：`node --test mock/backend-parity.test.mjs mock/consumer-records.test.mjs mock/consumer-availability.test.mjs`。
