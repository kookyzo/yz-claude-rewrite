# Phase 02: 基础设施层

## 目标

实现 TypeScript 类型定义、Service 层（云函数封装）、工具函数，为后续所有页面开发提供类型安全的基础设施。

## 前置依赖

- Phase 01 完成（项目骨架、云函数已复制）

## 旧代码摘要

### API 调用模式

旧项目有两种云函数调用方式并存：

**1. `callCF()` 封装（`utils/cf.js`）：**
- 自动注入 `_userId`（通过 `app.ensureLogin()`）
- `attachTo` 参数控制 userId 注入位置：`'root'` | `'data'` | `'auto'`
- 返回值永远是对象，不抛异常
- 失败返回 `{ code: 500, message: err.errMsg }`
- 未登录返回 `{ code: 401, message: 'unauthenticated' }`

**2. 直接 `wx.cloud.callFunction()`：**
- 在 home、Category、Product_Details 等页面中使用
- 手动处理 `res.result`

### 云函数统一响应格式

所有云函数遵循 Action-Based 路由模式：

```
请求: { action: 'add' | 'update' | 'delete' | 'list' | 'get', data: {...} }
响应: { code: 200|400|401|404|409|500, message: '描述', data: {...} }
```

### 数据库核心数据模型

**Users 集合：**
- `openId`, `userId`（`user_YYMM_XXXXXXXX` 格式）, `firstName`, `lastName`, `phone`, `birthday`, `gender`, `region`, `title`, `nickname`, `mail`

**ProductSkus 集合：**
- `skuId`, `nameCN`, `nameEN`, `price`, `skuMainImages[]`, `spuId`, `materialId`, `subSeries`, `sizeId`

**ProductSpus 集合：**
- `spuId`, `name`, `description`, `category`, `seriesId`, `isOnSale`, `mainImages[]`, `referencePrice`

**CartItems 集合：**
- `cartId`, `skuId`, `spuId`, `quantity`, `status`（选中状态）, `useSpecification`

**Orders 集合：**
- `userId`, `addressId`, `totalAmount`, `status`, `payMethod`, `transactionId`, `items[]`, `orderNo`, `createdAt`

**Addresses 集合：**
- `userId`, `receiver`, `phone`, `provinceCity`, `detailAddress`, `isDefault`

**Wishes 集合：**
- `userId`, `spuId`, `skuId`

**Reservations 集合：**
- `activityId`, `userId`, `name`, `phone`, `people`, `date`, `selectedTimes[]`, `submissionCount`

### 图片处理逻辑

旧项目中图片处理散落在多个页面，核心逻辑：
1. `cloud://` URL → 通过 `Taro.cloud.getTempFileURL()` 转为 HTTP URL
2. HTTP URL + 腾讯云 COS 压缩参数：`?imageView2/1/w/{width}/h/{height}/q/{quality}` 或 `?imageMogr2/thumbnail/{w}x{h}/quality/{q}/format/webp`
3. 批量处理：50 个/批，最多 3 并发

## 产出文件清单

```
src/
├── types/
│   ├── api.ts
│   ├── product.ts
│   ├── cart.ts
│   ├── order.ts
│   ├── user.ts
│   └── reservation.ts
├── services/
│   ├── cloud.ts
│   ├── product.service.ts
│   ├── cart.service.ts
│   ├── order.service.ts
│   ├── user.service.ts
│   ├── address.service.ts
│   ├── wish.service.ts
│   ├── reservation.service.ts
│   ├── payment.service.ts
│   ├── banner.service.ts
│   ├── cms.service.ts
│   └── image.service.ts
├── utils/
│   ├── format.ts
│   ├── image.ts
│   ├── navigation.ts
│   └── validate.ts
└── constants/
    └── index.ts
```

## 实现要求

### 1. `src/types/api.ts` — 通用 API 类型

```typescript
/** 云函数统一响应 */
export interface CloudResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}

/** 分页信息 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/** 带分页的列表响应 */
export interface PaginatedData<T> {
  items: T[];
  pagination: Pagination;
}
```

### 2. `src/types/product.ts` — 商品类型

```typescript
export interface Spu {
  _id: string;
  spuId: string;
  name: string;
  description: string;
  category: string;
  seriesId: string;
  isOnSale: boolean;
  mainImages: string[];
  referencePrice: number;
}

export interface Sku {
  _id: string;
  skuId: string;
  nameCN: string;
  nameEN: string;
  price: number;
  skuMainImages: string[];
  spuId: string;
  materialId: string;
  subSeries: string;
  sizeId?: string;
  stock?: number;
}

export interface Material {
  _id: string;
  nameCN: string;
  materialImage: string;
  sortNum?: number;
  isEnabled?: boolean;
}

export interface SubSeries {
  _id: string;
  name: string;
  displayImage: string;
  introduction?: string;
  parentSeriesId?: string;
  sortNum?: number;
  isEnabled?: boolean;
}

export interface Category {
  _id: string;
  typeName: string;
  displayImage?: string;
  status?: boolean;
}

export interface ProductSize {
  _id: string;
  category: { _id: string };
  type: string;
  standard: string;
  sizeNum: number;
  value: string;
  sortNum?: number;
  isEnabled?: boolean;
}
```

### 3. `src/types/cart.ts` — 购物车类型

```typescript
export interface CartItem {
  _cartItemId: string;
  skuId: string;
  spuId: string;
  quantity: number;
  checked: boolean;
  name: string;
  nameEN: string;
  price: number;
  image: string;
  material: string;
  size?: string;
}
```

### 4. `src/types/order.ts` — 订单类型

```typescript
export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'shipping'
  | 'signed'
  | 'completed'
  | 'cancelled'
  | 'payment_failed'
  | 'refunding'
  | 'refunded';

export interface OrderItem {
  skuId: string;
  spuId: string;
  quantity: number;
  unitPrice: number;
  skuNameCN: string;
  skuNameEN: string;
  skuImage: string[];
  materialName?: string;
}

export interface Order {
  _id: string;
  orderNo: string;
  userId: string;
  addressId: string;
  totalAmount: number;
  status: OrderStatus;
  payMethod?: string;
  transactionId?: string;
  items: OrderItem[];
  createdAt: number;
  logisticsNo?: string;
}
```

### 5. `src/types/user.ts` — 用户类型

```typescript
export interface User {
  _id: string;
  openId: string;
  userId: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  phone?: string;
  birthday?: string;
  gender?: string;
  title?: string;
  mail?: string;
  region?: string[];
}

export interface Address {
  _id: string;
  userId: string;
  receiver: string;
  phone: string;
  provinceCity: string;
  detailAddress: string;
  isDefault: boolean;
}
```

### 6. `src/types/reservation.ts` — 预约类型

```typescript
export interface Reservation {
  _id: string;
  userId: string;
  name: string;
  phone: string;
  people: string;
  date: string;
  selectedTimes: string[];
  submissionCount: number;
}
```

### 7. `src/services/cloud.ts` — 基础调用器

```typescript
import Taro from '@tarojs/taro'

export interface CloudResponse<T = any> {
  code: number;
  message: string;
  data?: T;
}

export async function callCloudFunction<T = any>(
  name: string,
  data: Record<string, any> = {}
): Promise<CloudResponse<T>> {
  try {
    const res = await Taro.cloud.callFunction({ name, data })
    return res.result as CloudResponse<T>
  } catch (err: any) {
    return {
      code: 500,
      message: err?.errMsg || 'cloud.callFunction failed',
    }
  }
}
```

要点：
- 永远返回 `CloudResponse`，不抛异常（与旧 `callCF` 行为一致）
- 泛型 `T` 用于 `data` 字段的类型推断

### 8. Service 文件实现要求

每个 service 文件导出具名函数，参数和返回值均有类型。以下列出每个 service 的函数签名和对应云函数调用。

**`user.service.ts`：**

| 函数 | 云函数 | Action | 参数 |
|------|--------|--------|------|
| `login()` | `login` | — | `{}` |
| `checkLogin()` | `login-easy` | `checkLogin` | `{}` |
| `loginEasy(userInfo)` | `login-easy` | `login` | `{ userInfo }` |
| `register(userInfo)` | `sign_up` | — | `{ userInfo: { gender, title, nickname, phone, birthday, region, mail } }` |
| `getUserInfo()` | `getUserInfo` | — | `{}` |
| `updateUser(data)` | `manage-user` | `update` | `{ action: 'update', data }` |
| `bindPhone(code)` | `bindPhoneNumber` | — | `{ code }` |

**`product.service.ts`：**

| 函数 | 云函数 | Action | 参数 |
|------|--------|--------|------|
| `getProductDetail(skuId)` | `get-product` | `getProductDetail` | `{ _skuId }` |
| `getProductsBySubSeries(params)` | `get-product` | `getProductsBySubSeries` | `{ subSeriesId, sortBy, page, pageSize }` |
| `getProductsByCategory(params)` | `get-product` | `getProductsByCategory` | `{ categoryId, sortBy, page, pageSize }` |
| `getProductsByMaterial(params)` | `get-product` | `getProductsByMaterial` | `{ materialId, sortBy, page, pageSize }` |
| `getProductsByFilter(params)` | `get-product` | `getProductsByFilter` | `{ subSeriesIds?, categoryIds?, materialIds?, sortBy, page, pageSize }` |
| `getModelShowData(skuIds)` | `get-product` | `getModelShowData` | `{ skuIds }` |
| `listSubSeries(filterEnabled?)` | `manage-subseries` | `list` | `{ filterEnabled }` |
| `listCategories()` | `manage-category` | `list` | `{}` |
| `listMaterials(filterEnabled?)` | `manage-material` | `list` | `{ filterEnabled }` |
| `getRecommendations(skuId)` | `manage-recommendations` | `getRecommendations` | `{ skuId, limit: 3 }` |

**`cart.service.ts`：**

| 函数 | 云函数 | Action | 参数 |
|------|--------|--------|------|
| `addToCart(userId, skuId, qty)` | `manage-cart` | `add` | `{ _userId, _skuId, quantity, useSpecification: true }` |
| `getCartItems(userId)` | `manage-cart` | `list` | `{ _userId }` |
| `toggleItemSelected(cartItemId, selected)` | `manage-cart` | `selected` | `{ _cartItemId, selected }` |
| `toggleAllSelected(userId, selected)` | `manage-cart` | `selectedAll` | `{ _userId, selected }` |
| `removeCartItem(cartItemId)` | `manage-cart` | `remove` | `{ _cartItemId }` |
| `updateCartItemQty(cartItemId, qty)` | `manage-cart` | `update` | `{ _cartItemId, quantity }` |

**`order.service.ts`：**

| 函数 | 云函数 | Action | 参数 |
|------|--------|--------|------|
| `createOrderFromCart(userId, addressId)` | `manage-order-easy` | `createOrderFromCart` | `{ _userId, _addressId }` |
| `createDirectOrder(params)` | `manage-order-easy` | `createDirectOrder` | `{ _userId, _addressId, _skuId, quantity }` |
| `updateOrderStatus(params)` | `manage-order-easy` | `updateOrderStatus` | `{ updateData: { _orderId, _userId, newStatus, ... } }` |
| `cancelOrder(orderId, userId)` | `manage-order-easy` | `cancelOrder` | `{ _orderId, _userId }` |
| `confirmReceipt(orderId, userId)` | `manage-order-easy` | `confirmReceipt` | `{ _orderId, _userId }` |
| `applyRefund(params)` | `manage-order-easy` | `applyRefund` | `{ _orderId, _userId, refundReason, refundAmount }` |
| `queryRefundStatus(orderId, userId)` | `manage-order-easy` | `queryRefundStatus` | `{ _orderId, _userId }` |
| `getOrderDetail(orderId, userId)` | `manage-order-easy` | `getOrderDetail` | `{ _orderId, _userId }` |
| `getUserOrders(userId, status?)` | `manage-order-easy` | `getUserOrders` | `{ _userId, status? }` |

**`address.service.ts`：**

| 函数 | 云函数 | Action | 参数 |
|------|--------|--------|------|
| `addAddress(userId, data)` | `manage-address` | `add` | `{ _userId, addressData }` |
| `editAddress(addressId, data)` | `manage-address` | `edit` | `{ _addressId, addressData }` |
| `deleteAddress(addressId)` | `manage-address` | `delete` | `{ _addressId }` |
| `listAddresses(userId)` | `manage-address` | `list` | `{ _userId }` |
| `setDefaultAddress(addressId)` | `manage-address` | `setDefault` | `{ _addressId }` |
| `getDefaultAddress(userId)` | `manage-address` | `getDefault` | `{ _userId }` |

**`wish.service.ts`：**

| 函数 | 云函数 | Action | 参数 |
|------|--------|--------|------|
| `addWish(userId, spuId, skuId)` | `manage-wish` | `add` | `{ userId, spuId, skuId }` |
| `removeWish(wishId)` | `manage-wish` | `remove` | `{ _wishId }` |
| `checkWish(userId, spuId, skuId)` | `manage-wish` | `check` | `{ userId, spuId, skuId }` |
| `listWishes(userId)` | `manage-wish` | `list` | `{ userId: { _id: _userId } }` |

**`reservation.service.ts`：**

| 函数 | 云函数 | Action | 参数 |
|------|--------|--------|------|
| `addReservation(data)` | `reservation-easy` | `add` | `{ name, phone, people, date, selectedTimes, submissionCount: 0 }` |
| `listReservations()` | `reservation-easy` | `list` | `{}` |
| `getReservation(id)` | `reservation-change` | `get` | `{ reservationId }` |
| `updateReservation(data)` | `reservation-change` | `update` | `{ reservationId, name, phone, people, date, selectedTimes }` |

**`payment.service.ts`：**

| 函数 | 云函数 | Action | 参数 |
|------|--------|--------|------|
| `createPayment(orderId, orderNo, desc)` | `wxpayFunctions` | `wxpay_order` | `{ _orderId, orderNo, description }` |
| `queryPayment(outTradeNo)` | `wxpayFunctions` | `wxpay_query_order_by_out_trade_no` | `{ out_trade_no }` |

**`banner.service.ts`：**

| 函数 | 云函数 | Action | 参数 |
|------|--------|--------|------|
| `listBanners()` | `manage-banner` | `list` | `{ filterEnabled: false }` |

**`image.service.ts`（纯前端，不调用云函数）：**

| 函数 | 说明 |
|------|------|
| `processCloudUrl(cloudUrl)` | 将 `cloud://` URL 转为 HTTP URL |
| `batchConvertUrls(urls, batchSize?, concurrency?)` | 批量转换，默认 50/批、3 并发 |
| `compressImageUrl(httpUrl, width, height, quality?)` | 拼接 COS 压缩参数 |

### 9. `src/utils/format.ts`

```typescript
/** 格式化价格：12345 → "12,345.00" */
export function formatPrice(price: number): string

/** 格式化日期：timestamp → "YYYY-MM-DD" */
export function formatDate(timestamp: number): string

/** 隐藏手机号中间四位：13812345678 → "138****5678" */
export function formatPhone(phone: string): string
```

### 10. `src/utils/image.ts`

```typescript
import Taro from '@tarojs/taro'

/** 将 cloud:// URL 转为临时 HTTP URL */
export async function processCloudUrl(cloudUrl: string): Promise<string>

/** 批量转换 cloud:// URLs */
export async function batchConvertUrls(
  urls: string[],
  batchSize?: number,   // 默认 50
  concurrency?: number  // 默认 3
): Promise<string[]>

/** 拼接腾讯云 COS 图片压缩参数 */
export function compressImageUrl(
  httpUrl: string,
  width: number,
  height: number,
  quality?: number  // 默认 80
): string
```

### 11. `src/utils/validate.ts`

```typescript
/** 验证手机号（中国大陆） */
export function isValidPhone(phone: string): boolean
// 正则: /^1[3-9]\d{9}$/

/** 验证邮箱 */
export function isValidEmail(email: string): boolean

/** 验证非空字符串 */
export function isNotEmpty(value: string): boolean
```

### 12. `src/utils/navigation.ts`

```typescript
import Taro from '@tarojs/taro'

/** 导航到页面 */
export function navigateTo(url: string): void

/** 切换 Tab */
export function switchTab(url: string): void

/** 返回上一页 */
export function navigateBack(delta?: number): void

/** 重定向（替换当前页） */
export function redirectTo(url: string): void
```

### 13. `src/constants/index.ts`

```typescript
export const CLOUD_ENV_ID = 'cloud1-9glm8muj52815539'
export const APP_ID = 'wxfe20c0865a438545'
export const CONSULTATION_PHONE = '19988266351'
export const DEFAULT_PAGE_SIZE = 200
export const IMAGE_BATCH_SIZE = 50
export const IMAGE_BATCH_CONCURRENCY = 3
```

## 验收标准

1. 所有 `types/*.ts` 文件无 TypeScript 编译错误
2. `services/cloud.ts` 的 `callCloudFunction` 能正确调用云函数并返回类型化响应
3. 每个 service 文件导出的函数签名与上述表格一致
4. `utils/image.ts` 的 `processCloudUrl` 能将 `cloud://` URL 转为 HTTP URL
5. `utils/format.ts` 的 `formatPrice(12345)` 返回 `"12,345.00"`
6. `utils/validate.ts` 的 `isValidPhone('13812345678')` 返回 `true`
7. 所有文件 `import` 路径正确，无循环依赖
