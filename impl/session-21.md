# 会话 21：Phase 07b 地址列表 + 新增/编辑地址 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 07 的第二部分：地址列表页（address-list）和新增/编辑地址页（address-edit）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用前先读取 service 文件确认方法签名，避免参数传递错误。
4. 这两个页面都是分包页面（pages-sub/），不是 Tab 页，不需要 CustomTabBar 组件。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/07-user-center.md`（关注「旧代码摘要 → 3. 地址列表页」和「4. 新增/编辑地址页」部分，以及对应的「实现要求」部分）
3. `src/services/address.service.ts`（地址服务 — **必读**，理解 listAddresses / addAddress / editAddress / deleteAddress / setDefaultAddress 方法签名）
4. `src/services/user.service.ts`（用户服务 — getUserInfo 获取 userId）
5. `src/types/user.ts`（Address 类型定义）
6. `src/utils/validate.ts`（isValidPhone / isNotEmpty）

## 参考旧代码（必读，1:1 还原 UI）

**地址列表页：**
- `legacy_ro/yz-legacy-code/pages/my_address/my_address.wxml`
- `legacy_ro/yz-legacy-code/pages/my_address/my_address.wxss`
- `legacy_ro/yz-legacy-code/pages/my_address/my_address.js`

**新增/编辑地址页：**
- `legacy_ro/yz-legacy-code/pages/add_new_address/add_new_address.wxml`
- `legacy_ro/yz-legacy-code/pages/add_new_address/add_new_address.wxss`
- `legacy_ro/yz-legacy-code/pages/add_new_address/add_new_address.js`

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-20 已完成。地址服务和用户服务已就绪。

### 已有的关键基础设施

- `src/services/address.service.ts` — `listAddresses(userId)`, `addAddress(userId, data)`, `editAddress(addressId, data)`, `deleteAddress(addressId)`, `setDefaultAddress(addressId)`, `getDefaultAddress(userId)`
- `src/services/user.service.ts` — `getUserInfo()`
- `src/types/user.ts` — `Address`（`_id, userId, receiver, phone, provinceCity, detailAddress, isDefault`）
- `src/utils/validate.ts` — `isValidPhone()`, `isNotEmpty()`
- `src/stores/useUserStore.ts` — `userId`
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏
- `src/components/FloatPopup/` + `src/components/FloatBtn/` — 浮动咨询
- `src/assets/icons/selected.png` + `not_selected.png` — 勾选/未勾选图标

---

## 页面 A：地址列表页 `pages-sub/address-list/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 页面状态

```typescript
const [addresses, setAddresses] = useState<Address[]>([])
const [defaultAddressId, setDefaultAddressId] = useState('')
const [isSelectMode, setIsSelectMode] = useState(false)
const [isEmpty, setIsEmpty] = useState(true)
```

### 核心功能点

#### 1. 页面加载（useLoad）

- 接收参数 `params.select`：若 `=== '1'` 则进入选择模式（`setIsSelectMode(true)`）
- 调用 `loadAddressList()` 加载地址列表

#### 2. 每次显示刷新（useDidShow）

- 使用 Taro 的 `useDidShow` Hook（注意：先用 context7 确认 `useDidShow` 的正确导入方式）
- 每次页面显示时调用 `loadAddressList()`（支持从新增/编辑地址页返回后自动刷新）

#### 3. 加载地址列表（loadAddressList）

```typescript
const loadAddressList = async () => {
  const userRes = await userService.getUserInfo()
  if (userRes.code === 200 && userRes.data) {
    const res = await addressService.listAddresses(userRes.data._id)
    if (res.code === 200 && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data as any).items || []
      setAddresses(list)
      setIsEmpty(list.length === 0)
      // 找到默认地址
      const defaultAddr = list.find(a => a.isDefault)
      if (defaultAddr) setDefaultAddressId(defaultAddr._id)
    }
  }
}
```

注意：云函数返回格式可能是 `{ data: Address[] }` 或 `{ data: { items: Address[] } }`，需要兼容两种格式。

#### 4. 设为默认

- 调用 `addressService.setDefaultAddress(addressId)`
- 成功后刷新列表

#### 5. 删除地址

- `Taro.showModal({ title: '确认删除', content: '确定要删除该地址吗？' })`
- 确认后调用 `addressService.deleteAddress(addressId)`
- 成功后刷新列表

#### 6. 编辑地址

- `Taro.navigateTo({ url: '/pages-sub/address-edit/index?id=${addressId}' })`

#### 7. 新增地址

- `Taro.navigateTo({ url: '/pages-sub/address-edit/index' })`

#### 8. 选择模式（从编辑信息页或支付页进入）

- 点击地址卡片 → 通过 `Taro.eventCenter.trigger('selectAddress', address)` 传递选中地址 → `Taro.navigateBack()`

### UI 结构

```
TopBarWithBack
└── container（需要 marginTop 偏移 TopBarWithBack）
    ├── title「地址簿」（40rpx, 600 weight, margin-left: 20rpx）
    ├── 空状态（is_address_list_empty 时显示）
    │   └── add-new-address 按钮「新增地址」
    └── 非空状态
        ├── ScrollView（scroll-y, height: 80vh）
        │   └── 每个地址卡片 default-address-detail
        │       ├── 默认标签「默认」（仅 defaultAddressId === item._id 时显示）
        │       └── address-detail-edit（flex 布局）
        │           ├── address-container（左侧信息区，width: 400rpx）
        │           │   ├── name-phone（收件人 + 电话，flex 水平排列）
        │           │   ├── province-city（省市区）
        │           │   └── detail-address（详细地址）
        │           └── ops（右侧操作区，margin-left: auto）
        │               ├── edit-delete-buttons（编辑 + 删除，纵向排列）
        │               │   ├── edit-btn「编辑」
        │               │   └── delete-btn「删除」
        │               └── set-default「设为默认」（仅非默认地址显示）
        ├── add-new-address 按钮「新增地址」
        └── 底部占位（80rpx）
```

### 关键样式要点

- 标题：`margin-left: 20rpx; margin-bottom: 40rpx; font-size: 40rpx; font-weight: 600`
- 默认标签：`height: 45rpx; width: 90rpx; background: rgb(184,184,184); color: rgb(66,66,66); font-size: 26rpx; 居中`
- 新增地址按钮：`height: 85rpx; width: 95%; background: black; color: white; font-size: 27rpx; font-weight: 600; margin-left: 20rpx`
- 地址卡片：`width: 96%; margin-left: 2%; padding-top: 60rpx; padding-bottom: 65rpx; border-top: rgb(151,151,151) solid 2rpx`
- 收件人/电话：`font-size: 30rpx; font-weight: 600; color: black`
- 省市区：`font-size: 28rpx; font-weight: 600; margin-top: 20rpx`
- 详细地址：`font-size: 28rpx; font-weight: 600; word-break: break-all`
- 操作按钮（编辑/删除）：`font-size: 20rpx; color: #3b4046; padding: 8rpx 16rpx; border: 1rpx solid #3b4046; border-radius: 8rpx`
- 设为默认按钮：`font-size: 24rpx; color: #3b4046; padding: 6rpx 12rpx; border: 1rpx solid #3b4046; border-radius: 6rpx`
- 详细样式参考旧代码 `my_address.wxss` 1:1 还原

### 注意：TopBarWithBack 偏移

地址列表页使用 `navigationStyle: 'custom'`，页面内容需要添加 `marginTop` 来避免被 TopBarWithBack 遮挡。参考已实现的 product-detail 页面的做法。

---

## 页面 B：新增/编辑地址页 `pages-sub/address-edit/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 页面状态

```typescript
const [addressId, setAddressId] = useState('')  // 非空 = 编辑模式
const [name, setName] = useState('')             // 收件人
const [phone, setPhone] = useState('')           // 联系电话
const [region, setRegion] = useState<string[]>(['请', '选择', '地区'])
const [regionFontSize, setRegionFontSize] = useState(28)  // 动态字号
const [address, setAddress] = useState('')       // 详细地址
const [isDefault, setIsDefault] = useState(false)
const [submitting, setSubmitting] = useState(false)

// 校验错误态
const [errors, setErrors] = useState({ name: false, phone: false, address: false })

// 动态 placeholder
const [namePlaceholder, setNamePlaceholder] = useState('收件人*')
const [phonePlaceholder, setPhonePlaceholder] = useState('联系电话*')
const [addressPlaceholder, setAddressPlaceholder] = useState('详细地址*')
const [namePlaceholderStyle, setNamePlaceholderStyle] = useState('color: #999;')
const [phonePlaceholderStyle, setPhonePlaceholderStyle] = useState('color: #999;')
const [addressPlaceholderStyle, setAddressPlaceholderStyle] = useState('color: #999;')
```

### 核心功能点

#### 1. 页面加载 & 编辑模式回填

`useLoad` 中：
1. 获取 `params.id`，若存在则进入编辑模式
2. 调用 `userService.getUserInfo()` 获取 `userId`
3. 调用 `addressService.listAddresses(userId)` 获取地址列表
4. 找到 `_id === params.id` 的地址 → 回填表单
5. 回填时 `provinceCity.split('-')` 还原为 `region` 数组

#### 2. 收件人 & 详细地址输入

文本输入，输入时清除对应错误态。

#### 3. 电话输入

数字输入，限 11 位：`replace(/\D/g, '').slice(0, 11)`

#### 4. 地区选择

- `<Picker mode="region" value={region}>`
- 选择后检查文字长度，过长时缩小字号到 24rpx，否则恢复 28rpx

#### 5. 一键定位

调用 `Taro.chooseLocation()` → 解析返回的 `address` 字符串提取省市区：

```typescript
const handleGetLocation = async () => {
  try {
    const res = await Taro.chooseLocation({})
    if (res.address) {
      // 解析地址字符串提取省市区
      const parsed = parseAddress(res.address)
      if (parsed) {
        setRegion(parsed.region)
        setAddress(parsed.detail || res.name || '')
      } else {
        Taro.showToast({ title: '无法解析地址，请手动选择地区', icon: 'none' })
      }
    }
  } catch (err: any) {
    if (err?.errMsg?.includes('auth deny') || err?.errMsg?.includes('authorize')) {
      // 权限被拒绝，引导去设置页
      Taro.showModal({
        title: '需要位置权限',
        content: '请在设置中开启位置权限',
        confirmText: '去设置',
        success: (modalRes) => {
          if (modalRes.confirm) Taro.openSetting({})
        },
      })
    }
  }
}

// 地址解析：按省/市/区/县关键字分割
function parseAddress(addr: string): { region: string[]; detail: string } | null {
  const provinceMatch = addr.match(/^(.+?省|.+?自治区|.+?市)/)
  const cityMatch = addr.match(/(省|自治区)(.+?市|.+?自治州|.+?地区|.+?盟)/)
  const districtMatch = addr.match(/(市|自治州|地区|盟)(.+?区|.+?县|.+?市|.+?旗)/)

  if (provinceMatch && cityMatch && districtMatch) {
    const province = provinceMatch[1]
    const city = cityMatch[2]
    const district = districtMatch[2]
    const detail = addr.replace(province, '').replace(city, '').replace(district, '')
    return { region: [province, city, district], detail }
  }
  return null
}
```

#### 6. 设为默认

checkbox 切换 `isDefault`。

#### 7. 表单验证 & 保存

验证规则：
- 收件人：`isNotEmpty(name)`
- 电话：`/^1\d{10}$/`
- 详细地址：`isNotEmpty(address)`

验证失败时：对应字段红色边框 + placeholder 变红色提示。

保存流程：
1. `setSubmitting(true)`
2. `provinceCity = region.join('-')`（如 `"广东省-深圳市-南山区"`）
3. 获取 `userId`
4. 新增模式：`addressService.addAddress(userId, { receiver: name, phone, provinceCity, detailAddress: address })`
   - 注意：`addAddress` 的第二个参数类型是 `Omit<Address, '_id' | 'userId' | 'isDefault'>`，不包含 `isDefault`。如果需要设置默认，保存成功后再调用 `setDefaultAddress`
5. 编辑模式：`addressService.editAddress(addressId, { receiver: name, phone, provinceCity, detailAddress: address, isDefault })`
6. 如果 `isDefault` 为 true 且是新增模式，保存成功后额外调用 `addressService.setDefaultAddress(newAddressId)`
7. 成功 → Toast + `Taro.navigateBack()`
8. finally → `setSubmitting(false)`

**重要**：先读取 `address.service.ts` 确认 `addAddress` 和 `editAddress` 的参数签名，确保传参正确。

### UI 结构

```
TopBarWithBack
└── enter-info-container（margin: 30rpx 60rpx 30rpx 30rpx）
    ├── required-field「*必填项」（右对齐，font-size: 25rpx, color: rgb(104,104,104)）
    ├── form 表单
    │   ├── form-item 收件人（input）
    │   ├── form-item 联系电话（input type="number"）
    │   ├── form-item 地区（region-container: flex 布局）
    │   │   ├── Picker mode="region"（flex: 1）
    │   │   └── location-btn「一键定位」（黑底白字按钮）
    │   └── form-item 详细地址（input）
    └── set-default-btn 区域
        ├── set-default（checkbox + "设为默认地址"）
        └── save-btn「保存」（黑底白字按钮）
```

### 关键样式要点

- 容器：`margin-left: 30rpx; margin-right: 60rpx; margin-top: 30rpx`
- 必填提示：`margin-left: 600rpx; font-size: 25rpx; color: rgb(104,104,104); white-space: nowrap`
- 表单项：`width: 100%; margin-bottom: 20rpx`
- 输入框：`border: 2rpx solid black; color: #929191; width: 100%; height: 80rpx; padding: 0 20rpx; font-size: 28rpx; box-sizing: border-box`
- 地区容器：`display: flex; align-items: center; gap: 20rpx; width: 100%`
- 地区 Picker：`flex: 1; min-width: 0`（覆盖 input-container 的 width: 100%）
- 一键定位按钮：`width: 180rpx; height: 80rpx; background: #000; color: #fff; font-size: 22rpx; border-radius: 0; flex-shrink: 0`
- 设为默认 checkbox：`width: 30rpx; height: 30rpx; margin-right: 20rpx`
- 保存按钮：`width: 105%; background: #000; color: #fff; border-radius: 0`
- 错误态：旧代码中有 `.not-correct` 类但未在 WXSS 中定义，参考 edit-info 页面的错误态样式 `border: 2rpx solid #CE1616; color: #CE1616`
- 详细样式参考旧代码 `add_new_address.wxss` 1:1 还原

### 注意：TopBarWithBack 偏移

同样需要 `marginTop` 偏移。参考已实现的 product-detail 页面。

---

## 产出

- 地址列表页 3 个文件（`pages-sub/address-list/` 下的 index.tsx + index.config.ts + index.module.scss）
- 新增/编辑地址页 3 个文件（`pages-sub/address-edit/` 下的 index.tsx + index.config.ts + index.module.scss）

## 要求

- 使用已有的 services（address.service / user.service），调用前先读取确认方法签名
- 使用已有的 validate 工具函数
- 使用已有的组件：TopBarWithBack、FloatPopup、FloatBtn
- 地址列表页使用 `useDidShow` 每次显示时刷新列表
- 选择模式下使用 `Taro.eventCenter.trigger('selectAddress', address)` 回传地址（与支付页和编辑信息页的监听对应）
- 删除地址前弹 `Taro.showModal` 确认
- 新增/编辑地址页的 `provinceCity` 存储格式为 `region.join('-')`，回填时 `split('-')` 还原
- 一键定位使用 `Taro.chooseLocation()`，权限拒绝时引导去设置页
- 表单验证错误态用红色边框 + 红色 placeholder 标识
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 完成后运行 `npm run build:weapp` 确认编译通过

---
