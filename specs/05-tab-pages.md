# Phase 05: 四个主 Tab 页面

## 目标

实现 4 个主包 Tab 页面（home、category、cart、my），这些页面构成小程序的核心导航框架。每个页面均为 React 函数组件 + SCSS Modules，使用 Taro 生命周期 Hooks，遵循 TypeScript strict 模式。

## 前置依赖

- Phase 02 完成（`types/`、`services/`、`utils/`、`constants/`）
- Phase 03 完成（`stores/`、`hooks/`）
- Phase 04 完成（`components/`、`custom-tab-bar/`）

## 旧代码摘要

### 1. 首页（`pages/home/home.js`，1365 行）

#### 1.1 状态字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `swiperList` | `Array` | 轮播图数据列表，从云数据库获取 |
| `reservation` | `Object` | 预约入口图片和链接 `{ image, url, text }` |
| `title` | `string` | 活动标题 `'YZHENG品牌线下发布会'` |
| `address_text` | `string` | 活动地址 |
| `isLoadingBanners` | `boolean` | 轮播图加载状态 |
| `showTabBarLoading` | `boolean` | TabBar 页面切换加载状态 |
| `isPopupShow` | `boolean` | 在线咨询弹窗状态 |
| `scroll_top` | `number` | 当前滚动位置 |
| `critical_scroll_top` | `number` | 滚动临界值，固定 `400` |
| `swiperContainerTop` | `string` | 动态计算的容器顶部位置（rpx） |
| `swiperContainerHeight` | `string` | 动态计算的容器高度（rpx） |
| `bannerHeight` | `string` | 轮播图高度（rpx） |
| `subSeriesList` | `Array` | 子系列列表 `[{ _id, subSeriesId, name, nameEN, displayImage }]` |
| `currentSeriesIndex` | `number` | 当前选中的系列索引 |
| `currentSeriesProducts` | `Array` | 当前系列的产品列表 |
| `currentSubSeriesNameEN` | `string` | 当前系列英文名称 |
| `isLoadingSeriesProducts` | `boolean` | 系列商品加载状态 |
| `allSeriesProducts` | `Object` | 产品预加载缓存 `{ subSeriesId: [products] }` |
| `modelShowList` | `Array` | 模特展示数据 `[{ _id, skuId, image, nameCN, nameEN, price }]` |
| `currentModelIndex` | `number` | 当前选中的模特索引 |
| `seriesIsTouching` | `boolean` | series-swiper 是否正在触摸 |
| `seriesInViewport` | `boolean` | series-swiper 是否在视口中 |
| `modelIsTouching` | `boolean` | model-swiper 是否正在触摸 |
| `modelInViewport` | `boolean` | model-swiper 是否在视口中 |

#### 1.2 生命周期逻辑

| 生命周期 | 逻辑 |
|----------|------|
| `onLoad` | 设置 `showTabBarLoading: true`；并行调用 `loadBanners()`、`loadSubSeries()`、`loadModelShowData()` |
| `onReady` | 调用 `calculateSwiperContainerSize()` 动态计算布局尺寸；调用 `setupSeriesObserver()` 设置 IntersectionObserver |
| `onShow` | 设置 TabBar 选中状态 `selected: 0`；若 series/model 在视口中且未触摸，恢复自动滑动 |
| `onHide` | 停止所有自动滑动定时器 |
| `onUnload` | 清理所有定时器和 IntersectionObserver |
| `onPageScroll` | 计算滚动透明度，动态更新导航栏颜色（黑→白渐变） |

#### 1.3 云函数调用

| 云函数 | Action | 参数 | 用途 |
|--------|--------|------|------|
| `manage-banner` | `list` | `{ filterEnabled: false }` | 获取所有轮播图 |
| `manage-subseries` | `list` | `{ filterEnabled: true }` | 获取启用的子系列 |
| `get-product` | `getProductsBySubSeries` | `{ subSeriesId, sortBy: 'default', page: 1, pageSize: 10 }` | 获取系列商品（预加载） |
| `get-product` | `getModelShowData` | `{ skuIds: [4个固定ID] }` | 获取模特展示数据 |

固定的模特展示 SKU IDs：
```
'25b91eb368e669ac01dffc8766d0ce66'
'25b91eb368e72a1501f306044c88f50e'
'2d0db0d268e6363001da19c452718054'
'2d0db0d268e66d3501dfe0c57b543f45'
```

#### 1.4 核心交互逻辑

**导航栏滚动变色：**
- `critical_scroll_top = 400`
- `opacity = Math.min(scrollTop / 400, 1)`
- RGB 线性插值：`r = g = b = Math.floor(255 * opacity)`
- 文字颜色：`opacity > 0.5` 时 `#000000`，否则 `#ffffff`
- 通过 `wx.setNavigationBarColor()` 动态设置

**系列 Swiper 自动滑动：**
- IntersectionObserver 监听 `.series-swiper`，阈值 `0.5`
- 进入视口时启动 `setInterval`（3000ms），自动切换到下一个系列
- 触摸时暂停，触摸结束后延迟 3000ms 恢复
- 切换时从 `allSeriesProducts` 缓存读取商品数据

**模特 Swiper 自动滑动：**
- 与系列 Swiper 逻辑相同，监听 `.model-swiper`
- 数据加载完成后延迟 100ms 设置 Observer（因为有 `wx:if` 条件渲染）

**商品预加载策略（三阶段）：**
1. 立即加载第一个系列商品（首屏优先）
2. 延迟 200ms 预加载相邻系列（前后各 1 个）
3. 延迟 500ms 批量加载剩余系列（每批 3 个，批次间 100ms）

**图片处理：**
- cloud:// URL → HTTP URL（`wx.cloud.getTempFileURL`，50/批，3 并发）
- HTTP URL + 压缩参数：`?imageMogr2/thumbnail/280x280/quality/80/format/webp`（仅 `tcb.qcloud.la` 域名）
- 产品图片预加载：`wx.getImageInfo` 强制缓存，每批 5 张，批次间 50ms
- 系列展示大图预加载：优先前 3 个，剩余延迟 500ms 后每个间隔 200ms

**布局计算（`calculateSwiperContainerSize`）：**
- 使用 `wx.getWindowInfo()` 获取系统信息
- rpx 转换比例：`750 / windowWidth`
- TopBar 总高度 = `110rpx（barHeight）+ statusBarHeight * rpxRatio`
- swiper 容器高度 = `windowHeightRpx - topBarTotalHeight`
- banner 高度 = `windowHeightRpx - topBarTotalHeight - 100rpx（tabBar）`

#### 1.5 UI 结构

```
TopBar（透明背景，滚动变色）
├── 全屏轮播 Banner（Swiper，占满 TopBar 到 TabBar 之间）
│   └── 每张 banner 点击跳转分类页
├── 预约入口图片
├── 系列展示区
│   ├── 系列 Tab 栏（水平滚动，点击/自动切换）
│   ├── 系列大图 Swiper（与 Tab 联动）
│   └── 商品卡片横向滚动列表（ProductCard）
├── 模特展示区
│   ├── 模特 Tab 栏（水平滚动，点击/自动切换）
│   └── 模特大图 Swiper（与 Tab 联动，点击跳转商品详情）
├── FloatBtn（浮动咨询按钮）
├── FloatPopup（在线咨询弹窗）
└── LoadingBar（页面加载指示器）
```

#### 1.6 依赖组件

`TopBar`、`ProductCard`、`FloatBtn`、`FloatPopup`、`LoadingBar`、`CustomTabBar`

### 2. 分类页（`pages/Category/Category.js`，1983 行）

#### 2.1 状态字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `product_series_Selected` | `string` | 当前主筛选状态，`'ALL'` 或具体筛选类型 |
| `filterSections` | `Array` | 三个筛选区块 `[{ type: 'subseries'\|'category'\|'material', title, items: [{ id, name, image?, isSelected }] }]` |
| `selectedFilter` | `Object` | 当前选中的一级筛选 `{ type, id, name }` |
| `subSeriesList` | `Array` | 子系列列表（ALL 视图下的网格展示） |
| `subSeriesProducts` | `Array` | 按子系列筛选的商品列表 |
| `subSeriesInfo` | `Object` | 当前子系列信息 `{ name, displayImage }` |
| `productCount` | `number` | 子系列商品总数 |
| `categoryProducts` | `Array` | 按品类筛选的商品列表 |
| `categoryInfo` | `Object` | 当前品类信息 |
| `categoryProductCount` | `number` | 品类商品总数 |
| `materialProducts` | `Array` | 按材质筛选的商品列表 |
| `materialInfo` | `Object` | 当前材质信息 |
| `materialProductCount` | `number` | 材质商品总数 |
| `currentPage` | `number` | 当前分页页码 |
| `hasMore` | `boolean` | 是否有更多数据 |
| `loadingProducts` | `boolean` | 商品加载状态 |
| `currentFilterType` | `string` | 当前筛选类型 `'subseries'\|'category'\|'material'` |
| `currentSort` | `string` | 当前排序方式 `'default'\|'price_asc'\|'price_desc'` |
| `sortText` | `string` | 排序显示文字 |
| `showSortOptions` | `boolean` | 排序选项面板是否显示 |
| `showFilterPanel` | `boolean` | 二次筛选面板是否显示 |
| `selectedCategories` | `string[]` | 二次筛选：选中的品类 ID 列表 |
| `selectedMaterials` | `string[]` | 二次筛选：选中的材质 ID 列表 |
| `selectedSubSeries` | `string[]` | 二次筛选：选中的子系列 ID 列表 |
| `searchValue` | `string` | 搜索关键词（预留） |
| `isPopupShow` | `boolean` | 在线咨询弹窗状态 |
| `showTabBarLoading` | `boolean` | TabBar 页面切换加载状态 |
| `pageSize` | `number` | 每页商品数，固定 `200` |

#### 2.2 生命周期逻辑

| 生命周期 | 逻辑 |
|----------|------|
| `onLoad` | 设置 `showTabBarLoading: true`；调用 `loadFilterData()` 并行加载子系列、品类、材质列表 |
| `onReady` | 无特殊逻辑 |
| `onShow` | 设置 TabBar 选中状态 `selected: 1` |
| `onHide` | 无特殊逻辑 |
| `onUnload` | 无特殊逻辑 |

#### 2.3 云函数调用

| 云函数 | Action | 参数 | 用途 |
|--------|--------|------|------|
| `manage-subseries` | `list` | `{ filterEnabled: true }` | 获取启用的子系列列表 |
| `manage-category` | `list` | `{}` | 获取品类列表 |
| `manage-material` | `list` | `{ filterEnabled: true }` | 获取启用的材质列表 |
| `get-product` | `getProductsBySubSeries` | `{ subSeriesId, sortBy, page, pageSize }` | 按子系列查询商品 |
| `get-product` | `getProductsByCategory` | `{ categoryId, sortBy, page, pageSize }` | 按品类查询商品 |
| `get-product` | `getProductsByMaterial` | `{ materialId, sortBy, page, pageSize }` | 按材质查询商品 |
| `get-product` | `getProductsByFilter` | `{ subSeriesIds?, categoryIds?, materialIds?, sortBy, page, pageSize }` | 多条件组合筛选 |

#### 2.4 核心交互逻辑

**筛选状态机（三层筛选体系）：**

```
状态: ALL（默认）
  ├── 显示子系列网格（大图 + 名称）
  ├── 点击子系列 → 进入 subseries 筛选
  └── 点击 filterSection 中的 item → 进入对应类型筛选

状态: subseries / category / material（一级筛选）
  ├── 显示商品列表 + 排序栏 + 筛选按钮
  ├── 点击 "ALL" 按钮 → 回到 ALL 状态
  ├── 点击排序 → 切换排序方式，重新加载第 1 页
  ├── 点击筛选按钮 → 打开二次筛选面板
  └── 滚动到底 → 加载下一页（追加）

状态: 二次筛选面板（叠加在一级筛选上）
  ├── 多选品类、材质、子系列
  ├── 重置 → 清空所有二次筛选
  └── 确定 → 调用 getProductsByFilter 组合查询
```

**`loadFilterData()` 初始化流程：**
1. 并行调用 `manage-subseries`、`manage-category`、`manage-material` 三个云函数
2. 子系列按 `sortNum` 升序排序
3. 构建 `filterSections` 数组（3 个区块），每个区块包含 `{ type, title, items }`
4. 子系列图片需要 cloud:// → HTTP URL 转换
5. 预加载子系列展示图（`wx.getImageInfo`）

**排序逻辑：**
- 三种排序：`default`（默认）、`price_asc`（价格升序）、`price_desc`（价格降序）
- 切换排序时重新加载第 1 页，`sortBy` 参数传给云函数

**分页逻辑：**
- `pageSize = 200`
- `scroll-view` 的 `onScrollToLower` 触发加载下一页
- 根据 `currentFilterType` 调用对应的加载函数，`append = true` 追加数据
- `hasMore` 由 `pagination.page < pagination.totalPages` 判断

**材质分组展开（`expandMaterialIds`）：**
- 材质列表中某些 item 是"分组"（包含 `childMaterials` 数组）
- 筛选时需要将分组 ID 展开为其下所有子材质的真实 `_id`

**图片处理（与首页相同模式）：**
- cloud:// URL → HTTP URL（50/批，3 并发）
- 压缩参数：`?imageView2/1/w/300/h/300/q/50`
- 产品图片预加载：`wx.getImageInfo` 异步缓存

#### 2.5 UI 结构

```
TopBar（白色背景）
├── ALL 视图（product_series_Selected === 'ALL'）
│   ├── 筛选栏：ALL 按钮（高亮）+ 3 个 filterSection 水平滚动
│   └── 子系列网格（2 列，每项：大图 + 中文名 + 英文名）
│       └── 点击跳转到对应子系列的商品列表
│
├── 筛选视图（product_series_Selected !== 'ALL'）
│   ├── 筛选栏：ALL 按钮 + 3 个 filterSection 水平滚动（当前选中高亮）
│   ├── 顶部信息：系列/品类/材质展示图 + 名称 + 商品数量
│   ├── 排序/筛选工具栏
│   │   ├── 排序按钮（点击展开排序选项：默认/价格升/价格降）
│   │   └── 筛选按钮（点击展开二次筛选面板）
│   ├── 商品列表（scroll-view，纵向滚动，触底加载更多）
│   │   └── 商品卡片（图片 + 名称 + 价格，点击跳转商品详情）
│   └── 加载状态（loading / 没有更多数据）
│
├── 二次筛选面板（showFilterPanel === true，覆盖层）
│   ├── 品类多选列表
│   ├── 材质多选列表
│   ├── 子系列多选列表
│   ├── 重置按钮
│   └── 确定按钮
│
├── 排序选项面板（showSortOptions === true）
│   ├── 默认排序
│   ├── 价格从低到高
│   └── 价格从高到低
│
├── FloatPopup（在线咨询弹窗）
└── LoadingBar（页面加载指示器）
```

#### 2.6 依赖组件

`TopBar`、`FloatPopup`、`LoadingBar`、`CustomTabBar`

### 3. 购物车页（`pages/Shopping_Cart/Shopping_Cart.js`，652 行）

#### 3.1 状态字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `items` | `Array` | 购物车商品列表，每项包含 `_cartItemId, name, foreign_name, price, quantity, checked, image, material, size, formattedSubtotal` |
| `is_empty_cart` | `boolean` | 购物车是否为空 |
| `isAllChecked` | `boolean` | 是否全选 |
| `total_price` | `number` | 已选商品总价（数值） |
| `formattedTotalPrice` | `string` | 格式化后的总价字符串 |
| `loading` | `boolean` | 加载状态 |
| `showTabBarLoading` | `boolean` | TabBar 页面切换时的加载状态 |
| `isPopupShow` | `boolean` | 在线咨询弹窗显示状态 |

#### 3.2 生命周期逻辑

| 生命周期 | 逻辑 |
|----------|------|
| `onLoad` | 设置 `showTabBarLoading: true` |
| `onReady` | 检查 `items` 是否为空，更新 `is_empty_cart` |
| `onShow` | 设置 TabBar 选中状态 `selected: 2`；设置 `showTabBarLoading: true`；调用 `refreshCartFromCloud()` 刷新购物车 |
| `onHide` | 无特殊逻辑 |
| `onUnload` | 无特殊逻辑 |

#### 3.3 云函数调用

| 云函数 | Action | 参数 | 用途 |
|--------|--------|------|------|
| `getUserInfo` | — | `{}` | 获取用户信息，检查注册状态 |
| `manage-cart` | `list` | `{ _userId }` | 获取购物车列表 |
| `manage-cart` | `selected` | `{ _cartItemId, selected }` | 切换单个商品选中状态 |
| `manage-cart` | `selectedAll` | `{ _userId, selected }` | 全选/全不选 |
| `manage-cart` | `update` | `{ _cartItemId, quantity }` | 更新商品数量 |
| `manage-cart` | `remove` | `{ _cartItemId }` | 删除商品 |

#### 3.4 核心交互逻辑

**乐观更新模式（所有写操作统一模式）：**
1. **立即更新 UI**：修改本地 `items` 数组，重新计算 `isAllChecked` 和 `total_price`，调用 `setData` 刷新界面
2. **后台同步服务器**：调用对应云函数（`manage-cart` 的 `selected`/`selectedAll`/`update` action）
3. **失败时回滚**：若云函数返回非 200 或抛异常，恢复为旧值并提示用户

**`refreshCartFromCloud()` 数据归一化：**
- 先调用 `getUserInfo` 获取 `_userId`，未注册用户跳转注册页
- 调用 `manage-cart` `list` 获取购物车列表
- 云函数返回的字段需要归一化映射：
  - `name` ← `skuInfo.nameCN` || `spuInfo.name`
  - `price` ← `unitPrice` || `skuInfo.price` || `spuInfo.referencePrice`
  - `checked` ← `status`（布尔值）
  - `image` ← `skuInfo.skuMainImages[0]` || `spuInfo.mainImages[0]`
  - `material` ← `materialInfo.nameCN`
  - `size` ← `sizeInfo.value`
  - `formattedSubtotal` ← `formatPrice(price * quantity)`
- 图片需要 cloud:// → HTTP URL 转换

**价格计算（`recalcTotal`）：**
```
total = items.filter(checked).reduce((sum, item) => sum + price * quantity, 0)
formattedTotalPrice = formatPrice(total)
isAllChecked = items.length > 0 && items.every(item => item.checked)
```

**结算流程（`goPay`）：**
- 检查是否有选中商品，无则提示"请选择商品"
- 跳转到支付页：`/pages/payment/payment`

**商品详情跳转：**
- 使用 `skuId` 跳转：`/pages/Product_Details/Product_Details?_skuId=${skuId}`
- 若无 `skuId` 则使用 `spuId`

#### 3.5 UI 结构

```
TopBar（白色背景）
├── 加载状态（loading === true）
│   └── 居中 loading 动画
├── 空购物车视图（is_empty_cart === true）
│   ├── 空购物车图标
│   ├── 提示文字"购物车是空的"
│   └── "去逛逛"按钮（跳转分类页）
├── 非空购物车视图（is_empty_cart === false）
│   ├── 商品列表（scroll-view，纵向滚动）
│   │   └── 每个商品项
│   │       ├── 左侧：勾选框（checkbox）
│   │       ├── 中间：商品图片（点击跳转详情）
│   │       ├── 右侧信息区
│   │       │   ├── 商品名称（中文 + 英文）
│   │       │   ├── 材质 + 尺码
│   │       │   ├── 数量控制（- / 数量 / +）
│   │       │   └── 单价
│   │       └── 删除按钮（滑动或点击）
│   └── 底部结算栏（fixed）
│       ├── 全选框 + "全选"文字
│       ├── 合计：¥{formattedTotalPrice}
│       └── "结算"按钮
├── FloatPopup（在线咨询弹窗）
└── LoadingBar（页面加载指示器）
```

#### 3.6 依赖组件

`TopBar`、`FloatPopup`、`LoadingBar`、`CustomTabBar`

### 4. 我的页（`pages/My/My.js`，416 行）

#### 4.1 状态字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `isRegistered` | `boolean` | 用户是否已注册 |
| `registerBtnText` | `string` | 注册按钮文字，已注册显示"编辑地址"，未注册显示"立即注册" |
| `greeting` | `string` | 问候语，如"刘女士" |
| `userInfo` | `Object` | 用户信息对象 |
| `personal_info` | `Array` | 个人信息展示列表 `[{ label, value }]`，包含昵称、电话、生日、地区、地址 |
| `wishlistCount` | `number` | 心愿单商品数量 |
| `showTabBarLoading` | `boolean` | TabBar 页面切换时加载状态 |
| `isPopupShow` | `boolean` | 在线咨询弹窗显示 |

#### 4.2 生命周期逻辑

| 生命周期 | 逻辑 |
|----------|------|
| `onLoad` | 调用 `ensureLogin()`；调用 `checkUserRegistrationStatus()`；调用 `loadUserInfoFromCloud()`；调用 `loadWishlistFromCloud()`；调用 `computeGreeting()` |
| `onReady` | 无特殊逻辑 |
| `onShow` | 设置 TabBar 选中状态 `selected: 3`；重新调用 `computeGreeting()` |
| `onHide` | 无特殊逻辑 |
| `onUnload` | 无特殊逻辑 |

#### 4.3 云函数调用

| 云函数 | Action | 参数 | 用途 |
|--------|--------|------|------|
| `getUserInfo` | — | `{}` | 获取用户信息，判断注册状态 |
| `manage-wish` | `list` | `{ userId: { _id: _userId } }` | 获取心愿单列表（仅计数） |
| `login-easy` | `checkLogin` | `{}` | 检查登录状态 |

#### 4.4 核心交互逻辑

**注册状态检查（`checkUserRegistrationStatus`）：**
- 调用 `getUserInfo` 云函数
- `code === 200`：已注册，`registerBtnText = '编辑地址'`
- `code === 404`：未注册，`registerBtnText = '立即注册'`

**用户信息加载（`loadUserInfoFromCloud`）：**
- 调用 `getUserInfo` 获取完整用户信息
- 构建 `personal_info` 数组：昵称、电话、生日、地区、收货地址列表

**问候语计算（`computeGreeting`）：**
- 从 `userInfo` 中获取 `nickname` 或 `lastName`
- 中文姓名拆分逻辑：支持复姓（欧阳、司马、诸葛等）
- 拼接称谓：`{姓}{title}`，如"刘女士"、"欧阳先生"
- 未注册用户显示默认问候语

**页面导航函数：**

| 函数 | 目标页面 | 说明 |
|------|----------|------|
| `goToOrders()` | `/pages/my_sub_page/my_sub_page?tab=1` | 我的订单（默认待付款 tab） |
| `my_order_method(tab)` | `/pages/my_sub_page/my_sub_page?tab={n}` | 按状态跳转订单：1=待付款, 2=待发货, 3=待收货, 4=已完成, 5=全部, 6=售后 |
| `goToWishlist()` | `/pages/wishlist/wishlist` | 心愿单 |
| `goEditInfo()` | `/pages/edit_information/edit_information` | 编辑个人信息 |
| `goToAfterSales()` | `/pages/my_sub_page/my_sub_page?tab=6` | 售后服务 |
| `goReservation()` | 预约页面 | 检查登录→查询预约→跳转预约成功/新建预约 |
| `goToPrivacyPolicy()` | `/pages-sub/privacy-policy/index` | 隐私政策 |
| `goToUserAgreement()` | `/pages-sub/user-agreement/index` | 用户协议 |
| `goConsult()` | — | 打开在线咨询弹窗 |

#### 4.5 UI 结构

```
TopBar（白色背景）
├── 顶部欢迎区
│   ├── 背景图片
│   ├── 欢迎文字"Welcome"
│   └── 问候语（如"刘女士"）
├── 功能入口区（4 个图标按钮）
│   ├── 我的订单（跳转订单列表）
│   ├── 心愿单（跳转心愿单，显示数量角标）
│   ├── 个人信息（跳转编辑信息 / 注册页）
│   └── 售后服务（跳转售后列表）
├── 滚动内容区
│   ├── 客服服务区
│   │   └── "联系在线客服"按钮（open-type="contact"）
│   ├── 微信二维码区
│   │   └── 品牌微信二维码图片
│   ├── 政策链接区
│   │   ├── 销售条款（跳转用户协议）
│   │   └── 隐私政策（跳转隐私政策）
│   └── 账号注销说明文字
├── FloatPopup（在线咨询弹窗）
└── LoadingBar（页面加载指示器）
```

#### 4.6 依赖组件

`TopBar`、`FloatPopup`、`LoadingBar`、`CustomTabBar`

## 产出文件清单

```
src/pages/
├── home/
│   ├── index.tsx
│   ├── index.module.scss
│   └── index.config.ts
├── category/
│   ├── index.tsx
│   ├── index.module.scss
│   └── index.config.ts
├── cart/
│   ├── index.tsx
│   ├── index.module.scss
│   └── index.config.ts
└── my/
    ├── index.tsx
    ├── index.module.scss
    └── index.config.ts
```

## 实现要求

### 1. 首页 — `src/pages/home/index.tsx`

#### 1.1 页面配置 — `src/pages/home/index.config.ts`

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  enableShareAppMessage: true,
  enableShareTimeline: true,
})
```

#### 1.2 依赖项

```typescript
// Hooks
import { useNavBarScroll } from '@/hooks/useNavBarScroll'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import { useImageProcessor } from '@/hooks/useImageProcessor'

// Services
import { bannerService } from '@/services/banner.service'
import { productService } from '@/services/product.service'

// Stores
import { useAppStore } from '@/stores/useAppStore'

// Components
import TopBar from '@/components/TopBar'
import ProductCard from '@/components/ProductCard'
import FloatBtn from '@/components/FloatBtn'
import FloatPopup from '@/components/FloatPopup'
import LoadingBar from '@/components/LoadingBar'

// Utils
import { formatPrice } from '@/utils/format'
import { navigateTo, switchTab } from '@/utils/navigation'
```

#### 1.3 核心逻辑

**Taro 生命周期映射（所有 4 个页面通用）：**

| 旧代码 | Taro Hook |
|--------|-----------|
| `onLoad` | `useLoad` |
| `onReady` | `useReady` |
| `onShow` | `useDidShow` |
| `onHide` | `useDidHide` |
| `onUnload` | `useUnload` |
| `onPageScroll` | `usePageScroll` |
| `onShareAppMessage` | `useShareAppMessage` |
| `onShareTimeline` | `useShareTimeline` |

**导航栏滚动变色：**
- 使用 `useNavBarScroll({ criticalScrollTop: 400 })` Hook
- 将返回的 `backgroundColor` 传递给 `<TopBar backgroundColor={backgroundColor} />`
- Hook 内部通过 `usePageScroll` 监听滚动，计算颜色渐变

**Swiper 自动滑动（series + model）：**
- 使用 `useRef` 存储 `IntersectionObserver` 实例和 `setInterval` ID
- `useReady` 中创建 `Taro.createIntersectionObserver`，阈值 `[0.5]`
- 进入视口时启动 3000ms 自动切换定时器
- `onTouchStart` 暂停，`onTouchEnd` 延迟 3000ms 恢复
- `useDidHide` 停止所有定时器，`useDidShow` 恢复
- `useUnload` 清理所有定时器和 Observer

**商品预加载策略：**
- `useLoad` 中并行调用 `bannerService.listBanners()`、`productService.listSubSeries(true)`、`productService.getModelShowData(MODEL_SKU_IDS)`
- 子系列加载完成后，启动三阶段预加载：
  1. 立即加载第一个系列商品 → 设置 `currentSeriesProducts`
  2. `setTimeout(200)` 预加载相邻系列
  3. `setTimeout(500)` 批量加载剩余系列（每批 3 个，批次间 100ms）
- 使用 `useRef` 存储 `allSeriesProducts` 缓存（避免频繁 re-render）

**图片处理：**
- 使用 `useImageProcessor` Hook 的 `processImages` 方法
- Banner 图片：`bannerService.listBanners()` 返回后，对 `imgUrl` 字段调用 `processImages`
- 系列展示图：子系列 `displayImage` 字段调用 `processImages`
- 商品缩略图：压缩参数 `{ width: 280, height: 280, quality: 80 }`，格式 webp
- 模特展示图：`getModelShowData` 返回后，对 `image` 字段调用 `processImages`

**布局动态计算（`useReady` 中执行）：**

```typescript
const systemInfo = Taro.getWindowInfo()
const rpxRatio = 750 / systemInfo.windowWidth
const statusBarHeightRpx = systemInfo.statusBarHeight * rpxRatio
const topBarTotalHeight = 110 + statusBarHeightRpx  // 110rpx = barHeight
const windowHeightRpx = systemInfo.windowHeight * rpxRatio
const swiperContainerHeight = windowHeightRpx - topBarTotalHeight
const bannerHeight = swiperContainerHeight - 100  // 100rpx = tabBar 高度
```

- 计算结果存入 `useState`，通过 inline style 传递给对应容器

### 2. 分类页 — `src/pages/category/index.tsx`

#### 2.1 页面配置 — `src/pages/category/index.config.ts`

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  enableShareAppMessage: true,
  enableShareTimeline: true,
})
```

#### 2.2 依赖项

```typescript
// Hooks
import { useImageProcessor } from '@/hooks/useImageProcessor'
import { usePagination } from '@/hooks/usePagination'

// Services
import { productService } from '@/services/product.service'

// Stores
import { useAppStore } from '@/stores/useAppStore'

// Components
import TopBar from '@/components/TopBar'
import FloatPopup from '@/components/FloatPopup'
import LoadingBar from '@/components/LoadingBar'

// Utils
import { formatPrice } from '@/utils/format'
import { navigateTo, switchTab } from '@/utils/navigation'
```

#### 2.3 核心逻辑

**生命周期：**

| Taro Hook | 逻辑 |
|-----------|------|
| `useLoad` | 设置 `showTabBarLoading: true`；调用 `loadFilterData()` 并行加载子系列、品类、材质列表 |
| `useDidShow` | 设置 TabBar 选中状态 `useAppStore.setCurrentTab(1)` |
| `useReachBottom` | 当 `hasMore && !loading` 时调用 `loadMore()` 加载下一页 |

**筛选状态机（三层筛选体系）：**

```typescript
// 核心状态
type FilterType = 'subseries' | 'category' | 'material'
type ViewMode = 'ALL' | 'FILTERED'

const [viewMode, setViewMode] = useState<ViewMode>('ALL')
const [currentFilterType, setCurrentFilterType] = useState<FilterType>('subseries')
const [selectedFilter, setSelectedFilter] = useState<{ type: FilterType; id: string; name: string } | null>(null)
const [currentSort, setCurrentSort] = useState<'default' | 'price_asc' | 'price_desc'>('default')
const [showSortOptions, setShowSortOptions] = useState(false)
const [showFilterPanel, setShowFilterPanel] = useState(false)

// 二次筛选多选状态
const [selectedCategories, setSelectedCategories] = useState<string[]>([])
const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])
const [selectedSubSeries, setSelectedSubSeries] = useState<string[]>([])
```

**状态转换逻辑：**

```
ALL 视图（默认）
  ├── 显示子系列网格（大图 + 中文名 + 英文名）
  ├── 顶部筛选栏：ALL 按钮（高亮）+ 3 个 filterSection 水平滚动
  ├── 点击子系列网格项 → setViewMode('FILTERED'), setCurrentFilterType('subseries'), 加载商品
  └── 点击 filterSection 中的 item → setViewMode('FILTERED'), setCurrentFilterType(item.type), 加载商品

FILTERED 视图（一级筛选）
  ├── 显示商品列表 + 排序栏 + 筛选按钮
  ├── 点击 "ALL" 按钮 → setViewMode('ALL'), 清空筛选状态
  ├── 点击排序 → setCurrentSort(newSort), 重新加载第 1 页
  ├── 点击筛选按钮 → setShowFilterPanel(true)
  └── 滚动到底 → usePagination.loadMore()

二次筛选面板（叠加在 FILTERED 视图上）
  ├── 多选品类、材质、子系列
  ├── 重置 → 清空所有二次筛选数组
  └── 确定 → 调用 productService.getProductsByFilter() 组合查询
```

**`loadFilterData()` 初始化流程：**
1. 并行调用 `productService.listSubSeries(true)`、`productService.listCategories()`、`productService.listMaterials(true)`
2. 子系列按 `sortNum` 升序排序
3. 构建 `filterSections` 数组（3 个区块），每个区块 `{ type, title, items: [{ id, name, image?, isSelected }] }`
4. 子系列图片通过 `useImageProcessor.processImages` 转换并压缩
5. 预加载子系列展示图

**分页与数据加载：**
- 使用 `usePagination` Hook，`pageSize = 200`（与旧代码一致）
- 根据 `currentFilterType` 选择对应的 `fetchFn`：
  - `'subseries'` → `productService.getProductsBySubSeries({ subSeriesId, sortBy, page, pageSize })`
  - `'category'` → `productService.getProductsByCategory({ categoryId, sortBy, page, pageSize })`
  - `'material'` → `productService.getProductsByMaterial({ materialId, sortBy, page, pageSize })`
- 二次筛选时使用 `productService.getProductsByFilter({ subSeriesIds?, categoryIds?, materialIds?, sortBy, page, pageSize })`
- 切换排序时调用 `usePagination.refresh()` 重新加载第 1 页

**材质分组展开（`expandMaterialIds`）：**

```typescript
function expandMaterialIds(materialIds: string[], allMaterials: Material[]): string[] {
  const expanded: string[] = []
  for (const id of materialIds) {
    const material = allMaterials.find(m => m._id === id)
    if (material?.childMaterials?.length) {
      expanded.push(...material.childMaterials.map(c => c._id))
    } else {
      expanded.push(id)
    }
  }
  return expanded
}
```

- 在二次筛选提交时，对选中的材质 ID 调用此函数展开为子材质真实 `_id`

**图片处理：**
- 商品列表图片压缩参数：`{ width: 300, height: 300, quality: 50 }`（使用 `imageView2` 格式）
- 子系列网格展示图：通过 `useImageProcessor.processImages` 转换并预加载

### 3. 购物车页 — `src/pages/cart/index.tsx`

#### 3.1 页面配置 — `src/pages/cart/index.config.ts`

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
})
```

#### 3.2 依赖项

```typescript
// Hooks
import { useAuth } from '@/hooks/useAuth'
import { useImageProcessor } from '@/hooks/useImageProcessor'

// Stores
import { useCartStore } from '@/stores/useCartStore'
import { useAppStore } from '@/stores/useAppStore'

// Components
import TopBar from '@/components/TopBar'
import FloatPopup from '@/components/FloatPopup'
import LoadingBar from '@/components/LoadingBar'

// Utils
import { formatPrice } from '@/utils/format'
import { navigateTo, switchTab } from '@/utils/navigation'
```

#### 3.3 核心逻辑

**生命周期：**

| Taro Hook | 逻辑 |
|-----------|------|
| `useLoad` | 设置 `showTabBarLoading: true` |
| `useDidShow` | 设置 TabBar 选中状态 `useAppStore.setCurrentTab(2)`；调用 `refreshCart()` 刷新购物车 |

**购物车数据流（全部通过 `useCartStore`）：**

```typescript
// 从 store 读取状态
const { items, loading, totalPrice, selectedCount, isAllChecked } = useCartStore()
const { fetchCart, toggleItem, toggleAll, updateQuantity, removeItem } = useCartStore()

// 页面级状态
const [isPopupShow, setIsPopupShow] = useState(false)
const isEmpty = items.length === 0 && !loading
```

**`refreshCart()` 流程：**
1. 调用 `useAuth.ensureLogin()` 确保已登录
2. 若未登录，跳转注册页并 return
3. 调用 `useCartStore.fetchCart()` 从云端加载购物车
4. `fetchCart` 内部完成数据归一化（字段映射）和图片 URL 转换

**交互操作（全部委托给 store 的乐观更新方法）：**
- 勾选单个商品：`toggleItem(cartItemId, !item.checked)`
- 全选/全不选：`toggleAll(!isAllChecked)`
- 增减数量：`updateQuantity(cartItemId, newQuantity)`，数量最小为 1
- 删除商品：`removeItem(cartItemId)`，删除前弹出确认对话框（`Taro.showModal`）
- 所有写操作由 store 内部执行乐观更新三步模式（立即更新 UI → 后台同步 → 失败回滚）

**结算流程（`goPay`）：**
- 检查 `selectedCount > 0`，否则 `Taro.showToast({ title: '请选择商品', icon: 'none' })`
- 跳转支付页：`navigateTo('/pages/payment/payment')`

**商品详情跳转：**
- 优先使用 `skuId`：`navigateTo('/pages/product-detail/index?skuId=${item.skuId}')`
- 若无 `skuId` 则使用 `spuId`

### 4. 我的页 — `src/pages/my/index.tsx`

#### 4.1 页面配置 — `src/pages/my/index.config.ts`

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
})
```

#### 4.2 依赖项

```typescript
// Hooks
import { useAuth } from '@/hooks/useAuth'

// Services
import { userService } from '@/services/user.service'
import { wishService } from '@/services/wish.service'

// Stores
import { useUserStore } from '@/stores/useUserStore'
import { useAppStore } from '@/stores/useAppStore'

// Components
import TopBar from '@/components/TopBar'
import FloatPopup from '@/components/FloatPopup'
import LoadingBar from '@/components/LoadingBar'

// Utils
import { navigateTo } from '@/utils/navigation'
```

#### 4.3 核心逻辑

**生命周期：**

| Taro Hook | 逻辑 |
|-----------|------|
| `useLoad` | 调用 `useAuth.ensureLogin()`；调用 `loadUserData()` |
| `useDidShow` | 设置 TabBar 选中状态 `useAppStore.setCurrentTab(3)`；重新计算问候语 |

**`loadUserData()` 流程：**
1. 调用 `useUserStore.fetchUserInfo()` 获取用户信息并更新 `isRegistered`
2. 调用 `wishService.listWishes(userId)` 获取心愿单列表，仅取 `count`
3. 根据 `isRegistered` 设置 `registerBtnText`：已注册 `'编辑地址'`，未注册 `'立即注册'`
4. 构建 `personal_info` 数组：昵称、电话、生日、地区、收货地址列表

**问候语计算（`computeGreeting`）：**

```typescript
// 复姓列表
const COMPOUND_SURNAMES = ['欧阳', '司马', '诸葛', '上官', '皇甫', '令狐', '司徒', '东方', '西门', '南宫']

function computeGreeting(userInfo: User | null): string {
  if (!userInfo) return '欢迎'
  const name = userInfo.nickname || userInfo.lastName || ''
  if (!name) return '欢迎'

  // 提取姓氏
  let surname = name.substring(0, 1)
  for (const cs of COMPOUND_SURNAMES) {
    if (name.startsWith(cs)) {
      surname = cs
      break
    }
  }

  // 拼接称谓
  const title = userInfo.title || ''
  return `${surname}${title}`
}
```

**页面导航函数：**

| 函数 | 目标页面 |
|------|----------|
| `goToOrders()` | `navigateTo('/pages/my_sub_page/my_sub_page?tab=1')` |
| `goToOrderByStatus(tab)` | `navigateTo('/pages/my_sub_page/my_sub_page?tab=${tab}')` |
| `goToWishlist()` | `navigateTo('/pages/wishlist/wishlist')` |
| `goEditInfo()` | `navigateTo('/pages/edit_information/edit_information')` |
| `goToAfterSales()` | `navigateTo('/pages/my_sub_page/my_sub_page?tab=6')` |
| `goToPrivacyPolicy()` | `navigateTo('/pages-sub/privacy-policy/index')` |
| `goToUserAgreement()` | `navigateTo('/pages-sub/user-agreement/index')` |
| `goConsult()` | `setIsPopupShow(true)` |

## 验收标准

1. 所有 4 个页面文件（含 `.config.ts`）无 TypeScript 编译错误
2. 每个页面均为 React 函数组件，使用 SCSS Modules 进行样式隔离
3. 所有页面使用 Taro 生命周期 Hooks（`useLoad`、`useDidShow`、`useReady` 等），不使用类组件生命周期
4. 首页导航栏滚动变色正确：`scrollTop = 0` 时透明/黑色，`scrollTop >= 400` 时白色，中间线性插值
5. 首页 Swiper 自动滑动正确：IntersectionObserver 阈值 0.5，进入视口启动 3000ms 定时器，触摸暂停，触摸结束 3000ms 后恢复
6. 首页商品预加载三阶段策略正确：首屏优先 → 相邻预加载 → 批量加载剩余
7. 首页布局动态计算正确：rpx 转换比例 `750/windowWidth`，swiper 容器高度 = 窗口高度 - TopBar 高度
8. 分类页筛选状态机正确：ALL 视图 ↔ FILTERED 视图切换，一级筛选 + 二次筛选面板
9. 分类页排序逻辑正确：切换排序时重新加载第 1 页，`sortBy` 参数传给 service
10. 分类页分页逻辑正确：`usePagination` Hook 管理分页，`useReachBottom` 触发 `loadMore()`
11. 分类页材质分组展开正确：`expandMaterialIds` 将分组 ID 展开为子材质真实 `_id`
12. 购物车页通过 `useCartStore` 管理所有状态，页面组件不直接调用云函数
13. 购物车页所有写操作（勾选、全选、数量、删除）通过 store 的乐观更新方法执行
14. 购物车页 `useDidShow` 中调用 `refreshCart()` 确保每次进入页面数据最新
15. 购物车页结算前检查 `selectedCount > 0`，否则提示用户
16. 我的页问候语计算正确：支持复姓识别（欧阳、司马、诸葛等），拼接称谓
17. 我的页 `useLoad` 中调用 `ensureLogin()` 确保登录状态
18. 我的页注册状态检查正确：已注册显示"编辑地址"，未注册显示"立即注册"
19. 我的页所有导航函数跳转路径正确，与旧代码一致
20. 所有 4 个页面在 `useDidShow` 中正确设置 TabBar 选中状态（首页 0、分类 1、购物车 2、我的 3）
21. 所有页面图片处理使用 `useImageProcessor` Hook，不直接调用 `wx.cloud.getTempFileURL`
22. 所有页面 `import` 路径正确，无循环依赖
23. 首页 `useUnload` 中清理所有定时器和 IntersectionObserver，无内存泄漏
