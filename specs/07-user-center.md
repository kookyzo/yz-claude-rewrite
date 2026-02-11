# Phase 07: 用户中心、地址管理、订单管理、售后服务

## 目标

实现用户中心相关的 9 个页面：注册、编辑个人信息、地址列表、地址编辑、订单列表、售后入口、售后详情、退款申请、退换详情。

## 前置依赖

- Phase 02 完成（`types/`、`services/`、`utils/`、`constants/`）
- Phase 03 完成（`stores/`、`hooks/`）
- Phase 04 完成（共享组件：`TopBarWithBack`、`FloatPopup`、`FloatBtn`、`ReviewPopup`、`LoadingBar`）

## 页面清单

| # | 新路径 | 旧路径 | 说明 |
|---|--------|--------|------|
| 1 | `pages-sub/register/` | `pages/register/register` | 注册 |
| 2 | `pages-sub/edit-info/` | `pages/edit_information/edit_information` | 编辑个人信息 |
| 3 | `pages-sub/address-list/` | `pages/my_address/my_address` | 地址列表 |
| 4 | `pages-sub/address-edit/` | `pages/add_new_address/add_new_address` | 新增/编辑地址 |
| 5 | `pages-sub/order-list/` | `pages/my_sub_page/my_sub_page` | 订单列表 |
| 6 | `pages-sub/after-sales/` | `pages/my_sub_after_sales_service/...` | 售后入口（含申请表单） |
| 7 | `pages-sub/after-sales-detail/` | `pages/after_sales_service/after_sales_service` | 售后详情（静态保养指南） |
| 8 | `pages-sub/refund/` | `pages/refund/refund` | 退款申请 |
| 9 | `pages-sub/return-exchange-detail/` | `pages/return_exchange_details/...` | 退换详情（静态政策页） |

---

## Taro API 确认（via context7 官方文档）

以下 API 用法已通过 Taro 官方文档确认：

### Picker 组件

- **`<Picker mode="selector">`**：普通选择器，`range` 传数组，`onChange` 回调 `e.detail.value` 为选中索引（number）
- **`<Picker mode="date">`**：日期选择器，`value` 为 `"YYYY-MM-DD"` 字符串，`start`/`end` 限制范围，`onChange` 回调 `e.detail.value` 为日期字符串
- **`<Picker mode="region">`**：省市区选择器，`value` 为 `string[]`（省/市/区），`onChange` 回调 `e.detail.value` 为 `string[]`，`e.detail.code` 为行政区划代码

### Button openType="getPhoneNumber"

- Taro `<Button openType="getPhoneNumber">` 触发 `onGetPhoneNumber` 回调
- 回调 `e.detail` 包含 `code`（授权码）和 `errMsg`
- 成功时 `errMsg === 'getPhoneNumber:ok'`，用 `code` 调用后端云函数 `bindPhoneNumber` 解密获取手机号

### Taro.chooseLocation()

- 打开地图让用户选择位置
- 返回 `{ name, address, latitude, longitude }`
- 需要用户授权地理位置权限，拒绝时 `errMsg` 包含 `'auth deny'` 或 `'cancel'`

### useLoad / useRouter

- **`useLoad(callback)`**：等同于 `onLoad` 生命周期，回调参数为页面参数对象（Taro v3.5.0+）
- **`useRouter()`**：返回 `RouterInfo` 对象，`routerInfo.params` 包含页面参数（等同于 `onLoad(options)` 的 `options`）
- 本项目统一使用 `useLoad` 获取页面参数

---

## 旧代码摘要

### 1. 注册页（`pages/register/register`）

**页面状态字段：**
- `lastName`、`firstName` — 姓、名（分开输入）
- `gender` — 称谓：`'mr'`（先生）| `'ms'`（女士）| `'other'`（其他），默认 `'mr'`
- `phone` — 手机号
- `birthday` — 生日（`YYYY-MM-DD`）
- `maxDate` — 生日选择器最大日期（当天，onLoad 中计算）
- `agreements` — 条款勾选状态对象：`{ privacy, marketing, analysis, crossBorder }`，其中 `privacy` 为必选
- `isAllSelected` — 全选状态
- `get_phone_btn_disabled` — 手机号获取按钮禁用状态
- `errors` — 表单验证错误：`{ lastName, firstName, phone, birthday, privacy }`

**生命周期逻辑：**
- `onLoad`：计算 `maxDate`（当天日期），设置到 data

**云函数调用：**
- `bindPhoneNumber`：一键获取手机号，传 `{ code }`，返回 `{ code: 200, data: { phoneNumber } }`
- `sign_up`：注册，传 `{ userInfo: { gender, title, nickname, phone, birthday, region: '', mail: '' } }`
  - `title` 由 `gender` 映射：`mr→'先生'`、`ms→'女士'`、`other→'其他'`
  - `nickname` = `lastName + firstName`
  - 成功 `code === 200`，已存在 `code === 409`

**核心交互逻辑：**
- 称谓选择：三个单选按钮（先生/女士/其他），通过 `data-gender` 传值
- 手机号：支持手动输入（限 11 位数字）和一键授权（`open-type="getPhoneNumber"`）
- 生日：`<Picker mode="date">`，范围 `1900-01-01` 到当天
- 条款：4 个独立勾选 + 全选按钮，`privacy` 为必选项
- 年龄校验：`checkAge()` 验证是否满 18 周岁
- 表单验证：姓非空、名非空、手机号 `/^1\d{10}$/`、生日非空、隐私声明已勾选
- 提交按钮：`disabled={!agreements.privacy}`，文案"我已满18周岁，自愿选择并同意以上内容"

**UI 结构概要：**
- 顶部"个人信息"标题
- 姓名两列布局（姓 + 名）
- 称谓三选一（先生/女士/其他）
- 电话输入 + 一键授权按钮
- 生日日期选择器
- 条款列表（4 项 + 全选）
- 底部提交按钮

**页面间数据传递：**
- 注册成功后 `navigateBack()` 返回上一页（通常是"我的"页）

### 2. 编辑个人信息页（`pages/edit_information/edit_information`）

**页面状态字段：**
- `gender` — `'female'` | `'male'`，默认 `'female'`
- `is_female` / `is_male` — 性别布尔值（用于 UI 切换）
- `titleList` — 称谓选项：`['称谓*', '女士', '小姐', '男士', '先生', '其他']`
- `titleIndex` — 当前选中称谓索引，默认 `1`
- `nickname`、`birthday`、`phone`、`mail`、`region` — 基础资料
- `auth` — 隐私协议勾选状态
- `not_correct_title` / `not_correct_nickname` / `not_correct_phone` / `not_correct_mail` — 校验错误状态
- `nickname_placeholder_style` / `phone_placeholder_style` / `mail_placeholder_style` — 动态 placeholder 样式
- `submitting` — 提交节流

**生命周期逻辑：**
- `onLoad`：调用 `app.ensureLogin()` → 调用 `getUserInfo` 云函数获取用户资料 → `fillFormFromProfile()` 回填表单；失败时从 `wx.getStorageSync('profile')` 本地缓存回填

**云函数调用：**
- `getUserInfo`：获取用户信息，用于回填表单
- `manage-user`（action: `'update'`）：保存修改，传 `{ action: 'update', data: { gender, title, nickname, birthday, phone, email, region } }`

**核心交互逻辑：**
- 性别选择：女士/男士两个单选按钮
- 称谓：`<Picker mode="selector">`，选项列表 `['称谓*', '女士', '小姐', '男士', '先生', '其他']`
- 生日：`<Picker mode="date">`，范围 `1900-01-01` 到 `2100-12-31`
- 电话：数字输入，限 11 位，`replace(/\D/g, '').slice(0, 11)`
- 地区：`<Picker mode="region">`，显示格式 `省 - 市 - 区`
- "前往编辑地址信息"按钮：跳转 `/pages/my_address/my_address?select=1`
- 表单验证：称谓不能为默认值（`'称谓*'`）、昵称非空、电话 `/^1\d{10}$/`、邮箱格式（若填写）
- 验证失败：placeholder 变红色 `#CE1616`，提示文字变为"请输入正确的XXX"
- 隐私协议必须勾选

**回填逻辑（`fillFormFromProfile`）：**
- `title` → 在 `titleList` 中查找索引
- `region`：兼容数组和字符串格式（`"省/市/区"` 或 `"省-市-区"`）
- `mail` 字段兼容 `email` 和 `mail` 两种 key

**UI 结构概要：**
- 背景大图 + 弹窗式表单（与注册页类似的弹窗布局）
- 右上角关闭按钮（×）→ `navigateBack()`
- Logo 图片
- 性别选择（女士/男士）
- 表单字段：称谓、昵称、生日、电话、邮箱、地区
- "前往编辑地址信息"入口
- 隐私协议勾选 + 提交按钮（文案"立即注册"，实际为保存修改）

**页面间数据传递：**
- 保存成功后通过 `getCurrentPages()` 获取上一页（"我的"页），调用 `prev.loadUserInfoSafe()` 刷新
- 延迟 400ms 后 `navigateBack()`

### 3. 地址列表页（`pages/my_address/my_address`）

**页面状态字段：**
- `is_address_list_empty` — 地址列表是否为空
- `address_list` — 地址数组（云端返回）
- `default_address_id` — 默认地址 `_id`
- `isSelectMode` — 是否为选择模式（从支付页进入时为 `true`）
- `isPopupShow` — 在线咨询弹窗

**生命周期逻辑：**
- `onLoad(options)`：若 `options.select === '1'` 则进入选择模式；调用 `ensureLogin()` → `loadAddressList()`
- `onShow`：每次显示时刷新地址列表（新增/编辑后返回自动刷新）

**云函数调用：**
- `getUserInfo`：获取用户 `_id`
- `manage-address`（action: `'list'`）：传 `{ _userId }`，返回 `{ data: { items: Address[] } }`
- `manage-address`（action: `'setDefault'`）：传 `{ _addressId }`
- `manage-address`（action: `'delete'`）：传 `{ _addressId }`，删除前弹 `wx.showModal` 确认

**核心交互逻辑：**
- 空状态：显示"新增地址"按钮
- 地址卡片：显示收件人、电话、省市区、详细地址；默认地址显示"默认"标签
- 操作按钮：编辑（跳转编辑页）、删除（确认弹窗）、设为默认
- 选择模式：点击地址卡片 → 通过 `getCurrentPages()` 将选中地址传给上一页 `prev.setData({ address })` → `navigateBack()`
- 底部"新增地址"按钮：跳转 `/pages/add_new_address/add_new_address`

**UI 结构概要：**
- 标题"地址簿"
- 空状态 vs 地址列表（`ScrollView` 纵向滚动）
- 每个地址卡片：默认标签 + 收件人/电话 + 省市区 + 详细地址 + 编辑/删除/设为默认按钮
- 底部"新增地址"按钮
- `FloatPopup` 在线咨询弹窗

**页面间数据传递：**
- 接收参数：`options.select` 控制选择模式
- 选择模式下：将选中地址对象传给上一页（支付选地址页）
- 编辑：跳转时传 `?id=${addressId}`

### 4. 新增/编辑地址页（`pages/add_new_address/add_new_address`）

**页面状态字段：**
- `addressId` — 编辑模式下的地址 ID（空字符串为新增模式）
- `name` — 收件人
- `phone` — 联系电话
- `region` — 省市区数组，默认 `["请", "选择", "地区"]`
- `regionFontSize` — 地区显示字号（动态调整，默认 28rpx）
- `address` — 详细地址
- `set_default` — 是否设为默认
- `not_correct_name` / `not_correct_phone` / `not_correct_address` — 校验错误状态
- `name_placeholder` / `phone_placeholder` / `address_placeholder` — 动态 placeholder
- `*_placeholder_style` — 动态 placeholder 样式

**生命周期逻辑：**
- `onLoad(options)`：`ensureLogin()`；若 `options.id` 存在则进入编辑模式 → 调用 `manage-address` list 获取地址列表 → 找到对应地址 → 回填表单
- `onReady`：延迟 200ms 调整地区字号

**云函数调用：**
- `getUserInfo`：获取用户 `_id`
- `manage-address`（action: `'list'`）：编辑模式下获取地址列表，找到对应地址回填
- `manage-address`（action: `'add'`）：新增，传 `{ _userId, addressData: { receiver, phone, provinceCity, detailAddress, isDefault } }`
- `manage-address`（action: `'edit'`）：编辑，传 `{ _addressId, addressData: { receiver, phone, provinceCity, detailAddress, isDefault } }`

**核心交互逻辑：**
- 收件人、电话、详细地址：文本输入，电话限 11 位数字
- 地区选择：`<Picker mode="region">`，选择后动态调整字号适应一行显示
- 一键定位：调用 `Taro.chooseLocation()` → 解析地址字符串提取省市区 → 填充地区和详细地址
  - 地址解析：按 `省/市/区/县` 分割，失败时提示手动选择
  - 权限拒绝时弹窗引导去设置页
- 设为默认：checkbox 切换
- `provinceCity` 存储格式：`"省-市-区"` 字符串（`join('-')`）
- 回填时解析：`provinceCity.split('-')` 还原为数组
- 表单验证：收件人非空、电话 `/^1\d{10}$/`、详细地址非空
- 保存成功后 `navigateBack()`

**UI 结构概要：**
- "*必填项"提示
- 表单：收件人、联系电话、地区（Picker + 一键定位按钮）、详细地址
- 设为默认 checkbox + 保存按钮
- `FloatPopup` 在线咨询弹窗

**页面间数据传递：**
- 接收参数：`options.id`（编辑模式的地址 ID）
- 保存成功后通过 `getCurrentPages()` 调用上一页 `prev.loadAddressList()` 刷新

### 5. 订单列表页（`pages/my_sub_page/my_sub_page`）

**页面状态字段：**
- `selected_option` — 当前选中 Tab ID：`'1'`=全部、`'2'`=待付款、`'3'`=待发货、`'4'`=待收货、`'5'`=待评价
- `change_option_List` — Tab 配置数组：`[{ text, option_id }]`
- `loading` / `showTabBarLoading` — 加载状态
- `items_all` / `items_pending_payment` / `items_pending_shipment` / `items_pending_receipt` / `items_pending_review` — 各分类订单列表
- `empty_pending_payment` / `empty_pending_shipment` / `empty_pending_receipt` — 各分类空状态
- `show_review_popup` / `product_image` / `product_name` / `product_foreign_name` — 评价弹窗数据
- `isPopupShow` — 在线咨询弹窗
- `searchValue` — 搜索关键词（UI 存在但未实现搜索逻辑）

**生命周期逻辑：**
- `onLoad(options)`：支持 `options.tab`（直接 Tab ID）和 `options.type`（语义映射：`pending_payment→'2'`、`pending_delivery→'3'`、`pending_receipt→'4'`、`completed→'5'`、`all→'1'`）；设置 `selected_option` 后调用 `loadOrdersFromCloud()`
- `onShow`：每次显示时刷新当前分类订单

**云函数调用：**
- `getUserInfo`：获取用户 `_id`，未注册时提示并跳转注册页
- `manage-order-easy`（action: `'getUserOrders'`）：传 `{ _userId, status? }`
  - 全部 Tab：分别查询 `pending_payment` 和 `paid` 两个状态，合并结果
  - 其他 Tab：传对应 status（`pending_payment` / `paid` / `shipping` / `signed`）
- `manage-order-easy`（action: `'cancelOrder'`）：传 `{ _orderId, _userId }`
- `manage-order-easy`（action: `'confirmReceipt'`）：传 `{ _orderId, _userId }`

**核心交互逻辑：**
- 顶部搜索栏（UI 存在，搜索功能未实现）
- 5 个 Tab 切换：全部 / 待付款 / 待发货 / 待收货 / 待评价
- 切换 Tab 时重新从云端加载对应状态的订单
- 订单卡片显示：日期、订单编号（可复制）、状态文本、商品图片、商品名称（中/英文）、材质、单价、数量、合计金额
- 状态映射（云端 → 显示）：`pending_payment→'PENDING_PAYMENT'`、`paid→'PAID'`、`shipping→'SHIPPED'`、`signed→'SIGNED'`
- 按钮逻辑（按状态）：
  - 待付款：取消订单（`showModal` 确认）+ 立即支付（跳转支付页）
  - 待发货：申请售后（跳转退款页）+ 物流咨询
  - 待收货：查看物流 + 确认收货（`showModal` 确认）
  - 已完成/待评价：申请售后 + 立即评价（打开评价弹窗）
- 空状态：显示空图标 + "暂无订单" + "去挑选商品"按钮（跳转分类页）

**订单数据格式化（`formatOrders`）：**
- `id` ← `order.orderNo || order._id`
- `date` ← `formatDate(order.createdAt)`（时间戳 → `YYYY-MM-DD`）
- `image` ← `firstItem.skuImage[0]`
- `name` ← `firstItem.skuNameCN`
- `foreign_name` ← `firstItem.skuNameEN`
- `material` ← `firstItem.material`
- `formattedUnitPrice` ← `formatPrice(firstItem.unitPrice)`
- `formattedTotalPrice` ← `formatPrice(order.totalAmount)`

**UI 结构概要：**
- `LoadingBar` 加载指示器
- 搜索栏
- 5 Tab 水平滚动切换栏
- 订单列表（`ScrollView` 纵向滚动）
- 每个订单卡片：顶部信息（日期+编号+状态）+ 详情（图片+名称+价格+按钮）
- 空状态提示
- `FloatPopup` 在线咨询弹窗
- `ReviewPopup` 评价弹窗

**页面间数据传递：**
- 接收参数：`options.tab` 或 `options.type`（初始 Tab）
- 立即支付：跳转 `/pages-sub/payment/index?orderId=${orderId}`
- 申请售后：跳转 `/pages-sub/refund/index?orderId=${orderId}`

### 6. 售后入口页（`pages/my_sub_after_sales_service/my_sub_after_sales_service`）

**页面状态字段：**
- `change_option_List` — 顶部 Tab：`[{ text: '日常佩戴', option_id: '1' }, { text: '存放建议', option_id: '2' }, { text: '定期保养', option_id: '3' }, { text: '珠宝护理', option_id: '4' }]`
- `selected_option` — 当前选中 Tab，默认 `'1'`
- `orderId` — 从上一级带过来的订单 ID
- `orderItems` — 订单商品列表（用于选择申请的商品）
- `chosenOrderItemId` — 选中的订单商品 ID
- `reasonList` — 申请原因：`['质量问题', '少件/错发', '外观破损', '不想要/七天无理由', '其它']`
- `reasonIndex` — 选中原因索引
- `desc` — 问题描述
- `photos` — 凭证图片（cloud fileID 数组）
- `submitting` / `uploading` — 状态标志
- `isPopupShow` — 在线咨询弹窗

**生命周期逻辑：**
- `onLoad(options)`：获取 `options.orderId`；若有 orderId 则 `ensureLogin()` → `loadOrderItems(orderId)` 拉取订单详情

**云函数调用：**
- `manage-order`（action: `'detail'`）：获取订单详情，提取可申请的商品列表
- `after-sales`（action: `'create'`）：提交售后申请，传 `{ _userId, orderId, orderItemId, reason, description, photos }`

**核心交互逻辑：**
- 顶部 4 Tab 切换（保养指南内容）
- 若携带 `orderId`，显示"申请售后"表单区域：
  - 选择商品（radio 单选）
  - 申请原因（`<Picker mode="selector">`）
  - 问题描述（textarea，最多 500 字）
  - 上传凭证（最多 9 张，上传到云存储）
  - 提交按钮
- 图片上传：`Taro.chooseImage()` → `Taro.cloud.uploadFile()` → 存储 fileID
- 删除图片：从数组中移除

**UI 结构概要：**
- 顶部 4 Tab 水平滚动切换
- 售后申请表单（仅 orderId 存在时显示）
- 保养指南内容（按 Tab 切换显示）
- 底部感谢文字 + 联系客服链接
- `FloatPopup` 在线咨询弹窗

**页面间数据传递：**
- 接收参数：`options.orderId`
- 提交成功后 `navigateBack()`

### 7. 售后详情页（`pages/after_sales_service/after_sales_service`）

**页面状态字段：**
- `serviceStates` — 服务项目折叠状态：`{ daily_wear: false, storage: false, maintenance: false, jewelry_care: false }`
- `up_image` / `down_image` — 折叠箭头图标路径
- `isPopupShow` — 在线咨询弹窗

**生命周期逻辑：**
- `onLoad`：无特殊逻辑

**云函数调用：**
- 无（纯静态页面）

**核心交互逻辑：**
- 4 个可折叠的服务项目（手风琴效果，可同时展开多个）：
  - 日常佩戴：穿脱衣物佩戴珠宝注意事项
  - 存放建议：保存在原包装内，分开存放
  - 定期保养：每年一次珠宝检查
  - 珠宝护理：擦拭布温水清洗，专业清洁服务
- 点击标题切换折叠状态（`toggleService`）
- 底部感谢文字 + "官方客服"链接（打开 FloatPopup）

**UI 结构概要：**
- 标题"保养情节"
- 4 个可折叠服务项目（标题 + 箭头图标 + 内容）
- 底部感谢文字
- `FloatPopup` 在线咨询弹窗

**页面间数据传递：**
- 无参数接收，无数据传出

### 8. 退款申请页（`pages/refund/refund`）

**页面状态字段：**
- `orderId` — 订单 ID（从上一页传入，只读显示）
- `description` — 问题描述
- `phone` — 联系方式（手机号）
- `submitting` — 提交状态
- `isPopupShow` — 在线咨询弹窗

**生命周期逻辑：**
- `onLoad(options)`：获取 `options.orderId`，设置到 data

**云函数调用：**
- `getUserInfo`：获取用户 `_id`
- `refund`（action: `'create'`）：提交退款申请，传 `{ _userId, orderId, description, phone, createTime }`

**核心交互逻辑：**
- 订单编号：只读显示（`disabled` input）
- 问题描述：textarea，最多 500 字，实时字数统计
- 联系方式：手机号输入
- 表单验证：orderId 非空、描述非空、手机号非空且格式 `/^1[3-9]\d{9}$/`
- 提交成功后 `showToast` + 延迟 2s `navigateBack()`

**UI 结构概要：**
- 订单信息区：订单编号（只读）
- 问题描述区：textarea + 字数统计
- 联系方式区：手机号输入
- 提交按钮（loading + disabled 状态）
- 在线咨询弹窗

**页面间数据传递：**
- 接收参数：`options.orderId`
- 提交成功后 `showToast` + 延迟 2s `navigateBack()`

### 9. 退换详情页（`pages/return_exchange_details/return_exchange_details`）

**页面状态字段：**
- `isPopupShow` — 在线咨询弹窗

**生命周期逻辑：**
- `onLoad`：无特殊逻辑

**云函数调用：**
- 无（纯静态页面）

**核心交互逻辑：**
- 纯静态展示页面，无动态数据
- 内容分为两大区域：
  1. **订单跟踪说明**：展示订单状态流转说明（已下单 → 已付款 → 已发货 → 已签收）
  2. **退换货政策**：
     - 退货条件：7 天无理由退货，商品未使用、包装完好
     - 换货条件：质量问题可换货
     - 退款方式：原路退回
     - 处理时间：收到退货后 3-5 个工作日
- 底部"官方客服"链接（打开 FloatPopup）

**UI 结构概要：**
- `ScrollView` 纵向滚动
- 订单跟踪流程图（静态）
- 退换货政策文字说明
- 底部感谢文字 + 联系客服链接
- `FloatPopup` 在线咨询弹窗

**页面间数据传递：**
- 无参数接收，无数据传出

---

## 产出文件清单

```
src/pages-sub/
├── register/
│   ├── index.tsx
│   ├── index.config.ts
│   └── index.module.scss
├── edit-info/
│   ├── index.tsx
│   ├── index.config.ts
│   └── index.module.scss
├── address-list/
│   ├── index.tsx
│   ├── index.config.ts
│   └── index.module.scss
├── address-edit/
│   ├── index.tsx
│   ├── index.config.ts
│   └── index.module.scss
├── order-list/
│   ├── index.tsx
│   ├── index.config.ts
│   └── index.module.scss
├── after-sales/
│   ├── index.tsx
│   ├── index.config.ts
│   └── index.module.scss
├── after-sales-detail/
│   ├── index.tsx
│   ├── index.config.ts
│   └── index.module.scss
├── refund/
│   ├── index.tsx
│   ├── index.config.ts
│   └── index.module.scss
└── return-exchange-detail/
    ├── index.tsx
    ├── index.config.ts
    └── index.module.scss
```

---

## 实现要求

### 1. 注册页 — `src/pages-sub/register/index.tsx`

```typescript
interface RegisterState {
  lastName: string
  firstName: string
  gender: 'mr' | 'ms' | 'other'
  phone: string
  birthday: string
  maxDate: string
  agreements: {
    privacy: boolean
    marketing: boolean
    analysis: boolean
    crossBorder: boolean
  }
  isAllSelected: boolean
  phoneButtonDisabled: boolean
  errors: {
    lastName: boolean
    firstName: boolean
    phone: boolean
    birthday: boolean
    privacy: boolean
  }
  submitting: boolean
}
```

**依赖：**
- Hooks：`useAuth`（`ensureLogin`）
- Services：`userService.register()`、`userService.bindPhone()`
- Utils：`isValidPhone`、`isNotEmpty`
- Components：`TopBarWithBack`

**核心逻辑：**
- `useLoad`：计算 `maxDate`（当天日期 `YYYY-MM-DD` 格式）
- 称谓选择：三个单选按钮，通过 `gender` state 控制选中状态
- 手机号获取：
  - 手动输入：`replace(/\D/g, '').slice(0, 11)` 限制
  - 一键授权：`<Button openType="getPhoneNumber" onGetPhoneNumber={handleGetPhone}>`，成功时调用 `userService.bindPhone(code)` 获取手机号
- 生日选择：`<Picker mode="date" start="1900-01-01" end={maxDate}>`
- 条款勾选：4 个独立 checkbox + 全选按钮，全选逻辑为设置所有项为 `true`/`false`
- 年龄校验 `checkAge()`：计算生日到当天是否满 18 周岁
- 表单验证：姓非空、名非空、手机号 `/^1\d{10}$/`、生日非空且满 18 岁、`privacy` 已勾选
- 提交：`gender` 映射 `title`（`mr→'先生'`、`ms→'女士'`、`other→'其他'`），`nickname = lastName + firstName`，调用 `userService.register({ gender, title, nickname, phone, birthday, region: '', mail: '' })`
- 成功（`code === 200`）：`showToast` + `navigateBack()`
- 已存在（`code === 409`）：提示"用户已注册"

**关键样式：**
- 页面背景：白色
- 姓名区域：两列 `display: flex; gap: 20rpx`
- 称谓按钮：`height: 70rpx; border: 1rpx solid #ddd; border-radius: 8rpx`，选中 `background: #000; color: #fff; border-color: #000`
- 输入框：`height: 80rpx; border-bottom: 1rpx solid #eee; font-size: 28rpx`
- 错误状态：`border-color: #CE1616`，placeholder 颜色 `#CE1616`
- 条款文字：`font-size: 24rpx; color: #666`
- 提交按钮：`width: 100%; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx; font-size: 30rpx`
- 禁用状态：`opacity: 0.5`

### 2. 编辑个人信息页 — `src/pages-sub/edit-info/index.tsx`

```typescript
const TITLE_LIST = ['称谓*', '女士', '小姐', '男士', '先生', '其他']

interface EditInfoState {
  gender: 'female' | 'male'
  titleIndex: number
  nickname: string
  birthday: string
  phone: string
  mail: string
  region: string[]
  privacyAgreed: boolean
  errors: {
    title: boolean
    nickname: boolean
    phone: boolean
    mail: boolean
  }
  submitting: boolean
}
```

**依赖：**
- Hooks：`useAuth`（`ensureLogin`）
- Services：`userService.getUserInfo()`、`userService.updateUser()`
- Utils：`isValidPhone`、`isValidEmail`、`isNotEmpty`
- Components：`TopBarWithBack`

**核心逻辑：**
- `useLoad`：调用 `ensureLogin()` → `userService.getUserInfo()` 获取用户资料 → `fillFormFromProfile()` 回填表单；失败时从 `Taro.getStorageSync('profile')` 本地缓存回填
- 回填逻辑 `fillFormFromProfile(profile)`：
  - `title` → 在 `TITLE_LIST` 中 `indexOf` 查找索引，未找到则默认 `0`
  - `region`：兼容数组（直接使用）和字符串格式（按 `/` 或 `-` 分割为数组）
  - `mail`：兼容 `profile.email` 和 `profile.mail` 两种 key
- 性别选择：女士/男士两个单选按钮
- 称谓：`<Picker mode="selector" range={TITLE_LIST}>`，`onChange` 回调 `e.detail.value` 为索引
- 生日：`<Picker mode="date" start="1900-01-01" end="2100-12-31">`
- 电话：`replace(/\D/g, '').slice(0, 11)` 限制
- 地区：`<Picker mode="region">`，显示格式 `region.join(' - ')`
- "前往编辑地址信息"按钮：`Taro.navigateTo({ url: '/pages-sub/address-list/index?select=1' })`
- 表单验证：`titleIndex !== 0`、昵称非空、电话 `/^1\d{10}$/`、邮箱格式（若填写）
- 验证失败：对应字段 placeholder 变红色 `#CE1616`，提示文字变为"请输入正确的XXX"
- 隐私协议必须勾选
- 提交：调用 `userService.updateUser({ gender, title: TITLE_LIST[titleIndex], nickname, birthday, phone, email: mail, region: region.join('-') })`
- 成功后 `showToast` + 延迟 400ms `navigateBack()`

**关键样式：**
- 背景大图：`width: 100%; height: 100vh; position: fixed; object-fit: cover`
- 弹窗表单：`position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 90%; max-height: 85vh; background: #fff; border-radius: 20rpx; overflow-y: auto; padding: 40rpx`
- 关闭按钮（×）：`position: absolute; top: 20rpx; right: 20rpx; font-size: 40rpx; color: #999`
- Logo：`width: 120rpx; margin: 0 auto 30rpx`
- 性别单选：圆形按钮，选中 `background: #000; border-color: #000`
- 输入框：`height: 80rpx; border: 1rpx solid #ddd; border-radius: 8rpx; padding: 0 20rpx; font-size: 28rpx`
- 错误状态：`border-color: #CE1616`
- 提交按钮：`width: 100%; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx`

### 3. 地址列表页 — `src/pages-sub/address-list/index.tsx`

```typescript
interface AddressListState {
  addresses: Address[]
  defaultAddressId: string
  isSelectMode: boolean
  isEmpty: boolean
  isPopupShow: boolean
}
```

**依赖：**
- Hooks：`useAuth`（`ensureLogin`）
- Services：`addressService.listAddresses()`、`addressService.setDefaultAddress()`、`addressService.deleteAddress()`、`userService.getUserInfo()`
- Types：`Address`（from `types/user.ts`）
- Components：`TopBarWithBack`、`FloatPopup`、`FloatBtn`

**核心逻辑：**
- `useLoad(params)`：若 `params.select === '1'` 则设置 `isSelectMode = true`；调用 `ensureLogin()` → `loadAddressList()`
- 使用 `useDidShow`（Taro 生命周期 Hook）：每次页面显示时刷新地址列表（新增/编辑后返回自动刷新）
- `loadAddressList()`：调用 `userService.getUserInfo()` 获取 `userId` → `addressService.listAddresses(userId)` → 更新 `addresses` 和 `isEmpty`
- 设为默认：调用 `addressService.setDefaultAddress(addressId)` → 刷新列表
- 删除：`Taro.showModal({ title: '确认删除', content: '确定要删除该地址吗？' })` → 确认后调用 `addressService.deleteAddress(addressId)` → 刷新列表
- 编辑：`Taro.navigateTo({ url: '/pages-sub/address-edit/index?id=${addressId}' })`
- 新增：`Taro.navigateTo({ url: '/pages-sub/address-edit/index' })`
- 选择模式：点击地址卡片 → 通过 `Taro.eventCenter.trigger('selectAddress', address)` 传递选中地址 → `Taro.navigateBack()`

**关键样式：**
- 地址卡片：`background: #fff; border-radius: 12rpx; padding: 30rpx; margin-bottom: 20rpx`
- 默认标签：`display: inline-block; background: #000; color: #fff; font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 4rpx`
- 收件人/电话：`font-size: 30rpx; font-weight: 600; color: #333`
- 地址文字：`font-size: 26rpx; color: #666; margin-top: 10rpx`
- 操作按钮区：`display: flex; justify-content: flex-end; gap: 20rpx; margin-top: 20rpx; border-top: 1rpx solid #eee; padding-top: 20rpx`
- 操作按钮：`font-size: 24rpx; color: #666; padding: 8rpx 20rpx`
- 空状态：居中显示，图标 + 文字 + 按钮
- 底部新增按钮：`position: fixed; bottom: 0; width: 100%; height: 100rpx; background: #000; color: #fff; font-size: 30rpx`

### 4. 新增/编辑地址页 — `src/pages-sub/address-edit/index.tsx`

```typescript
interface AddressEditState {
  addressId: string
  name: string
  phone: string
  region: string[]
  regionFontSize: number
  address: string
  isDefault: boolean
  errors: {
    name: boolean
    phone: boolean
    address: boolean
  }
  submitting: boolean
  isPopupShow: boolean
}
```

**依赖：**
- Hooks：`useAuth`（`ensureLogin`）
- Services：`addressService.addAddress()`、`addressService.editAddress()`、`addressService.listAddresses()`、`userService.getUserInfo()`
- Utils：`isValidPhone`、`isNotEmpty`
- Components：`TopBarWithBack`、`FloatPopup`、`FloatBtn`

**核心逻辑：**
- `useLoad(params)`：调用 `ensureLogin()`；若 `params.id` 存在则进入编辑模式 → 调用 `userService.getUserInfo()` 获取 `userId` → `addressService.listAddresses(userId)` → 找到 `_id === params.id` 的地址 → 回填表单
- 回填时：`provinceCity.split('-')` 还原为 `region` 数组
- 收件人、详细地址：文本输入
- 电话：`replace(/\D/g, '').slice(0, 11)` 限制
- 地区选择：`<Picker mode="region" value={region}>`，选择后动态调整字号（地区文字过长时缩小到 24rpx）
- 一键定位：调用 `Taro.chooseLocation()` → 解析 `address` 字符串提取省市区
  - 解析逻辑：按 `省`、`市`、`区`、`县` 关键字分割地址字符串
  - 成功：填充 `region` 和 `address`
  - 失败：`Taro.showToast({ title: '无法解析地址，请手动选择地区', icon: 'none' })`
  - 权限拒绝：`Taro.showModal` 引导用户去设置页开启权限
- 设为默认：checkbox 切换
- `provinceCity` 存储格式：`region.join('-')`（如 `"广东省-深圳市-南山区"`）
- 表单验证：收件人非空、电话 `/^1\d{10}$/`、详细地址非空
- 新增：`addressService.addAddress(userId, { receiver: name, phone, provinceCity, detailAddress: address, isDefault })`
- 编辑：`addressService.editAddress(addressId, { receiver: name, phone, provinceCity, detailAddress: address, isDefault })`
- 成功后 `showToast` + `navigateBack()`

**关键样式：**
- 必填提示：`font-size: 24rpx; color: #999; padding: 20rpx 30rpx`
- 表单项：`padding: 20rpx 30rpx; border-bottom: 1rpx solid #eee`
- 标签：`font-size: 28rpx; color: #333; width: 160rpx`
- 输入框：`flex: 1; font-size: 28rpx; height: 80rpx`
- 地区显示：动态 `font-size`（默认 28rpx，过长时 24rpx）
- 一键定位按钮：`font-size: 26rpx; color: #333; padding: 10rpx 20rpx; border: 1rpx solid #ddd; border-radius: 8rpx`
- 设为默认区域：`display: flex; align-items: center; padding: 30rpx`
- 保存按钮：`width: 90%; margin: 40rpx auto; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx`

### 5. 订单列表页 — `src/pages-sub/order-list/index.tsx`

```typescript
type TabId = '1' | '2' | '3' | '4' | '5'

interface TabItem {
  text: string
  optionId: TabId
}

const TAB_LIST: TabItem[] = [
  { text: '全部', optionId: '1' },
  { text: '待付款', optionId: '2' },
  { text: '待发货', optionId: '3' },
  { text: '待收货', optionId: '4' },
  { text: '待评价', optionId: '5' },
]

/** Tab ID → 云端 status 映射 */
const TAB_STATUS_MAP: Record<TabId, OrderStatus | OrderStatus[] | null> = {
  '1': null,                    // 全部：查 pending_payment + paid
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

interface FormattedOrder {
  id: string
  orderId: string
  date: string
  status: OrderStatus
  statusText: string
  image: string
  name: string
  nameEN: string
  material: string
  formattedUnitPrice: string
  quantity: number
  formattedTotalPrice: string
}

interface OrderListState {
  selectedTab: TabId
  orders: Record<TabId, FormattedOrder[]>
  loading: boolean
  showReviewPopup: boolean
  reviewProduct: {
    image: string
    name: string
    nameEN: string
  }
  reviewOrderId: string
  isPopupShow: boolean
}
```

**依赖：**
- Hooks：`useAuth`（`ensureLogin`、`ensureRegistered`）
- Services：`orderService.getUserOrders()`、`orderService.cancelOrder()`、`orderService.confirmReceipt()`、`userService.getUserInfo()`
- Utils：`formatDate`、`formatPrice`
- Types：`Order`、`OrderStatus`（from `types/order.ts`）
- Components：`TopBarWithBack`、`LoadingBar`、`SlidingBar`、`FloatPopup`、`FloatBtn`、`ReviewPopup`

**核心逻辑：**
- `useLoad(params)`：解析初始 Tab
  - `params.tab`：直接作为 `TabId`
  - `params.type`：语义映射 `pending_payment→'2'`、`pending_delivery→'3'`、`pending_receipt→'4'`、`completed→'5'`、`all→'1'`
  - 默认 `'1'`
  - 调用 `ensureLogin()` → `loadOrders()`
- 使用 `useDidShow`：每次页面显示时刷新当前 Tab 订单
- `loadOrders(tabId)`：
  - 全部 Tab（`'1'`）：分别查询 `pending_payment` 和 `paid` 两个状态，合并结果
  - 其他 Tab：传对应 status 查询
  - 调用 `orderService.getUserOrders(userId, status)` → `formatOrders(orders)` → 更新 `orders[tabId]`
- `formatOrders(orders: Order[]): FormattedOrder[]`：
  - `id` ← `order.orderNo || order._id`
  - `date` ← `formatDate(order.createdAt)`
  - `image` ← `order.items[0].skuImage[0]`
  - `name` ← `order.items[0].skuNameCN`
  - `nameEN` ← `order.items[0].skuNameEN`
  - `material` ← `order.items[0].materialName`
  - `formattedUnitPrice` ← `formatPrice(order.items[0].unitPrice)`
  - `formattedTotalPrice` ← `formatPrice(order.totalAmount)`
- Tab 切换：更新 `selectedTab`，若该 Tab 数据为空则重新加载
- 订单编号复制：`Taro.setClipboardData({ data: orderId })`
- 按钮逻辑（按状态）：
  - 待付款（`pending_payment`）：取消订单（`Taro.showModal` 确认 → `orderService.cancelOrder(orderId, userId)` → 刷新）+ 立即支付（`Taro.navigateTo({ url: '/pages-sub/payment/index?orderId=${orderId}' })`）
  - 待发货（`paid`）：申请售后（`Taro.navigateTo({ url: '/pages-sub/refund/index?orderId=${orderId}' })`）+ 物流咨询（打开 FloatPopup）
  - 待收货（`shipping`）：查看物流（打开 FloatPopup 咨询）+ 确认收货（`Taro.showModal` 确认 → `orderService.confirmReceipt(orderId, userId)` → 刷新）
  - 已完成/待评价（`signed`）：申请售后 + 立即评价（设置 `reviewProduct` 数据，打开 `ReviewPopup`）
- 空状态：显示空图标 + "暂无订单" + "去挑选商品"按钮（`Taro.switchTab({ url: '/pages/category/index' })`）

**关键样式：**
- 搜索栏：`height: 64rpx; background: #f5f5f5; border-radius: 32rpx; padding: 0 30rpx; margin: 20rpx 30rpx`
- Tab 栏：`SlidingBar` 组件，水平滚动
- 订单卡片：`background: #fff; border-radius: 12rpx; padding: 30rpx; margin-bottom: 20rpx`
- 卡片顶部：`display: flex; justify-content: space-between; font-size: 24rpx; color: #999; margin-bottom: 20rpx`
- 状态文本：`color: #333; font-weight: 600`
- 商品信息区：`display: flex; gap: 20rpx`
- 商品图片：`width: 180rpx; height: 180rpx; border-radius: 8rpx`
- 商品名称：`font-size: 28rpx; color: #333`
- 英文名：`font-size: 24rpx; color: #999`
- 价格：`font-size: 28rpx; color: #333; font-weight: 600`
- 按钮区：`display: flex; justify-content: flex-end; gap: 16rpx; margin-top: 20rpx`
- 普通按钮：`height: 60rpx; padding: 0 30rpx; border: 1rpx solid #ddd; border-radius: 30rpx; font-size: 24rpx; color: #333`
- 主要按钮：`background: #000; color: #fff; border-color: #000`

### 6. 售后入口页 — `src/pages-sub/after-sales/index.tsx`

```typescript
const CARE_TABS = [
  { text: '日常佩戴', optionId: '1' },
  { text: '存放建议', optionId: '2' },
  { text: '定期保养', optionId: '3' },
  { text: '珠宝护理', optionId: '4' },
]

const REASON_LIST = ['质量问题', '少件/错发', '外观破损', '不想要/七天无理由', '其它']

interface AfterSalesState {
  selectedTab: string
  orderId: string
  orderItems: OrderItem[]
  chosenOrderItemId: string
  reasonIndex: number
  description: string
  photos: string[]
  submitting: boolean
  uploading: boolean
  isPopupShow: boolean
}
```

**依赖：**
- Hooks：`useAuth`（`ensureLogin`）
- Services：`orderService.getOrderDetail()`、`userService.getUserInfo()`
- Types：`OrderItem`（from `types/order.ts`）
- Components：`TopBarWithBack`、`SlidingBar`、`FloatPopup`、`FloatBtn`

**核心逻辑：**
- `useLoad(params)`：获取 `params.orderId`；若有 orderId 则 `ensureLogin()` → `loadOrderItems(orderId)`
- `loadOrderItems(orderId)`：调用 `userService.getUserInfo()` 获取 `userId` → `orderService.getOrderDetail(orderId, userId)` → 提取 `order.items` 设置到 `orderItems`
- 保养指南 Tab 切换：通过 `SlidingBar` 组件，`selectedTab` 控制显示内容
- 售后申请表单（仅 `orderId` 存在时渲染）：
  - 选择商品：radio 单选列表，显示商品图片和名称
  - 申请原因：`<Picker mode="selector" range={REASON_LIST}>`
  - 问题描述：`<Textarea maxlength={500}>`，实时字数统计
  - 上传凭证：`Taro.chooseImage({ count: 9 - photos.length })` → `Taro.cloud.uploadFile()` → 存储 fileID 到 `photos` 数组
  - 删除图片：从 `photos` 数组中 `filter` 移除
- 提交：验证 `chosenOrderItemId` 非空、`reasonIndex >= 0`、`description` 非空 → 调用云函数 `after-sales`（action: `'create'`）传 `{ _userId, orderId, orderItemId, reason: REASON_LIST[reasonIndex], description, photos }`
- 成功后 `showToast` + `navigateBack()`

**关键样式：**
- Tab 栏：`SlidingBar` 组件
- 保养指南内容：`padding: 30rpx; font-size: 28rpx; color: #333; line-height: 1.8`
- 申请表单区：`background: #fff; border-radius: 12rpx; padding: 30rpx; margin: 20rpx`
- 商品选择项：`display: flex; align-items: center; padding: 20rpx 0; border-bottom: 1rpx solid #eee`
- 商品图片：`width: 120rpx; height: 120rpx; border-radius: 8rpx; margin-right: 20rpx`
- Textarea：`width: 100%; height: 200rpx; border: 1rpx solid #eee; border-radius: 8rpx; padding: 20rpx; font-size: 28rpx`
- 图片上传区：`display: flex; flex-wrap: wrap; gap: 16rpx`
- 上传图片缩略图：`width: 160rpx; height: 160rpx; border-radius: 8rpx; position: relative`
- 删除按钮：`position: absolute; top: -10rpx; right: -10rpx; width: 36rpx; height: 36rpx; background: rgba(0,0,0,0.5); border-radius: 50%; color: #fff`
- 提交按钮：`width: 90%; margin: 40rpx auto; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx`

### 7. 售后详情页 — `src/pages-sub/after-sales-detail/index.tsx`

```typescript
interface ServiceSection {
  key: string
  title: string
  content: string
  expanded: boolean
}

const INITIAL_SECTIONS: ServiceSection[] = [
  { key: 'daily_wear', title: '日常佩戴', content: '穿脱衣物时请注意佩戴的珠宝...', expanded: false },
  { key: 'storage', title: '存放建议', content: '请将珠宝保存在原包装内，分开存放...', expanded: false },
  { key: 'maintenance', title: '定期保养', content: '建议每年进行一次珠宝检查...', expanded: false },
  { key: 'jewelry_care', title: '珠宝护理', content: '使用擦拭布和温水清洗...', expanded: false },
]

interface AfterSalesDetailState {
  sections: ServiceSection[]
  isPopupShow: boolean
}
```

**依赖：**
- Components：`TopBarWithBack`、`FloatPopup`、`FloatBtn`

**核心逻辑：**
- 纯静态页面，无云函数调用，无生命周期逻辑
- 内部状态 `sections`：初始化为 `INITIAL_SECTIONS`
- `toggleSection(key)`：切换对应 section 的 `expanded` 状态（可同时展开多个，非互斥手风琴）
- 底部"官方客服"链接：点击打开 `FloatPopup`

**关键样式：**
- 标题"保养情节"：`font-size: 36rpx; font-weight: 600; color: #333; padding: 30rpx`
- 折叠项标题：`display: flex; justify-content: space-between; align-items: center; padding: 30rpx; font-size: 30rpx; font-weight: 600; border-bottom: 1rpx solid #eee`
- 箭头图标：`width: 30rpx; height: 30rpx; transition: transform 0.3s`，展开时 `transform: rotate(180deg)`
- 折叠内容：`padding: 20rpx 30rpx; font-size: 26rpx; color: #666; line-height: 1.8`，收起时 `height: 0; overflow: hidden`
- 底部感谢文字：`font-size: 24rpx; color: #999; text-align: center; padding: 40rpx`

### 8. 退款申请页 — `src/pages-sub/refund/index.tsx`

```typescript
interface RefundState {
  orderId: string
  description: string
  phone: string
  submitting: boolean
  isPopupShow: boolean
}
```

**依赖：**
- Hooks：`useAuth`（`ensureLogin`）
- Services：`userService.getUserInfo()`
- Utils：`isValidPhone`、`isNotEmpty`
- Components：`TopBarWithBack`、`FloatPopup`、`FloatBtn`

**核心逻辑：**
- `useLoad(params)`：获取 `params.orderId`，设置到 state
- 订单编号：只读显示（`disabled` Input）
- 问题描述：`<Textarea maxlength={500}>`，实时字数统计 `${description.length}/500`
- 联系方式：手机号输入，`replace(/\D/g, '').slice(0, 11)` 限制
- 表单验证：`orderId` 非空、`description` 非空、`phone` 非空且 `/^1[3-9]\d{9}$/`
- 提交：调用 `userService.getUserInfo()` 获取 `userId` → 调用云函数 `refund`（action: `'create'`）传 `{ _userId, orderId, description, phone, createTime: Date.now() }`
- 成功后 `Taro.showToast({ title: '提交成功', icon: 'success' })` + 延迟 2s `navigateBack()`

**关键样式：**
- 订单信息区：`padding: 30rpx; background: #f5f5f5; border-radius: 8rpx; margin: 20rpx`
- 订单编号输入：`font-size: 28rpx; color: #999; background: transparent`
- Textarea：`width: 100%; height: 250rpx; border: 1rpx solid #eee; border-radius: 8rpx; padding: 20rpx; font-size: 28rpx`
- 字数统计：`font-size: 24rpx; color: #999; text-align: right; margin-top: 10rpx`
- 手机号输入：`height: 80rpx; border: 1rpx solid #ddd; border-radius: 8rpx; padding: 0 20rpx; font-size: 28rpx`
- 提交按钮：`width: 90%; margin: 40rpx auto; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx`
- 禁用/loading 状态：`opacity: 0.5`

### 9. 退换详情页 — `src/pages-sub/return-exchange-detail/index.tsx`

```typescript
interface ReturnExchangeDetailState {
  isPopupShow: boolean
}
```

**依赖：**
- Components：`TopBarWithBack`、`FloatPopup`、`FloatBtn`

**核心逻辑：**
- 纯静态页面，无云函数调用，无生命周期逻辑
- 内容硬编码在 JSX 中，分为两大区域：
  1. 订单跟踪说明：静态流程图展示（已下单 → 已付款 → 已发货 → 已签收）
  2. 退换货政策：退货条件、换货条件、退款方式、处理时间
- 底部"官方客服"链接：点击打开 `FloatPopup`

**关键样式：**
- 页面容器：`ScrollView` 纵向滚动，`padding: 30rpx`
- 流程图区域：`display: flex; justify-content: space-between; align-items: center; padding: 40rpx 20rpx; margin-bottom: 40rpx`
- 流程节点：`display: flex; flex-direction: column; align-items: center; font-size: 24rpx; color: #333`
- 流程连接线：`flex: 1; height: 2rpx; background: #ddd; margin: 0 10rpx`
- 政策标题：`font-size: 32rpx; font-weight: 600; color: #333; margin: 30rpx 0 20rpx`
- 政策内容：`font-size: 26rpx; color: #666; line-height: 1.8`
- 底部感谢文字：`font-size: 24rpx; color: #999; text-align: center; padding: 40rpx`

---

## 验收标准

1. 所有 9 个页面文件（含 `index.tsx`、`index.config.ts`、`index.module.scss`）无 TypeScript 编译错误
2. 每个页面均为 React 函数组件，使用 SCSS Modules 进行样式隔离
3. 注册页：称谓三选一正确切换、手机号支持手动输入和一键授权、生日选择器范围正确（1900 到当天）、年龄校验满 18 周岁、条款全选逻辑正确、`privacy` 为必选项
4. 编辑信息页：`fillFormFromProfile` 回填逻辑正确处理 `title` 索引查找、`region` 数组/字符串兼容、`mail`/`email` 字段兼容
5. 地址列表页：选择模式（`select=1`）下点击地址卡片能正确传递地址数据并返回；`useDidShow` 每次显示时刷新列表
6. 地址编辑页：编辑模式正确回填表单（`provinceCity.split('-')` 还原数组）；一键定位能解析地址字符串提取省市区；权限拒绝时引导去设置页
7. 订单列表页：5 Tab 切换正确加载对应状态订单；全部 Tab 合并 `pending_payment` 和 `paid` 查询结果；`formatOrders` 数据转换正确；各状态按钮逻辑正确（取消/支付/售后/收货/评价）
8. 售后入口页：保养指南 4 Tab 切换正确；售后申请表单仅在 `orderId` 存在时显示；图片上传到云存储并存储 fileID
9. 售后详情页：4 个折叠项可独立展开/收起（非互斥手风琴）
10. 退款申请页：订单编号只读显示；问题描述实时字数统计；手机号格式验证 `/^1[3-9]\d{9}$/`
11. 退换详情页：纯静态页面正确渲染订单跟踪和退换货政策内容
12. 所有需要登录的页面在 `useLoad` 中调用 `ensureLogin()`
13. 所有包含在线咨询的页面正确集成 `FloatPopup` + `FloatBtn` 组件
14. 所有页面使用 `useLoad` 获取页面参数（非 `useRouter`）
15. 所有文件 `import` 路径正确，无循环依赖
