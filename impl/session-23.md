# 会话 23：Phase 07d 售后入口 + 售后详情 + 退款申请 + 退换详情 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 07 的第四部分（也是最后一部分）：售后入口页（after-sales）、售后详情页（after-sales-detail）、退款申请页（refund）、退换详情页（return-exchange-detail）。其中售后详情和退换详情是纯静态页面，逻辑很简单。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用前先读取 service 文件确认方法签名，避免参数传递错误。
4. 这四个页面都是分包页面（pages-sub/），不是 Tab 页，不需要 CustomTabBar 组件。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/07-user-center.md`（关注「旧代码摘要 → 6. 售后入口页」「7. 售后详情页」「8. 退款申请页」「9. 退换详情页」部分，以及对应的「实现要求」部分）
3. `src/services/order.service.ts`（订单服务 — **必读**，理解 getOrderDetail 方法签名）
4. `src/services/user.service.ts`（用户服务 — getUserInfo）
5. `src/types/order.ts`（Order / OrderItem 类型定义）
6. `src/utils/validate.ts`（isValidPhone / isNotEmpty）
7. `src/components/SlidingBar/index.tsx`（Tab 栏组件 — 理解 props）
8. `src/hooks/useAuth.ts`（ensureLogin）

## 参考旧代码（必读，1:1 还原 UI）

**售后入口页：**
- `legacy_ro/yz-legacy-code/pages/my_sub_after_sales_service/my_sub_after_sales_service.wxml`
- `legacy_ro/yz-legacy-code/pages/my_sub_after_sales_service/my_sub_after_sales_service.wxss`
- `legacy_ro/yz-legacy-code/pages/my_sub_after_sales_service/my_sub_after_sales_service.js`

**售后详情页：**
- `legacy_ro/yz-legacy-code/pages/after_sales_service/after_sales_service.wxml`
- `legacy_ro/yz-legacy-code/pages/after_sales_service/after_sales_service.wxss`
- `legacy_ro/yz-legacy-code/pages/after_sales_service/after_sales_service.js`

**退款申请页：**
- `legacy_ro/yz-legacy-code/pages/refund/refund.wxml`
- `legacy_ro/yz-legacy-code/pages/refund/refund.wxss`
- `legacy_ro/yz-legacy-code/pages/refund/refund.js`

**退换详情页：**
- `legacy_ro/yz-legacy-code/pages/return_exchange_details/return_exchange_details.wxml`
- `legacy_ro/yz-legacy-code/pages/return_exchange_details/return_exchange_details.wxss`
- `legacy_ro/yz-legacy-code/pages/return_exchange_details/return_exchange_details.js`

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-22 已完成。订单服务、用户服务、共享组件均已就绪。

### 已有的关键基础设施

- `src/services/order.service.ts` — `getOrderDetail(orderId, userId)`, `applyRefund(params)`
- `src/services/user.service.ts` — `getUserInfo()`
- `src/types/order.ts` — `Order`, `OrderItem`（`{ skuId, spuId, quantity, unitPrice, skuNameCN, skuNameEN, skuImage: string[], materialName? }`）
- `src/utils/validate.ts` — `isValidPhone()`, `isNotEmpty()`
- `src/hooks/useAuth.ts` — `ensureLogin()`
- `src/hooks/useImageProcessor.ts` — 云图片 URL 转换
- `src/components/SlidingBar/` — Tab 栏，props: `items: {id, text}[]`, `activeId`, `onSelect(item)`
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏
- `src/components/FloatPopup/` + `src/components/FloatBtn/` — 浮动咨询

---

## 页面 A：售后入口页 `pages-sub/after-sales/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 常量定义

```typescript
const CARE_TABS = [
  { id: '1', text: '日常佩戴' },
  { id: '2', text: '存放建议' },
  { id: '3', text: '定期保养' },
  { id: '4', text: '珠宝护理' },
]

const REASON_LIST = ['质量问题', '少件/错发', '外观破损', '不想要/七天无理由', '其它']
```

### 页面状态

```typescript
const [selectedTab, setSelectedTab] = useState('1')
const [orderId, setOrderId] = useState('')
const [orderItems, setOrderItems] = useState<OrderItem[]>([])
const [chosenOrderItemId, setChosenOrderItemId] = useState('')
const [reasonIndex, setReasonIndex] = useState(-1)
const [description, setDescription] = useState('')
const [photos, setPhotos] = useState<string[]>([])
const [submitting, setSubmitting] = useState(false)
const [uploading, setUploading] = useState(false)
```

### 核心功能点

#### 1. 页面加载（useLoad）

- 获取 `params.orderId`，设置到 state
- 若有 orderId → `ensureLogin()` → `loadOrderItems(orderId)`

#### 2. 加载订单商品（loadOrderItems）

```typescript
const loadOrderItems = async (oid: string) => {
  const userRes = await userService.getUserInfo()
  if (userRes.code === 200 && userRes.data) {
    const res = await orderService.getOrderDetail(oid, userRes.data._id)
    if (res.code === 200 && res.data) {
      setOrderItems(res.data.items || [])
    }
  }
}
```

#### 3. 保养指南 Tab

使用 SlidingBar 组件切换 4 个保养指南 Tab。每个 Tab 对应不同的保养内容文字（从旧代码 WXML 中 1:1 复制保养指南文案）。

保养指南内容是纯文字展示，根据 `selectedTab` 渲染对应内容。

#### 4. 售后申请表单（仅 orderId 存在时渲染）

**选择商品：**
- radio 单选列表，显示商品图片和名称
- 商品图片可能是 `cloud://` 格式，需要用 `useImageProcessor` 转换
- 点击选中 → `setChosenOrderItemId(item.skuId)`

**申请原因：**
- `<Picker mode="selector" range={REASON_LIST}>`
- `onChange` → `setReasonIndex(e.detail.value)`

**问题描述：**
- 使用 Taro `<Textarea>` 组件（注意：先用 context7 确认 Taro Textarea 的正确导入和用法）
- `maxlength={500}`
- 实时字数统计 `${description.length}/500`

**上传凭证：**
- 点击添加按钮 → `Taro.chooseImage({ count: 9 - photos.length, sizeType: ['compressed'], sourceType: ['album', 'camera'] })`
- 选择后逐个上传到云存储：`Taro.cloud.uploadFile({ cloudPath, filePath })` → 存储返回的 `fileID` 到 `photos` 数组
- 上传中设置 `uploading = true`，完成后恢复
- 删除图片：从 `photos` 数组中移除对应项
- 最多 9 张

**注意**：`Taro.cloud.uploadFile` 的用法需要先用 context7 查 Taro 官方文档确认。`cloudPath` 格式建议：`after-sales/${Date.now()}_${index}.${ext}`

#### 5. 提交售后申请

验证：
- `chosenOrderItemId` 非空（Toast: "请选择商品"）
- `reasonIndex >= 0`（Toast: "请选择申请原因"）
- `description` 非空（Toast: "请填写问题描述"）

提交：
- `setSubmitting(true)`
- 获取 userId
- 调用云函数：`callCloudFunction('after-sales', { action: 'create', _userId: userId, orderId, orderItemId: chosenOrderItemId, reason: REASON_LIST[reasonIndex], description, photos })`
- 注意：`after-sales` 云函数可能不在现有 service 文件中，需要直接使用 `callCloudFunction`（从 `@/services/cloud` 导入）
- 成功 → `Taro.showToast({ title: '提交成功', icon: 'success' })` → `Taro.navigateBack()`
- 失败 → Toast 提示
- finally → `setSubmitting(false)`

### UI 结构

```
TopBarWithBack
└── container（需要 marginTop 偏移）
    ├── SlidingBar（4 个保养指南 Tab）
    ├── care-content（保养指南文字内容，根据 selectedTab 切换）
    ├── divider（分隔线，仅 orderId 存在时显示）
    └── apply-section（售后申请表单，仅 orderId 存在时渲染）
        ├── section-title「售后申请」
        ├── product-list（商品单选列表）
        │   └── 每个商品项（radio + image + name）
        ├── reason-picker（申请原因 Picker）
        ├── description-area（问题描述 Textarea + 字数统计）
        ├── photo-upload（上传凭证区域）
        │   ├── 已上传图片缩略图（带删除按钮）
        │   └── 添加图片按钮（+）
        ├── submit-btn「提交申请」
        ├── FloatBtn
        └── FloatPopup
```

### 关键样式要点

- 保养指南内容：`padding: 30rpx; font-size: 28rpx; color: #333; line-height: 1.8`
- 申请表单区：`background: #fff; border-radius: 12rpx; padding: 30rpx; margin: 20rpx`
- 商品选择项：`display: flex; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid #eee`
- 商品图片：`width: 120rpx; height: 120rpx; border-radius: 8rpx; margin-right: 20rpx`
- 选中态 radio：黑色填充圆，未选中空心圆
- Textarea：`width: 100%; height: 200rpx; border: 1rpx solid #eee; border-radius: 8rpx; padding: 20rpx; font-size: 28rpx`
- 图片上传区：`display: flex; flex-wrap: wrap; gap: 16rpx`
- 缩略图：`width: 160rpx; height: 160rpx; border-radius: 8rpx; position: relative`
- 删除按钮：`position: absolute; top: -10rpx; right: -10rpx; width: 36rpx; height: 36rpx; background: rgba(0,0,0,0.5); border-radius: 50%; color: #fff; font-size: 24rpx; 居中`
- 添加按钮：`width: 160rpx; height: 160rpx; border: 1rpx dashed #ddd; border-radius: 8rpx; 居中 + 号`
- 提交按钮：`width: 90%; margin: 40rpx auto; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx`
- 详细样式参考旧代码 1:1 还原

---

## 页面 B：售后详情页 `pages-sub/after-sales-detail/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 核心逻辑

纯静态页面，无云函数调用，无页面参数。

```typescript
interface ServiceSection {
  key: string
  title: string
  content: string
  expanded: boolean
}

const INITIAL_SECTIONS: ServiceSection[] = [
  { key: 'daily_wear', title: '日常佩戴', content: '...', expanded: false },
  { key: 'storage', title: '存放建议', content: '...', expanded: false },
  { key: 'maintenance', title: '定期保养', content: '...', expanded: false },
  { key: 'jewelry_care', title: '珠宝护理', content: '...', expanded: false },
]
```

- 内部状态 `sections`：初始化为 `INITIAL_SECTIONS`
- `toggleSection(key)`：切换对应 section 的 `expanded` 状态（可同时展开多个，非互斥）
- 底部"官方客服"链接：点击打开 FloatPopup
- 保养内容文案从旧代码 `after_sales_service.wxml` 中 1:1 复制

### UI 结构

```
TopBarWithBack
└── container（需要 marginTop 偏移）
    ├── page-title「保养清洁」
    ├── sections-list
    │   └── 每个折叠项
    │       ├── section-header（title + 箭头图标，点击切换）
    │       └── section-content（展开时显示内容文字）
    ├── footer-text（感谢文字 + 官方客服链接）
    ├── FloatBtn
    └── FloatPopup
```

### 关键样式要点

- 标题"保养清洁"：`font-size: 36rpx; font-weight: 600; color: #333; padding: 30rpx`
- 折叠项标题：`display: flex; justify-content: space-between; align-items: center; padding: 30rpx; font-size: 30rpx; font-weight: 600; border-bottom: 1rpx solid #eee`
- 箭头图标：`width: 30rpx; height: 30rpx; transition: transform 0.3s`，展开时 `transform: rotate(180deg)`
- 折叠内容：`padding: 20rpx 30rpx; font-size: 26rpx; color: #666; line-height: 1.8`，收起时 `max-height: 0; overflow: hidden; padding: 0 30rpx`（用 CSS transition 实现动画）
- 底部感谢文字：`font-size: 24rpx; color: #999; text-align: center; padding: 40rpx`
- 如果 `src/assets/icons/` 中缺少箭头图标，可以用 CSS 三角形或 NutUI 的 Icon 组件替代

---

## 页面 C：退款申请页 `pages-sub/refund/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 页面状态

```typescript
const [orderId, setOrderId] = useState('')
const [description, setDescription] = useState('')
const [phone, setPhone] = useState('')
const [submitting, setSubmitting] = useState(false)
```

### 核心功能点

#### 1. 页面加载（useLoad）

获取 `params.orderId`，设置到 state。

#### 2. 表单

- 订单编号：只读显示（`disabled` Input 或纯 Text 展示）
- 问题描述：`<Textarea maxlength={500}>`，实时字数统计 `${description.length}/500`
- 联系方式：手机号输入，`replace(/\D/g, '').slice(0, 11)` 限制

#### 3. 表单验证

- `orderId` 非空
- `description` 非空（Toast: "请填写问题描述"）
- `phone` 非空且 `/^1[3-9]\d{9}$/`（Toast: "请输入正确的手机号"）

#### 4. 提交

- `setSubmitting(true)`
- 获取 userId
- 调用云函数：`callCloudFunction('refund', { action: 'create', _userId: userId, orderId, description, phone, createTime: Date.now() })`
- 注意：`refund` 云函数可能不在现有 service 文件中，需要直接使用 `callCloudFunction`
- 成功 → `Taro.showToast({ title: '提交成功', icon: 'success' })` → 延迟 2s → `Taro.navigateBack()`
- 失败 → Toast 提示
- finally → `setSubmitting(false)`

### UI 结构

```
TopBarWithBack
└── container（需要 marginTop 偏移）
    ├── section-title「退款申请」
    ├── order-info（订单编号只读展示区）
    │   ├── label「订单编号」
    │   └── orderId 文本
    ├── description-section
    │   ├── label「问题描述」
    │   ├── Textarea
    │   └── char-count（字数统计）
    ├── phone-section
    │   ├── label「联系方式」
    │   └── Input type="number"
    ├── submit-btn「提交」
    ├── FloatBtn
    └── FloatPopup
```

### 关键样式要点

- 订单信息区：`padding: 30rpx; background: #f5f5f5; border-radius: 8rpx; margin: 20rpx`
- 订单编号文本：`font-size: 28rpx; color: #999`
- Textarea：`width: 100%; height: 250rpx; border: 1rpx solid #eee; border-radius: 8rpx; padding: 20rpx; font-size: 28rpx`
- 字数统计：`font-size: 24rpx; color: #999; text-align: right; margin-top: 10rpx`
- 手机号输入：`height: 80rpx; border: 1rpx solid #ddd; border-radius: 8rpx; padding: 0 20rpx; font-size: 28rpx`
- 提交按钮：`width: 90%; margin: 40rpx auto; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx`
- 禁用态：`opacity: 0.5`
- 详细样式参考旧代码 `refund.wxss` 1:1 还原

---

## 页面 D：退换详情页 `pages-sub/return-exchange-detail/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 核心逻辑

纯静态页面，无云函数调用，无页面参数。内容硬编码在 JSX 中。

两大区域：
1. **订单跟踪说明**：静态流程图（已下单 → 已付款 → 已发货 → 已签收），用 flex 布局 + 连接线实现
2. **退换货政策**：退货条件、换货条件、退款方式、处理时间等文字说明

底部"官方客服"链接：点击打开 FloatPopup。

政策内容文案从旧代码 `return_exchange_details.wxml` 中 1:1 复制。

### UI 结构

```
TopBarWithBack
└── ScrollView（scroll-y）
    ├── page-title「退换货政策」
    ├── flow-chart（订单跟踪流程图）
    │   ├── step「已下单」
    │   ├── line（连接线）
    │   ├── step「已付款」
    │   ├── line
    │   ├── step「已发货」
    │   ├── line
    │   └── step「已签收」
    ├── policy-sections
    │   ├── section「退货条件」+ 内容
    │   ├── section「换货条件」+ 内容
    │   ├── section「退款方式」+ 内容
    │   └── section「处理时间」+ 内容
    ├── footer-text（感谢文字 + 官方客服链接）
    ├── FloatBtn
    └── FloatPopup
```

### 关键样式要点

- 页面容器：`ScrollView` 纵向滚动，`padding: 30rpx`
- 流程图区域：`display: flex; justify-content: space-between; align-items: center; padding: 40rpx 20rpx; margin-bottom: 40rpx`
- 流程节点：`display: flex; flex-direction: column; align-items: center; font-size: 24rpx; color: #333`
- 流程连接线：`flex: 1; height: 2rpx; background: #ddd; margin: 0 10rpx`
- 政策标题：`font-size: 32rpx; font-weight: 600; color: #333; margin: 30rpx 0 20rpx`
- 政策内容：`font-size: 26rpx; color: #666; line-height: 1.8`
- 底部感谢文字：`font-size: 24rpx; color: #999; text-align: center; padding: 40rpx`
- 详细样式参考旧代码 `return_exchange_details.wxss` 1:1 还原

---

## 产出

- 售后入口页 3 个文件（`pages-sub/after-sales/` 下的 index.tsx + index.config.ts + index.module.scss）
- 售后详情页 3 个文件（`pages-sub/after-sales-detail/` 下）
- 退款申请页 3 个文件（`pages-sub/refund/` 下）
- 退换详情页 3 个文件（`pages-sub/return-exchange-detail/` 下）

## 要求

- 使用已有的 services（order.service / user.service），调用前先读取确认方法签名
- 售后申请和退款申请的云函数（`after-sales`、`refund`）可能不在现有 service 文件中，直接使用 `callCloudFunction`（从 `@/services/cloud` 导入）
- 使用已有的组件：SlidingBar、TopBarWithBack、FloatBtn、FloatPopup
- 使用已有的 hooks：useAuth（ensureLogin）、useImageProcessor（商品图片转换）
- 售后入口页图片上传使用 `Taro.cloud.uploadFile`，先用 context7 查文档确认用法
- 售后详情页折叠项可同时展开多个（非互斥手风琴），用 CSS transition 实现展开/收起动画
- 退款申请页提交成功后延迟 2s 再 navigateBack
- 退换详情页流程图用 flex 布局 + 连接线实现
- 所有页面使用 TopBarWithBack + marginTop 偏移（参考已实现的 product-detail 页面）
- 保养指南和退换货政策的文案从旧代码 WXML 中 1:1 复制
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 完成后运行 `npm run build:weapp` 确认编译通过

---
