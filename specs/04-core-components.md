# Phase 04: 核心共享组件

## 目标

实现 12 个可复用的共享组件，为后续所有页面开发提供 UI 基础设施。每个组件均为 React 函数组件 + SCSS Modules，遵循 TypeScript strict 模式。

> **NutUI 优先原则**：项目已安装 `@nutui/nutui-react-taro` 组件库。实现组件时，优先使用 NutUI 提供的基础组件（如 `Popup`、`Button`、`Dialog`、`Overlay`、`Rate`、`TextArea`、`Picker`、`DatePicker` 等）作为底层构建块，减少手写样式和交互逻辑。仅在 NutUI 无法满足需求时才完全手写。实现前请先查阅 NutUI React Taro 文档确认可用组件。

## 前置依赖

- Phase 02 完成（`types/`、`services/`、`utils/`、`constants/`）
- Phase 03 完成（`stores/`、`hooks/`）

## 旧代码摘要

### 1. TopBar（`components/TopBar/`）

**结构**：固定定位顶部导航栏，包含 logo 图片，支持可选返回按钮。
- Props：`barHeight`（内容栏高度 rpx，默认 110）、`imageSrc`（logo 图片路径）、`backgroundColor`（背景色，默认 white）、`showBack`（是否显示返回按钮，默认 false）
- 通过 `wx.getSystemInfoSync()` 获取 `statusBarHeight`，作为顶部 padding
- 返回按钮逻辑：页面栈 > 1 则 `navigateBack`，否则 `switchTab` 到首页
- 样式：`position: fixed; top: 0; z-index: 999`，内部 flex 居中，logo 使用 `mode="heightFix"`

### 2. TopBarWithBack（`components/TopBarWithBack/`）

**结构**：与 TopBar 几乎相同，但 `showBack` 默认为 `true`，返回按钮使用图片图标（`back.png`）而非文字字符。
- 返回按钮位置：`left: 16rpx`，40rpx × 40rpx 图标
- 其余逻辑与 TopBar 一致

### 3. ProductCard（旧 `product_image`）

**结构**：商品卡片，包含大图、编号、中英文名称、价格、加购按钮。
- Props：`url`（跳转链接）、`image`（商品大图）、`name`（中文名）、`product_id`（编号）、`foreign_name`（英文名）、`price`（价格，自动 formatPrice）
- 点击大图跳转商品详情页（`Product_Details?id={product_id}`）
- 加购按钮触发 `onAddToCart` 自定义事件，携带 `productId`
- 样式：卡片高度 750rpx，大图占 80% 宽高，底部信息区 flex 布局

### 4. SizePopup（`components/SizePopup/`）

**结构**：全屏遮罩 + 居中弹窗，尺码选择指南。
- Props：`showPopup`（控制显示隐藏）
- 内部状态：`productType`（bracelet/ring 切换）
- 包含手镯和戒指两套尺寸对照表（静态内容）
- 底部"我了解了"按钮触发 `closePopup` 事件
- 样式：遮罩 `rgba(0,0,0,0.5)`，弹窗 `height: 80%; width: 85%`，白色背景，无圆角

### 5. FloatPopup（`components/FloatPopup/`）

**结构**：底部弹出式在线咨询弹窗，包含三个按钮。
- Props：`show`（控制显示隐藏），通过 observer 同步到内部 `showPopup`
- 三个按钮：「在线客服」（`open-type="contact"`）、「客服电话：19988266351」（调用 `Taro.makePhoneCall`）、「取消」
- 关闭时触发 `close` 事件通知父组件
- 样式：遮罩 `rgba(0,0,0,0.808)`，弹窗从底部滑入（`translateY(100%)` → `translateY(0)`），过渡 0.3s ease-in-out

### 6. FloatBtn（`components/FloatBtn/`）

**结构**：固定定位的圆形浮动按钮，显示电话图标。
- 无外部 Props，点击触发父组件的弹窗显示
- 样式：`position: fixed; bottom: 220rpx; right: 40rpx`，80rpx 圆形，白色背景，阴影 `0 4rpx 12rpx rgba(0,0,0,0.1)`，点击缩放 `scale(0.95)`

### 7. CartSuccessPopup（旧 `AddToCartSuccessPopup`）

**结构**：居中弹窗，加入购物车成功提示。
- Props：`show`（控制显示隐藏）
- 标题"已加入购物车"，两个横排按钮：「继续选购」和「前往购物车」
- 事件：`continueShopping`、`goToCart`、`close`
- 样式：居中定位，600rpx 宽，圆角 20rpx，缩放动画（`scale(0.8)` → `scale(1)`）

### 8. LoadingBar（旧 `TabBarLoading`）

**结构**：全屏加载指示器，居中显示 logo + 进度条。
- Props：`show`（控制显示隐藏）
- 内部状态：`progress`（0-100），通过 `setInterval` 每 150ms 随机增长 5-15，最多到 95%
- `finishLoading()` 方法将进度设为 100%，300ms 后隐藏
- 样式：全屏白色半透明背景 `rgba(255,255,255,0.95)`，z-index 9999，logo 120rpx，进度条 200rpx 宽 4rpx 高，深灰色 `#333333`

### 9. SlidingBar（旧 `SlidingSelectionBar`）

**结构**：水平滑动选择栏，用于系列/分类切换。
- Props：`items`（选项列表 `{ id, text }[]`）、`scrollX`（水平滚动，默认 true）、`scrollY`（垂直滚动，默认 false）
- 点击选项触发 `onSelect` 事件，携带选中项数据
- 样式：`scroll-view` 容器，flex 布局，按钮文字 30rpx，颜色 `rgb(187,187,187)`，透明背景

### 10. ReviewPopup（旧 `review_interface`）

**结构**：底部弹出式评价弹窗，包含三维星级评分、商品信息、文字评价、图片上传。
- Props：`showPopup`（控制显示）、`product_image`、`product_name`、`product_foreign_name`
- 三维评分：描述相符、物流服务、服务态度，各 5 颗星
- 星级评分文字映射：`['非常差', '差', '一般', '好', '非常好']`
- 点击星星逻辑：点击第 N 颗，则 0~N 全部点亮（`clicked: item.id <= id`）
- 文字评价：textarea，最多 500 字，实时字数统计
- 底部：图/视频上传按钮 + "发布评价"按钮
- 样式：底部滑入弹窗，高度 1250rpx，星星 40rpx，发布按钮黑底白字

### 11. SignUpPopup（旧 `sign_up`）

**结构**：全屏遮罩 + 居中注册表单弹窗，完整注册流程。
- Props：`showPopup`（控制显示）
- 表单字段：性别（女/男单选）、称谓（picker 选择）、昵称、生日（date picker）、电话（支持一键获取 `open-type="getPhoneNumber"`）、邮箱、地区（region picker）
- 必填项：称谓、昵称、电话；选填项：生日、邮箱、地区
- 表单验证：称谓不能为默认值、昵称非空、电话 `/^1\d{10}$/`、邮箱格式（若填写）
- 验证失败时：placeholder 变红色 `#CE1616`，提示文字变为"请输入正确的XXX"
- 隐私协议勾选：必须勾选才能提交，链接跳转到隐私政策和用户协议页面
- 提交调用 `sign_up` 云函数，成功后触发 `formSubmit` 事件并延迟关闭
- 右上角关闭按钮（×）触发 `closePopup` 事件
- 事件：`formSubmit`（携带 userId、userData）、`closePopup`

### 12. CustomTabBar（`custom-tab-bar/`）

**结构**：底部 4 Tab 导航栏，固定定位。
- 4 个 Tab：首页、分类、购物车、我的
- 每个 Tab 包含图标（选中/未选中两套）和文字
- 选中状态通过 `useAppStore.currentTab` 控制
- 点击调用 `Taro.switchTab()` 切换页面
- 颜色：未选中 `#999999`，选中 `#333333`
- 样式：`position: fixed; bottom: 0`，高度 100rpx，白色背景，顶部 1rpx 边框 `#e5e5e5`，底部安全区 `env(safe-area-inset-bottom)`，z-index 999

## 产出文件清单

```
src/
├── components/
│   ├── TopBar/
│   │   ├── index.tsx
│   │   └── index.module.scss
│   ├── TopBarWithBack/
│   │   ├── index.tsx
│   │   └── index.module.scss
│   ├── ProductCard/
│   │   ├── index.tsx
│   │   └── index.module.scss
│   ├── SizePopup/
│   │   ├── index.tsx
│   │   └── index.module.scss
│   ├── FloatPopup/
│   │   ├── index.tsx
│   │   └── index.module.scss
│   ├── FloatBtn/
│   │   ├── index.tsx
│   │   └── index.module.scss
│   ├── CartSuccessPopup/
│   │   ├── index.tsx
│   │   └── index.module.scss
│   ├── LoadingBar/
│   │   ├── index.tsx
│   │   └── index.module.scss
│   ├── SlidingBar/
│   │   ├── index.tsx
│   │   └── index.module.scss
│   ├── ReviewPopup/
│   │   ├── index.tsx
│   │   └── index.module.scss
│   └── SignUpPopup/
│       ├── index.tsx
│       └── index.module.scss
└── custom-tab-bar/
    ├── index.tsx
    └── index.module.scss
```

## 实现要求

### 1. TopBar — `src/components/TopBar/index.tsx`

```typescript
interface TopBarProps {
  /** Logo 图片路径，默认 '/assets/icons/top.png' */
  imageSrc?: string
  /** 背景色，默认 'transparent' */
  backgroundColor?: string
  /** 内容栏高度 (rpx)，默认 110 */
  barHeight?: number
}
```

**依赖 Hooks**：`useSystemInfo`（获取 `statusBarHeight`）

**核心逻辑：**
- 外层容器 `position: fixed; top: 0; z-index: 999`
- 顶部 padding 为 `statusBarHeight` px（动态获取）
- 内部 flex 居中显示 logo 图片，使用 Taro `Image` 组件 `mode="heightFix"`
- `backgroundColor` 通过 inline style 设置，支持页面通过 `useNavBarScroll` 动态传入

**关键样式：**
- 容器：`width: 100%; position: fixed; top: 0; left: 0; z-index: 999`
- 内部：`display: flex; align-items: flex-start; justify-content: center; margin-top: 20rpx; margin-bottom: 15rpx`
- Logo：`height: calc(100% - 35rpx); mode: heightFix`

### 2. TopBarWithBack — `src/components/TopBarWithBack/index.tsx`

```typescript
interface TopBarWithBackProps {
  /** Logo 图片路径，默认 '/assets/icons/top.png' */
  imageSrc?: string
  /** 背景色，默认 'white' */
  backgroundColor?: string
  /** 内容栏高度 (rpx)，默认 110 */
  barHeight?: number
}
```

**依赖 Hooks**：`useSystemInfo`（获取 `statusBarHeight`）

**核心逻辑：**
- 与 TopBar 结构相同，但始终显示返回按钮
- 返回按钮使用图片图标（`/assets/icons/back.png`），位于左侧 `left: 16rpx`
- 返回逻辑：`Taro.getCurrentPages().length > 1` 则 `Taro.navigateBack()`，否则 `Taro.switchTab({ url: '/pages/home/index' })`

**关键样式：**
- 返回按钮：`position: absolute; left: 16rpx; top: 50%; transform: translateY(-50%); width: 60rpx; height: 60rpx`
- 图标：`width: 40rpx; height: 40rpx`

### 3. ProductCard — `src/components/ProductCard/index.tsx`

```typescript
interface ProductCardProps {
  /** 商品 SKU ID */
  skuId: string
  /** 商品大图 URL */
  image: string
  /** 商品中文名 */
  name: string
  /** 商品英文名 */
  nameEN?: string
  /** 商品编号（显示用） */
  productId?: string
  /** 价格（数字，组件内部 formatPrice） */
  price: number
  /** 点击加购回调 */
  onAddToCart?: (skuId: string) => void
  /** 点击卡片跳转回调（默认跳转商品详情页） */
  onPress?: (skuId: string) => void
}
```

**依赖**：`utils/format.ts`（`formatPrice`）

**核心逻辑：**
- 点击大图区域跳转商品详情：`Taro.navigateTo({ url: '/pages/product-detail/index?skuId=${skuId}' })`
- 点击加购按钮（+图标）调用 `onAddToCart` 回调
- 价格使用 `formatPrice` 格式化显示

**关键样式：**
- 卡片容器：`height: 750rpx; display: flex; flex-direction: column`
- 大图区域：`width: 80%; height: 80%; object-fit: cover; padding-top: 10%; padding-left: 12%`
- 信息区：flex 横向布局，左侧编号+名称，右侧加购按钮+价格
- 编号文字：`font-size: 26rpx`
- 中文名：`font-size: 35rpx`
- 英文名：`font-size: 28rpx`
- 价格：`font-size: 30rpx`
- 加购按钮：`50rpx × 50rpx`

### 4. SizePopup — `src/components/SizePopup/index.tsx`

```typescript
type ProductType = 'bracelet' | 'ring'

interface SizePopupProps {
  /** 控制弹窗显示 */
  visible: boolean
  /** 关闭回调 */
  onClose: () => void
}
```

**核心逻辑：**
- 内部状态 `productType: ProductType`，默认 `'bracelet'`
- 手镯/戒指切换使用 checkbox 样式的单选按钮
- 手镯尺寸表：`13–15.5cm → 16.5寸`、`16–16.9cm → 18寸`
- 戒指尺寸表：`16.1mm → 12寸`、`16.5mm → 13寸`、`16.85mm → 14寸`
- 底部"我了解了"按钮调用 `onClose`

**关键样式：**
- 遮罩：`position: fixed; background: rgba(0,0,0,0.5); z-index: 999`
- 弹窗：`height: 80%; width: 85%; max-width: 500px; background: #fff; border-radius: 0`
- Logo：`height: 130rpx; width: 75rpx; margin-top: 40rpx`
- 标题：`font-size: 32rpx; font-weight: bold`
- 表格：`border: 1rpx solid #ddd; border-radius: 8rpx`，表头 `background: #f5f5f5`
- 提交按钮：`width: 88%; background: black; color: white; position: absolute; bottom: 40rpx`

### 5. FloatPopup — `src/components/FloatPopup/index.tsx`

```typescript
interface FloatPopupProps {
  /** 控制弹窗显示 */
  visible: boolean
  /** 关闭回调 */
  onClose: () => void
}
```

**核心逻辑：**
- 三个按钮垂直排列：
  1. 「在线客服」— 使用 Taro `Button` 的 `openType="contact"` 属性
  2. 「客服电话：19988266351」— 调用 `Taro.makePhoneCall({ phoneNumber: CONSULTATION_PHONE })`
  3. 「取消」— 调用 `onClose`
- 点击遮罩层也调用 `onClose`

**关键样式：**
- 遮罩：`background: rgba(0,0,0,0.808); z-index: 999`
- 弹窗容器：`position: fixed; bottom: 0; width: 100%; background: #fff`
- 滑入动画：`transform: translateY(100%)` → `translateY(0)`，`transition: 0.3s ease-in-out`
- 按钮：`font-size: 30rpx; font-weight: 600; padding: 30rpx 0; color: #333`
- 取消按钮：`color: #999`

### 6. FloatBtn — `src/components/FloatBtn/index.tsx`

```typescript
interface FloatBtnProps {
  /** 点击回调（通常用于打开 FloatPopup） */
  onPress: () => void
}
```

**核心逻辑：**
- 显示电话图标（SVG 或 PNG），点击调用 `onPress`
- 无内部状态

**关键样式：**
- 容器：`position: fixed; bottom: 220rpx; right: 40rpx; width: 80rpx; height: 80rpx; border-radius: 50%; background: #fff; z-index: 998`
- 阴影：`box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1)`
- 图标：`width: 50rpx; height: 50rpx`，居中
- 点击反馈：`active` 伪类 `transform: scale(0.95)`，过渡 `transition: transform 0.3s`

### 7. CartSuccessPopup — `src/components/CartSuccessPopup/index.tsx`

```typescript
interface CartSuccessPopupProps {
  /** 控制弹窗显示 */
  visible: boolean
  /** 继续选购回调 */
  onContinue: () => void
  /** 前往购物车回调 */
  onGoToCart: () => void
  /** 关闭回调（点击遮罩） */
  onClose: () => void
}
```

**核心逻辑：**
- 标题"已加入购物车"
- 两个横排按钮：「继续选购」调用 `onContinue`，「前往购物车」调用 `onGoToCart`
- 点击遮罩调用 `onClose`

**关键样式：**
- 遮罩：`background: rgba(0,0,0,0.5); z-index: 999`
- 弹窗：`position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 600rpx; border-radius: 20rpx; padding: 50rpx 40rpx 40rpx`
- 显示动画：`scale(0.8) → scale(1)`，`opacity: 0 → 1`，`transition: 0.3s ease-in-out`
- 标题：`font-size: 36rpx; font-weight: 600; color: #333; margin-bottom: 40rpx`
- 按钮容器：`display: flex; gap: 20rpx`
- 继续选购按钮：`background: #000; color: #fff; height: 88rpx; border-radius: 8rpx`
- 前往购物车按钮：`background: #f5f5f5; color: #333`

### 8. LoadingBar — `src/components/LoadingBar/index.tsx`

```typescript
interface LoadingBarProps {
  /** 控制显示隐藏 */
  visible: boolean
  /** 加载完成回调（进度到 100% 并隐藏后触发） */
  onFinish?: () => void
}
```

**核心逻辑：**
- 内部状态 `progress: number`（0-100）
- `visible` 变为 `true` 时，启动 `setInterval`（150ms 间隔），每次随机增长 5-15（`Math.floor(Math.random() * 11) + 5`），上限 95%
- `visible` 变为 `false` 时，将 `progress` 设为 100%，300ms 后重置为 0 并调用 `onFinish`
- 组件卸载时清除定时器（`useEffect` cleanup）
- 使用 `useRef` 存储 interval ID，避免闭包问题

**关键样式：**
- 遮罩：`position: fixed; inset: 0; background: rgba(255,255,255,0.95); z-index: 9999; display: flex; flex-direction: column; align-items: center; justify-content: center`
- Logo：`width: 120rpx; height: 120rpx; margin-bottom: 40rpx`
- 进度条容器：`width: 200rpx; height: 4rpx; background: #e5e5e5; border-radius: 2rpx; overflow: hidden`
- 进度条填充：`height: 100%; background: #333333; transition: width 0.15s linear`，宽度通过 inline style `width: ${progress}%` 控制

### 9. SlidingBar — `src/components/SlidingBar/index.tsx`

```typescript
interface SlidingBarItem {
  /** 选项唯一标识 */
  id: string
  /** 显示文字 */
  text: string
}

interface SlidingBarProps {
  /** 选项列表 */
  items: SlidingBarItem[]
  /** 当前选中项 ID */
  activeId?: string
  /** 选中回调 */
  onSelect: (item: SlidingBarItem) => void
  /** 水平滚动，默认 true */
  scrollX?: boolean
  /** 垂直滚动，默认 false */
  scrollY?: boolean
}
```

**核心逻辑：**
- 使用 Taro `ScrollView` 组件，`scrollX` 默认开启
- 点击选项调用 `onSelect` 回调，携带选中项 `{ id, text }`
- 选中状态通过 `activeId` 与 `item.id` 比较确定
- 无内部状态，完全受控组件

**关键样式：**
- 容器：`ScrollView`，`white-space: nowrap; width: 100%`
- 选项按钮：`display: inline-block; padding: 10rpx 30rpx; font-size: 30rpx; color: rgb(187,187,187); background: transparent; border: none`
- 选中状态：`color: #333; font-weight: 600`
- 过渡：`transition: color 0.2s`

### 10. ReviewPopup — `src/components/ReviewPopup/index.tsx`

```typescript
interface ReviewRating {
  /** 描述相符 */
  description: number
  /** 物流服务 */
  logistics: number
  /** 服务态度 */
  service: number
}

interface ReviewPopupProps {
  /** 控制弹窗显示 */
  visible: boolean
  /** 商品图片 */
  productImage: string
  /** 商品中文名 */
  productName: string
  /** 商品英文名 */
  productNameEN?: string
  /** 提交评价回调 */
  onSubmit: (data: {
    ratings: ReviewRating
    content: string
    images: string[]
  }) => void
  /** 关闭回调 */
  onClose: () => void
}
```

**核心逻辑：**
- 三维评分：描述相符、物流服务、服务态度，各 5 颗星，默认 5 分
- 星级评分文字映射：`['非常差', '差', '一般', '好', '非常好']`（索引 0-4 对应 1-5 星）
- 点击星星逻辑：点击第 N 颗星（1-based），则 1~N 全部点亮（`filled: starIndex <= clickedIndex`）
- 文字评价：`Textarea` 组件，`maxlength={500}`，实时字数统计 `${content.length}/500`
- 图片上传：调用 `Taro.chooseImage()`，最多 9 张，上传后显示缩略图列表
- 点击「发布评价」按钮调用 `onSubmit`，携带 `{ ratings, content, images }`

**关键样式：**
- 遮罩：`background: rgba(0,0,0,0.5); z-index: 999`
- 弹窗：`position: fixed; bottom: 0; width: 100%; height: 1250rpx; background: #fff; border-radius: 20rpx 20rpx 0 0`
- 滑入动画：`transform: translateY(100%)` → `translateY(0)`，`transition: 0.3s ease-in-out`
- 商品信息区：`display: flex; align-items: center; padding: 30rpx; gap: 20rpx`
- 商品图片：`width: 120rpx; height: 120rpx; border-radius: 8rpx`
- 星星：`width: 40rpx; height: 40rpx`，未选中 `opacity: 0.3`，选中 `opacity: 1`
- 评分文字：`font-size: 24rpx; color: #999`
- Textarea：`width: 100%; height: 200rpx; font-size: 28rpx; padding: 20rpx; border: 1rpx solid #eee; border-radius: 8rpx`
- 字数统计：`font-size: 24rpx; color: #999; text-align: right`
- 发布按钮：`width: 100%; height: 88rpx; background: #000; color: #fff; font-size: 30rpx; border-radius: 8rpx`

### 11. SignUpPopup — `src/components/SignUpPopup/index.tsx`

```typescript
interface SignUpFormData {
  /** 性别：'female' | 'male' */
  gender: string
  /** 称谓 */
  title: string
  /** 昵称 */
  nickname: string
  /** 生日（YYYY-MM-DD） */
  birthday?: string
  /** 电话 */
  phone: string
  /** 邮箱 */
  mail?: string
  /** 地区（省市区数组） */
  region?: string[]
}

interface SignUpPopupProps {
  /** 控制弹窗显示 */
  visible: boolean
  /** 表单提交成功回调 */
  onSubmit: (data: { userId: string; userInfo: SignUpFormData }) => void
  /** 关闭回调 */
  onClose: () => void
}
```

**依赖**：`utils/validate.ts`（`isValidPhone`、`isValidEmail`、`isNotEmpty`）、`services/user.service.ts`（`register`）

**核心逻辑：**
- 内部状态：`formData: SignUpFormData`、`errors: Record<string, string>`、`privacyAgreed: boolean`
- 性别选择：女/男单选按钮，默认 `'female'`
- 称谓选择：Taro `Picker` 组件，`mode="selector"`，选项 `['女士', '先生', '小姐', '太太']`
- 生日选择：Taro `Picker` 组件，`mode="date"`
- 电话输入：支持手动输入，也支持微信一键获取（Taro `Button` 的 `openType="getPhoneNumber"`，成功后调用 `userService.bindPhone(code)` 获取手机号）
- 地区选择：Taro `Picker` 组件，`mode="region"`

**表单验证（提交时触发）：**
- 必填项：称谓（不能为默认值）、昵称（`isNotEmpty`）、电话（`isValidPhone`，正则 `/^1[3-9]\d{9}$/`）
- 选填项：生日、邮箱（若填写则 `isValidEmail`）、地区
- 验证失败时：对应字段 placeholder 变红色 `#CE1616`，提示文字变为"请输入正确的XXX"
- 隐私协议：必须勾选 `privacyAgreed` 才能提交，未勾选时提示"请先同意隐私协议"
- 隐私协议链接：点击跳转 `Taro.navigateTo({ url: '/pages-sub/privacy-policy/index' })` 和 `'/pages-sub/user-agreement/index'`

**提交流程：**
1. 前端验证通过后，调用 `userService.register(formData)`
2. 成功（`code === 200`）：触发 `onSubmit` 回调，携带 `{ userId, userInfo }`，延迟 500ms 后关闭弹窗
3. 失败：`Taro.showToast({ title: res.message || '注册失败', icon: 'none' })`

**关键样式：**
- 遮罩：`background: rgba(0,0,0,0.5); z-index: 999`
- 弹窗：`position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 90%; max-width: 650rpx; max-height: 85vh; background: #fff; border-radius: 20rpx; overflow-y: auto`
- 关闭按钮（×）：`position: absolute; top: 20rpx; right: 20rpx; font-size: 40rpx; color: #999`
- 表单项：`margin-bottom: 30rpx`
- 标签：`font-size: 28rpx; color: #333; margin-bottom: 10rpx`
- 输入框：`height: 80rpx; border: 1rpx solid #ddd; border-radius: 8rpx; padding: 0 20rpx; font-size: 28rpx`
- 错误状态输入框：`border-color: #CE1616`，placeholder 颜色 `#CE1616`
- 性别单选：圆形按钮，选中 `background: #000; border-color: #000`
- 提交按钮：`width: 100%; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx; font-size: 30rpx`
- 隐私协议：`font-size: 24rpx; color: #999`，链接文字 `color: #333; text-decoration: underline`

### 12. CustomTabBar — `src/custom-tab-bar/index.tsx`

```typescript
interface TabItem {
  /** Tab 页路径 */
  pagePath: string
  /** Tab 文字 */
  text: string
  /** 未选中图标路径 */
  iconPath: string
  /** 选中图标路径 */
  selectedIconPath: string
}

// 无外部 Props，从 useAppStore 读取 currentTab
```

**依赖**：`stores/useAppStore.ts`（`currentTab`、`setCurrentTab`）

**核心逻辑：**
- 4 个 Tab 配置（组件内部常量）：

```typescript
const TAB_LIST: TabItem[] = [
  { pagePath: '/pages/home/index', text: '首页', iconPath: '/assets/icons/home.png', selectedIconPath: '/assets/icons/home-active.png' },
  { pagePath: '/pages/category/index', text: '分类', iconPath: '/assets/icons/category.png', selectedIconPath: '/assets/icons/category-active.png' },
  { pagePath: '/pages/cart/index', text: '购物车', iconPath: '/assets/icons/cart.png', selectedIconPath: '/assets/icons/cart-active.png' },
  { pagePath: '/pages/my/index', text: '我的', iconPath: '/assets/icons/my.png', selectedIconPath: '/assets/icons/my-active.png' },
]
```

- 从 `useAppStore` 读取 `currentTab` 确定选中状态
- 点击 Tab 时调用 `Taro.switchTab({ url: item.pagePath })`，同时调用 `setCurrentTab(index)` 更新 store
- 每个 Tab 显示图标（选中/未选中两套）和文字
- 颜色：未选中 `#999999`，选中 `#333333`

**关键样式：**
- 容器：`position: fixed; bottom: 0; left: 0; width: 100%; height: 100rpx; background: #fff; z-index: 999`
- 顶部边框：`border-top: 1rpx solid #e5e5e5`
- 底部安全区：`padding-bottom: env(safe-area-inset-bottom)`
- 内部布局：`display: flex; justify-content: space-around; align-items: center; height: 100%`
- Tab 项：`display: flex; flex-direction: column; align-items: center; justify-content: center`
- 图标：`width: 48rpx; height: 48rpx; margin-bottom: 4rpx`
- 文字：`font-size: 20rpx; color: #999999`
- 选中文字：`color: #333333`

## 验收标准

1. 所有 12 个组件文件（含 `custom-tab-bar`）无 TypeScript 编译错误
2. 每个组件均为 React 函数组件，使用 SCSS Modules 进行样式隔离
3. `TopBar` 和 `TopBarWithBack` 能正确获取 `statusBarHeight` 并设置顶部 padding
4. `TopBarWithBack` 的返回按钮逻辑正确：页面栈 > 1 则 `navigateBack`，否则 `switchTab` 到首页
5. `ProductCard` 的价格显示使用 `formatPrice` 格式化，点击大图跳转商品详情页
6. `SizePopup` 能正确切换手镯/戒指尺寸表，底部按钮调用 `onClose`
7. `FloatPopup` 的三个按钮功能正确：在线客服使用 `openType="contact"`、客服电话调用 `Taro.makePhoneCall`、取消调用 `onClose`
8. `CartSuccessPopup` 的缩放动画正确：`scale(0.8) → scale(1)`，两个按钮分别触发 `onContinue` 和 `onGoToCart`
9. `LoadingBar` 的进度条逻辑正确：150ms 间隔随机增长 5-15，上限 95%，隐藏时设为 100% 并延迟重置
10. `SlidingBar` 为完全受控组件，`activeId` 控制选中状态，点击触发 `onSelect`
11. `ReviewPopup` 的三维星级评分逻辑正确：点击第 N 颗星则 1~N 全部点亮，文字评价最多 500 字
12. `SignUpPopup` 的表单验证正确：称谓必选、昵称非空、电话 `/^1[3-9]\d{9}$/`、邮箱格式（若填写）、隐私协议必须勾选
13. `CustomTabBar` 从 `useAppStore` 读取 `currentTab`，点击 Tab 调用 `Taro.switchTab` 并更新 store
14. 所有弹窗组件（SizePopup、FloatPopup、CartSuccessPopup、ReviewPopup、SignUpPopup）均支持点击遮罩关闭
15. 所有文件 `import` 路径正确，无循环依赖
