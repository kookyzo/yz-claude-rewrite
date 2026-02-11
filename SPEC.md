# YZHENG 小程序 Taro React 重构 — 主 SPEC

## 1. 项目概述

YZHENG 是一个珠宝电商微信小程序，具备完整的商品浏览、购物车、订单支付、预约系统、售后服务等功能。本项目将原生微信小程序全量重写为 Taro + React + TypeScript，以获得更好的代码可维护性、类型安全和跨平台能力。云函数（后端）原样保留，不做任何修改。

| 项目信息 | 值 |
|----------|-----|
| AppID | `wxfe20c0865a438545` |
| 云环境 ID | `cloud1-9glm8muj52815539` |
| 旧代码路径 | `legacy_ro/yz-legacy-code/`（只读参考） |
| 旧项目分析 | `legacy_ro/yz-legacy-code/yz-legacy项目分析.md` |

---

## 2. 技术栈

| 层面 | 方案 | 说明 |
|------|------|------|
| 框架 | Taro 4.x + React 18 | 如遇兼容问题回退 3.6.x |
| 语言 | TypeScript (strict mode) | `tsconfig.json` 开启 strict |
| 构建工具 | Vite (`@tarojs/vite-runner`) | Taro 4.x 推荐构建方案 |
| 组件库 | NutUI (`@nutui/nutui-react-taro`) | 优先使用 NutUI 基础组件 |
| 状态管理 | Zustand | 轻量、零样板、原生 Hooks；持久化使用 Taro 存储 API |
| 样式方案 | SCSS Modules (`.module.scss`) | 样式隔离，rpx 兼容 |
| 云函数调用 | `Taro.cloud.callFunction()` | 封装在 Service 层 |
| 云函数策略 | 原样保留 | 不修改任何云函数代码 |
| 包管理 | npm | — |
| 代码规范 | ESLint + Prettier | Taro 默认配置 |

---

## 3. 目录结构

```
yz-claude-rewrite/
├── config/                          # Taro 构建配置
│   ├── index.ts
│   ├── dev.ts
│   └── prod.ts
├── src/
│   ├── app.ts                       # 入口（云开发初始化）
│   ├── app.config.ts                # 页面路由、TabBar、窗口配置
│   ├── app.scss                     # 全局样式（字体、reset）
│   │
│   ├── types/                       # TypeScript 类型定义
│   │   ├── product.ts               # SPU、SKU、Material、Series 等
│   │   ├── cart.ts                  # Cart、CartItem
│   │   ├── order.ts                 # Order、OrderItem、OrderStatus
│   │   ├── user.ts                  # User、Address
│   │   ├── reservation.ts           # Reservation、Activity
│   │   └── api.ts                   # CloudResponse<T>、CloudAction 等通用类型
│   │
│   ├── services/                    # API 服务层（封装云函数调用）
│   │   ├── cloud.ts                 # callCloudFunction 基础调用器
│   │   ├── product.service.ts       # 商品相关
│   │   ├── cart.service.ts          # 购物车
│   │   ├── order.service.ts         # 订单（manage-order-easy）
│   │   ├── user.service.ts          # 用户认证 & 信息
│   │   ├── address.service.ts       # 收货地址
│   │   ├── wish.service.ts          # 收藏夹
│   │   ├── reservation.service.ts   # 预约
│   │   ├── payment.service.ts       # 微信支付
│   │   ├── banner.service.ts        # 轮播图
│   │   ├── cms.service.ts           # CMS 管理
│   │   └── image.service.ts         # 图片 URL 转换 & 压缩
│   │
│   ├── stores/                      # Zustand 状态管理
│   │   ├── useUserStore.ts          # 用户认证状态
│   │   ├── useCartStore.ts          # 购物车状态
│   │   └── useAppStore.ts           # 全局应用状态
│   │
│   ├── hooks/                       # 自定义 React Hooks
│   │   ├── useAuth.ts               # 登录检查、用户信息
│   │   ├── useSystemInfo.ts         # 状态栏高度、系统信息
│   │   ├── useImageProcessor.ts     # 图片 URL 转换 & 压缩
│   │   ├── useNavBarScroll.ts       # 导航栏滚动变色
│   │   └── usePagination.ts         # 分页逻辑
│   │
│   ├── utils/                       # 工具函数
│   │   ├── format.ts                # formatPrice, formatDate, formatPhone
│   │   ├── image.ts                 # processCloudUrl, compressImageUrl
│   │   ├── navigation.ts            # navigateTo, switchTab 封装
│   │   └── validate.ts              # 手机号、邮箱等校验
│   │
│   ├── constants/                   # 常量
│   │   └── index.ts                 # 云环境 ID、电话号码、图片压缩参数等
│   │
│   ├── components/                  # 共享组件
│   │   ├── TopBar/
│   │   │   ├── index.tsx
│   │   │   └── index.module.scss
│   │   ├── TopBarWithBack/
│   │   ├── ProductCard/
│   │   ├── SizePopup/
│   │   ├── FloatPopup/
│   │   ├── FloatBtn/
│   │   ├── CartSuccessPopup/
│   │   ├── LoadingBar/
│   │   ├── SlidingBar/
│   │   ├── ReviewPopup/
│   │   └── SignUpPopup/
│   │
│   ├── pages/                       # 主包页面
│   │   ├── home/
│   │   │   ├── index.tsx
│   │   │   ├── index.config.ts
│   │   │   └── index.module.scss
│   │   ├── category/
│   │   ├── cart/
│   │   ├── my/
│   │   ├── splash/
│   │   └── product-detail/
│   │
│   ├── pages-sub/                   # 分包页面
│   │   ├── payment/
│   │   ├── payment-failed/
│   │   ├── payment-select-address/
│   │   ├── series-detail/
│   │   ├── series-promotion/
│   │   ├── register/
│   │   ├── edit-info/
│   │   ├── address-list/
│   │   ├── address-edit/
│   │   ├── order-list/
│   │   ├── after-sales/
│   │   ├── after-sales-detail/
│   │   ├── refund/
│   │   ├── return-exchange-detail/
│   │   ├── reservation/
│   │   ├── reservation-normal/
│   │   ├── reservation-change/
│   │   ├── reservation-success/
│   │   ├── reservation-easy/
│   │   ├── wishlist/
│   │   ├── consultation/
│   │   ├── privacy-policy/
│   │   ├── user-agreement/
│   │   └── product-cms/
│   │
│   ├── assets/                      # 静态资源
│   │   ├── icons/                   # TabBar 图标、UI 图标
│   │   └── images/                  # 启动页、默认图等
│   │
│   └── custom-tab-bar/              # 自定义 TabBar
│       ├── index.tsx
│       └── index.module.scss
│
├── cloudfunctions/                  # 云函数（直接复制，不修改）
├── project.config.json              # 微信小程序项目配置
├── tsconfig.json
├── package.json
├── SPEC.md                          # 本文件
└── specs/                           # 分阶段 Spec 文件
```

---

## 4. 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 页面目录 | kebab-case | `pages/product-detail/` |
| 页面文件 | `index.tsx` + `index.config.ts` + `index.module.scss` | — |
| 组件目录 | PascalCase | `components/TopBar/` |
| 组件文件 | `index.tsx` + `index.module.scss` | — |
| Service 文件 | `xxx.service.ts` | `product.service.ts` |
| Store 文件 | `useXxxStore.ts` | `useCartStore.ts` |
| Hook 文件 | `useXxx.ts` | `useAuth.ts` |
| 类型文件 | camelCase | `types/product.ts` |
| 工具文件 | camelCase | `utils/format.ts` |
| 常量 | UPPER_SNAKE_CASE | `CLOUD_ENV_ID` |
| 接口/类型 | PascalCase | `interface CartItem {}` |
| 函数 | camelCase | `formatPrice()` |
| CSS 类名 | camelCase（SCSS Modules 自动作用域） | `styles.productCard` |

---

## 5. Service 层设计

### 5.1 基础调用器 `cloud.ts`

```typescript
// src/services/cloud.ts
export interface CloudResponse<T = any> {
  code: number;        // 200 | 400 | 401 | 404 | 409 | 500
  message: string;
  data?: T;
}

export async function callCloudFunction<T = any>(
  name: string,
  data: Record<string, any> = {}
): Promise<CloudResponse<T>> {
  const res = await Taro.cloud.callFunction({ name, data });
  return res.result as CloudResponse<T>;
}
```

### 5.2 Service 文件与云函数映射表

| Service 文件 | 云函数 | 主要 Actions |
|-------------|--------|-------------|
| `user.service.ts` | `login`, `login-easy`, `sign_up`, `manage-user`, `getUserInfo`, `updateUserInfo`, `bindPhoneNumber` | login, checkLogin, register, update, getUserInfo, bindPhone |
| `product.service.ts` | `get-product`, `manage-subseries`, `manage-category`, `manage-material`, `manage-recommendations` | getProductDetail, getProductsBySubSeries, getProductsByCategory, getProductsByMaterial, getProductsByFilter, getModelShowData, listSubSeries, listCategories, listMaterials, getRecommendations |
| `cart.service.ts` | `manage-cart` | add, list, selected, selectedAll, remove, update |
| `order.service.ts` | `manage-order-easy` | createOrderFromCart, createDirectOrder, updateOrderStatus, cancelOrder, confirmReceipt, applyRefund, queryRefundStatus, getOrderDetail, getUserOrders |
| `address.service.ts` | `manage-address` | add, edit, delete, list, setDefault, getDefault |
| `wish.service.ts` | `manage-wish` | add, remove, check, list |
| `reservation.service.ts` | `reservation-easy`, `reservation-change`, `manage-reservation` | add, list, get, update |
| `payment.service.ts` | `wxpayFunctions` | wxpay_order, wxpay_query_order_by_out_trade_no |
| `banner.service.ts` | `manage-banner`, `get-banners` | list |
| `cms.service.ts` | `manage-category`, `manage-material`, `manage-size`, `manage-subseries`, `update-product` | add, update, remove, get, list |
| `image.service.ts` | — (纯前端) | processCloudUrl, batchConvertUrls, compressImageUrl |

---

## 6. Store 设计

### useUserStore

| 字段 | 类型 | 说明 |
|------|------|------|
| `isLoggedIn` | `boolean` | 是否已登录 |
| `isRegistered` | `boolean` | 是否已注册（getUserInfo 返回 200） |
| `userId` | `string \| null` | 用户 ID（`user_YYMM_XXXXXXXX` 格式） |
| `openId` | `string \| null` | 微信 OpenID |
| `userInfo` | `User \| null` | 完整用户信息 |

| 方法 | 说明 |
|------|------|
| `login()` | 调用 `login` 云函数，更新登录状态 |
| `checkLogin()` | 调用 `login-easy` checkLogin，检查登录状态 |
| `fetchUserInfo()` | 调用 `getUserInfo`，更新 userInfo |
| `logout()` | 清除状态 |

### useCartStore

| 字段 | 类型 | 说明 |
|------|------|------|
| `items` | `CartItem[]` | 购物车商品列表 |
| `loading` | `boolean` | 加载状态 |
| `totalPrice` | `number` | 已选商品总价（computed） |
| `selectedCount` | `number` | 已选商品数量（computed） |
| `isAllChecked` | `boolean` | 是否全选（computed） |

| 方法 | 说明 |
|------|------|
| `fetchCart()` | 调用 `manage-cart` list，加载购物车 |
| `toggleItem(id, checked)` | 乐观更新：先更新 UI，再调用 `manage-cart` selected |
| `toggleAll(checked)` | 乐观更新：先更新 UI，再调用 `manage-cart` selectedAll |
| `updateQuantity(id, qty)` | 乐观更新：先更新 UI，再调用 `manage-cart` update |
| `removeItem(id)` | 调用 `manage-cart` remove |

### useAppStore

| 字段 | 类型 | 说明 |
|------|------|------|
| `systemInfo` | `SystemInfo` | 系统信息（状态栏高度等） |
| `currentTab` | `number` | 当前 TabBar 选中索引 |
| `privacyAgreed` | `boolean` | 隐私协议是否已同意 |

| 方法 | 说明 |
|------|------|
| `setCurrentTab(index)` | 更新 TabBar 选中状态 |
| `initSystemInfo()` | 获取并缓存系统信息 |
| `agreePrivacy()` | 标记隐私协议已同意 |

---

## 7. 页面清单

共 31 个页面（已排除 4 个测试页：product-test、product-query-test、orderTest、orderTestEasy）。

### 主包页面（6 个）

| # | 新路径 | 旧路径 | 说明 |
|---|--------|--------|------|
| 1 | `pages/splash/index` | `pages/splash/splash` | 启动页 |
| 2 | `pages/home/index` | `pages/home/home` | 首页（Tab） |
| 3 | `pages/category/index` | `pages/Category/Category` | 分类（Tab） |
| 4 | `pages/cart/index` | `pages/Shopping_Cart/Shopping_Cart` | 购物车（Tab） |
| 5 | `pages/my/index` | `pages/My/My` | 我的（Tab） |
| 6 | `pages/product-detail/index` | `pages/Product_Details/Product_Details` | 商品详情 |

### 分包页面（25 个）— `pages-sub/`

| # | 新路径 | 旧路径 | 说明 |
|---|--------|--------|------|
| 7 | `pages-sub/series-detail/index` | `pages/SeriesDetail/SeriesDetail` | 系列详情 |
| 8 | `pages-sub/series-promotion/index` | `pages/series_promotion/series_promotion` | 系列推广 |
| 9 | `pages-sub/payment/index` | `pages/payment/payment` | 支付页 |
| 10 | `pages-sub/payment-failed/index` | `pages/payment_failed/payment_failed` | 支付失败 |
| 11 | `pages-sub/payment-select-address/index` | `pages/payment_sub_page_select_address/...` | 支付选地址 |
| 12 | `pages-sub/register/index` | `pages/register/register` | 注册 |
| 13 | `pages-sub/edit-info/index` | `pages/edit_information/edit_information` | 编辑信息 |
| 14 | `pages-sub/address-list/index` | `pages/my_address/my_address` | 地址列表 |
| 15 | `pages-sub/address-edit/index` | `pages/add_new_address/add_new_address` | 新增/编辑地址 |
| 16 | `pages-sub/order-list/index` | `pages/my_sub_page/my_sub_page` | 订单列表 |
| 17 | `pages-sub/after-sales/index` | `pages/my_sub_after_sales_service/...` | 售后服务 |
| 18 | `pages-sub/after-sales-detail/index` | `pages/after_sales_service/after_sales_service` | 售后详情（静态） |
| 19 | `pages-sub/refund/index` | `pages/refund/refund` | 退款申请 |
| 20 | `pages-sub/return-exchange-detail/index` | `pages/return_exchange_details/...` | 退换详情 |
| 21 | `pages-sub/reservation/index` | `pages/reservation/reservation` | VIP 预约 |
| 22 | `pages-sub/reservation-normal/index` | `pages/reservation_normal/reservation_normal` | 普通预约 |
| 23 | `pages-sub/reservation-change/index` | `pages/reservation-changge/reservation-changge` | 修改预约 |
| 24 | `pages-sub/reservation-success/index` | `pages/reservation_success/reservation_success` | 预约成功 |
| 25 | `pages-sub/reservation-easy/index` | （无独立页面，逻辑在 reservation 中） | 简化预约 |
| 26 | `pages-sub/wishlist/index` | `pages/wishlist/wishlist` | 收藏夹 |
| 27 | `pages-sub/consultation/index` | `pages/Consultation/Consultation` | 咨询 |
| 28 | `pages-sub/privacy-policy/index` | `pages/privacy_policy/privacy_policy` | 隐私政策 |
| 29 | `pages-sub/user-agreement/index` | `pages/user_agreement/user_agreement` | 用户协议 |
| 30 | `pages-sub/product-cms/index` | `pages/manage-product-cms/manage-product-cms` | 商品 CMS |
| 31 | `pages-sub/reservation-easy/index` | `pages/reservation-easy/reservation-easy` | 通用预约 |

---

## 8. 云函数清单

以下为实际复制到新项目 `cloudfunctions/` 目录的云函数（已排除所有备份/副本），共 28 个。

### 用户认证 & 管理（7 个）

| 云函数 | 说明 |
|--------|------|
| `login` | 主登录，自动创建新用户，生成 `user_YYMM_XXXXXXXX` 格式 ID |
| `login-easy` | 简化登录（预约系统用） |
| `sign_up` | 用户注册 |
| `manage-user` | 用户 CRUD（update action） |
| `getUserInfo` | 获取用户信息 |
| `updateUserInfo` | 更新用户信息 |
| `bindPhoneNumber` | 手机号绑定（微信一键获取） |

### 商品管理（8 个）

| 云函数 | 说明 |
|--------|------|
| `get-product` | 商品查询（支持多种 action：按系列/品类/材质/筛选/详情） |
| `getProduct` | 备用商品查询（ProductDisplay 组件用） |
| `update-product` | 更新商品信息 |
| `manage-category` | 品类 CRUD |
| `manage-series` | 系列管理 |
| `manage-subseries` | 子系列 CRUD |
| `manage-size` | 尺码 CRUD |
| `manage-material` | 材质 CRUD |

### 购物车 & 收藏（2 个）

| 云函数 | 说明 |
|--------|------|
| `manage-cart` | 购物车操作（add/list/selected/selectedAll/remove/update） |
| `manage-wish` | 收藏夹管理（add/remove/check/list） |

### 订单 & 支付（5 个）

| 云函数 | 说明 |
|--------|------|
| `manage-order` | 订单管理（普通订单+管理员功能+两步退款） |
| `manage-order-easy` | 简化订单管理（预售订单+简化退款） |
| `wxpayFunctions` | 微信支付集成（下单、查询、退款） |
| `refund` | 退款处理（create action） |
| `auto-cancel-orders` | 定时自动取消未支付订单 |

### 预约系统（3 个）

| 云函数 | 说明 |
|--------|------|
| `manage-reservation` | 活动预约管理 |
| `reservation-easy` | 通用预约（add/list） |
| `reservation-change` | 修改预约（get/update） |

### 内容 & 营销（3 个）

| 云函数 | 说明 |
|--------|------|
| `get-banners` | 获取轮播图 |
| `manage-banner` | 轮播图管理（list action） |
| `manage-recommendations` | 推荐商品管理 |

### 其他（2 个）

| 云函数 | 说明 |
|--------|------|
| `manage-address` | 收货地址管理（add/edit/delete/list/setDefault/getDefault） |
| `generate-qrcode` | 二维码生成（预约确认用） |

### 排除的云函数（不复制）

| 云函数 | 排除原因 |
|--------|----------|
| `bindPhoneNumber - 副本` | 备份副本 |
| `get-product备份` | 备份 |
| `manage-cart - 副本` | 备份副本 |
| `manage-activity` | 活动管理（当前未使用） |

---

## 9. 组件清单

| 新组件名 | 旧组件 | 职责 |
|----------|--------|------|
| `TopBar` | `TopBar` | Tab 页顶部导航栏，支持滚动变色 |
| `TopBarWithBack` | `TopBarWithBack` | 子页面导航栏，带返回按钮 |
| `ProductCard` | `product_image` | 商品卡片（图片、名称、价格、加购按钮） |
| `SizePopup` | `SizePopup` | 尺码/产品类型选择弹窗 |
| `FloatPopup` | `FloatPopup` | 在线咨询浮窗（拨打电话 / 客服会话） |
| `FloatBtn` | `FloatBtn` | 浮动电话按钮（触发 FloatPopup） |
| `CartSuccessPopup` | `AddToCartSuccessPopup` | 加入购物车成功提示（继续购物 / 去购物车） |
| `LoadingBar` | `TabBarLoading` | 顶部进度条加载指示器 |
| `SlidingBar` | `SlidingSelectionBar` | 水平滑动选择栏 |
| `ReviewPopup` | `review_interface` | 评价弹窗（5 星评分 + 文字 + 图片） |
| `SignUpPopup` | `sign_up` | 注册表单弹窗（完整注册流程） |
| `CustomTabBar` | 自定义 TabBar 逻辑 | 底部 4 Tab 导航（首页/分类/购物车/我的） |

**不迁移的旧组件：**

- `added_to_cart` — 功能与 `CartSuccessPopup` 重复，合并
- `custom-navigation-bar` — 功能与 `TopBar`/`TopBarWithBack` 重复，合并
- `ProductDisplay` — 逻辑重构到页面内，不再作为独立组件

---

## 10. 分阶段 Spec 索引

| Phase | 文件 | 范围 |
|-------|------|------|
| 01 | [`specs/01-project-init.md`](specs/01-project-init.md) | Taro 项目初始化、配置、云函数复制 |
| 02 | [`specs/02-foundation.md`](specs/02-foundation.md) | types/、services/cloud.ts、所有 service 文件、utils/ |
| 03 | [`specs/03-stores-and-hooks.md`](specs/03-stores-and-hooks.md) | Zustand stores、自定义 Hooks |
| 04 | [`specs/04-core-components.md`](specs/04-core-components.md) | TopBar、TabBar、ProductCard、SizePopup 等共享组件 |
| 05 | [`specs/05-tab-pages.md`](specs/05-tab-pages.md) | home、category、cart、my 四个主页面 |
| 06 | [`specs/06-product-flow.md`](specs/06-product-flow.md) | product-detail、series-detail、payment 等商品交易流程 |
| 07 | [`specs/07-user-center.md`](specs/07-user-center.md) | register、edit-info、address、order-list、after-sales 等 |
| 08 | [`specs/08-reservation.md`](specs/08-reservation.md) | 5 个预约页面 |
| 09 | [`specs/09-misc-pages.md`](specs/09-misc-pages.md) | splash、wishlist、consultation、policy、CMS 等 |
| 10 | [`specs/10-optimization.md`](specs/10-optimization.md) | 分包、懒加载、骨架屏等性能优化 |
