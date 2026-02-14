# 会话 30：Phase 10 性能优化 — 分包预加载、图片懒加载、骨架屏、渲染优化 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 10：性能优化。这是整个重构项目的最后一个 session。所有 31 个页面和 11 个共享组件已全部实现完毕，本次聚焦于性能层面的优化，包括分包预下载、图片懒加载、骨架屏组件、渲染性能优化和生产构建配置。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 修改现有文件前必须先读取该文件，理解当前代码结构后再做最小化改动。
3. 本次任务涉及多个文件的小幅修改，务必逐一确认修改正确后再进入下一个文件。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/10-optimization.md`（**完整阅读**，本次任务的完整 spec）
3. `src/app.config.ts`（当前路由配置，需添加 `preloadRule`）
4. `config/index.ts`（当前构建配置）
5. `config/prod.ts`（当前生产配置，需补充优化项）
6. `src/components/ProductCard/index.tsx`（需添加 `React.memo` 和 `lazyLoad`）

## 前置依赖

Sessions 01-29 已全部完成。所有页面、组件、服务层、状态管理已就绪。

### 当前项目状态

- `app.config.ts` 中 `subPackages` 已正确配置（25 个分包页面），**不需要修改分包配置**
- `config/prod.ts` 当前几乎为空（仅有注释），需要补充生产优化配置
- `config/index.ts` 中 CSS Modules 已启用，类名格式为 `[name]__[local]___[hash:base64:5]`
- `ProductCard` 组件当前未使用 `React.memo`，`Image` 未启用 `lazyLoad`
- 部分页面使用 Zustand 全量解构模式（如 `const { items, loading } = useCartStore()`），需优化为 selector 模式

---

## 任务 A：分包预下载配置

### 修改文件：`src/app.config.ts`

在 `defineAppConfig` 中添加 `preloadRule` 字段（与 `subPackages` 同级）：

```typescript
preloadRule: {
  'pages/home/index': {
    network: 'all',
    packages: ['pages-sub'],
  },
},
```

**注意事项：**
- 仅在首页触发预下载，因为首页是 splash 之后的第一个 TabBar 页面
- 使用 `network: 'all'`（任何网络环境均预下载），分包体积可控
- 不在 splash 页触发，避免与视频播放竞争带宽
- 先用 context7 确认 Taro 4.x 中 `preloadRule` 的配置方式和字段名

---

## 任务 B：骨架屏组件

### 新建文件：`src/components/Skeleton/index.tsx` + `index.module.scss`

#### Props 接口

```typescript
interface SkeletonProps {
  /** 控制是否显示骨架屏 */
  loading: boolean
  /** 真实内容 */
  children: React.ReactNode
  /** 骨架屏布局类型 */
  type?: 'card' | 'list' | 'detail' | 'banner'
  /** 列表类型时的行数，默认 3 */
  rows?: number
}
```

#### 核心逻辑

- `loading === true` → 渲染骨架占位 UI
- `loading === false` → 渲染 `children`

#### 四种布局类型

1. **`banner`**：全宽矩形占位（高度 400rpx）
2. **`card`**：重复 `rows` 次的卡片骨架（大矩形图片 + 两行文字 + 价格行）
3. **`list`**：重复 `rows` 次的列表项骨架（左侧 200rpx 方形图片 + 右侧 3 行文字）
4. **`detail`**：详情页骨架（大图 750rpx + 标题行 + 3 行描述 + 价格行）

#### 关键样式

```scss
@keyframes skeletonPulse {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}

.skeletonBlock {
  background: #f0f0f0;
  border-radius: 8rpx;
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

.imageBlock {
  width: 100%;
  height: 400rpx;
  margin-bottom: 20rpx;
}

.textBlock {
  height: 28rpx;
  margin-bottom: 16rpx;
}

.textShort { width: 40%; }
.textMedium { width: 70%; }
.textLong { width: 100%; }

.listItem {
  display: flex;
  padding: 30rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.listImage {
  width: 200rpx;
  height: 200rpx;
  flex-shrink: 0;
  margin-right: 20rpx;
}
```

---

## 任务 C：图片懒加载

### 修改文件：`src/components/ProductCard/index.tsx`

1. 给 `Image` 组件添加 `lazyLoad` 属性
2. 用 `React.memo` 包裹整个组件

修改后的结构：

```tsx
import React from 'react'
// ... 其余 import 不变

interface ProductCardProps { /* 不变 */ }

const ProductCard: React.FC<ProductCardProps> = React.memo(function ProductCard({
  skuId, image, name, nameEN, productId, price, onAddToCart, onPress,
}) {
  // ... 逻辑不变

  return (
    <View className={styles.card}>
      <View className={styles.imageArea} onClick={handlePress}>
        <Image className={styles.image} src={image} mode='aspectFill' lazyLoad />
      </View>
      {/* ... 其余 JSX 不变 */}
    </View>
  )
})

export default ProductCard
```

### 修改以下页面中的 Image 组件，添加 `lazyLoad` 属性

逐一读取以下文件，找到列表/ScrollView 中的 `<Image>` 标签，添加 `lazyLoad`：

| 文件 | 场景 |
|------|------|
| `src/pages/home/index.tsx` | 商品推荐列表中的图片 |
| `src/pages/category/index.tsx` | 分类商品网格中的图片 |
| `src/pages-sub/wishlist/index.tsx` | 收藏商品列表中的图片 |
| `src/pages-sub/series-detail/index.tsx` | 系列商品列表中的图片 |
| `src/pages-sub/order-list/index.tsx` | 订单商品缩略图 |

**注意：**
- 先用 context7 确认 Taro `Image` 组件的 `lazyLoad` 属性用法
- `lazyLoad` 仅在 `Page` 或 `ScrollView` 内的 `Image` 上生效
- 轮播图（Swiper 内的 Image）不需要 lazyLoad，因为轮播图需要立即加载
- 只修改列表/ScrollView 场景中的 Image，不要改动非列表场景的 Image

---

## 任务 D：骨架屏集成

在以下页面中集成 `Skeleton` 组件，包裹异步加载的内容区域。

**修改前必须先读取每个页面文件**，理解其当前的 loading 状态变量和数据加载流程。

| 页面 | 骨架类型 | 包裹范围 |
|------|----------|----------|
| `src/pages/home/index.tsx` | `banner` + `card` | 轮播图区域用 `banner`，商品列表区域用 `card` |
| `src/pages/category/index.tsx` | `list` | 分类商品列表区域 |
| `src/pages/cart/index.tsx` | `list` | 购物车商品列表区域 |
| `src/pages/product-detail/index.tsx` | `detail` | 商品详情主体区域 |
| `src/pages-sub/wishlist/index.tsx` | `list` | 收藏列表区域 |
| `src/pages-sub/order-list/index.tsx` | `list` | 订单列表区域 |
| `src/pages-sub/series-detail/index.tsx` | `card` | 系列商品卡片区域 |

**集成模式：**

```tsx
import Skeleton from '@/components/Skeleton'

// 在 JSX 中包裹异步内容
<Skeleton loading={loading} type="list" rows={4}>
  {/* 原有的列表内容 */}
</Skeleton>
```

**注意：**
- 使用页面已有的 `loading` 状态变量，不要新增状态
- 如果页面当前有自己的 loading UI（如 spinner），用 Skeleton 替换它
- 纯静态页面（privacy-policy、user-agreement、consultation、after-sales-detail 等）不需要骨架屏
- 骨架屏应放在 TopBar/TopBarWithBack 之后、实际内容区域的位置

---

## 任务 E：Zustand Store 精确订阅优化

将以下文件中的 Zustand 全量解构改为 selector 精确订阅模式：

### 1. `src/pages/cart/index.tsx`

当前（全量解构）：
```typescript
const { items, loading, totalPrice, selectedCount, isAllChecked } = useCartStore()
const { fetchCart, toggleItem, toggleAll, updateQuantity, removeItem } = useCartStore()
```

优化为（selector 精确订阅）：
```typescript
const items = useCartStore(state => state.items)
const loading = useCartStore(state => state.loading)
const totalPrice = useCartStore(state => state.totalPrice)
const selectedCount = useCartStore(state => state.selectedCount)
const isAllChecked = useCartStore(state => state.isAllChecked)
const fetchCart = useCartStore(state => state.fetchCart)
const toggleItem = useCartStore(state => state.toggleItem)
const toggleAll = useCartStore(state => state.toggleAll)
const updateQuantity = useCartStore(state => state.updateQuantity)
const removeItem = useCartStore(state => state.removeItem)
```

### 2. `src/pages/my/index.tsx`

当前：
```typescript
const { isRegistered, fetchUserInfo } = useUserStore()
```

优化为：
```typescript
const isRegistered = useUserStore(state => state.isRegistered)
const fetchUserInfo = useUserStore(state => state.fetchUserInfo)
```

### 3. `src/pages/splash/index.tsx`

当前：
```typescript
const { privacyAgreed, agreePrivacy } = useAppStore()
```

优化为：
```typescript
const privacyAgreed = useAppStore(state => state.privacyAgreed)
const agreePrivacy = useAppStore(state => state.agreePrivacy)
```

**同时扫描其他页面文件**，如果发现类似的全量解构模式，一并优化为 selector 模式。

---

## 任务 F：生产构建配置优化

### 修改文件：`config/prod.ts`

当前文件几乎为空。补充生产环境优化配置：

```typescript
import type { UserConfigExport } from "@tarojs/cli";

export default {
  mini: {
    postcss: {
      cssModules: {
        enable: true,
        config: {
          namingPattern: 'module',
          generateScopedName: '[hash:base64:6]',  // 生产环境使用短类名，减少体积
        },
      },
    },
    miniCssExtractPluginOption: {
      ignoreOrder: true,
    },
  },
  h5: {},
} satisfies UserConfigExport<'vite'>
```

**注意：**
- 先用 context7 确认 Taro 4.x Vite 模式下 `config/prod.ts` 的合并机制，确保 `postcss.cssModules` 配置能正确覆盖 `config/index.ts` 中的基础配置
- 生产环境使用 `[hash:base64:6]` 短类名替代开发环境的 `[name]__[local]___[hash:base64:5]`，减少样式体积
- 保留 `satisfies UserConfigExport<'vite'>` 类型约束

---

## 产出

### 新建文件
- `src/components/Skeleton/index.tsx`
- `src/components/Skeleton/index.module.scss`

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/app.config.ts` | 添加 `preloadRule` |
| `config/prod.ts` | 补充生产环境 CSS Modules 短类名配置 |
| `src/components/ProductCard/index.tsx` | `React.memo` 包裹 + `Image` 添加 `lazyLoad` |
| `src/pages/home/index.tsx` | Image `lazyLoad` + Skeleton 集成 |
| `src/pages/category/index.tsx` | Image `lazyLoad` + Skeleton 集成 |
| `src/pages/cart/index.tsx` | Skeleton 集成 + Zustand selector 优化 |
| `src/pages/product-detail/index.tsx` | Skeleton 集成 |
| `src/pages/my/index.tsx` | Zustand selector 优化 |
| `src/pages/splash/index.tsx` | Zustand selector 优化 |
| `src/pages-sub/wishlist/index.tsx` | Image `lazyLoad` + Skeleton 集成 |
| `src/pages-sub/series-detail/index.tsx` | Image `lazyLoad` + Skeleton 集成 |
| `src/pages-sub/order-list/index.tsx` | Image `lazyLoad` + Skeleton 集成 |

## 要求

- 先用 context7 确认 Taro 4.x 中 `preloadRule` 配置方式
- 先用 context7 确认 Taro `Image` 组件 `lazyLoad` 属性用法
- `Skeleton` 组件支持 4 种布局类型（`card`、`list`、`detail`、`banner`），脉冲动画流畅
- `ProductCard` 使用 `React.memo()` 包裹，导出方式不变
- 所有列表场景中的 `Image` 组件添加 `lazyLoad`
- Zustand Store 使用 selector 精确订阅，扫描所有页面确保无遗漏
- 修改每个文件前必须先读取该文件，理解当前结构后做最小化改动
- 不要修改任何业务逻辑，仅做性能优化层面的改动
- 完成后运行 `npm run build:weapp` 确认编译通过

---
