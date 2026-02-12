# 会话 14：Phase 05c 购物车页 cart — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 05 的第三部分：购物车页（cart）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用时业务参数必须包在 `data` 字段下（`{ action, data: { ... } }`），不要平铺在顶层。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定，特别注意 Service 调用模式和已知配置要点）
2. `specs/05-tab-pages.md`（关注「旧代码摘要 → 3. 购物车页」部分）

## 参考旧代码（必读，1:1 还原 UI）

开始编码前，必须先完整阅读以下旧代码，理解页面结构、布局、间距、颜色等视觉要素：
- `legacy_ro/yz-legacy-code/pages/Shopping_Cart/Shopping_Cart.wxml`（页面结构，优先读）
- `legacy_ro/yz-legacy-code/pages/Shopping_Cart/Shopping_Cart.wxss`（样式细节，优先读）
- `legacy_ro/yz-legacy-code/pages/Shopping_Cart/Shopping_Cart.js`（交互逻辑和数据流）

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-13 已完成：所有基础设施 + 共享组件 + 首页 + 分类页就绪。

购物车页的核心状态管理已在 Session 06 中实现（`src/stores/useCartStore.ts`），页面组件不直接调用云函数，所有读写操作通过 store 方法完成。

### 已有的关键基础设施（必须先读取理解）

- `src/stores/useCartStore.ts` — 购物车状态管理（fetchCart、toggleItem、toggleAll、updateQuantity、removeItem），内部实现乐观更新三步模式
- `src/services/cart.service.ts` — 购物车云函数封装（addToCart、getCartItems、toggleItemSelected、toggleAllSelected、removeCartItem、updateCartItemQty）
- `src/types/cart.ts` — CartItem 类型定义（_cartItemId、skuId、spuId、quantity、checked、name、nameEN、price、image、material、size）
- `src/hooks/useAuth.ts` — 登录/注册状态检查（ensureLogin、ensureRegistered）
- `src/hooks/useImageProcessor.ts` — 图片批量转换（processImages）

## 本次任务

改写 `src/pages/cart/index.tsx` + `index.config.ts` + `index.module.scss`（当前为占位文件）

### 核心功能点

1. **登录检查**
   - `useDidShow` 中先调用 `useAuth.ensureLogin()` 确保已登录
   - 未登录时不加载购物车数据

2. **购物车数据加载**
   - 通过 `useCartStore.fetchCart()` 从云端加载
   - fetchCart 内部完成数据归一化（字段映射）和图片 URL 转换
   - 每次 `onShow` 都刷新，确保数据最新

3. **三种视图状态**
   - **加载中**：居中 loading 动画（使用 LoadingBar）
   - **空购物车**：空购物车图标 + 提示文字"购物车是空的" + "去逛逛"按钮（switchTab 到分类页）
   - **非空购物车**：商品列表 + 底部结算栏

4. **商品列表项**
   - 左侧：勾选框（checkbox），点击调用 `toggleItem(cartItemId, !checked)`
   - 中间：商品图片（点击跳转商品详情）
   - 右侧信息区：
     - 商品名称（中文 name）
     - 英文名（nameEN）
     - 材质 material + 尺码 size
     - 数量控制（- / 数量 / +），调用 `updateQuantity(cartItemId, newQty)`，最小值为 1
     - 单价显示（formatPrice）
   - 删除：滑动删除或删除按钮，删除前弹出 `Taro.showModal` 确认对话框，确认后调用 `removeItem(cartItemId)`

5. **底部结算栏（fixed 定位）**
   - 全选框 + "全选"文字，点击调用 `toggleAll(!isAllChecked)`
   - 合计金额：`¥{formatPrice(totalPrice)}`
   - "结算"按钮：检查 `selectedCount > 0`，否则 `Taro.showToast({ title: '请选择商品', icon: 'none' })`；通过则 `navigateTo('/pages/payment/payment')`

6. **浮动咨询** — FloatBtn + FloatPopup

7. **图片处理** — 商品图片通过 useImageProcessor 批量转换 cloud:// URL

### 数据流

```
useDidShow
  → ensureLogin()
  → fetchCart()（store 方法，内部调 cart.service.getCartItems）
  → store 更新 items / totalPrice / selectedCount / isAllChecked
  → 页面通过 useCartStore() 订阅自动 re-render
```

所有写操作（toggleItem / toggleAll / updateQuantity / removeItem）均由 store 内部执行乐观更新：
1. 立即更新 UI（修改 items 数组 + 重算 derived 值）
2. 后台调用云函数同步
3. 失败时回滚到旧值 + Toast 提示

### UI 结构

```
TopBar（白色背景）
├── LoadingBar（loading === true 时显示）
├── 空购物车视图（items.length === 0 && !loading）
│   ├── 空购物车图标
│   ├── 提示文字"购物车是空的"
│   └── "去逛逛"按钮（switchTab 到 /pages/category/index）
├── 非空购物车视图（items.length > 0）
│   ├── 商品列表（ScrollView 纵向滚动，底部留出结算栏高度）
│   │   └── 每个商品项
│   │       ├── 左侧：勾选框
│   │       ├── 中间：商品图片（点击跳转详情）
│   │       └── 右侧信息区
│   │           ├── 商品名称（中文 + 英文）
│   │           ├── 材质 + 尺码
│   │           ├── 数量控制（- / 数量 / +）
│   │           ├── 单价
│   │           └── 删除按钮
│   └── 底部结算栏（fixed）
│       ├── 全选框 + "全选"
│       ├── 合计：¥{totalPrice}
│       └── "结算"按钮
├── FloatBtn（浮动咨询按钮）
└── FloatPopup（在线咨询弹窗）
```

### 商品详情跳转路径

- 优先使用 `skuId`：`navigateTo('/pages/product-detail/index?skuId=${item.skuId}')`
- 若无 `skuId` 则使用 `spuId`：`navigateTo('/pages/product-detail/index?spuId=${item.spuId}')`

## 产出

- 购物车页 3 个文件（index.tsx + index.config.ts + index.module.scss）

## 要求

- 所有购物车状态读写通过 `useCartStore`，页面组件不直接调用 `cart.service`
- 使用已有的 hooks：useAuth、useImageProcessor、useSystemInfo
- 使用已有的组件：TopBar、FloatBtn、FloatPopup、LoadingBar
- 使用已有的 utils：formatPrice（from `@/utils/format`）、navigateTo / switchTab（from `@/utils/navigation`）
- `useDidShow` 中设置 `useAppStore.getState().setCurrentTab(2)`
- 页面配置改为 `navigationStyle: 'custom'`（当前 index.config.ts 用的是默认导航栏标题，需要改成自定义导航栏以配合 TopBar 组件）
- 样式使用 rpx 单位
- 底部结算栏需要考虑安全区域（safe-area-inset-bottom）
- 完成后运行 `npm run build:weapp` 确认编译通过

---
