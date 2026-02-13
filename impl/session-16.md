# 会话 16：Phase 06a 商品详情页 product-detail — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 06 的第一部分：商品详情页（product-detail）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用时业务参数必须包在 `data` 字段下（`{ action, data: { ... } }`），不要平铺在顶层。
4. 本页面是非 Tab 页面，不需要 CustomTabBar 组件。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定，特别注意 Service 调用模式和已知配置要点）
2. `specs/06-product-flow.md`（关注「旧代码摘要 → 1. Product_Details」和「实现要求 → 1. 商品详情页」部分）

## 参考旧代码（必读，1:1 还原 UI）

开始编码前，必须先完整阅读以下旧代码，理解页面结构、布局、间距、颜色等视觉要素：
- `legacy_ro/yz-legacy-code/pages/Product_Details/Product_Details.wxml`（页面结构，优先读）
- `legacy_ro/yz-legacy-code/pages/Product_Details/Product_Details.wxss`（样式细节，优先读）
- `legacy_ro/yz-legacy-code/pages/Product_Details/Product_Details.js`（交互逻辑和数据流）

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-15 已完成：所有基础设施 + 共享组件 + 4 个 Tab 主页面就绪。

### 已有的关键基础设施（必须先读取理解）

- `src/services/product.service.ts` — `getProductDetail(skuId)`、`getRecommendations(skuId)`
- `src/services/cart.service.ts` — `addToCart(userId, skuId, qty)`
- `src/services/wish.service.ts` — `checkWish(userId, spuId, skuId)`、`addWish(userId, spuId, skuId)`、`removeWish(wishId)`
- `src/types/product.ts` — Sku、Spu、Material、SubSeries、ProductSize 类型
- `src/hooks/useAuth.ts` — `ensureLogin()`、`ensureRegistered()`
- `src/hooks/useImageProcessor.ts` — `processImages()` 图片批量转换
- `src/stores/useUserStore.ts` — `userId`、`isRegistered`
- `src/stores/useCartStore.ts` — 购物车 store（加购后可选刷新）
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏
- `src/components/SizePopup/` — 尺码选择弹窗
- `src/components/CartSuccessPopup/` — 加购成功弹窗（props: `visible`、`onContinue`、`onGoToCart`、`onClose`）
- `src/components/FloatBtn/` + `src/components/FloatPopup/` — 浮动咨询
- `src/components/LoadingBar/` — 加载指示器
- `src/utils/format.ts` — `formatPrice()`
- `src/utils/navigation.ts` — `navigateTo()`、`switchTab()`

## 本次任务

改写 `src/pages/product-detail/index.tsx` + `index.config.ts` + `index.module.scss`（当前为占位文件）

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
  enableShareAppMessage: true,
})
```

### 页面参数

通过 `useRouter()` 获取：
- `skuId`（主入口）— SKU 数据库 `_id`
- `spuId`（备用入口）— 兼容旧链接

### 核心功能点

#### 1. 页面初始化（`useLoad`）

- 通过 `useRouter().params` 获取 `skuId` 或 `spuId`
- 主路径：有 `skuId` → 直接调用 `loadProductDetail(skuId)`
- 备用路径：仅有 `spuId` → 先调用 `productService.getProductDetail(spuId)` 获取默认 SKU，再加载

#### 2. 加载商品详情（`loadProductDetail`）

调用 `productService.getProductDetail(skuId)` 后处理返回数据：

- **SKU 主图**：`processImages()` 压缩参数 `{ width: 750, height: 750, quality: 80 }`
- **礼盒图**（`skuDetailImages`）：压缩参数 `{ width: 750, height: 469, quality: 80 }`
- **关联 SKU 图**：从 `relatedSkus.otherMaterials` 提取，压缩 `{ width: 300, height: 300, quality: 50 }`
- **尺码选择器**：检查 `nameCN` 是否包含"手镯"，是则从 `relatedSkus.sameMaterial.sizes` 构建 `availableSizes`
- **收藏状态**：调用 `wishService.checkWish(userId, spuId, skuId)`
- **推荐商品**：调用 `productService.getRecommendations(skuId)`，最高 priority 放中间位置（index 1）

#### 3. 加入购物车

1. `ensureRegistered()` 检查注册状态
2. 调用 `cartService.addToCart(userId, currentSku._id, quantity)`
3. 成功后设置 `showCartSuccess = true` 显示 CartSuccessPopup

#### 4. 直接购买

1. `ensureRegistered()` 检查注册状态
2. `Taro.setStorageSync('directBuyProduct', productInfo)` 存储商品信息
   - productInfo 结构：`{ skuId: currentSku._id, quantity, price, name: nameCN, nameEN, material: materialName, size: sizeValue, image: images[0], directBuy: true }`
3. `navigateTo('/pages-sub/payment/index')` 跳转支付页

#### 5. 收藏切换

- 已收藏 → `wishService.removeWish(currentWishId)` → `isInWishlist = false`
- 未收藏 → `wishService.addWish(userId, spuId, skuId)` → `isInWishlist = true`，存储返回的 wishId

#### 6. 尺码切换

- 点击不同尺码 → 获取对应 `skuId` → 调用 `loadProductDetail(newSkuId)` 重新加载整个页面数据

#### 7. 关联 SKU 跳转（"更多款式"）

- `navigateTo('/pages/product-detail/index?skuId=${relatedSku._id}')` — 新开页面

#### 8. 分享

```typescript
useShareAppMessage(() => ({
  title: `${nameCN} ${nameEN}`,
  path: `/pages/product-detail/index?skuId=${currentSku?._id}`,
  imageUrl: '/assets/images/share.jpg',
}))
```

#### 9. 服务项折叠

- `serviceStates` 初始值：`{ delivery: false, afterSales: false, returnPolicy: false }`
- 点击标题行切换对应 key 的布尔值
- 三个服务项：配送服务、售后服务（含子项列表）、退换货服务

### UI 结构

```
TopBarWithBack
├── LoadingBar（loading 时显示）
├── ScrollView（纵向滚动，底部留出操作栏高度）
│   ├── 图片轮播区
│   │   ├── Swiper + SwiperItem（SKU 主图，点击 previewImage）
│   │   └── 自定义进度指示器（底部居中，格式 "currentIndex / total"，非圆点）
│   ├── 商品信息区
│   │   ├── nameEN（英文名）
│   │   ├── "作品编号:" + skuId
│   │   ├── nameCN（中文名）
│   │   ├── 收藏图标（已收藏红色填充 / 未收藏空心）+ 分享图标
│   │   ├── 运费文字："中国大陆包邮"
│   │   └── formattedPrice
│   ├── 尺码选择区（仅 nameCN 包含"手镯"时显示）
│   │   └── 横向滚动尺码列表（选中态黑底白字 / 售罄态半透明+删除线）
│   ├── 详情区
│   │   ├── 作品尺寸
│   │   ├── 作品材质
│   │   ├── 产地：中国
│   │   └── 证书说明
│   ├── 关联 SKU 区（"更多款式"）
│   │   └── 3 列网格（每项：图片 + materialName + skuId）
│   ├── 礼盒图区
│   │   └── 全宽图片列表（mode="widthFix"）
│   ├── 可折叠服务项
│   │   ├── 配送服务（折叠/展开）
│   │   ├── 售后服务（折叠/展开，含子项列表）
│   │   └── 退换货服务（折叠/展开）
│   └── 推荐商品区
│       └── 3 列网格（最多 3 个商品）
├── 底部操作栏（fixed 定位）
│   ├── 客服按钮（触发 FloatPopup）
│   ├── 购物车按钮（switchTab 到 /pages/cart/index）
│   ├── 加入购物车按钮
│   └── 立即结算按钮
├── FloatBtn（浮动咨询按钮）
├── FloatPopup（在线咨询弹窗）
├── SizePopup（尺码选择弹窗，如需要）
└── CartSuccessPopup（加购成功弹窗）
```

### 图片轮播指示器

不使用 Swiper 自带的 `indicatorDots`，而是自定义指示器：
- 位置：轮播区底部居中
- 格式：`{currentIndex + 1} / {total}`
- 样式：`font-size: 24rpx; color: #999; background: rgba(0,0,0,0.3); padding: 4rpx 16rpx; border-radius: 20rpx; color: #fff`
- 通过 Swiper 的 `onChange` 事件更新 `currentImageIndex`

### 推荐商品排序

云函数返回的推荐商品带 `priority` 字段：
- `same_product_different_size = 1`（最高）
- `same_subseries_material = 2`
- `same_material_random = 3`

排序后将最高优先级的商品放在中间位置（index 1），其余按 priority 排列。

### 底部操作栏样式要点

```
position: fixed; bottom: 0; width: 100%;
height: 100rpx; background: #fff; z-index: 998;
display: flex; align-items: center;
padding-bottom: env(safe-area-inset-bottom);
```

- 客服按钮：`width: 100rpx`，图标居中
- 购物车按钮：`width: 100rpx`，图标居中
- 加入购物车按钮：`flex: 1; background: #fff; color: #333; border: 1rpx solid #333; font-size: 28rpx`
- 立即结算按钮：`flex: 1; background: #000; color: #fff; font-size: 28rpx`

### 图标资源

旧代码中商品详情页使用了多个图标（收藏心形、分享、客服、购物车等）。如果 `src/assets/icons/` 中缺少对应图标，从 `legacy_ro/yz-legacy-code/` 中找到并复制过来。

## 产出

- 商品详情页 3 个文件（index.tsx + index.config.ts + index.module.scss）
- 如有缺失的图标/图片资源，从 legacy 复制到 `src/assets/`

## 要求

- 使用已有的 services（product.service、cart.service、wish.service），不新建 service
- 使用已有的 hooks：useAuth、useImageProcessor、useSystemInfo
- 使用已有的组件：TopBarWithBack、LoadingBar、FloatBtn、FloatPopup、SizePopup、CartSuccessPopup
- 使用已有的 utils：formatPrice、navigateTo、switchTab
- 本页面是主包页面（`pages/product-detail/index`），不是 Tab 页，不需要 CustomTabBar
- 页面配置使用 `navigationStyle: 'custom'` + `enableShareAppMessage: true`
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 图片轮播使用 Taro `Swiper` + `SwiperItem`，自定义进度指示器（非圆点）
- 点击轮播图调用 `Taro.previewImage({ urls: images, current: images[currentIndex] })`
- 底部操作栏需要考虑安全区域（safe-area-inset-bottom）
- 完成后运行 `npm run build:weapp` 确认编译通过

---
