# 会话 5：Phase 02d Services 下半部分 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 02 的第四部分：Service 层下半部分（7 个 service 文件）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 严格按照 spec 中的函数签名和云函数参数实现。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定，特别注意 Service 调用模式）
2. `specs/02-foundation.md`（只需关注实现要求 8 中的 address.service.ts、wish.service.ts、reservation.service.ts、payment.service.ts、banner.service.ts、cms.service.ts、image.service.ts）

## 前置依赖

Sessions 01-04 已完成：types/、constants/、services/cloud.ts、utils/、以及 user/product/cart/order service 已就绪。

## 本次任务

1. 创建 `src/services/address.service.ts`（6 个函数）
   - addAddress、editAddress、deleteAddress、listAddresses、setDefaultAddress、getDefaultAddress
   - 对应云函数：manage-address

2. 创建 `src/services/wish.service.ts`（4 个函数）
   - addWish、removeWish、checkWish、listWishes
   - 对应云函数：manage-wish

3. 创建 `src/services/reservation.service.ts`（4 个函数）
   - addReservation、listReservations、getReservation、updateReservation
   - 对应云函数：reservation-easy、reservation-change

4. 创建 `src/services/payment.service.ts`（2 个函数）
   - createPayment、queryPayment
   - 对应云函数：wxpayFunctions

5. 创建 `src/services/banner.service.ts`（1 个函数）
   - listBanners
   - 对应云函数：manage-banner

6. 创建 `src/services/cms.service.ts`
   - 对应云函数：manage-category、manage-material、manage-size、manage-subseries、update-product
   - 参考 SPEC.md 中 Service 映射表的 cms.service.ts 行

7. 创建 `src/services/image.service.ts`（3 个函数，纯前端不调用云函数）
   - processCloudUrl、batchConvertUrls、compressImageUrl
   - 这些是对 `@/utils/image` 中同名函数的重新导出或薄封装，保持 service 层接口一致性

## 产出

- 7 个 service 文件

## 要求

- 每个函数使用 `callCloudFunction` 封装（从 `@/services/cloud` 导入），image.service.ts 除外
- 参数和返回值均有 TypeScript 类型（从 `@/types/` 导入）
- 每个函数的云函数名、action、参数结构严格按照 spec 表格
- image.service.ts 从 `@/utils/image` 导入并重新导出，保持 service 层统一入口
- 完成后运行 `npm run build:weapp` 确认编译通过

---
