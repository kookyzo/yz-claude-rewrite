# 会话 2：Phase 02a 类型定义 + 基础调用器 + 常量 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 02 的第一部分：TypeScript 类型定义、云函数基础调用器、常量文件。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 严格按照 spec 中的类型定义实现，不要自行添加或删减字段。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/02-foundation.md`（完整读取，本次任务的 spec）

只需关注 spec 中以下章节：
- 实现要求 1-7（types/api.ts、product.ts、cart.ts、order.ts、user.ts、reservation.ts）
- 实现要求 7（services/cloud.ts）
- 实现要求 13（constants/index.ts）

## 前置依赖

Phase 01 已完成：项目骨架就绪，Vite + NutUI + Zustand 已安装，目录结构已创建。

## 本次任务

1. 创建 `src/types/api.ts` — CloudResponse<T>、Pagination、PaginatedData<T>
2. 创建 `src/types/product.ts` — Spu、Sku、Material、SubSeries、Category、ProductSize
3. 创建 `src/types/cart.ts` — CartItem
4. 创建 `src/types/order.ts` — OrderStatus、OrderItem、Order
5. 创建 `src/types/user.ts` — User、Address
6. 创建 `src/types/reservation.ts` — Reservation
7. 创建 `src/services/cloud.ts` — callCloudFunction 基础调用器
8. 创建 `src/constants/index.ts` — CLOUD_ENV_ID、APP_ID、CONSULTATION_PHONE 等常量

## 产出

- 6 个类型定义文件（types/）
- 1 个云函数基础调用器（services/cloud.ts）
- 1 个常量文件（constants/index.ts）

## 要求

- 遵循 CONVENTIONS.md 中的命名规范（接口 PascalCase、常量 UPPER_SNAKE_CASE）
- 类型定义严格按照 spec，不多不少
- cloud.ts 永远返回 CloudResponse，不抛异常（与旧项目 callCF 行为一致）
- 使用 `@/` 路径别名进行跨目录导入
- 完成后运行 `npm run build:weapp` 确认编译通过

---
