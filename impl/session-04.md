# 会话 4：Phase 02c Services 上半部分 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 02 的第三部分：Service 层上半部分（4 个核心 service 文件）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 严格按照 spec 中的函数签名和云函数参数实现，不要自行修改参数名或结构。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定，特别注意 Service 调用模式）
2. `specs/02-foundation.md`（只需关注实现要求 8 中的 user.service.ts、product.service.ts、cart.service.ts、order.service.ts）

## 前置依赖

Sessions 01-03 已完成：types/、constants/、services/cloud.ts、utils/ 已就绪。

## 本次任务

1. 创建 `src/services/user.service.ts`（7 个函数）
   - login、checkLogin、loginEasy、register、getUserInfo、updateUser、bindPhone
   - 对应云函数：login、login-easy、sign_up、getUserInfo、manage-user、bindPhoneNumber

2. 创建 `src/services/product.service.ts`（10 个函数）
   - getProductDetail、getProductsBySubSeries、getProductsByCategory、getProductsByMaterial、getProductsByFilter、getModelShowData、listSubSeries、listCategories、listMaterials、getRecommendations
   - 对应云函数：get-product、manage-subseries、manage-category、manage-material、manage-recommendations

3. 创建 `src/services/cart.service.ts`（6 个函数）
   - addToCart、getCartItems、toggleItemSelected、toggleAllSelected、removeCartItem、updateCartItemQty
   - 对应云函数：manage-cart

4. 创建 `src/services/order.service.ts`（9 个函数）
   - createOrderFromCart、createDirectOrder、updateOrderStatus、cancelOrder、confirmReceipt、applyRefund、queryRefundStatus、getOrderDetail、getUserOrders
   - 对应云函数：manage-order-easy

## 产出

- 4 个 service 文件

## 要求

- 每个函数使用 `callCloudFunction` 封装（从 `@/services/cloud` 导入）
- 参数和返回值均有 TypeScript 类型（从 `@/types/` 导入）
- 每个函数的云函数名、action、参数结构严格按照 spec 表格
- 遵循 CONVENTIONS.md 中的 Service 调用模式
- 完成后运行 `npm run build:weapp` 确认编译通过

---
