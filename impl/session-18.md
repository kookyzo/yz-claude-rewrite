# 会话 18：Phase 06c 支付页 payment — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 06 的第三部分：支付页（payment）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用时业务参数必须包在 `data` 字段下（`{ action, data: { ... } }`），不要平铺在顶层。**但要先读取现有 service 文件确认其实际调用模式**，有些 service 已经在内部处理了参数结构，调用时直接传参即可。
4. 本页面是分包页面（pages-sub/），不是 Tab 页，不需要 CustomTabBar 组件。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/06-product-flow.md`（关注「旧代码摘要 → 4. payment」和「实现要求 → 4. 支付页」部分）
3. `src/services/order.service.ts`（订单服务 — 必读，理解已有方法签名）
4. `src/services/payment.service.ts`（支付服务 — 必读）
5. `src/services/address.service.ts`（地址服务 — 必读）
6. `src/services/cart.service.ts`（购物车服务 — 必读，用于购物车模式获取已选商品）
7. `src/types/order.ts`（Order、OrderItem、OrderStatus 类型）
8. `src/types/user.ts`（Address 类型）

## 参考旧代码（必读，1:1 还原 UI）

- `legacy_ro/yz-legacy-code/pages/payment/payment.wxml`（页面结构，优先读）
- `legacy_ro/yz-legacy-code/pages/payment/payment.wxss`（样式细节，优先读）
- `legacy_ro/yz-legacy-code/pages/payment/payment.js`（交互逻辑和数据流）

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-17 已完成。商品详情页的"直接购买"功能会通过 `Taro.setStorageSync('directBuyProduct', productInfo)` 传递商品信息到本页面。

### 已有的关键基础设施（必须先读取理解）

- `src/services/order.service.ts` — `createOrderFromCart(userId, addressId)`、`createDirectOrder({userId, addressId, skuId, quantity})`、`updateOrderStatus({orderId, userId, newStatus, ...})`、`getOrderDetail(orderId, userId)`
- `src/services/payment.service.ts` — `createPayment(orderId, orderNo, desc)`、`queryPayment(outTradeNo)`
- `src/services/address.service.ts` — `getDefaultAddress(userId)`、`listAddresses(userId)`
- `src/services/cart.service.ts` — `getCartItems(userId)`、`removeCartItem(cartItemId)`
- `src/types/order.ts` — Order（`_id, orderNo, userId, addressId, totalAmount, status, items, transactionId`）、OrderStatus、OrderItem
- `src/types/user.ts` — Address（`_id, userId, receiver, phone, provinceCity, detailAddress, isDefault`）
- `src/hooks/useAuth.ts` — `ensureLogin()`、`ensureRegistered()`
- `src/hooks/useImageProcessor.ts` — `processImages()`
- `src/stores/useUserStore.ts` — `userId`
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏
- `src/components/FloatPopup/` + `src/components/FloatBtn/` — 浮动咨询
- `src/utils/format.ts` — `formatPrice()`
- `src/utils/navigation.ts` — `navigateTo()`、`switchTab()`

## 本次任务

改写 `src/pages-sub/payment/index.tsx` + `index.config.ts` + `index.module.scss`（当前为占位文件）

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 页面参数

通过 `useRouter()` 获取：
- `orderId`（可选）— 订单重新支付模式

### 三种入口模式

```
useLoad 中判断：
1. router.params.orderId 存在 → 模式 'repay'（订单重新支付）
2. Taro.getStorageSync('directBuyProduct') 存在 → 模式 'directBuy'（直接购买）
3. 以上都不满足 → 模式 'cart'（购物车结算）
```

### 核心功能点

#### 1. 模式判断与数据加载（`useLoad` + `useDidShow`）

**repay 模式：**
- 调用 `orderService.getOrderDetail(orderId, userId)` 获取订单信息
- 从订单中提取商品列表和地址信息
- 设置 `currentOrder = order`（后续支付时跳过创建订单步骤）

**directBuy 模式：**
- 从 `Taro.getStorageSync('directBuyProduct')` 读取商品信息
- 读取后立即 `Taro.removeStorageSync('directBuyProduct')` 清除
- 构建 items 数组（单个商品）
- 计算总价

**cart 模式：**
- 在 `useDidShow` 中调用 `cartService.getCartItems(userId)`
- 过滤 `checked === true`（或 `status === true` / `selected === true`）的商品
- 归一化字段映射：
  - `name` ← `skuInfo.nameCN || spuInfo.name`
  - `price` ← `unitPrice || skuInfo.price || spuInfo.referencePrice`
  - `image` ← `skuInfo.skuMainImages[0] || spuInfo.mainImages[0]`
  - `material` ← `materialInfo.nameCN`
  - `size` ← `sizeInfo.value`
- 图片通过 `processImages()` 转换
- 计算总价

**所有模式都加载默认地址：**
- 先调用 `addressService.getDefaultAddress(userId)`
- 若无默认地址，调用 `addressService.listAddresses(userId)` 取第一个
- 若无任何地址，`address` 保持 `null`

#### 2. 地址选择

- 点击地址区域 → `navigateTo('/pages-sub/payment-select-address/index')`
- 选地址页通过 `Taro.eventCenter` 回传选中地址

```typescript
// 支付页：监听地址选择事件
useDidShow(() => {
  Taro.eventCenter.on('selectAddress', (addr) => {
    setAddress(addr)
  })
})
useUnload(() => {
  Taro.eventCenter.off('selectAddress')
})
```

#### 3. 支付流程（`handlePay`）

```
1. 前置验证
   - authAgreed === true（隐私协议已勾选），否则 showToast '请先同意隐私协议'
   - address !== null（地址已选），否则 showToast '请选择收货地址'
   - items.length > 0（商品列表非空），否则 showToast '没有待支付商品'

2. 创建订单（若 currentOrder 不存在）
   - directBuy 模式 → orderService.createDirectOrder({ userId, addressId, skuId, quantity })
   - cart 模式 → orderService.createOrderFromCart(userId, addressId)
   - repay 模式 → 跳过，直接使用 currentOrder

3. 调用微信支付
   - paymentService.createPayment(order._id, order.orderNo, `YZHENG订单-${order.orderNo}`)
   - 返回 { timeStamp, nonceStr, packageVal, paySign }

4. 发起支付
   - Taro.requestPayment({ timeStamp, nonceStr, package: packageVal, signType: 'RSA', paySign })

5. 支付结果处理
   - 成功 → handlePaymentSuccess(order)
   - 失败/取消 → handlePaymentFailure(order)
```

#### 4. 支付成功处理

1. `paymentService.queryPayment(order.orderNo)` — 查询支付结果确认
2. `orderService.updateOrderStatus({ orderId: order._id, userId, newStatus: 'paid', transactionId, payTime })` — 更新订单状态
3. cart 模式：清除已购商品 — 重新获取购物车列表，过滤已选商品，逐个调用 `cartService.removeCartItem(cartItemId)`
4. 跳转：`Taro.redirectTo({ url: '/pages-sub/order-list/index?type=pending_delivery' })`

#### 5. 支付失败处理

1. `orderService.updateOrderStatus({ orderId: order._id, userId, newStatus: 'payment_failed' })`
2. `Taro.showToast({ title: '支付失败', icon: 'none' })`
3. 延迟 2 秒后 `Taro.navigateBack()`

### UI 结构

```
TopBarWithBack
├── ScrollView（纵向滚动）
│   ├── 地址区
│   │   ├── 有地址：detailAddress（主）+ provinceCity（副）+ receiver + phone + 右箭头
│   │   └── 无地址："添加收货地址"按钮（虚线边框）
│   ├── 发货提示："商品将会在付款后20个工作日内发货"
│   ├── 商品列表
│   │   └── 每项：image + name + nameEN + material + size + quantity + formattedPrice + formattedSubtotal
│   ├── 空状态（cart 模式且无已选商品）
│   │   └── "购物车中没有选中的商品" + 返回购物车按钮
│   ├── 支付方式（仅微信支付，含勾选图标）
│   ├── 订单备注 Textarea（500 字上限 + 字数计数器）
│   ├── 总价显示
│   └── 隐私协议勾选区
│       ├── 勾选框
│       ├── "我已阅读并同意"
│       ├── 隐私政策链接（点击跳转，需阻止冒泡）
│       └── 用户协议链接（点击跳转，需阻止冒泡）
├── 支付按钮（底部固定或在滚动区内）
├── FloatBtn（浮动咨询按钮）
└── FloatPopup（在线咨询弹窗）
```

### 隐私协议链接的冒泡阻止

隐私政策和用户协议链接在勾选区内，点击链接时不能触发勾选框的切换。在 Taro 中使用 `onClick` 并在处理函数中调用 `e.stopPropagation()`：

```typescript
const handlePrivacyLink = (e) => {
  e.stopPropagation()
  navigateTo('/pages-sub/privacy-policy/index')
}
const handleAgreementLink = (e) => {
  e.stopPropagation()
  navigateTo('/pages-sub/user-agreement/index')
}
```

### 价格计算

```typescript
const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
const formattedTotalPrice = formatPrice(totalPrice)
```

### 图标资源

如果 `src/assets/icons/` 中缺少支付页需要的图标（地址箭头、微信支付图标、勾选框等），从 `legacy_ro/yz-legacy-code/` 中找到并复制过来。

## 产出

- 支付页 3 个文件（`pages-sub/payment/` 下的 index.tsx + index.config.ts + index.module.scss）
- 如有缺失的图标资源，从 legacy 复制到 `src/assets/icons/`

## 要求

- 使用已有的 services（order.service、payment.service、address.service、cart.service），不新建 service。**调用前先读取 service 文件确认方法签名**，避免参数传递错误。
- 使用已有的 hooks：useAuth、useImageProcessor
- 使用已有的组件：TopBarWithBack、FloatBtn、FloatPopup
- 使用已有的 utils：formatPrice、navigateTo、switchTab
- 地址回传使用 `Taro.eventCenter`（`on` / `trigger` / `off`），不使用旧代码的 `getCurrentPages().setData` 模式
- `Taro.requestPayment` 的 `signType` 使用 `'RSA'`
- 备注 Textarea 最多 500 字，实时显示字数计数
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 完成后运行 `npm run build:weapp` 确认编译通过

---
