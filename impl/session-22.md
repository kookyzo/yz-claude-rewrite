# 会话 22：Phase 07c 订单列表 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 07 的第三部分：订单列表页（order-list）。这是一个功能较复杂的页面，包含 5 个 Tab、多种订单状态对应不同操作按钮、评价弹窗等。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用前先读取 service 文件确认方法签名，避免参数传递错误。
4. 这个页面是分包页面（pages-sub/），不是 Tab 页，不需要 CustomTabBar 组件。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/07-user-center.md`（关注「旧代码摘要 → 5. 订单列表页」部分，以及对应的「实现要求」部分）
3. `src/services/order.service.ts`（订单服务 — **必读**，理解 getUserOrders / cancelOrder / confirmReceipt 方法签名）
4. `src/services/user.service.ts`（用户服务 — getUserInfo 获取 userId）
5. `src/types/order.ts`（Order / OrderItem / OrderStatus 类型定义）
6. `src/utils/format.ts`（formatDate / formatPrice）
7. `src/components/SlidingBar/index.tsx`（Tab 栏组件 — 理解 props 接口）
8. `src/components/ReviewPopup/index.tsx`（评价弹窗 — 理解 props 接口）
9. `src/components/LoadingBar/index.tsx`（加载动画）
10. `src/hooks/useAuth.ts`（ensureLogin / ensureRegistered）

## 参考旧代码（必读，1:1 还原 UI）

- `legacy_ro/yz-legacy-code/pages/my_sub_page/my_sub_page.wxml`
- `legacy_ro/yz-legacy-code/pages/my_sub_page/my_sub_page.wxss`
- `legacy_ro/yz-legacy-code/pages/my_sub_page/my_sub_page.js`

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-21 已完成。订单服务、用户服务、共享组件均已就绪。

### 已有的关键基础设施

- `src/services/order.service.ts`:
  - `getUserOrders(userId, status?)` — 获取订单列表，status 可选
  - `cancelOrder(orderId, userId)` — 取消订单
  - `confirmReceipt(orderId, userId)` — 确认收货
- `src/services/user.service.ts` — `getUserInfo()`
- `src/types/order.ts`:
  - `OrderStatus`: `'pending_payment' | 'paid' | 'shipping' | 'signed' | 'completed' | 'cancelled' | 'payment_failed' | 'refunding' | 'refunded'`
  - `OrderItem`: `{ skuId, spuId, quantity, unitPrice, skuNameCN, skuNameEN, skuImage: string[], materialName? }`
  - `Order`: `{ _id, orderNo, userId, addressId, totalAmount, status, items, createdAt, logisticsNo? }`
- `src/utils/format.ts` — `formatDate(timestamp)` → `"YYYY-MM-DD"`、`formatPrice(price)` → `"12,345.00"`
- `src/hooks/useAuth.ts` — `ensureLogin()`, `ensureRegistered()`
- `src/hooks/useImageProcessor.ts` — 批量转换 `cloud://` URL 为 HTTP URL（订单商品图片可能是云存储地址）
- `src/components/SlidingBar/` — Tab 栏，props: `items: {id, text}[]`, `activeId`, `onSelect(item)`
- `src/components/ReviewPopup/` — 评价弹窗，props: `visible`, `productImage`, `productName`, `productNameEN?`, `onSubmit({ratings, content, images})`, `onClose`
- `src/components/LoadingBar/` — 加载动画
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏
- `src/components/FloatPopup/` + `src/components/FloatBtn/` — 浮动咨询

---

## 页面：订单列表页 `pages-sub/order-list/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 常量定义

```typescript
type TabId = '1' | '2' | '3' | '4' | '5'

const TAB_LIST = [
  { id: '1', text: '全部' },
  { id: '2', text: '待付款' },
  { id: '3', text: '待发货' },
  { id: '4', text: '待收货' },
  { id: '5', text: '待评价' },
]

/** Tab ID → 云端 status 映射 */
const TAB_STATUS_MAP: Record<TabId, OrderStatus | null> = {
  '1': null,                // 全部：查 pending_payment + paid + shipping + signed
  '2': 'pending_payment',
  '3': 'paid',
  '4': 'shipping',
  '5': 'signed',
}

/** 云端 status → 显示文本映射 */
const STATUS_DISPLAY: Record<string, string> = {
  pending_payment: 'PENDING_PAYMENT',
  paid: 'PAID',
  shipping: 'SHIPPED',
  signed: 'SIGNED',
}
```

### 页面状态

```typescript
const [selectedTab, setSelectedTab] = useState<TabId>('1')
const [orders, setOrders] = useState<Record<TabId, FormattedOrder[]>>({
  '1': [], '2': [], '3': [], '4': [], '5': [],
})
const [loading, setLoading] = useState(false)
const [showReviewPopup, setShowReviewPopup] = useState(false)
const [reviewProduct, setReviewProduct] = useState({ image: '', name: '', nameEN: '' })
const [reviewOrderId, setReviewOrderId] = useState('')

interface FormattedOrder {
  id: string           // orderNo || _id
  orderId: string      // _id（用于 API 调用）
  date: string         // formatDate(createdAt)
  status: OrderStatus
  statusText: string   // STATUS_DISPLAY[status]
  image: string        // items[0].skuImage[0]
  name: string         // items[0].skuNameCN
  nameEN: string       // items[0].skuNameEN
  material: string     // items[0].materialName
  formattedUnitPrice: string
  quantity: number
  formattedTotalPrice: string
}
```

### 核心功能点

#### 1. 页面加载（useLoad）

解析初始 Tab：
- `params.tab`：直接作为 TabId
- `params.type`：语义映射
  - `pending_payment` → `'2'`
  - `pending_delivery` → `'3'`
  - `pending_receipt` → `'4'`
  - `completed` → `'5'`
  - `all` → `'1'`
- 默认 `'1'`

调用 `ensureLogin()` → `loadOrders(initialTab)`

#### 2. 每次显示刷新（useDidShow）

每次页面显示时刷新当前 Tab 的订单数据。使用 Taro 的 `useDidShow` Hook。

#### 3. 加载订单（loadOrders）

```typescript
const loadOrders = async (tabId: TabId) => {
  setLoading(true)
  try {
    const userRes = await userService.getUserInfo()
    if (userRes.code !== 200 || !userRes.data) return

    const userId = userRes.data._id
    const status = TAB_STATUS_MAP[tabId]

    let orderList: Order[] = []

    if (status === null) {
      // 全部 Tab：分别查询多个状态，合并结果
      const [r1, r2, r3, r4] = await Promise.all([
        orderService.getUserOrders(userId, 'pending_payment'),
        orderService.getUserOrders(userId, 'paid'),
        orderService.getUserOrders(userId, 'shipping'),
        orderService.getUserOrders(userId, 'signed'),
      ])
      orderList = [
        ...(r1.code === 200 && r1.data ? r1.data : []),
        ...(r2.code === 200 && r2.data ? r2.data : []),
        ...(r3.code === 200 && r3.data ? r3.data : []),
        ...(r4.code === 200 && r4.data ? r4.data : []),
      ]
    } else {
      const res = await orderService.getUserOrders(userId, status)
      if (res.code === 200 && res.data) {
        orderList = Array.isArray(res.data) ? res.data : []
      }
    }

    // 按创建时间倒序
    orderList.sort((a, b) => b.createdAt - a.createdAt)

    const formatted = formatOrders(orderList)
    setOrders(prev => ({ ...prev, [tabId]: formatted }))
  } finally {
    setLoading(false)
  }
}
```

#### 4. 格式化订单（formatOrders）

```typescript
function formatOrders(list: Order[]): FormattedOrder[] {
  return list.map(order => ({
    id: order.orderNo || order._id,
    orderId: order._id,
    date: formatDate(order.createdAt),
    status: order.status,
    statusText: STATUS_DISPLAY[order.status] || order.status,
    image: order.items[0]?.skuImage?.[0] || '',
    name: order.items[0]?.skuNameCN || '',
    nameEN: order.items[0]?.skuNameEN || '',
    material: order.items[0]?.materialName || '',
    formattedUnitPrice: formatPrice(order.items[0]?.unitPrice || 0),
    quantity: order.items[0]?.quantity || 1,
    formattedTotalPrice: formatPrice(order.totalAmount),
  }))
}
```

#### 5. Tab 切换

```typescript
const handleTabSelect = (item: { id: string }) => {
  const tabId = item.id as TabId
  setSelectedTab(tabId)
  // 若该 Tab 数据为空则重新加载
  if (orders[tabId].length === 0) {
    loadOrders(tabId)
  }
}
```

#### 6. 订单编号复制

点击订单编号 → `Taro.setClipboardData({ data: order.id })`

#### 7. 按钮操作（按订单状态）

**待付款（pending_payment）：**
- 「取消订单」→ `Taro.showModal({ title: '确认取消', content: '确定要取消该订单吗？' })` → 确认后 `orderService.cancelOrder(orderId, userId)` → 刷新当前 Tab
- 「立即支付」→ `Taro.navigateTo({ url: '/pages-sub/payment/index?orderId=${orderId}' })`

**待发货（paid）：**
- 「申请售后」→ `Taro.navigateTo({ url: '/pages-sub/refund/index?orderId=${orderId}' })`
- 「物流咨询」→ 打开 FloatPopup（在线咨询）

**待收货（shipping）：**
- 「查看物流」→ 打开 FloatPopup（在线咨询）
- 「确认收货」→ `Taro.showModal({ title: '确认收货', content: '确认已收到商品？' })` → 确认后 `orderService.confirmReceipt(orderId, userId)` → 刷新当前 Tab

**已完成/待评价（signed）：**
- 「申请售后」→ `Taro.navigateTo({ url: '/pages-sub/refund/index?orderId=${orderId}' })`
- 「立即评价」→ 设置 `reviewProduct` 数据（image, name, nameEN）→ 设置 `reviewOrderId` → `setShowReviewPopup(true)`

#### 8. 评价提交

ReviewPopup 的 `onSubmit` 回调：
- 收到 `{ ratings, content, images }` 数据
- 目前评价功能后端未完善，先 Toast 提示"评价提交成功"并关闭弹窗
- 关闭弹窗后刷新当前 Tab

#### 9. 空状态

当前 Tab 无订单时显示：
- 空状态图标
- "暂无订单"文字
- 「去挑选商品」按钮 → `Taro.switchTab({ url: '/pages/category/index' })`

#### 10. 商品图片处理

订单商品图片可能是 `cloud://` 格式的云存储地址，需要使用 `useImageProcessor` Hook 转换为 HTTP URL。在 `formatOrders` 之后，收集所有图片 URL，调用 `processImages` 批量转换，然后更新 `orders` 中的 image 字段。

读取 `src/hooks/useImageProcessor.ts` 了解其用法，参考已实现的 product-detail 或 cart 页面中的使用方式。

### UI 结构

```
TopBarWithBack
└── container（需要 marginTop 偏移 TopBarWithBack）
    ├── SlidingBar（5 个 Tab）
    ├── LoadingBar（loading 时显示）
    ├── 订单列表（ScrollView scroll-y）
    │   └── 每个订单卡片 order-card
    │       ├── card-header（flex, space-between）
    │       │   ├── 左侧：日期 + 订单编号（可点击复制）
    │       │   └── 右侧：状态文本（statusText）
    │       ├── card-body（flex, gap: 20rpx）
    │       │   ├── 商品图片（180rpx × 180rpx）
    │       │   └── 商品信息区
    │       │       ├── 商品名称（skuNameCN）
    │       │       ├── 英文名（skuNameEN）
    │       │       ├── 材质（materialName）
    │       │       ├── 单价 × 数量
    │       │       └── 合计金额（加粗）
    │       └── card-footer（按钮区，flex, justify-content: flex-end, gap: 16rpx）
    │           └── 根据 status 渲染不同按钮组合
    ├── 空状态（当前 Tab 无订单时）
    │   ├── 空图标
    │   ├── "暂无订单"
    │   └── 「去挑选商品」按钮
    ├── ReviewPopup（评价弹窗）
    ├── FloatBtn（浮动咨询按钮）
    └── FloatPopup（在线咨询弹窗）
```

### 关键样式要点

- Tab 栏：使用 SlidingBar 组件，水平滚动
- 订单卡片：`background: #fff; border-radius: 12rpx; padding: 30rpx; margin: 0 20rpx 20rpx`
- 卡片顶部：`display: flex; justify-content: space-between; font-size: 24rpx; color: #999; margin-bottom: 20rpx`
- 日期文字：`font-size: 24rpx; color: #999`
- 订单编号：`font-size: 22rpx; color: #999; margin-top: 8rpx`（点击可复制）
- 状态文本：`color: #333; font-weight: 600; font-size: 24rpx`
- 商品图片：`width: 180rpx; height: 180rpx; border-radius: 8rpx; flex-shrink: 0`
- 商品名称：`font-size: 28rpx; color: #333; font-weight: 500`
- 英文名：`font-size: 24rpx; color: #999; margin-top: 6rpx`
- 材质：`font-size: 24rpx; color: #666; margin-top: 6rpx`
- 价格：`font-size: 28rpx; color: #333; font-weight: 600`
- 按钮区：`display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx solid #f0f0f0`
- 普通按钮：`height: 60rpx; padding: 0 30rpx; border: 1rpx solid #ddd; border-radius: 30rpx; font-size: 24rpx; color: #333; background: #fff; display: flex; align-items: center; justify-content: center`
- 主要按钮（立即支付/确认收货）：`background: #000; color: #fff; border-color: #000`
- 空状态容器：`display: flex; flex-direction: column; align-items: center; padding-top: 200rpx`
- 空状态图标：`width: 200rpx; height: 200rpx; margin-bottom: 30rpx`
- "去挑选商品"按钮：`margin-top: 40rpx; padding: 16rpx 60rpx; border: 1rpx solid #000; border-radius: 30rpx; font-size: 26rpx`
- 详细样式参考旧代码 `my_sub_page.wxss` 1:1 还原

### 注意事项

1. **TopBarWithBack 偏移**：页面使用 `navigationStyle: 'custom'`，内容需要 `marginTop` 偏移。参考已实现的 product-detail 页面。

2. **useDidShow 导入**：先用 context7 确认 `useDidShow` 从 `@tarojs/taro` 导入的正确方式。

3. **云存储图片转换**：订单商品图片可能是 `cloud://` 开头的云存储地址，需要用 `useImageProcessor` 转换。先读取该 Hook 的实现了解用法。

4. **全部 Tab 查询策略**：全部 Tab 需要并行查询多个状态然后合并，不是传 `undefined` 给 `getUserOrders`（因为后端可能不支持无 status 查全部）。

5. **按钮渲染逻辑**：不同状态的订单显示不同按钮组合，建议用一个 `renderButtons(order)` 函数根据 `order.status` 返回对应按钮 JSX。

---

## 产出

- 订单列表页 3 个文件（`pages-sub/order-list/` 下的 index.tsx + index.config.ts + index.module.scss）

## 要求

- 使用已有的 services（order.service / user.service），调用前先读取确认方法签名
- 使用已有的组件：SlidingBar、ReviewPopup、LoadingBar、TopBarWithBack、FloatBtn、FloatPopup
- 使用已有的 utils：formatDate、formatPrice
- 使用已有的 hooks：useAuth（ensureLogin）、useImageProcessor（云图片转换）
- Tab 切换时若数据为空才重新加载，避免重复请求
- `useDidShow` 每次显示刷新当前 Tab
- 取消订单和确认收货前弹 `Taro.showModal` 确认
- 订单编号支持点击复制（`Taro.setClipboardData`）
- 空状态"去挑选商品"使用 `Taro.switchTab`（跳转到 Tab 页）
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 完成后运行 `npm run build:weapp` 确认编译通过

---
