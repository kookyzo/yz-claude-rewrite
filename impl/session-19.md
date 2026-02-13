# 会话 19：Phase 06d 支付失败 + 选地址 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 06 的第四部分：支付失败页（payment-failed）和支付选地址页（payment-select-address）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用前先读取 service 文件确认方法签名，避免参数传递错误。
4. 这两个页面都是分包页面（pages-sub/），不是 Tab 页，不需要 CustomTabBar 组件。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/06-product-flow.md`（关注「旧代码摘要 → 5. payment_failed」和「6. payment_sub_page_select_address」部分，以及对应的「实现要求」部分）
3. `src/services/address.service.ts`（地址服务 — 必读，理解已有方法签名）
4. `src/types/user.ts`（Address 类型定义）

## 参考旧代码（必读，1:1 还原 UI）

**支付失败页：**
- `legacy_ro/yz-legacy-code/pages/payment_failed/payment_failed.wxml`
- `legacy_ro/yz-legacy-code/pages/payment_failed/payment_failed.wxss`
- `legacy_ro/yz-legacy-code/pages/payment_failed/payment_failed.js`

**选地址页：**
- `legacy_ro/yz-legacy-code/pages/payment_sub_page_select_address/payment_sub_page_select_address.wxml`
- `legacy_ro/yz-legacy-code/pages/payment_sub_page_select_address/payment_sub_page_select_address.wxss`
- `legacy_ro/yz-legacy-code/pages/payment_sub_page_select_address/payment_sub_page_select_address.js`

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-18 已完成。支付页（session-18）已实现 `Taro.eventCenter` 监听 `selectAddress` 事件，选地址页需要通过 `Taro.eventCenter.trigger('selectAddress', address)` 回传选中地址。

### 已有的关键基础设施

- `src/services/address.service.ts` — `listAddresses(userId)`、`getDefaultAddress(userId)`
- `src/types/user.ts` — Address（`_id, userId, receiver, phone, provinceCity, detailAddress, isDefault`）
- `src/hooks/useAuth.ts` — `ensureLogin()`
- `src/stores/useUserStore.ts` — `userId`
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏
- `src/components/FloatPopup/` + `src/components/FloatBtn/` — 浮动咨询
- `src/utils/navigation.ts` — `navigateTo()`

---

## 页面 A：支付失败页 `pages-sub/payment-failed/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 核心逻辑

- 无页面参数，无云函数调用，纯静态展示页面
- 两个按钮操作：
  - 「重新支付」→ `Taro.redirectTo({ url: '/pages-sub/payment/index' })`
  - 「查看订单」→ `Taro.redirectTo({ url: '/pages-sub/order-list/index?type=pending_payment' })`
- 注意使用 `redirectTo` 而非 `navigateTo`（替换当前页面，避免页面栈堆积）

### UI 结构

```
TopBarWithBack
└── 居中内容区
    ├── 失败图标（大图标）
    ├── "支付失败"标题
    ├── 说明文字（如"请重新尝试支付或查看订单详情"）
    └── 按钮区（水平排列）
        ├── 「重新支付」按钮（黑底白字）
        └── 「查看订单」按钮（灰底黑字）
```

### 关键样式

- 容器：`display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 60rpx`
- 失败图标：`width: 160rpx; height: 160rpx; margin-bottom: 40rpx`
- 标题：`font-size: 36rpx; font-weight: 600; color: #333; margin-bottom: 20rpx`
- 说明文字：`font-size: 28rpx; color: #999; margin-bottom: 60rpx; text-align: center`
- 按钮容器：`display: flex; gap: 30rpx; width: 100%; padding: 0 40rpx`
- 重新支付按钮：`flex: 1; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx; font-size: 30rpx`
- 查看订单按钮：`flex: 1; height: 88rpx; background: #f5f5f5; color: #333; border-radius: 8rpx; font-size: 30rpx`

### 图标资源

如果 `src/assets/icons/` 中缺少支付失败图标，从 `legacy_ro/yz-legacy-code/` 中找到并复制过来。

---

## 页面 B：支付选地址页 `pages-sub/payment-select-address/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 核心功能点

#### 1. 地址列表加载（`useDidShow`）

- 每次页面显示时刷新地址列表（支持从新增/编辑地址页返回后自动更新）
- 调用 `addressService.listAddresses(userId)`
- 默认选中 `isDefault === true` 的地址

#### 2. 选择地址

- 点击地址项 → 设置 `selectedId = address._id`
- 选中态：单选框黑色填充

#### 3. 确认选择

- 点击底部确认按钮
- 从 `addresses` 中找到 `selectedId` 对应的地址对象
- 通过 `Taro.eventCenter.trigger('selectAddress', selectedAddress)` 回传给支付页
- 调用 `Taro.navigateBack()`

#### 4. 新增地址

- `navigateTo('/pages-sub/address-edit/index')`

#### 5. 编辑地址

- `navigateTo('/pages-sub/address-edit/index?addressId=${id}')`

### UI 结构

```
TopBarWithBack
├── "新增地址"按钮（虚线边框，顶部）
├── ScrollView（地址列表，纵向滚动）
│   └── 每个地址项
│       ├── 左侧：单选框（选中黑色填充 / 未选中空心圆）
│       ├── 中间信息区
│       │   ├── receiver + phone（+ 默认标签 badge，如有）
│       │   └── provinceCity + detailAddress
│       └── 右侧：编辑按钮（图标）
├── 底部确认按钮（fixed 定位，黑底白字）
├── FloatBtn（浮动咨询按钮）
└── FloatPopup（在线咨询弹窗）
```

### 关键样式

- 新增地址按钮：`width: 100%; height: 88rpx; border: 1rpx dashed #ddd; border-radius: 8rpx; text-align: center; line-height: 88rpx; font-size: 28rpx; color: #999; margin: 20rpx 0`
- 地址列表项：`display: flex; align-items: flex-start; padding: 30rpx; background: #fff; margin-bottom: 10rpx`
- 单选框：`width: 40rpx; height: 40rpx; border-radius: 50%; border: 2rpx solid #ddd; margin-right: 20rpx; flex-shrink: 0`，选中态 `background: #000; border-color: #000`
- 默认标签：`display: inline-block; padding: 4rpx 12rpx; background: #000; color: #fff; font-size: 20rpx; border-radius: 4rpx; margin-left: 10rpx`
- 收件人+电话：`font-size: 28rpx; font-weight: 600; color: #333`
- 地址详情：`font-size: 26rpx; color: #666; margin-top: 10rpx`
- 编辑按钮：`width: 40rpx; height: 40rpx; flex-shrink: 0; margin-left: auto`
- 底部确认按钮：`position: fixed; bottom: 0; width: 100%; height: 100rpx; background: #000; color: #fff; font-size: 32rpx; padding-bottom: env(safe-area-inset-bottom)`

### eventCenter 回传机制

支付页（session-18 已实现）在 `useDidShow` 中监听：
```typescript
Taro.eventCenter.on('selectAddress', (addr) => setAddress(addr))
```

选地址页确认时触发：
```typescript
const confirmAddress = () => {
  const selected = addresses.find(a => a._id === selectedId)
  if (selected) {
    Taro.eventCenter.trigger('selectAddress', selected)
    Taro.navigateBack()
  }
}
```

---

## 产出

- 支付失败页 3 个文件（`pages-sub/payment-failed/` 下的 index.tsx + index.config.ts + index.module.scss）
- 选地址页 3 个文件（`pages-sub/payment-select-address/` 下的 index.tsx + index.config.ts + index.module.scss）
- 如有缺失的图标资源，从 legacy 复制到 `src/assets/icons/`

## 要求

- 使用已有的 services（address.service），调用前先读取确认方法签名
- 使用已有的组件：TopBarWithBack、FloatBtn、FloatPopup
- 使用已有的 utils：navigateTo
- 支付失败页的两个按钮使用 `Taro.redirectTo`（非 navigateTo），避免页面栈堆积
- 选地址页地址回传使用 `Taro.eventCenter.trigger('selectAddress', address)`，与支付页的监听对应
- 选地址页在 `useDidShow` 中加载地址列表（每次显示都刷新）
- 底部确认按钮需要考虑安全区域（safe-area-inset-bottom）
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 完成后运行 `npm run build:weapp` 确认编译通过

---
