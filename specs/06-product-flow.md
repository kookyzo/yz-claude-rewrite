# Phase 06: 商品浏览 → 支付流程

## 目标

实现从商品浏览到支付完成的完整交易流程，共 6 个页面。涵盖商品详情展示、系列浏览、SKU 选择、加入购物车、直接购买、微信支付、支付结果处理等核心电商功能。

## 前置依赖

- Phase 02 完成（`types/`、`services/`、`utils/`、`constants/`）
- Phase 03 完成（`stores/`、`hooks/`）
- Phase 04 完成（`components/`：TopBarWithBack、FloatPopup、CartSuccessPopup、SizePopup、LoadingBar、ProductCard）

## 页面清单

| # | 新路径 | 旧路径 | 包 | 说明 |
|---|--------|--------|----|------|
| 1 | `pages/product-detail/index` | `pages/Product_Details/Product_Details` | 主包 | 商品详情 |
| 2 | `pages-sub/series-detail/index` | `pages/SeriesDetail/SeriesDetail` | 分包 | 系列详情 |
| 3 | `pages-sub/series-promotion/index` | `pages/series_promotion/series_promotion` | 分包 | 系列推广 |
| 4 | `pages-sub/payment/index` | `pages/payment/payment` | 分包 | 支付页 |
| 5 | `pages-sub/payment-failed/index` | `pages/payment_failed/payment_failed` | 分包 | 支付失败 |
| 6 | `pages-sub/payment-select-address/index` | `pages/payment_sub_page_select_address/...` | 分包 | 支付选地址 |

## Taro API 参考

> 以下 API 信息均通过 context7 MCP 查询 Taro 官方文档确认，非猜测。

### Swiper 组件（`@tarojs/components`）

```tsx
import { Swiper, SwiperItem } from '@tarojs/components'

<Swiper
  autoplay={true}
  interval={4000}
  circular={true}
  indicatorDots={false}
  onChange={(e) => { /* e.detail.current */ }}
>
  <SwiperItem>...</SwiperItem>
</Swiper>
```

主要属性：`indicatorDots`、`indicatorColor`、`indicatorActiveColor`、`autoplay`、`current`、`interval`、`duration`、`circular`、`vertical`、`onChange`、`onTransition`、`onAnimationFinish`。

### Image 组件（`@tarojs/components`）

```tsx
import { Image } from '@tarojs/components'

<Image src={url} mode="aspectFill" lazyLoad />
```

主要属性：`src`、`mode`（scaleToFill / aspectFit / aspectFill / widthFix 等）、`lazyLoad`、`showMenuByLongpress`、`onLoad`、`onError`。

### Taro.previewImage

```typescript
import Taro from '@tarojs/taro'

Taro.previewImage({
  urls: string[],     // 必填，预览图片 URL 列表
  current?: string,   // 可选，当前显示图片的 URL
  success?: (res) => void,
  fail?: (res) => void,
  complete?: (res) => void,
})
```

### Taro.requestPayment

```typescript
import Taro from '@tarojs/taro'

Taro.requestPayment({
  timeStamp: string,           // 时间戳（字符串）
  nonceStr: string,            // 随机字符串
  package: string,             // 统一下单接口返回的 prepay_id，格式 "prepay_id=***"
  signType: 'MD5' | 'HMAC-SHA256' | 'RSA',  // 签名算法
  paySign: string,             // 签名
  success?: (res) => void,
  fail?: (res) => void,
  complete?: (res) => void,
})
```

### useRouter / useLoad（页面参数获取）

```tsx
import { useRouter } from '@tarojs/taro'

// 在页面组件中：
const router = useRouter()
// router.params.skuId — 获取 URL 参数
// router.path — 当前路由路径
```

```tsx
import { useLoad } from '@tarojs/taro'

// 等同于 onLoad 生命周期，Taro v3.5.0+
useLoad(() => {
  console.log('page loaded')
})
```

---

## 旧代码摘要

### 1. Product_Details（商品详情，2741 行）

**状态字段：**
- `_skuId` — 当前 SKU 的数据库 `_id`（URL 参数传入）
- `spuId` — SPU ID（备用入口参数）
- `image_src_list: [{src}]` — SKU 主图列表（已转换+压缩）
- `nameCN`、`nameEN` — 商品中英文名
- `skuId` — 显示用编号（非 `_id`）
- `size`、`material_name` — 当前 SKU 的尺码和材质名称
- `price`、`formattedPrice`、`unit_price` — 价格相关
- `quantity` — 购买数量（默认 1）
- `relatedSkus[]` — 同 SPU 不同材质的 SKU 列表（"更多款式"）
- `selectedSkuId` — 当前选中的 SKU `_id`
- `showSizeSelector: boolean` — 是否显示尺码选择器（仅手镯类显示）
- `availableSizes[]` — 可选尺码列表（同材质不同尺码）
- `sizeValue` — 当前尺码值
- `isInWishlist`、`currentWishId` — 收藏状态
- `showAddToCartSuccessPopup` — 加购成功弹窗
- `serviceStates: {after_sales, return_policy, repair_service}` — 服务项折叠状态
- `giftBoxImages[]` — SKU 详情图（礼盒图）
- `recommended_products_list[]` — 推荐商品（最多 3 个）
- `userId`、`currentSku`（完整 SKU 对象）、`loading`、`showTabBarLoading`

**生命周期（onLoad）：**
- 接收参数：`_skuId`（主入口）或 `productId` 或 `spuId`（备用入口）
- 主路径调用 `loadProductDetail(_skuId)`
- 备用路径调用 `fetchDetail()`（使用 `getProduct` 云函数的 `testSkuQuery` action）

**核心函数 `loadProductDetail(_skuId)`：**
1. 调用 `get-product`（action: `getProductDetail`，data: `{_skuId}`）
2. 处理 SKU 主图：cloud URL 转换 → 压缩（750×750，q80）
3. 处理礼盒图（`skuDetailImages`）：压缩（750×469，q80）
4. 处理关联 SKU：从 `productData.relatedSkus.otherMaterials` 提取，图片压缩（300×300，q50）
5. 处理尺码选择器：从 `productData.relatedSkus.sameMaterial.sizes` 提取，仅当 `nameCN` 包含"手镯"时显示
6. 检查收藏状态：`manage-wish`（action: `check`，data: `{userId, spuId, skuId}`）
7. 加载推荐商品：`manage-recommendations`（action: `getRecommendations`，data: `{skuId, limit: 3}`）

**加入购物车（`click_add_to_cart`）：**
1. `checkUserRegistration()` — 检查注册状态
2. `getCurrentUserInfo()` — 获取用户信息
3. 调用 `manage-cart`（action: `add`，data: `{_userId, _skuId: currentSku._id, quantity, useSpecification: true}`）
4. 成功后显示 `CartSuccessPopup`

**直接购买（`click_checkout`）：**
1. `checkUserRegistration()` — 检查注册状态
2. 构建 `productInfo` 对象：`{_skuId, quantity, price, name, foreign_name, material, size, image, directBuy: true, stock, skuData}`
3. `wx.setStorageSync('directBuyProduct', productInfo)` 存储商品信息
4. `wx.navigateTo('/pages/payment/payment')` 跳转支付页

**收藏切换（`heart`）：**
- 已收藏 → `manage-wish`（action: `remove`，data: `{_wishId: currentWishId}`）
- 未收藏 → `manage-wish`（action: `add`，data: `{userId: {_id}, spuId: {_id}, skuId: {_id}}`）

**尺码切换（`onSizeChange`）：**
- 从 `e.currentTarget.dataset.skuId` 获取新 SKU ID
- 调用 `loadProductDetail(newSkuId)` 重新加载整个页面数据

**关联 SKU 跳转（`goToRelatedSku`）：**
- `wx.navigateTo('/pages/Product_Details/Product_Details?_skuId=${skuId}')` — 新开页面

**推荐商品逻辑：**
- 云函数返回带 `priority` 字段：`same_product_different_size=1`、`same_subseries_material=2`、`same_material_random=3`
- 最高优先级放在中间位置（index 1）

**服务项折叠：**
- `toggleService(e)` 切换 `serviceStates[service]` 布尔值
- 三个服务项：配送服务、售后服务（含子项）、退换货服务

**分享：**
- `onShareAppMessage` 返回 `{title: nameCN + nameEN, path: '/pages/Product_Details/Product_Details?_skuId=${skuId}', imageUrl: '/Image/share/share.jpg'}`

**UI 结构（WXML，418 行）：**
- TopBarWithBack → LoadingBar → ScrollView
- 图片轮播：Swiper + 自定义进度条指示器（非圆点），格式 `currentIndex / total`
- 商品信息区：nameEN、"作品编号:" + skuId、nameCN、收藏/分享图标、运费文字（"中国大陆包邮"）、formattedPrice
- 尺码选择区（条件渲染 `showSizeSelector`）：当前尺码（选中态）+ 其他尺码（含库存/售罄状态）
- 详情区：作品尺寸、作品材质、产地:中国、证书说明
- 关联 SKU 区（"更多款式"）：网格布局，每项含图片、materialName、skuId
- 礼盒图区：全宽图片列表（`mode="widthFix"`）
- 可折叠服务项：配送服务、售后服务（含子项列表）、退换货服务（含"探索更多"链接）
- 推荐商品区：网格布局（3 列）
- 底部操作栏（固定定位）：客服按钮（触发 FloatPopup）、购物车按钮（switchTab）、加入购物车按钮、立即结算按钮
- 弹窗组件：FloatPopup、SizePopup、CartSuccessPopup

### 2. SeriesDetail（系列详情，482 行）

**状态字段：**
- `subSeriesId` — 子系列 ID（URL 参数传入）
- `subSeriesInfo` — 子系列信息对象（含 `nameEN`、`nameCN`、`displayImage`、`introduction`）
- `products[]` — 商品列表
- `productCount` — 商品总数
- `loadingProducts` — 加载状态
- `hasMore` — 是否有更多数据
- `currentPage`、`pageSize: 20` — 分页参数
- `currentSort: 'default'`、`sortText` — 排序状态
- `showSortOptions`、`showFilterPanel` — 排序/筛选面板显示状态
- `materials[]` — 材质筛选选项列表
- `selectedMaterials[]` — 已选材质 ID 列表

**生命周期（onLoad）：**
- 接收参数：`subSeriesId`
- 并行调用 `loadSubSeriesInfo(subSeriesId)` + `loadProducts()`

**核心函数：**

`loadSubSeriesInfo(subSeriesId)`：
- 调用 `manage-subseries`（action: `get`，data: `{id: subSeriesId}`）

`loadProducts(reset = false)`：
- 调用 `get-product`（action: `getProductsBySubSeries`，data: `{subSeriesId, sortBy, page, pageSize, materialIds?}`）
- 返回数据处理：cloud URL 转换 → `formatPrice` → 追加到 `products[]`
- 分页逻辑：`hasMore = items.length >= pageSize`

**筛选逻辑：**
- 从商品数据中动态提取 `materialId` 列表
- 调用 `manage-material`（action: `listByIds`）获取材质名称
- 选择材质后调用 `loadProducts(true)` 重置加载

**排序逻辑：**
- 三种排序：`default`（默认）、`price_asc`（价格从低到高）、`price_desc`（价格从高到低）
- 切换排序后调用 `loadProducts(true)` 重置加载

**分享：**
- `onShareAppMessage` 返回 `{title: subSeriesInfo.nameEN, path: '/pages/SeriesDetail/SeriesDetail?subSeriesId=${id}'}`

**UI 结构（WXML，144 行）：**
- TopBarWithBack（含系列名称标题）
- 头图区：子系列 `displayImage`（`mode="widthFix"`）
- 标题区：nameEN + nameCN
- 工具栏：商品数量 + 筛选按钮 + 排序按钮
- 筛选面板（底部弹出）：材质复选框列表 + 重置/确认按钮
- 排序面板（下拉）：三个排序选项
- 商品网格：每项含图片（`aspectFill`）、nameEN、nameCN、formattedPrice
- 底部状态：加载中 / 暂无商品 / 没有更多了

### 3. series_promotion（系列推广，极简页面）

**状态字段：**
- `promotionImage` — 推广图片 URL（URL 参数传入）

**生命周期（onLoad）：**
- 接收参数：`image`（推广图片 URL）
- 无云函数调用

**核心逻辑：**
- 纯展示页面，仅显示一张全宽推广图片
- 无交互逻辑

**UI 结构：**
- TopBarWithBack
- 单张 Image 组件，`mode="widthFix"`，宽度 100%

### 4. payment（支付页，1237 行）

**状态字段：**
- `address: {name, phone, detailAddress, provinceCity, _id}` — 收货地址
- `items[]` — 待支付商品列表（每项含 name、foreign_name、price、quantity、image、material、size、formattedPrice、formattedSubtotal）
- `payment_method: [{image, text, id, use_this_method}]` — 支付方式（仅微信支付）
- `total_price`、`formattedTotalPrice` — 总价
- `auth: false` — 隐私协议勾选状态
- `userId`、`currentUser` — 用户信息
- `currentOrder` — 当前订单对象（重新支付时使用）
- `paymentTimer`、`countdown: 1800` — 支付倒计时（30 分钟）
- `directBuy: false` — 是否直接购买模式
- `fromOrder: false` — 是否从订单重新支付
- `currentLength: 0` — 备注字数

**生命周期（onLoad）— 三种入口模式：**

1. **订单重新支付**：`options.orderId` 存在 → 设置 `fromOrder: true` → `getCurrentUserInfo()` → `loadOrderInfo(orderId)` 调用 `manage-order-easy`（action: `getOrderDetail`）
2. **直接购买**：检查 `wx.getStorageSync('directBuyProduct')` → 设置 `directBuy: true` → 构建 items → `calculateTotal()` → `wx.removeStorageSync('directBuyProduct')`
3. **购物车结算**：无特殊参数 → 在 `onShow` 中调用 `fetchSelectedItemsFromCart()` → `manage-cart`（action: `list`）→ 过滤 `status || selected` 的商品

**地址加载（`fetchDefaultAddress`）：**
- 先尝试 `manage-address`（action: `getDefault`）
- 若无默认地址，回退到 `manage-address`（action: `list`）取第一个

**支付流程（`click_pay_btn`）：**
1. 验证：`auth` 已勾选 + 地址已选 + 商品列表非空
2. 若 `currentOrder` 已存在（重新支付），直接进入步骤 4
3. 创建订单：
   - 直接购买模式：`manage-order-easy`（action: `createDirectOrder`，data: `{_userId, _addressId, _skuId, quantity}`）
   - 购物车模式：`manage-order-easy`（action: `createOrderFromCart`，data: `{_userId, _addressId}`）
4. 调用微信支付：`wxpayFunctions`（type: `wxpay_order`，data: `{_orderId, orderNo, description}`）
5. 发起支付：`Taro.requestPayment({timeStamp, nonceStr, package: packageVal, paySign, signType: 'RSA'})`
6. 支付成功 → `handlePaymentSuccess()`
7. 支付失败 → `handlePaymentFailure()`

**支付成功处理（`handlePaymentSuccess`）：**
1. `queryWxpayOrderDetail(orderNo)` — 查询支付结果确认
2. `updateOrderAfterPayment(orderId, 'paid', transaction_id, payTime)` — 调用 `manage-order-easy`（action: `updateOrderStatus`）
3. 购物车模式：`clearPurchasedFromCart()` — 重新获取购物车，过滤已选商品，逐个调用 `manage-cart`（action: `remove`）删除
4. 跳转到订单列表页（待发货 Tab）

**支付失败处理（`handlePaymentFailure`）：**
1. `updateOrderAfterPayment(orderId, 'payment_failed')` — 更新订单状态
2. `Taro.showToast({ title: '支付失败', icon: 'none' })`
3. 延迟 2 秒后 `navigateBack`

**价格计算（`calculateTotal`）：**
- `total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)`
- 使用 `formatPrice(total)` 格式化显示

**页面间数据传递：**
- 直接购买：通过 `wx.setStorageSync('directBuyProduct', productInfo)` 传递，支付页 `onLoad` 中读取后立即 `removeStorageSync`
- 购物车结算：支付页 `onShow` 中实时从云端获取已选商品
- 订单重新支付：通过 URL 参数 `orderId` 传递
- 地址选择：跳转选地址页，选中后通过 `getCurrentPages()[length-2].setData({address})` 回传

**UI 结构（WXML，179 行）：**
- TopBarWithBack
- 地址区：detailAddress（主）、provinceCity（副）、name + phone；无地址时显示"添加地址"按钮
- 发货提示："商品将会在付款后20个工作日内发货"
- 商品列表（ScrollView）：每项含 image、name、foreign_name、material、size/color、quantity、formattedPrice、formattedSubtotal
- 空状态：显示"购物车中没有选中的商品"+ 返回购物车按钮
- 支付方式选择器（仅微信支付，含勾选框）
- 订单备注 Textarea（500 字上限 + 字数计数器）
- 总价显示
- 隐私协议勾选：隐私政策 + 用户协议链接（`catchtap` 阻止冒泡）
- 支付按钮
- FloatPopup

### 5. payment_failed（支付失败，简单页面）

**状态字段：**
- `icon` — 失败图标路径
- `isPopupShow` — FloatPopup 显示状态

**核心逻辑：**
- `click_re_pay()` — `wx.redirectTo('/pages/payment/payment')` 重新支付
- `click_view_order()` — `wx.redirectTo('/pages/my_sub_page/my_sub_page?type=pending_payment')` 查看订单

**UI 结构：**
- TopBarWithBack
- 居中图标 + "支付失败" 文字 + 说明文字
- 两个按钮：「重新支付」、「查看订单」
- FloatPopup

### 6. payment_sub_page_select_address（支付选地址）

**状态字段：**
- `is_address_list_empty` — 地址列表是否为空
- `address_list[]` — 地址列表（每项含 `_id`、`receiver`、`phone`、`provinceCity`、`detailAddress`、`isDefault`）
- `confirm_address_id` — 当前选中的地址 ID
- `default_address_id` — 默认地址 ID

**生命周期：**
- `onShow` 中加载地址列表（每次显示都刷新，支持从新增地址页返回后更新）
- 调用 `getUserInfo` 获取 userId → `manage-address`（action: `list`，data: `{_userId}`）

**核心逻辑：**
- `select_this_address(e)` — 设置 `confirm_address_id = e.currentTarget.dataset.id`
- `click_confirm()` — 格式化选中地址 → 通过 `getCurrentPages()[length-2].setData({address})` 回传给支付页 → `navigateBack`
- `click_add_new_address()` — `navigateTo('/pages/add_new_address/add_new_address')`
- `click_edit_address(e)` — `navigateTo('/pages/add_new_address/add_new_address?addressId=${id}')`

**UI 结构：**
- TopBarWithBack
- "新增地址" 按钮
- 地址列表：每项含选中/未选中单选框、默认标签、receiver + phone、provinceCity + detailAddress、编辑按钮
- 底部确认按钮
- FloatPopup

## 产出文件清单

```
src/
├── pages/
│   └── product-detail/
│       ├── index.tsx
│       ├── index.config.ts
│       └── index.module.scss
└── pages-sub/
    ├── series-detail/
    │   ├── index.tsx
    │   ├── index.config.ts
    │   └── index.module.scss
    ├── series-promotion/
    │   ├── index.tsx
    │   ├── index.config.ts
    │   └── index.module.scss
    ├── payment/
    │   ├── index.tsx
    │   ├── index.config.ts
    │   └── index.module.scss
    ├── payment-failed/
    │   ├── index.tsx
    │   ├── index.config.ts
    │   └── index.module.scss
    └── payment-select-address/
        ├── index.tsx
        ├── index.config.ts
        └── index.module.scss
```

## 实现要求

### 1. 商品详情页 — `src/pages/product-detail/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  enableShareAppMessage: true,
})
```

**依赖：**
- Hooks：`useSystemInfo`、`useAuth`、`useImageProcessor`
- Stores：`useUserStore`、`useCartStore`
- Services：`productService`（`getProductDetail`、`getRecommendations`）、`cartService`（`addToCart`）、`wishService`（`checkWish`、`addWish`、`removeWish`）
- Components：`TopBarWithBack`、`LoadingBar`、`FloatPopup`、`FloatBtn`、`SizePopup`、`CartSuccessPopup`
- Taro Components：`Swiper`、`SwiperItem`、`Image`、`ScrollView`、`View`、`Text`
- Taro API：`Taro.previewImage`、`Taro.navigateTo`、`Taro.switchTab`、`Taro.showToast`、`useShareAppMessage`
- Utils：`formatPrice`

**页面参数：**

```typescript
// 通过 useRouter 获取
interface ProductDetailParams {
  /** SKU 数据库 _id（主入口） */
  skuId?: string
  /** SPU ID（备用入口，兼容旧链接） */
  spuId?: string
}
```

**页面状态：**

```typescript
interface ProductDetailState {
  loading: boolean
  images: string[]                    // SKU 主图（已压缩）
  currentImageIndex: number           // 当前轮播索引
  nameCN: string
  nameEN: string
  skuId: string                       // 显示用编号
  price: number
  sizeValue: string
  materialName: string
  quantity: number                    // 购买数量，默认 1
  showSizeSelector: boolean           // 是否显示尺码选择器
  availableSizes: SizeOption[]        // 可选尺码列表
  relatedSkus: RelatedSku[]           // 关联 SKU（更多款式）
  giftBoxImages: string[]             // 礼盒详情图
  recommendations: RecommendProduct[] // 推荐商品（最多 3 个）
  isInWishlist: boolean
  currentWishId: string | null
  serviceStates: Record<string, boolean>  // 服务项折叠状态
  showCartSuccess: boolean            // 加购成功弹窗
  showFloatPopup: boolean             // 咨询弹窗
  currentSku: Sku | null              // 完整 SKU 对象（加购/购买时使用）
}

interface SizeOption {
  skuId: string       // 该尺码对应的 SKU _id
  sizeValue: string   // 尺码显示值
  stock: number       // 库存
  selected: boolean   // 是否当前选中
}

interface RelatedSku {
  _id: string
  skuId: string       // 显示用编号
  materialName: string
  image: string       // 已压缩缩略图
}

interface RecommendProduct {
  _id: string
  skuId: string
  nameCN: string
  nameEN: string
  price: number
  image: string
  priority: number
}
```

**核心逻辑：**

**1. 页面初始化（`useLoad`）：**
- 通过 `useRouter()` 获取 `params.skuId` 或 `params.spuId`
- 调用 `loadProductDetail(skuId)` 加载商品数据
- 若仅有 `spuId`，先调用 `productService.getProductDetail(spuId)` 获取默认 SKU 再加载

**2. 加载商品详情（`loadProductDetail`）：**
- 调用 `productService.getProductDetail(skuId)`
- 使用 `useImageProcessor.processImages()` 处理图片：
  - SKU 主图：`{ width: 750, height: 750, quality: 80 }`
  - 礼盒图（`skuDetailImages`）：`{ width: 750, height: 469, quality: 80 }`
  - 关联 SKU 图：`{ width: 300, height: 300, quality: 50 }`
- 尺码选择器：检查 `nameCN` 是否包含"手镯"，是则从 `relatedSkus.sameMaterial.sizes` 构建 `availableSizes`
- 关联 SKU：从 `relatedSkus.otherMaterials` 构建 `relatedSkus` 列表
- 收藏状态：调用 `wishService.checkWish(userId, spuId, skuId)`
- 推荐商品：调用 `productService.getRecommendations(skuId)`，按 priority 排序，最高优先级放中间位置

**3. 加入购物车：**
- 调用 `useAuth.ensureRegistered()` 检查注册状态
- 调用 `cartService.addToCart(userId, currentSku._id, quantity)`
- 成功后设置 `showCartSuccess = true`

**4. 直接购买：**
- 调用 `useAuth.ensureRegistered()` 检查注册状态
- 使用 `Taro.setStorageSync('directBuyProduct', productInfo)` 存储商品信息
- `productInfo` 结构：`{ skuId: currentSku._id, quantity, price, name: nameCN, nameEN, material: materialName, size: sizeValue, image: images[0], directBuy: true }`
- 跳转：`Taro.navigateTo({ url: '/pages-sub/payment/index' })`

**5. 收藏切换：**
- 已收藏：调用 `wishService.removeWish(currentWishId)` → 设置 `isInWishlist = false`
- 未收藏：调用 `wishService.addWish(userId, spuId, skuId)` → 设置 `isInWishlist = true`，存储返回的 `wishId`

**6. 尺码切换：**
- 点击不同尺码时，获取对应 `skuId`，调用 `loadProductDetail(newSkuId)` 重新加载

**7. 关联 SKU 跳转：**
- `Taro.navigateTo({ url: '/pages/product-detail/index?skuId=${relatedSku._id}' })`

**8. 分享：**
- 使用 Taro 的 `useShareAppMessage` Hook
- 返回 `{ title: nameCN + ' ' + nameEN, path: '/pages/product-detail/index?skuId=${currentSku._id}', imageUrl: '/assets/images/share.jpg' }`

**9. 服务项折叠：**
- `serviceStates` 初始值：`{ delivery: false, afterSales: false, returnPolicy: false }`
- 点击切换对应 key 的布尔值

**关键样式：**
- 图片轮播区：`width: 100%; height: 750rpx`，Swiper 占满
- 自定义轮播指示器：底部居中，格式 `currentIndex / total`，`font-size: 24rpx; color: #999`
- 商品信息区：`padding: 30rpx`
- nameEN：`font-size: 28rpx; color: #999; margin-bottom: 10rpx`
- skuId 编号：`font-size: 24rpx; color: #bbb`
- nameCN：`font-size: 36rpx; font-weight: 600; color: #333`
- 收藏图标：`width: 44rpx; height: 44rpx`，已收藏红色填充，未收藏空心
- 价格：`font-size: 36rpx; font-weight: 600; color: #333; margin-top: 20rpx`
- 尺码选择区：横向滚动，每项 `padding: 12rpx 24rpx; border: 1rpx solid #ddd; border-radius: 8rpx`，选中态 `background: #000; color: #fff`，售罄态 `opacity: 0.4; text-decoration: line-through`
- 关联 SKU 网格：`display: grid; grid-template-columns: repeat(3, 1fr); gap: 20rpx`，图片 `width: 100%; aspect-ratio: 1; border-radius: 8rpx`
- 礼盒图：`width: 100%; mode: widthFix`
- 服务项：可折叠，标题行 `display: flex; justify-content: space-between; padding: 24rpx 0; border-bottom: 1rpx solid #eee`，箭头旋转动画
- 推荐商品：3 列网格，图片 `aspect-ratio: 1`
- 底部操作栏：`position: fixed; bottom: 0; width: 100%; height: 100rpx; background: #fff; z-index: 998; display: flex; padding-bottom: env(safe-area-inset-bottom)`
- 客服按钮：`width: 100rpx`，图标居中
- 购物车按钮：`width: 100rpx`，图标居中
- 加入购物车按钮：`flex: 1; background: #fff; color: #333; border: 1rpx solid #333; font-size: 28rpx`
- 立即结算按钮：`flex: 1; background: #000; color: #fff; font-size: 28rpx`

### 2. 系列详情页 — `src/pages-sub/series-detail/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  enableShareAppMessage: true,
})
```

**依赖：**
- Hooks：`useSystemInfo`、`useImageProcessor`、`usePagination`
- Services：`productService`（`getProductsBySubSeries`、`listSubSeries`、`listMaterials`）
- Components：`TopBarWithBack`、`LoadingBar`
- Taro Components：`Image`、`ScrollView`、`View`、`Text`
- Taro API：`Taro.navigateTo`、`useShareAppMessage`
- Utils：`formatPrice`

**页面参数：**

```typescript
interface SeriesDetailParams {
  /** 子系列 ID */
  subSeriesId: string
}
```

**页面状态：**

```typescript
interface SeriesDetailState {
  subSeriesInfo: SubSeries | null
  products: SeriesProduct[]
  productCount: number
  currentSort: 'default' | 'price_asc' | 'price_desc'
  showSortPanel: boolean
  showFilterPanel: boolean
  materials: MaterialFilter[]
  selectedMaterialIds: string[]
}

interface SeriesProduct {
  _id: string
  skuId: string
  nameCN: string
  nameEN: string
  price: number
  formattedPrice: string
  image: string
}

interface MaterialFilter {
  _id: string
  nameCN: string
  selected: boolean
}
```

**核心逻辑：**

**1. 页面初始化（`useLoad`）：**
- 通过 `useRouter()` 获取 `params.subSeriesId`
- 并行调用：`loadSubSeriesInfo()` + `loadProducts()`

**2. 加载子系列信息：**
- 调用 `productService.listSubSeries()` 获取子系列详情（或通过 `get-product` 的 `getProductsBySubSeries` 返回的附带信息）

**3. 加载商品列表（使用 `usePagination`）：**
- `fetchFn` 调用 `productService.getProductsBySubSeries({ subSeriesId, sortBy: currentSort, page, pageSize: 20, materialIds: selectedMaterialIds })`
- 返回数据使用 `useImageProcessor.processImages()` 处理图片
- 价格使用 `formatPrice` 格式化

**4. 筛选逻辑：**
- 从已加载商品中提取不重复的 `materialId` 列表
- 调用 `productService.listMaterials()` 获取材质名称
- 选择/取消材质后，调用 `usePagination.refresh()` 重新加载

**5. 排序逻辑：**
- 切换排序后，更新 `currentSort`，调用 `usePagination.refresh()` 重新加载

**6. 商品点击：**
- `Taro.navigateTo({ url: '/pages/product-detail/index?skuId=${product._id}' })`

**7. 分享：**
- `useShareAppMessage` 返回 `{ title: subSeriesInfo.nameEN, path: '/pages-sub/series-detail/index?subSeriesId=${subSeriesId}' }`

**关键样式：**
- 头图：`width: 100%; mode: widthFix`
- 标题区：`padding: 30rpx`，nameEN `font-size: 36rpx; font-weight: 600`，nameCN `font-size: 28rpx; color: #999`
- 工具栏：`display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx; border-bottom: 1rpx solid #eee`
- 商品数量：`font-size: 26rpx; color: #999`
- 筛选/排序按钮：`font-size: 26rpx; color: #333`，带下拉箭头图标
- 筛选面板：底部弹出，`position: fixed; bottom: 0; width: 100%; background: #fff; z-index: 999; border-radius: 20rpx 20rpx 0 0`
- 材质复选框：`width: 36rpx; height: 36rpx`，选中态黑色填充
- 排序面板：下拉展开，每项 `padding: 24rpx 30rpx`，选中态 `font-weight: 600; color: #000`
- 商品网格：`display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; padding: 20rpx`
- 商品图片：`width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8rpx`
- 商品名称：nameEN `font-size: 26rpx; color: #333`，nameCN `font-size: 24rpx; color: #999`
- 商品价格：`font-size: 28rpx; font-weight: 600; color: #333`
- 底部状态文字：`text-align: center; padding: 30rpx; font-size: 24rpx; color: #999`

### 3. 系列推广页 — `src/pages-sub/series-promotion/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
})
```

**依赖：**
- Components：`TopBarWithBack`
- Taro Components：`Image`、`View`

**页面参数：**

```typescript
interface SeriesPromotionParams {
  /** 推广图片 URL */
  image: string
}
```

**核心逻辑：**
- 通过 `useRouter()` 获取 `params.image`（需 `decodeURIComponent`）
- 纯展示页面，无云函数调用，无交互逻辑

**关键样式：**
- 图片：`width: 100%; mode: widthFix`
- 容器：`min-height: 100vh; background: #fff`

### 4. 支付页 — `src/pages-sub/payment/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
})
```

**依赖：**
- Hooks：`useSystemInfo`、`useAuth`
- Stores：`useUserStore`、`useCartStore`
- Services：`orderService`（`createOrderFromCart`、`createDirectOrder`、`updateOrderStatus`、`getOrderDetail`）、`paymentService`（`createPayment`、`queryPayment`）、`addressService`（`getDefaultAddress`、`listAddresses`）、`cartService`（`getCartItems`、`removeCartItem`）
- Components：`TopBarWithBack`、`FloatPopup`、`FloatBtn`
- Taro Components：`Image`、`ScrollView`、`View`、`Text`、`Textarea`
- Taro API：`Taro.requestPayment`、`Taro.navigateTo`、`Taro.navigateBack`、`Taro.getStorageSync`、`Taro.removeStorageSync`、`Taro.showToast`、`Taro.redirectTo`
- Utils：`formatPrice`

**页面参数：**

```typescript
interface PaymentParams {
  /** 订单 ID（重新支付模式） */
  orderId?: string
}
```

**页面状态：**

```typescript
interface PaymentAddress {
  _id: string
  receiver: string
  phone: string
  provinceCity: string
  detailAddress: string
}

interface PaymentItem {
  _cartItemId?: string
  skuId: string
  name: string
  nameEN: string
  price: number
  quantity: number
  image: string
  material: string
  size?: string
  formattedPrice: string
  formattedSubtotal: string
}

interface PaymentState {
  mode: 'cart' | 'directBuy' | 'repay'
  address: PaymentAddress | null
  items: PaymentItem[]
  totalPrice: number
  formattedTotalPrice: string
  authAgreed: boolean
  remark: string
  currentOrder: Order | null
  paying: boolean
  showFloatPopup: boolean
}
```

**核心逻辑：**

**1. 页面初始化（`useLoad` + `useDidShow`）：**

三种入口模式判断：

```typescript
// useLoad 中：
const { orderId } = useRouter().params

if (orderId) {
  // 模式 1：订单重新支付
  setMode('repay')
  loadOrderInfo(orderId)
} else {
  const directBuyProduct = Taro.getStorageSync('directBuyProduct')
  if (directBuyProduct) {
    // 模式 2：直接购买
    setMode('directBuy')
    loadDirectBuyItems(directBuyProduct)
    Taro.removeStorageSync('directBuyProduct')
  } else {
    // 模式 3：购物车结算（在 useDidShow 中加载）
    setMode('cart')
  }
}

// useDidShow 中（仅 cart 模式）：
if (mode === 'cart') {
  fetchSelectedCartItems()
}
// 所有模式都加载默认地址
fetchDefaultAddress()
```

**2. 加载购物车已选商品（`fetchSelectedCartItems`）：**
- 调用 `cartService.getCartItems(userId)`
- 过滤 `checked === true` 的商品
- 归一化字段映射（与旧代码一致）：
  - `name` ← `skuInfo.nameCN || spuInfo.name`
  - `price` ← `unitPrice || skuInfo.price || spuInfo.referencePrice`
  - `image` ← `skuInfo.skuMainImages[0] || spuInfo.mainImages[0]`
  - `material` ← `materialInfo.nameCN`
  - `size` ← `sizeInfo.value`
- 计算总价并格式化

**3. 加载默认地址（`fetchDefaultAddress`）：**
- 先调用 `addressService.getDefaultAddress(userId)`
- 若无默认地址，调用 `addressService.listAddresses(userId)` 取第一个
- 若无任何地址，`address` 保持 `null`

**4. 地址选择：**
- 点击地址区域跳转：`Taro.navigateTo({ url: '/pages-sub/payment-select-address/index' })`
- 选地址页通过 `Taro.eventCenter` 回传选中地址（替代旧代码的 `getCurrentPages().setData` 模式）

**地址回传设计（替代 `getCurrentPages().setData`）：**

```typescript
// 支付页：监听地址选择事件
useDidShow(() => {
  Taro.eventCenter.on('selectAddress', (address: PaymentAddress) => {
    setAddress(address)
  })
})
// 组件卸载时移除监听
useEffect(() => {
  return () => { Taro.eventCenter.off('selectAddress') }
}, [])

// 选地址页：触发事件并返回
const confirmAddress = () => {
  Taro.eventCenter.trigger('selectAddress', selectedAddress)
  Taro.navigateBack()
}
```

**5. 支付流程（`handlePay`）：**

```typescript
async function handlePay() {
  // 1. 前置验证
  if (!authAgreed) return Taro.showToast({ title: '请先同意隐私协议', icon: 'none' })
  if (!address) return Taro.showToast({ title: '请选择收货地址', icon: 'none' })
  if (items.length === 0) return Taro.showToast({ title: '没有待支付商品', icon: 'none' })

  setPaying(true)

  // 2. 创建订单（若尚未创建）
  let order = currentOrder
  if (!order) {
    const res = mode === 'directBuy'
      ? await orderService.createDirectOrder({ _userId: userId, _addressId: address._id, _skuId: items[0].skuId, quantity: items[0].quantity })
      : await orderService.createOrderFromCart(userId, address._id)
    if (res.code !== 200) {
      setPaying(false)
      return Taro.showToast({ title: res.message || '创建订单失败', icon: 'none' })
    }
    order = res.data
    setCurrentOrder(order)
  }

  // 3. 调用微信支付
  const payRes = await paymentService.createPayment(order._id, order.orderNo, `YZHENG订单-${order.orderNo}`)
  if (payRes.code !== 200) {
    setPaying(false)
    return Taro.showToast({ title: '支付创建失败', icon: 'none' })
  }

  // 4. 发起支付
  const { timeStamp, nonceStr, packageVal, paySign } = payRes.data
  try {
    await Taro.requestPayment({
      timeStamp, nonceStr,
      package: packageVal,
      signType: 'RSA',
      paySign,
    })
    await handlePaymentSuccess(order)
  } catch {
    await handlePaymentFailure(order)
  } finally {
    setPaying(false)
  }
}
```

**6. 支付成功处理（`handlePaymentSuccess`）：**
- 调用 `paymentService.queryPayment(order.orderNo)` 确认支付结果
- 调用 `orderService.updateOrderStatus({ updateData: { _orderId: order._id, _userId: userId, newStatus: 'paid', transactionId, payTime } })`
- 购物车模式：清除已购商品 — 重新获取购物车列表，过滤已选商品，逐个调用 `cartService.removeCartItem(cartItemId)`
- 跳转：`Taro.redirectTo({ url: '/pages-sub/order-list/index?type=pending_delivery' })`

**7. 支付失败处理（`handlePaymentFailure`）：**
- 调用 `orderService.updateOrderStatus({ updateData: { _orderId: order._id, _userId: userId, newStatus: 'payment_failed' } })`
- `Taro.showToast({ title: '支付失败', icon: 'none' })`
- 延迟 2 秒后 `Taro.navigateBack()`

**关键样式：**
- 地址区：`padding: 30rpx; background: #fff; margin-bottom: 20rpx`，detailAddress `font-size: 30rpx; font-weight: 600`，provinceCity `font-size: 26rpx; color: #999`，name+phone `font-size: 26rpx; color: #666`
- 无地址状态：居中显示"添加收货地址"按钮，`border: 1rpx dashed #ddd; padding: 40rpx; text-align: center`
- 发货提示：`font-size: 24rpx; color: #999; padding: 20rpx 30rpx; background: #f9f9f9`
- 商品列表项：`display: flex; padding: 20rpx 30rpx; gap: 20rpx`，图片 `width: 160rpx; height: 160rpx; border-radius: 8rpx`
- 商品名称：`font-size: 28rpx; color: #333`，外文名 `font-size: 24rpx; color: #999`
- 商品规格：`font-size: 24rpx; color: #999`
- 商品价格：`font-size: 28rpx; color: #333; text-align: right`
- 备注区：`padding: 30rpx`，Textarea `width: 100%; height: 160rpx; border: 1rpx solid #eee; border-radius: 8rpx; padding: 20rpx; font-size: 28rpx`
- 字数计数：`font-size: 24rpx; color: #999; text-align: right`
- 隐私协议区：`padding: 20rpx 30rpx; font-size: 24rpx; color: #999`，链接 `color: #333; text-decoration: underline`
- 总价区：`padding: 30rpx; font-size: 36rpx; font-weight: 600; text-align: right`
- 支付按钮：`width: 100%; height: 88rpx; background: #000; color: #fff; font-size: 30rpx; border-radius: 8rpx; margin: 30rpx auto`

### 5. 支付失败页 — `src/pages-sub/payment-failed/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
})
```

**依赖：**
- Components：`TopBarWithBack`、`FloatPopup`、`FloatBtn`
- Taro Components：`Image`、`View`、`Text`
- Taro API：`Taro.redirectTo`

**核心逻辑：**
- 无页面参数，无云函数调用
- `handleRePay()` — `Taro.redirectTo({ url: '/pages-sub/payment/index' })`
- `handleViewOrder()` — `Taro.redirectTo({ url: '/pages-sub/order-list/index?type=pending_payment' })`

**关键样式：**
- 容器：`display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 60rpx`
- 失败图标：`width: 160rpx; height: 160rpx; margin-bottom: 40rpx`
- 标题"支付失败"：`font-size: 36rpx; font-weight: 600; color: #333; margin-bottom: 20rpx`
- 说明文字：`font-size: 28rpx; color: #999; margin-bottom: 60rpx; text-align: center`
- 按钮容器：`display: flex; gap: 30rpx; width: 100%; padding: 0 40rpx`
- 重新支付按钮：`flex: 1; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx; font-size: 30rpx`
- 查看订单按钮：`flex: 1; height: 88rpx; background: #f5f5f5; color: #333; border-radius: 8rpx; font-size: 30rpx`

### 6. 支付选地址页 — `src/pages-sub/payment-select-address/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
})
```

**依赖：**
- Hooks：`useSystemInfo`、`useAuth`
- Stores：`useUserStore`
- Services：`addressService`（`listAddresses`）
- Components：`TopBarWithBack`、`FloatPopup`、`FloatBtn`
- Taro Components：`Image`、`View`、`Text`、`ScrollView`
- Taro API：`Taro.navigateTo`、`Taro.navigateBack`、`Taro.eventCenter`

**页面状态：**

```typescript
interface SelectAddressState {
  addresses: Address[]
  selectedId: string | null
  loading: boolean
}
```

**核心逻辑：**

**1. 页面初始化（`useDidShow`）：**
- 每次页面显示时刷新地址列表（支持从新增地址页返回后更新）
- 调用 `addressService.listAddresses(userId)`
- 默认选中 `isDefault === true` 的地址

**2. 选择地址：**
- 点击地址项设置 `selectedId = address._id`

**3. 确认选择：**
- 通过 `Taro.eventCenter.trigger('selectAddress', selectedAddress)` 回传给支付页
- 调用 `Taro.navigateBack()`

**4. 新增地址：**
- `Taro.navigateTo({ url: '/pages-sub/address-edit/index' })`

**5. 编辑地址：**
- `Taro.navigateTo({ url: '/pages-sub/address-edit/index?addressId=${id}' })`

**关键样式：**
- 新增地址按钮：`width: 100%; height: 88rpx; border: 1rpx dashed #ddd; border-radius: 8rpx; text-align: center; line-height: 88rpx; font-size: 28rpx; color: #999; margin: 20rpx 0`
- 地址列表项：`display: flex; align-items: flex-start; padding: 30rpx; background: #fff; margin-bottom: 10rpx`
- 单选框：`width: 40rpx; height: 40rpx; border-radius: 50%; border: 2rpx solid #ddd; margin-right: 20rpx; flex-shrink: 0`，选中态 `background: #000; border-color: #000`
- 默认标签：`display: inline-block; padding: 4rpx 12rpx; background: #000; color: #fff; font-size: 20rpx; border-radius: 4rpx; margin-left: 10rpx`
- 收件人+电话：`font-size: 28rpx; font-weight: 600; color: #333`
- 地址详情：`font-size: 26rpx; color: #666; margin-top: 10rpx`
- 编辑按钮：`width: 40rpx; height: 40rpx; flex-shrink: 0; margin-left: auto`
- 底部确认按钮：`position: fixed; bottom: 0; width: 100%; height: 100rpx; background: #000; color: #fff; font-size: 32rpx; padding-bottom: env(safe-area-inset-bottom)`

## 验收标准

### 通用标准

1. 所有 6 个页面文件（含 `index.tsx`、`index.config.ts`、`index.module.scss`）无 TypeScript 编译错误
2. 每个页面均为 React 函数组件，使用 SCSS Modules 进行样式隔离
3. 所有文件 `import` 路径正确，无循环依赖
4. 所有页面的 `index.config.ts` 正确设置 `navigationStyle: 'custom'`
5. 需要分享功能的页面（商品详情、系列详情）正确设置 `enableShareAppMessage: true` 并使用 `useShareAppMessage` Hook

### 商品详情页

6. 页面支持 `skuId` 和 `spuId` 两种入口参数，均能正确加载商品数据
7. 图片轮播使用 `Swiper` + `SwiperItem`，自定义进度指示器显示 `currentIndex / total` 格式
8. 点击轮播图调用 `Taro.previewImage` 预览大图，`urls` 为全部主图，`current` 为当前图
9. 尺码选择器仅在 `nameCN` 包含"手镯"时显示，切换尺码调用 `loadProductDetail(newSkuId)` 重新加载
10. 关联 SKU（更多款式）点击后 `Taro.navigateTo` 新开商品详情页
11. 收藏切换正确调用 `wishService.addWish` / `removeWish`，UI 状态即时更新
12. 加入购物车流程：`ensureRegistered()` → `cartService.addToCart()` → 显示 `CartSuccessPopup`
13. 直接购买流程：`ensureRegistered()` → `Taro.setStorageSync('directBuyProduct', productInfo)` → `navigateTo` 支付页
14. 推荐商品按 `priority` 排序，最高优先级放中间位置（index 1）
15. 服务项（配送、售后、退换货）可折叠展开，箭头旋转动画正确
16. 底部操作栏固定定位，包含客服（触发 FloatPopup）、购物车（switchTab）、加入购物车、立即结算四个按钮

### 系列详情页

17. 页面通过 `useRouter()` 获取 `subSeriesId` 参数，并行加载子系列信息和商品列表
18. 商品列表使用 `usePagination` Hook，支持下拉加载更多（`pageSize: 20`）
19. 排序功能支持三种模式（默认、价格升序、价格降序），切换后调用 `usePagination.refresh()` 重置
20. 筛选面板从底部弹出，材质复选框列表支持多选，重置/确认按钮功能正确
21. 商品网格为 2 列布局，点击商品跳转商品详情页
22. 底部状态正确显示：加载中 / 暂无商品 / 没有更多了

### 系列推广页

23. 页面通过 `useRouter()` 获取 `image` 参数并 `decodeURIComponent` 解码
24. 纯展示页面，仅显示一张全宽图片（`mode="widthFix"`），无云函数调用，无交互逻辑

### 支付页

25. 三种入口模式正确判断：`orderId` 参数 → 重新支付；`directBuyProduct` Storage → 直接购买；否则 → 购物车结算
26. 直接购买模式：从 `Taro.getStorageSync('directBuyProduct')` 读取商品信息后立即 `removeStorageSync` 清除
27. 购物车模式：在 `useDidShow` 中调用 `cartService.getCartItems()` 并过滤 `checked === true` 的商品
28. 默认地址加载：先尝试 `getDefaultAddress`，无默认地址则回退到 `listAddresses` 取第一个
29. 地址选择使用 `Taro.eventCenter` 模式：支付页监听 `selectAddress` 事件，选地址页触发事件并 `navigateBack`
30. 支付前置验证：隐私协议已勾选 + 地址已选 + 商品列表非空，验证失败时 `showToast` 提示
31. 订单创建：直接购买调用 `createDirectOrder`，购物车调用 `createOrderFromCart`，重新支付跳过创建
32. 微信支付调用 `Taro.requestPayment`，参数 `signType` 为 `'RSA'`，`package` 字段使用 `packageVal`
33. 支付成功：查询支付结果 → 更新订单状态为 `'paid'` → 购物车模式清除已购商品 → `redirectTo` 订单列表页
34. 支付失败：更新订单状态为 `'payment_failed'` → `showToast` 提示 → 延迟 2 秒 `navigateBack`
35. 总价计算：`items.reduce((sum, item) => sum + item.price * item.quantity, 0)`，使用 `formatPrice` 格式化
36. 备注 Textarea 最多 500 字，实时显示字数计数

### 支付失败页

37. 页面无参数、无云函数调用，纯静态展示
38. 「重新支付」按钮调用 `Taro.redirectTo` 跳转支付页
39. 「查看订单」按钮调用 `Taro.redirectTo` 跳转订单列表页（`type=pending_payment`）

### 支付选地址页

40. 地址列表在 `useDidShow` 中加载，每次页面显示都刷新（支持从新增地址页返回后更新）
41. 默认地址自动选中（`isDefault === true`），选中态单选框为黑色填充
42. 点击地址项切换选中状态，点击确认按钮通过 `Taro.eventCenter.trigger('selectAddress', address)` 回传并 `navigateBack`
43. 新增地址按钮跳转 `/pages-sub/address-edit/index`，编辑按钮跳转 `/pages-sub/address-edit/index?addressId=${id}`
44. 底部确认按钮固定定位，包含安全区域底部 padding
