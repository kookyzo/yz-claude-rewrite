# Phase 10: 性能优化

## 目标

对 Taro + React 小程序进行性能优化，包括分包加载、预加载策略、图片懒加载、骨架屏、主包体积控制等，确保首屏加载速度和用户体验。

## 前置依赖

- Phase 01–09 全部完成（所有页面、组件、服务层已就绪）

---

## 1. 分包配置（subPackages）

### 1.1 分包策略

微信小程序主包大小限制为 2MB，整包（主包 + 所有分包）限制为 20MB。当前项目共 31 个页面，按以下策略分包：

- **主包（`pages/`）**：仅包含启动页、4 个 TabBar 页面和商品详情页（高频访问），共 6 个页面
- **分包（`pages-sub/`）**：其余 25 个低频页面统一放入一个分包

### 1.2 `app.config.ts` 分包配置

```typescript
// src/app.config.ts
export default defineAppConfig({
  pages: [
    'pages/splash/index',
    'pages/home/index',
    'pages/category/index',
    'pages/cart/index',
    'pages/my/index',
    'pages/product-detail/index',
  ],
  subPackages: [
    {
      root: 'pages-sub',
      pages: [
        'series-detail/index',
        'series-promotion/index',
        'payment/index',
        'payment-failed/index',
        'payment-select-address/index',
        'register/index',
        'edit-info/index',
        'address-list/index',
        'address-edit/index',
        'order-list/index',
        'after-sales/index',
        'after-sales-detail/index',
        'refund/index',
        'return-exchange-detail/index',
        'reservation/index',
        'reservation-normal/index',
        'reservation-change/index',
        'reservation-success/index',
        'reservation-easy/index',
        'wishlist/index',
        'consultation/index',
        'privacy-policy/index',
        'user-agreement/index',
        'product-cms/index',
      ],
    },
  ],
  // ... 其余配置（window、tabBar 等）
})
```

> **注意**：`subPackages` 中的 `pages` 路径是相对于 `root` 的，不需要加 `root` 前缀。Taro 会自动处理路径拼接。

---

## 2. 分包预下载（preloadRule）

### 2.1 预下载策略

`preloadRule` 允许在进入某个页面时预先下载指定分包，减少用户首次进入分包页面时的等待时间。配置规则：

- **Key**：触发预下载的页面路径
- **Value**：`{ network: 'all' | 'wifi', packages: string[] }`
  - `network: 'all'` — 任何网络环境下均预下载
  - `network: 'wifi'` — 仅 WiFi 环境下预下载
  - `packages` — 要预下载的分包 `root` 名称数组

### 2.2 预下载配置

```typescript
// src/app.config.ts（在 defineAppConfig 中添加）
preloadRule: {
  // 进入首页时，预下载 pages-sub 分包（任何网络）
  'pages/home/index': {
    network: 'all',
    packages: ['pages-sub'],
  },
},
```

**设计决策：**

- 仅在首页触发预下载，因为首页是用户启动后的第一个 TabBar 页面，此时预下载分包可覆盖绝大多数后续导航场景
- 使用 `network: 'all'` 而非 `'wifi'`，因为分包体积可控（单个分包 < 2MB），移动网络下载耗时极短
- 不在 splash 页触发预下载，因为 splash 页停留时间短且有视频播放，避免带宽竞争

---

## 3. 图片懒加载

### 3.1 Taro Image 组件 lazyLoad

Taro 的 `Image` 组件支持 `lazyLoad` 属性（布尔值，默认 `false`）。启用后，图片仅在即将进入可视区域时才开始加载。

**限制条件**：`lazyLoad` 仅在 `Page` 或 `ScrollView` 内的 `Image` 组件上生效。

### 3.2 应用范围

以下页面/组件中的图片列表应启用 `lazyLoad`：

| 页面/组件 | 图片场景 | 说明 |
|-----------|----------|------|
| `pages/home/index` | 轮播图下方的商品推荐列表 | 首页商品图片数量多，懒加载收益大 |
| `pages/category/index` | 分类商品网格 | 商品图片按分类加载，列表可能很长 |
| `components/ProductCard` | 商品大图 | 作为列表项复用，统一启用懒加载 |
| `pages-sub/wishlist/index` | 收藏商品列表 | ScrollView 内的商品图片 |
| `pages-sub/series-detail/index` | 系列商品列表 | 系列下可能有大量商品 |
| `pages-sub/order-list/index` | 订单商品缩略图 | 订单列表中的商品小图 |

### 3.3 实现方式

```tsx
// 在 ProductCard 组件中
<Image
  src={image}
  mode="aspectFill"
  lazyLoad
  className={styles.productImage}
/>

// 在列表页面的 ScrollView 中
<ScrollView scrollY className={styles.list}>
  {items.map(item => (
    <Image
      key={item._id}
      src={item.image}
      lazyLoad
      mode="aspectFill"
    />
  ))}
</ScrollView>
```

### 3.4 图片压缩配合

懒加载应与 `useImageProcessor` Hook 配合使用：

1. 页面加载时，通过 `processImages()` 将 `cloud://` URL 批量转换为 HTTP URL 并拼接压缩参数
2. 转换后的 HTTP URL 传入 `Image` 组件的 `src`，配合 `lazyLoad` 实现按需加载
3. 压缩参数根据场景调整：
   - 列表缩略图：`width=300, height=300, quality=50`（默认值）
   - 商品详情大图：`width=750, height=750, quality=80`
   - 轮播图/Banner：`width=750, height=400, quality=80`

---

## 4. 骨架屏（Skeleton Screen）

### 4.1 实现方案

Taro 没有内置骨架屏组件。采用**条件渲染**方案：在数据加载完成前显示骨架占位 UI，加载完成后切换为真实内容。

### 4.2 骨架屏组件 — `src/components/Skeleton/index.tsx`

```typescript
interface SkeletonProps {
  /** 控制是否显示骨架屏 */
  loading: boolean
  /** 真实内容（children） */
  children: React.ReactNode
  /** 骨架屏布局类型 */
  type?: 'card' | 'list' | 'detail' | 'banner'
  /** 列表类型时的行数，默认 3 */
  rows?: number
}
```

**核心逻辑：**

- `loading === true` 时渲染骨架占位 UI
- `loading === false` 时渲染 `children`（真实内容）
- 骨架元素使用 CSS 动画模拟加载效果（脉冲闪烁）

**骨架布局类型：**

1. **`card`**：商品卡片骨架 — 大矩形图片占位 + 两行文字占位 + 价格占位
2. **`list`**：列表骨架 — 左侧小方形图片 + 右侧多行文字，重复 `rows` 次
3. **`detail`**：详情页骨架 — 大图占位 + 标题行 + 多行描述 + 价格行
4. **`banner`**：轮播图骨架 — 全宽矩形占位

**使用示例：**

```tsx
// 在首页中使用
const [loading, setLoading] = useState(true)
const [products, setProducts] = useState<Product[]>([])

useEffect(() => {
  fetchProducts().then(data => {
    setProducts(data)
    setLoading(false)
  })
}, [])

return (
  <View>
    <Skeleton loading={loading} type="banner">
      <Swiper>{/* 轮播图内容 */}</Swiper>
    </Skeleton>

    <Skeleton loading={loading} type="card" rows={4}>
      {products.map(p => <ProductCard key={p._id} {...p} />)}
    </Skeleton>
  </View>
)
```

**关键样式（`index.module.scss`）：**

```scss
// 脉冲动画
@keyframes skeleton-pulse {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}

.skeletonBlock {
  background: #f0f0f0;
  border-radius: 8rpx;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

// 图片占位
.imageBlock {
  width: 100%;
  height: 400rpx;
  margin-bottom: 20rpx;
}

// 文字行占位
.textBlock {
  height: 28rpx;
  margin-bottom: 16rpx;

  &.short { width: 40%; }
  &.medium { width: 70%; }
  &.long { width: 100%; }
}

// 列表项骨架
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

### 4.3 应用范围

| 页面 | 骨架类型 | 说明 |
|------|----------|------|
| `pages/home/index` | `banner` + `card` | 轮播图骨架 + 商品卡片列表骨架 |
| `pages/category/index` | `list` | 分类商品列表骨架 |
| `pages/cart/index` | `list` | 购物车商品列表骨架 |
| `pages/product-detail/index` | `detail` | 商品详情页骨架 |
| `pages-sub/wishlist/index` | `list` | 收藏列表骨架 |
| `pages-sub/order-list/index` | `list` | 订单列表骨架 |
| `pages-sub/series-detail/index` | `card` | 系列商品卡片骨架 |

> **注意**：纯静态页面（privacy-policy、user-agreement、after-sales-detail、consultation）不需要骨架屏，因为没有异步数据加载。

---

## 5. 主包体积控制

### 5.1 体积预算

| 类别 | 目标 |
|------|------|
| 主包总体积 | < 1.5MB（预留 0.5MB 余量） |
| 单个分包体积 | < 2MB |
| 整包体积 | < 10MB（预留 10MB 余量） |

### 5.2 主包内容清单

主包应仅包含以下内容：

| 内容 | 路径 | 说明 |
|------|------|------|
| 入口文件 | `app.ts`、`app.config.ts`、`app.scss` | 应用初始化 |
| 主包页面 | `pages/`（6 个页面） | splash、home、category、cart、my、product-detail |
| 共享组件 | `components/` | 所有共享组件（主包和分包均使用） |
| 自定义 TabBar | `custom-tab-bar/` | 底部导航栏 |
| 基础设施 | `types/`、`services/`、`stores/`、`hooks/`、`utils/`、`constants/` | 类型、服务、状态、工具 |
| 静态资源 | `assets/icons/`、`assets/images/` | 图标和图片 |

### 5.3 体积优化策略

**1. 静态资源优化：**

- TabBar 图标使用 PNG 格式，单个图标 < 5KB，8 个图标（4 组选中/未选中）总计 < 40KB
- 其他 UI 图标（返回箭头、关闭按钮等）优先使用小尺寸 PNG（< 3KB）
- Logo 图片压缩至 < 10KB
- 启动页视频（`splash.mp4`）存储在云端（`cloud://`），不打包进主包

**2. 代码层面优化：**

- 使用 SCSS Modules 而非全局样式，Taro 构建时会自动 tree-shake 未使用的样式
- 避免在主包页面中直接 `import` 仅分包使用的大型依赖
- `types/` 目录中的类型定义在编译后会被擦除，不占用运行时体积

**3. 构建配置优化：**

```typescript
// config/prod.ts
const config = {
  mini: {
    postcss: {
      cssModules: {
        enable: true,
        config: {
          namingPattern: 'module',
          generateScopedName: '[hash:base64:6]',  // 短类名，减少体积
        },
      },
    },
    miniCssExtractPluginOption: {
      ignoreOrder: true,
    },
  },
}
```

**4. 体积监控：**

- 每次构建后检查 `dist/` 目录下的主包体积
- 使用微信开发者工具的「代码依赖分析」功能查看各模块占比
- 若主包超过 1.5MB，优先排查：
  1. 是否有大图片未压缩或未上传云端
  2. 是否有分包页面误放入主包
  3. 是否引入了不必要的第三方库

---

## 6. 渲染性能优化

### 6.1 长列表优化

商品列表、订单列表等可能包含大量数据项，需要避免一次性渲染全部 DOM 节点。

**策略：**

- 使用 `usePagination` Hook 分页加载数据（默认 `pageSize = 200`），通过 `ScrollView` 的 `onScrollToLower` 触发 `loadMore()`
- 列表项组件使用 `React.memo()` 包裹，避免父组件 re-render 导致所有列表项重新渲染
- 图片统一使用 `lazyLoad` 属性，减少首屏渲染压力

**示例（ProductCard 使用 React.memo）：**

```tsx
// src/components/ProductCard/index.tsx
const ProductCard: React.FC<ProductCardProps> = React.memo(({
  skuId, image, name, nameEN, price, onAddToCart, onPress,
}) => {
  // ... 组件实现
})

export default ProductCard
```

### 6.2 状态更新优化

**Zustand selector 精确订阅：**

- 组件从 Store 中读取状态时，使用 selector 函数精确选取所需字段，避免无关状态变更触发 re-render

```tsx
// ✅ 精确订阅：仅在 items 变化时 re-render
const items = useCartStore(state => state.items)

// ❌ 全量订阅：任何 store 字段变化都会 re-render
const store = useCartStore()
```

---

## 7. 网络请求优化

### 7.1 云函数调用优化

**减少冗余请求：**

- 购物车页面使用 `useCartStore` 缓存数据，避免每次 `onShow` 都重新请求（仅在 `items` 为空或用户主动下拉刷新时请求）
- 用户信息通过 `useUserStore` 全局缓存，`fetchUserInfo()` 仅在首次登录后调用一次
- 商品详情页的推荐商品数据可在首次加载后缓存，返回时不重复请求

**图片 URL 批量转换优化：**

- `useImageProcessor` 的 `processImages()` 已内置批量处理逻辑（50 个/批、3 并发）
- 页面应在数据加载完成后一次性收集所有 `cloud://` URL，调用一次 `processImages()` 批量转换
- 避免在列表项渲染时逐个调用转换函数

---

## 产出文件清单

```
src/
├── components/
│   └── Skeleton/
│       ├── index.tsx
│       └── index.module.scss
config/
├── index.ts          # 补充 subPackages 相关构建配置
└── prod.ts           # 生产环境优化配置
```

**需修改的现有文件：**

| 文件 | 修改内容 |
|------|----------|
| `src/app.config.ts` | 添加 `subPackages` 和 `preloadRule` 配置 |
| `config/prod.ts` | 添加 CSS Modules 短类名、miniCssExtract 配置 |
| `src/components/ProductCard/index.tsx` | 添加 `React.memo()` 包裹、`Image` 添加 `lazyLoad` |
| 各列表页面 | `Image` 组件添加 `lazyLoad` 属性 |
| 各数据加载页面 | 使用 `Skeleton` 组件包裹异步内容 |

---

## 验收标准

1. `app.config.ts` 中 `subPackages` 配置正确，`pages-sub` 分包包含全部 25 个分包页面路径
2. `app.config.ts` 中 `preloadRule` 配置正确，进入首页时预下载 `pages-sub` 分包
3. 主包页面路径（`pages/`）仅包含 6 个页面：splash、home、category、cart、my、product-detail
4. 所有分包页面的跳转路径使用完整路径（如 `/pages-sub/wishlist/index`），与 `subPackages` 配置一致
5. `Skeleton` 组件支持 4 种布局类型（`card`、`list`、`detail`、`banner`），脉冲动画流畅
6. `Skeleton` 组件在 `loading=true` 时显示骨架占位，`loading=false` 时显示 `children` 内容
7. 首页、分类页、购物车页、商品详情页、收藏列表页、订单列表页均使用 `Skeleton` 组件包裹异步内容
8. `ProductCard` 组件使用 `React.memo()` 包裹，`Image` 组件启用 `lazyLoad`
9. 所有列表页面中的 `Image` 组件均设置 `lazyLoad` 属性
10. Zustand Store 的使用方式为 selector 精确订阅，避免全量订阅
11. 构建产物主包体积 < 2MB，通过微信开发者工具验证
12. `config/prod.ts` 中 CSS Modules 使用短类名（`[hash:base64:6]`）减少样式体积
