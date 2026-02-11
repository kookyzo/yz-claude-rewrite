# Phase 03: Zustand Stores 与自定义 Hooks

## 目标

实现全局状态管理（Zustand Stores）和可复用的自定义 Hooks，为页面和组件提供用户认证、购物车、系统信息、导航栏滚动、图片处理、分页等核心能力。

## 前置依赖

- Phase 02 完成（`types/`、`services/`、`utils/`、`constants/` 已就绪）

## 旧代码摘要

### 1. globalData 与登录流程（`app.js`）

旧项目 `app.js` 结构简单：
- `globalData` 仅包含 `userInfo: null`
- `onLaunch` 中初始化云开发环境（`cloud1-9glm8muj52815539`），调用 `wx.login()` 但未实际处理返回
- 用户 ID 获取散落在各页面中，通过 `getUserInfo` 云函数获取 `userInfo.data._id` 作为 `_userId`
- 登录状态无集中管理，各页面自行调用云函数判断

### 2. 购物车状态管理（`Shopping_Cart.js`）

**数据结构：**
- `items: CartItem[]` — 购物车商品列表，每项包含 `_cartItemId`、`name`、`foreign_name`、`price`、`quantity`、`checked`、`image`、`material`、`size`、`formattedSubtotal`
- `is_empty_cart`、`isAllChecked`、`total_price`、`loading`、`showTabBarLoading`

**核心逻辑 — 乐观更新模式：**

所有写操作（勾选、全选、增减数量）均采用三步乐观更新：
1. **立即更新 UI**：修改本地 `items` 数组，重新计算 `isAllChecked` 和 `total_price`，调用 `setData` 刷新界面
2. **后台同步服务器**：调用对应云函数（`manage-cart` 的 `selected`/`selectedAll`/`update` action）
3. **失败时回滚**：若云函数返回非 200 或抛异常，恢复为旧值并提示用户

**价格计算（`recalcTotal`）：**
```
total = items.filter(checked).reduce((sum, item) => sum + price * quantity, 0)
```

**数据归一化（`refreshCartFromCloud`）：**
云函数返回的 `items` 需要归一化字段映射：
- `name` ← `skuInfo.nameCN` || `spuInfo.name`
- `price` ← `unitPrice` || `skuInfo.price` || `spuInfo.referencePrice`
- `checked` ← `status`（布尔值）
- `image` ← `skuInfo.skuMainImages[0]` || `spuInfo.mainImages[0]`
- `material` ← `materialInfo.nameCN`
- `size` ← `sizeInfo.value`

### 3. 滚动变色逻辑（`home.js`）

首页导航栏随页面滚动从黑色渐变为白色：
- `critical_scroll_top = 400`（滚动临界值，到达此值时完全变白）
- `opacity = Math.min(scrollTop / critical_scroll_top, 1)`
- RGB 值：`r = g = b = Math.floor(255 * opacity)`（从 `#000000` 到 `#FFFFFF`）
- 文字颜色：`opacity > 0.5` 时切换为黑色 `#000000`，否则白色 `#ffffff`
- 通过 `wx.setNavigationBarColor()` 动态设置

### 4. 图片处理逻辑（`Category.js`）

**cloud:// URL 转换：**
- 收集所有 `cloud://` 开头的 URL
- 按 50 个一批分组（`batchSize = 50`）
- 最多 3 个批次并行处理（`maxConcurrent = 3`）
- 调用 `wx.cloud.getTempFileURL({ fileList: batch })` 转换
- 将转换结果映射回原数据

**图片压缩（`compressImage`）：**
- 仅处理 `http://` 或 `https://` 开头的 URL
- 跳过已包含 `imageView2` 或 `imageMogr2` 的 URL
- 拼接腾讯云 COS 参数：`?imageView2/1/w/{width}/h/{height}/q/{quality}`
- 默认参数：`width=300, height=300, quality=50`

## 产出文件清单

```
src/
├── stores/
│   ├── useUserStore.ts
│   ├── useCartStore.ts
│   └── useAppStore.ts
└── hooks/
    ├── useAuth.ts
    ├── useSystemInfo.ts
    ├── useImageProcessor.ts
    ├── useNavBarScroll.ts
    └── usePagination.ts
```

## 实现要求

### 1. `src/stores/useUserStore.ts` — 用户状态

> **重要**：小程序环境无 `localStorage`，所有需要持久化的 Store 必须使用 Zustand `persist` 中间件 + Taro 存储 API 适配器。参见 CONVENTIONS.md 中的 Zustand 持久化模式。

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import Taro from '@tarojs/taro'
import type { User } from '../types/user'

const taroStorage = {
  getItem: (name: string) => Taro.getStorageSync(name) || null,
  setItem: (name: string, value: string) => Taro.setStorageSync(name, value),
  removeItem: (name: string) => Taro.removeStorageSync(name),
}

interface UserState {
  /** 是否已登录（login 云函数调用成功） */
  isLoggedIn: boolean
  /** 是否已注册（getUserInfo 返回 200） */
  isRegistered: boolean
  /** 用户 ID（user_YYMM_XXXXXXXX 格式） */
  userId: string | null
  /** 微信 OpenID */
  openId: string | null
  /** 完整用户信息 */
  userInfo: User | null

  /** 调用 login 云函数，获取 openId 和 userId */
  login: () => Promise<void>
  /** 调用 login-easy checkLogin，检查登录状态 */
  checkLogin: () => Promise<boolean>
  /** 调用 getUserInfo，更新 userInfo 和 isRegistered */
  fetchUserInfo: () => Promise<void>
  /** 清除所有用户状态 */
  logout: () => void
}
```

**实现要点：**
- `login()` 调用 `userService.login()`，成功后设置 `isLoggedIn = true`，存储 `userId` 和 `openId`
- `checkLogin()` 调用 `userService.checkLogin()`，返回 `code === 200` 表示已登录
- `fetchUserInfo()` 调用 `userService.getUserInfo()`，若 `code === 200` 设置 `isRegistered = true` 并存储 `userInfo`；若 `code === 404` 设置 `isRegistered = false`
- `logout()` 重置所有字段为初始值
- 使用 `persist` 中间件 + `taroStorage` 适配器持久化 `isLoggedIn`、`userId`、`openId` 字段（通过 `partialize` 选项只持久化必要字段）

### 2. `src/stores/useCartStore.ts` — 购物车状态

```typescript
import { create } from 'zustand'
import type { CartItem } from '../types/cart'

interface CartState {
  /** 购物车商品列表 */
  items: CartItem[]
  /** 加载状态 */
  loading: boolean

  /** 已选商品总价（派生计算） */
  readonly totalPrice: number
  /** 已选商品数量（派生计算） */
  readonly selectedCount: number
  /** 是否全选（派生计算） */
  readonly isAllChecked: boolean

  /** 从云端加载购物车列表 */
  fetchCart: () => Promise<void>
  /** 乐观更新：切换单个商品选中状态 */
  toggleItem: (cartItemId: string, checked: boolean) => Promise<void>
  /** 乐观更新：切换全选状态 */
  toggleAll: (checked: boolean) => Promise<void>
  /** 乐观更新：更新商品数量 */
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>
  /** 删除商品（非乐观，等待服务器确认后刷新） */
  removeItem: (cartItemId: string) => Promise<void>
}
```

**派生值计算（使用 getter 或在每次 items 变更后重新计算）：**

```typescript
// totalPrice
get totalPrice() {
  return this.items
    .filter(item => item.checked)
    .reduce((sum, item) => sum + item.price * item.quantity, 0)
}

// selectedCount
get selectedCount() {
  return this.items.filter(item => item.checked).length
}

// isAllChecked
get isAllChecked() {
  return this.items.length > 0 && this.items.every(item => item.checked)
}
```

> **注意**：Zustand 不原生支持 getter。推荐方案：在 store 外部定义 selector 函数，或在每次 `set()` 时同步计算 `totalPrice`、`selectedCount`、`isAllChecked` 并存入 state。

**乐观更新模式（以 `toggleItem` 为例）：**

```typescript
toggleItem: async (cartItemId, checked) => {
  const { items } = get()
  const oldItems = [...items]

  // 1. 乐观更新 UI
  set({
    items: items.map(item =>
      item._cartItemId === cartItemId ? { ...item, checked } : item
    ),
  })

  // 2. 后台同步
  const res = await cartService.toggleItemSelected(cartItemId, checked)

  // 3. 失败回滚
  if (res.code !== 200) {
    set({ items: oldItems })
    Taro.showToast({ title: res.message || '操作失败', icon: 'none' })
  }
}
```

`toggleAll` 和 `updateQuantity` 遵循相同的三步模式。`removeItem` 不做乐观更新，等待服务器确认后调用 `fetchCart()` 刷新。

### 3. `src/stores/useAppStore.ts` — 全局应用状态

> **持久化**：`privacyAgreed` 字段需要持久化（使用 `persist` + `taroStorage`，`partialize` 只持久化 `privacyAgreed`）。`systemInfo` 和 `currentTab` 不需要持久化。

```typescript
import { create } from 'zustand'

interface SystemInfo {
  /** 状态栏高度 (px) */
  statusBarHeight: number
  /** 胶囊按钮信息 */
  menuButtonRect: {
    top: number
    bottom: number
    left: number
    right: number
    width: number
    height: number
  }
  /** 导航栏高度 = (menuButton.top - statusBarHeight) * 2 + menuButton.height */
  navBarHeight: number
  /** 屏幕宽度 (px) */
  screenWidth: number
  /** 屏幕高度 (px) */
  screenHeight: number
  /** 安全区域 */
  safeArea: {
    top: number
    bottom: number
    left: number
    right: number
    width: number
    height: number
  }
  /** 设备像素比 */
  pixelRatio: number
  /** 平台 */
  platform: string
}

interface AppState {
  /** 系统信息（状态栏高度、胶囊按钮位置等） */
  systemInfo: SystemInfo | null
  /** 当前 TabBar 选中索引 */
  currentTab: number
  /** 隐私协议是否已同意 */
  privacyAgreed: boolean

  /** 更新 TabBar 选中状态 */
  setCurrentTab: (index: number) => void
  /** 获取并缓存系统信息 */
  initSystemInfo: () => void
  /** 标记隐私协议已同意 */
  agreePrivacy: () => void
}
```

**实现要点：**
- `initSystemInfo()` 使用 `Taro.getSystemInfoSync()` 获取系统信息，使用 `Taro.getMenuButtonBoundingClientRect()` 获取胶囊按钮位置
- 导航栏高度计算公式：`navBarHeight = (menuButtonRect.top - statusBarHeight) * 2 + menuButtonRect.height`
- 该方法应在 `app.ts` 的 `onLaunch` 中调用一次，后续通过 store 读取缓存值
- `setCurrentTab()` 供 CustomTabBar 组件调用
- `agreePrivacy()` 设置 `privacyAgreed = true`

### 4. `src/hooks/useAuth.ts` — 登录检查

```typescript
interface UseAuthReturn {
  /** 是否已登录 */
  isLoggedIn: boolean
  /** 是否已注册 */
  isRegistered: boolean
  /** 用户 ID */
  userId: string | null
  /** 完整用户信息 */
  userInfo: User | null
  /** 确保已登录，未登录则自动触发登录流程 */
  ensureLogin: () => Promise<boolean>
  /** 确保已注册，未注册则跳转注册页 */
  ensureRegistered: () => Promise<boolean>
}

export function useAuth(): UseAuthReturn
```

**实现要点：**
- 从 `useUserStore` 读取状态
- `ensureLogin()` 检查 `isLoggedIn`，若未登录则调用 `useUserStore.login()`，返回是否成功
- `ensureRegistered()` 检查 `isRegistered`，若未注册则调用 `Taro.navigateTo({ url: '/pages-sub/register/index' })`，返回 `false`

### 5. `src/hooks/useSystemInfo.ts` — 系统信息

```typescript
interface UseSystemInfoReturn {
  /** 状态栏高度 (px) */
  statusBarHeight: number
  /** 导航栏高度 (px) */
  navBarHeight: number
  /** 胶囊按钮位置信息 */
  menuButtonRect: {
    top: number
    bottom: number
    left: number
    right: number
    width: number
    height: number
  }
  /** 屏幕宽度 (px) */
  screenWidth: number
  /** 安全区域底部 (px) */
  safeAreaBottom: number
}

export function useSystemInfo(): UseSystemInfoReturn
```

**实现要点：**
- 从 `useAppStore` 读取 `systemInfo`
- 若 `systemInfo` 为 `null`（尚未初始化），返回安全默认值（`statusBarHeight: 20`、`navBarHeight: 44` 等）
- 该 Hook 是纯读取，不触发任何副作用

### 6. `src/hooks/useImageProcessor.ts` — 图片批量处理

```typescript
interface UseImageProcessorReturn {
  /** 批量转换 cloud:// URLs 为 HTTP URLs 并压缩 */
  processImages: (
    cloudUrls: string[],
    options?: { width?: number; height?: number; quality?: number }
  ) => Promise<string[]>
  /** 处理中状态 */
  processing: boolean
}

export function useImageProcessor(): UseImageProcessorReturn
```

**实现要点：**
- 内部使用 `useRef` 跟踪 `processing` 状态，避免组件卸载后 setState
- `processImages` 流程：
  1. 过滤出 `cloud://` 开头的 URL，记录其索引
  2. 调用 `batchConvertUrls(cloudUrls, 50, 3)` 批量转换为 HTTP URL
  3. 对转换后的 HTTP URL 调用 `compressImageUrl(url, width, height, quality)` 拼接压缩参数
  4. 将结果按原索引映射回完整数组
- 默认压缩参数：`width=300, height=300, quality=50`（与旧代码一致）
- 已经是 HTTP URL 的直接拼接压缩参数，不需要转换
- 已包含 `imageView2` 或 `imageMogr2` 的 URL 跳过压缩

### 7. `src/hooks/useNavBarScroll.ts` — 导航栏滚动变色

```typescript
interface UseNavBarScrollOptions {
  /** 滚动临界值（到达此值时完全变为目标色），默认 400 */
  criticalScrollTop?: number
  /** 起始颜色，默认 '#000000'（黑色） */
  fromColor?: string
  /** 目标颜色，默认 '#ffffff'（白色） */
  toColor?: string
}

interface UseNavBarScrollReturn {
  /** 当前背景色（hex 格式） */
  backgroundColor: string
  /** 当前文字颜色（'#000000' 或 '#ffffff'） */
  textColor: string
  /** 当前透明度 (0-1) */
  opacity: number
}

export function useNavBarScroll(
  options?: UseNavBarScrollOptions
): UseNavBarScrollReturn
```

**实现要点：**
- 内部调用 Taro 的 `usePageScroll` Hook 监听页面滚动（从 `@tarojs/taro` 导入）
- 滚动变色算法（从旧代码 `home.js` 提取）：

```typescript
// 在 usePageScroll 回调中：
const opacity = Math.min(scrollTop / criticalScrollTop, 1)

// RGB 线性插值（默认从黑到白）
const r = Math.floor(255 * opacity)
const g = Math.floor(255 * opacity)
const b = Math.floor(255 * opacity)

// 转 hex
const backgroundColor = '#' + [r, g, b]
  .map(x => Math.round(x).toString(16).padStart(2, '0'))
  .join('')

// 文字颜色：背景亮度超过 50% 时切换为黑色
const textColor = opacity > 0.5 ? '#000000' : '#ffffff'
```

- 使用 `useState` 存储 `backgroundColor`、`textColor`、`opacity`
- **重要**：`usePageScroll` 是 Taro 专有 Hook，只能在页面级组件中使用，不能在普通组件中使用。因此该 Hook 应在页面组件中调用，将返回值传递给 TopBar 组件

### 8. `src/hooks/usePagination.ts` — 分页逻辑

```typescript
interface UsePaginationOptions<T> {
  /** 数据获取函数，接收 page 和 pageSize，返回 { items, hasMore } */
  fetchFn: (page: number, pageSize: number) => Promise<{
    items: T[]
    hasMore: boolean
  }>
  /** 每页条数，默认 200（与旧代码 DEFAULT_PAGE_SIZE 一致） */
  pageSize?: number
}

interface UsePaginationReturn<T> {
  /** 当前已加载的所有数据 */
  data: T[]
  /** 是否正在加载 */
  loading: boolean
  /** 是否还有更多数据 */
  hasMore: boolean
  /** 当前页码 */
  page: number
  /** 加载第一页（重置） */
  refresh: () => Promise<void>
  /** 加载下一页（追加） */
  loadMore: () => Promise<void>
}

export function usePagination<T>(
  options: UsePaginationOptions<T>
): UsePaginationReturn<T>
```

**实现要点：**
- `refresh()` 重置 `page = 1`，清空 `data`，调用 `fetchFn(1, pageSize)`
- `loadMore()` 仅在 `hasMore && !loading` 时执行，`page + 1` 后调用 `fetchFn`，将新数据追加到 `data`
- 使用 `useRef` 防止并发请求（loading 锁）
- 组件卸载时通过 `useRef` 标记取消后续 setState

## 验收标准

1. 所有 Store 和 Hook 文件无 TypeScript 编译错误
2. `useUserStore` 的 `login()` 能调用 `userService.login()` 并正确更新 `isLoggedIn`、`userId`、`openId`
3. `useCartStore` 的乐观更新模式正确实现：UI 立即响应，失败时回滚并提示
4. `useCartStore` 的 `totalPrice` 计算结果与旧代码 `recalcTotal` 一致
5. `useAppStore` 的 `initSystemInfo()` 能正确获取 `statusBarHeight`、`menuButtonRect`、`navBarHeight`
6. `useNavBarScroll` 在 `scrollTop = 0` 时返回 `backgroundColor: '#000000'`，在 `scrollTop >= 400` 时返回 `backgroundColor: '#ffffff'`
7. `useImageProcessor` 的 `processImages` 能正确处理混合的 `cloud://` 和 `https://` URL 数组
8. `usePagination` 的 `refresh()` 能重置数据，`loadMore()` 能追加数据
9. 所有文件 `import` 路径正确，无循环依赖
10. Hook 中使用的 Taro API（`usePageScroll`、`getSystemInfoSync`、`getMenuButtonBoundingClientRect`）均从 `@tarojs/taro` 正确导入
