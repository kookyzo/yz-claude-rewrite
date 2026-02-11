# 会话 6：Phase 03a Zustand Stores — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 03 的第一部分：Zustand 状态管理。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认（Zustand、Taro 等），绝对不要凭经验猜测。
2. 小程序环境无 localStorage，Zustand 持久化必须使用 Taro 存储 API 适配器。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定，特别注意「Zustand 持久化」章节）
2. `specs/03-stores-and-hooks.md`（只需关注实现要求 1-3：useUserStore、useCartStore、useAppStore）

## 前置依赖

Sessions 01-05 已完成：types/、services/、utils/、constants/ 全部就绪。

## 本次任务

1. 创建 `src/stores/useUserStore.ts`
   - 状态：isLoggedIn、isRegistered、userId、openId、userInfo
   - 方法：login、checkLogin、fetchUserInfo、logout
   - 持久化：使用 `persist` 中间件 + Taro 存储适配器，`partialize` 只持久化 isLoggedIn、userId、openId
   - 调用 `@/services/user.service` 中的函数

2. 创建 `src/stores/useCartStore.ts`
   - 状态：items、loading
   - 派生值：totalPrice、selectedCount、isAllChecked（在每次 set 时同步计算）
   - 方法：fetchCart、toggleItem、toggleAll、updateQuantity、removeItem
   - 乐观更新模式：toggleItem/toggleAll/updateQuantity 先更新 UI，失败回滚
   - 不需要持久化（每次从云端加载）
   - 调用 `@/services/cart.service` 中的函数

3. 创建 `src/stores/useAppStore.ts`
   - 状态：systemInfo、currentTab、privacyAgreed
   - 方法：setCurrentTab、initSystemInfo、agreePrivacy
   - 持久化：只持久化 privacyAgreed 字段
   - initSystemInfo 使用 `Taro.getSystemInfoSync()` + `Taro.getMenuButtonBoundingClientRect()`
   - navBarHeight 计算：`(menuButtonRect.top - statusBarHeight) * 2 + menuButtonRect.height`

## 产出

- 3 个 Zustand store 文件

## 要求

- 持久化适配器严格按照 CONVENTIONS.md 中的 taroStorage 模式实现
- useCartStore 的乐观更新三步模式：① 立即更新 UI → ② 后台同步服务器 → ③ 失败回滚并提示
- useCartStore 的 totalPrice 计算：`items.filter(checked).reduce((sum, item) => sum + price * quantity, 0)`
- Zustand 不原生支持 getter，推荐在每次 `set()` 时同步计算派生值存入 state
- 完成后运行 `npm run build:weapp` 确认编译通过

---
