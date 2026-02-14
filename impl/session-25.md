# 会话 25：Phase 08b 修改预约 + 预约成功 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 08 的第二部分：修改预约页（reservation-change）和预约成功页（reservation-success）。修改预约页复用 VIP 预约页的表单 UI 和共享 Hook，预约成功页是独立的展示页面。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用前先读取 service 文件确认方法签名，避免参数传递错误。
4. 这两个页面都是分包页面（pages-sub/），不是 Tab 页，不需要 CustomTabBar 组件。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/08-reservation.md`（**完整阅读**，关注「旧代码摘要 → 3. 修改预约页」「4. 预约成功页」部分，以及对应的「实现要求」部分）
3. `src/services/reservation.service.ts`（预约服务 — **必读**，理解 getReservation / updateReservation / generateQRCode 方法签名）
4. `src/services/user.service.ts`（用户服务 — checkLogin）
5. `src/hooks/useReservationForm.ts`（**必读**，理解共享 Hook 的完整接口，包括 setFormData / setTimeSlots / setDateList 等）
6. `src/types/reservation.ts`（Reservation 类型定义）
7. `src/utils/validate.ts`（isValidPhone / isNotEmpty）
8. `src/hooks/useAuth.ts`（ensureLogin）

## 参考已实现的 VIP 预约页（必读，修改预约页 1:1 复用其 UI）

- `src/pages-sub/reservation/index.tsx`（**必读**，修改预约页的 JSX 结构和样式几乎完全相同）
- `src/pages-sub/reservation/index.module.scss`（**必读**，修改预约页的 SCSS 直接复用）

## 参考旧代码（必读，1:1 还原 UI）

**修改预约页：**
- `legacy_ro/yz-legacy-code/pages/reservation-changge/reservation-changge.wxml`
- `legacy_ro/yz-legacy-code/pages/reservation-changge/reservation-changge.wxss`
- `legacy_ro/yz-legacy-code/pages/reservation-changge/reservation-changge.js`

**预约成功页：**
- `legacy_ro/yz-legacy-code/pages/reservation_success/reservation_success.wxml`
- `legacy_ro/yz-legacy-code/pages/reservation_success/reservation_success.wxss`
- `legacy_ro/yz-legacy-code/pages/reservation_success/reservation_success.js`

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-24 已完成。预约服务、共享 Hook、VIP/普通/通用预约页均已就绪。

### 已有的关键基础设施

- `src/hooks/useReservationForm.ts`（**核心**）:
  - 导出接口：`ActivityConfig`, `DateItem`, `TimeSlot`, `ReservationFormData`, `FormErrors`
  - Hook 返回值：`formData`, `setFormData`, `errors`, `setErrors`, `dateList`, `setDateList`, `timeSlots`, `setTimeSlots`, `isTimePickerShow`, `setLastName`, `setFirstName`, `handlePhoneInput`, `setPhone`, `setPeopleIndex`, `selectDate`, `selectTimeSlot`, `toggleAuth`, `openTimePicker`, `closeTimePicker`, `confirmTimePicker`, `validate`
- `src/services/reservation.service.ts`:
  - `getReservation(id: string)` — 调用 `reservation-change` 云函数 action: `get`
  - `updateReservation({ reservationId, name, phone, people, date, selectedTimes })` — 调用 `reservation-change` 云函数 action: `update`
  - `generateQRCode(content: string, type: string)` — 调用 `generate-qrcode` 云函数
- `src/services/user.service.ts` — `checkLogin()`
- `src/stores/useUserStore.ts` — `login()`
- `src/hooks/useSystemInfo.ts` — `statusBarHeight`, `navBarHeight`
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏
- `src/components/FloatPopup/` + `src/components/FloatBtn/` — 浮动咨询

---

## 页面 A：修改预约页 `pages-sub/reservation-change/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 与 VIP 预约页的关系

修改预约页的 UI 结构和样式与 VIP 预约页**几乎完全相同**。差异点：
1. 页面加载时从 URL 参数获取 `reservationId`，加载已有预约数据回填表单
2. `auth` 默认为 `true`（修改预约时默认已勾选，不再验证）
3. 提交按钮文字为「修改预约」而非「立即预约」
4. 提交前弹出确认对话框，显示已修改次数
5. 调用 `updateReservation` 而非 `addReservation`
6. 无需检查重复预约
7. 需要处理 403 错误（已修改 2 次限制）

### 活动配置常量

使用与 VIP 预约页相同的配置（修改预约页对应的是 VIP 活动）：

```typescript
const CHANGE_CONFIG: ActivityConfig = {
  title: 'Y.ZHENG Fine Jewelry品牌发布会VIP预览',
  address: '上海市静安区富民路89号巨富大厦18A',
  timeText: '2025/10/11 17:00-20:00',
  bannerImage: '/assets/images/reservation/top_image.jpg',
  dateList: [
    { day: 11, activity: true, isToday: false, isSelected: true },
    { day: 12, activity: false, isToday: false, isSelected: false },
    { day: 13, activity: false, isToday: false, isSelected: false },
    { day: 14, activity: false, isToday: false, isSelected: false },
    { day: 15, activity: false, isToday: false, isSelected: false },
    { day: 16, activity: false, isToday: false, isSelected: false },
    { day: 17, activity: false, isToday: false, isSelected: false },
    { day: 18, activity: false, isToday: false, isSelected: false },
  ],
  timeSlots: [{ time: '17:00-20:00', isSelected: true }],
  defaultSelectedTime: '10月11日 17:00-20:00',
  peopleOptions: ['预约人数*', '1', '2'],
  sharePath: '/pages-sub/reservation/index',
}
```

### 额外页面状态

```typescript
const [reservationId, setReservationId] = useState('')
const [modificationCount, setModificationCount] = useState(0)
const [dataLoaded, setDataLoaded] = useState(false)
```

### 核心功能点

#### 1. 使用共享 Hook

```typescript
const {
  formData, setFormData, errors, dateList, timeSlots, setTimeSlots,
  isTimePickerShow, setLastName, setFirstName, handlePhoneInput,
  setPhone, setPeopleIndex, selectDate, selectTimeSlot, toggleAuth,
  openTimePicker, closeTimePicker, confirmTimePicker, validate,
} = useReservationForm(CHANGE_CONFIG)
```

#### 2. 页面参数获取

使用 Taro `useRouter()`（先用 context7 确认正确导入和用法）获取 `router.params.reservationId`。若无 reservationId 则 Toast 提示错误并 `Taro.navigateBack()`。

#### 3. 加载已有预约数据（useEffect 中调用）

```typescript
async function loadExistingReservation(id: string) {
  Taro.showLoading({ title: '加载中...' })
  try {
    const res = await reservationService.getReservation(id)
    if (res.code !== 200 || !res.data) {
      Taro.showToast({ title: '获取预约信息失败', icon: 'none' })
      Taro.navigateBack()
      return
    }
    const data = res.data
    // 解析姓名：第一个字符为姓，其余为名
    const lastName = data.name ? data.name.charAt(0) : ''
    const firstName = data.name ? data.name.substring(1) : ''

    // 匹配人数索引
    let peopleIndex = 0
    for (let i = 1; i < CHANGE_CONFIG.peopleOptions.length; i++) {
      if (CHANGE_CONFIG.peopleOptions[i] === data.people) {
        peopleIndex = i
        break
      }
    }

    // 回填表单数据
    setFormData(prev => ({
      ...prev,
      lastName,
      firstName,
      phone: data.phone || '',
      peopleIndex,
      selectedTime: data.date || '',
      auth: true,  // 修改预约时默认已勾选
    }))

    // 匹配已选时间段
    setTimeSlots(prev =>
      prev.map(slot => ({
        ...slot,
        isSelected: data.selectedTimes?.includes(slot.time) ?? false,
      }))
    )

    setModificationCount(data.submissionCount || 0)
    setDataLoaded(true)
  } catch {
    Taro.showToast({ title: '获取预约信息失败', icon: 'none' })
    Taro.navigateBack()
  } finally {
    Taro.hideLoading()
  }
}
```

#### 4. 提交流程（与 VIP 预约页的关键差异）

```typescript
async function handleSubmit() {
  // 1. 弹出确认对话框
  const { confirm } = await Taro.showModal({
    title: '确认修改',
    content: `预约信息只可以修改两次，您已修改${modificationCount}次，是否确认修改？`,
    confirmText: '确认修改',
    cancelText: '取消',
  })
  if (!confirm) return

  // 2. 检查登录
  const loginRes = await userService.checkLogin()
  if (loginRes.code !== 200) {
    Taro.showToast({ title: '请先登录', icon: 'none' })
    return
  }

  // 3. 表单验证（注意：不验证 auth，因为修改预约时默认已勾选）
  // 需要临时将 auth 设为 true 再验证，或者在 validate 前确保 auth 为 true
  if (!validate()) return

  // 4. 提交修改
  const fullName = formData.lastName + formData.firstName
  const selectedTimes = timeSlots.filter(s => s.isSelected).map(s => s.time)

  try {
    const res = await reservationService.updateReservation({
      reservationId,
      name: fullName,
      phone: formData.phone,
      people: CHANGE_CONFIG.peopleOptions[formData.peopleIndex],
      date: formData.selectedTime,
      selectedTimes,
    })

    if (res.code === 200) {
      setModificationCount(prev => prev + 1)
      Taro.showToast({ title: '修改成功', icon: 'success', duration: 2000 })
      setTimeout(() => {
        Taro.navigateTo({ url: buildSuccessUrl(res.data, CHANGE_CONFIG) })
      }, 2000)
    } else if (res.code === 403) {
      Taro.showToast({ title: '您已修改预约信息2次，无法再次修改', icon: 'none', duration: 3000 })
    } else {
      Taro.showToast({ title: (res as any).message || '修改失败', icon: 'none' })
    }
  } catch {
    Taro.showToast({ title: '修改失败', icon: 'none' })
  }
}
```

#### 5. buildSuccessUrl 函数

与 VIP 预约页相同的 `buildSuccessUrl` 函数（直接从 VIP 预约页复制）：

```typescript
function buildSuccessUrl(data: any, config: ActivityConfig): string {
  const params = new URLSearchParams({
    reservationId: data._id || data.reservationId || '',
    name: data.name || '',
    phone: data.phone || '',
    people: data.people || '',
    date: data.date || '',
    activityTitle: config.title,
    address: config.address,
    reservationTime: String(data.createTime || Date.now()),
  })
  return `/pages-sub/reservation-success/index?${params.toString()}`
}
```

#### 6. 分享

```typescript
useShareAppMessage(() => ({
  title: 'YZHENG品牌线下发布会',
  path: '/pages-sub/reservation/index',
}))
```

### UI 结构

与 VIP 预约页完全相同，仅以下差异：
- 提交按钮文字：「修改预约」
- 页面加载完成前（`dataLoaded === false`）可显示加载状态或空白（因为 `Taro.showLoading` 已覆盖）
- 无需一键获取手机号按钮（修改预约时手机号已回填，但保留该按钮也可以，旧代码中没有去掉）

**重要**：直接参考 `src/pages-sub/reservation/index.tsx` 的 JSX 结构，几乎 1:1 复制，只修改上述差异点。

### SCSS 文件

直接复制 `src/pages-sub/reservation/index.module.scss` 的内容。两个页面样式完全一致。

---

## 页面 B：预约成功页 `pages-sub/reservation-success/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 页面状态

```typescript
interface ReservationInfo {
  reservationId: string
  name: string
  phone: string
  people: string
  date: string
  activityTitle: string
  address: string
}

const [reservationInfo, setReservationInfo] = useState<ReservationInfo | null>(null)
const [qrCodeImage, setQrCodeImage] = useState('')
const [reservationTime, setReservationTime] = useState('')
const [isLoading, setIsLoading] = useState(true)
```

### 核心功能点

#### 1. 页面参数解析

使用 Taro `useRouter()` 获取 URL query 参数，在 `useEffect` 中解析：

```typescript
const router = useRouter()

useEffect(() => {
  const params = router.params
  if (!params.reservationId) {
    setIsLoading(false)
    return
  }
  setReservationInfo({
    reservationId: params.reservationId,
    name: decodeURIComponent(params.name || ''),
    phone: decodeURIComponent(params.phone || ''),
    people: decodeURIComponent(params.people || ''),
    date: decodeURIComponent(params.date || ''),
    activityTitle: decodeURIComponent(params.activityTitle || 'Y.ZHENG Fine Jewelry品牌发布会'),
    address: decodeURIComponent(params.address || '上海市静安区富民路89号巨富大厦18A'),
  })
  setReservationTime(decodeURIComponent(params.reservationTime || String(Date.now())))
  generateQRCodeImage(params.reservationId, decodeURIComponent(params.name || ''))
}, [])
```

#### 2. 二维码生成

```typescript
async function generateQRCodeImage(id: string, name: string) {
  setIsLoading(true)
  try {
    const content = JSON.stringify({ type: 'reservation', reservationId: id, name })
    const res = await reservationService.generateQRCode(content, 'reservation')
    if (res.code === 200 && res.data) {
      const qrSrc = res.data.fileId || res.data.qrCodeUrl || ''
      if (qrSrc) {
        setQrCodeImage(qrSrc)
      } else {
        Taro.showToast({ title: '二维码生成失败', icon: 'none' })
      }
    } else {
      Taro.showToast({ title: '二维码生成失败', icon: 'none' })
    }
  } catch {
    Taro.showToast({ title: '二维码生成失败', icon: 'none' })
  } finally {
    setIsLoading(false)
  }
}
```

#### 3. 操作按钮

```typescript
// 查看我的预约 — 滚动到页面顶部
function viewMyReservations() {
  Taro.pageScrollTo({ scrollTop: 0, duration: 300 })
}

// 修改预约信息 — redirectTo（替换当前页面）到修改预约页
function modifyReservation() {
  if (!reservationInfo) return
  Taro.redirectTo({
    url: `/pages-sub/reservation-change/index?reservationId=${reservationInfo.reservationId}`,
  })
}

// 返回首页 — navigateBack 到页面栈底
function goHome() {
  const pages = Taro.getCurrentPages()
  const delta = pages.length > 1 ? pages.length - 1 : 1
  Taro.navigateBack({ delta })
}
```

#### 4. 分享

```typescript
useShareAppMessage(() => ({
  title: 'Y.ZHENG Fine Jewelry品牌发布会',
  path: '/pages-sub/reservation/index',
}))
```

### UI 结构

```
TopBarWithBack
└── success-container（渐变背景，min-height: 100vh）
    ├── success-title「预约成功！」
    ├── success-desc「您的预约已确认，请截图保存此页面作为入场凭证」
    ├── reservation-card（白色圆角卡片，阴影）
    │   ├── card-title「预约详情」
    │   ├── info-item（活动名称）
    │   ├── info-item（预约人）
    │   ├── info-item（联系电话）
    │   ├── info-item（预约人数）
    │   ├── info-item（预约时间）
    │   ├── info-item（活动地址）
    │   └── info-item（预约编号）
    ├── qr-code-section（白色圆角卡片，阴影）
    │   ├── qr-title「入场二维码」
    │   ├── isLoading ? 加载文字 : 二维码图片区
    │   │   ├── qr-code-wrapper（400rpx × 400rpx）
    │   │   │   ├── qrCodeImage 存在 → Image 组件
    │   │   │   └── 否则 → 占位文字
    │   │   └── qr-desc「请截图保存此页面作为入场凭证，活动现场扫码入场」
    ├── action-buttons（操作按钮区）
    │   ├── button-row（两个并排按钮）
    │   │   ├── 「查看我的预约」secondary
    │   │   └── 「修改预约信息」secondary
    │   └── button-row（单个按钮）
    │       └── 「返回首页」primary
    └── tips（温馨提示卡片）
        ├── tips-title「温馨提示：」
        └── tips-content
            ├── • 请提前15分钟到达活动现场
            ├── • 入场时请出示此二维码
            └── • 如有疑问请联系客服
```

### 关键样式要点（1:1 还原旧代码 reservation_success.wxss）

- 页面容器：`min-height: 100vh; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 40rpx 30rpx; display: flex; flex-direction: column; align-items: center`
- 成功标题：`font-size: 48rpx; font-weight: bold; color: #2c3e50; margin-bottom: 20rpx; text-align: center`
- 成功描述：`font-size: 28rpx; color: #7f8c8d; text-align: center; margin-bottom: 40rpx; line-height: 1.5`
- 预约信息卡片：`width: 100%; background: #fff; border-radius: 20rpx; padding: 40rpx; margin-bottom: 40rpx; box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.1)`
- 卡片标题：`font-size: 32rpx; font-weight: bold; color: #2c3e50; margin-bottom: 30rpx; text-align: center; border-bottom: 2rpx solid #ecf0f1; padding-bottom: 20rpx`
- 信息行：`display: flex; margin-bottom: 20rpx; align-items: flex-start`
- 信息标签：`font-size: 28rpx; color: #7f8c8d; width: 160rpx; flex-shrink: 0`
- 信息值：`font-size: 28rpx; color: #2c3e50; flex: 1; word-break: break-all`
- 二维码区域：`width: 100%; background: #fff; border-radius: 20rpx; padding: 40rpx; margin-bottom: 40rpx; box-shadow: 0 8rpx 32rpx rgba(0,0,0,0.1); display: flex; flex-direction: column; align-items: center`
- 二维码标题：`font-size: 32rpx; font-weight: bold; color: #2c3e50; margin-bottom: 30rpx; text-align: center`
- 二维码容器：`width: 400rpx; height: 400rpx; background: #f8f9fa; border-radius: 20rpx; display: flex; align-items: center; justify-content: center; margin-bottom: 30rpx; border: 4rpx solid #e9ecef`
- 二维码图片：`width: 360rpx; height: 360rpx`
- 二维码说明中的加粗文字：`font-weight: bold; color: #ff8c00a8`
- 操作按钮区：`width: 100%; margin-bottom: 40rpx`
- 按钮行：`display: flex; gap: 20rpx; margin-bottom: 20rpx`
- 操作按钮：`flex: 1; border-radius: 50rpx; font-size: 28rpx; padding: 20rpx; border: none`
- primary 按钮：`background: #2c3e50; color: #fff`
- secondary 按钮：`background: #ecf0f1; color: #2c3e50`
- 温馨提示：`width: 100%; background: #fff; border-radius: 20rpx; padding: 30rpx; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.1)`
- 提示标题：`font-size: 28rpx; font-weight: bold; color: #2c3e50; margin-bottom: 20rpx`
- 提示内容：`font-size: 24rpx; color: #7f8c8d; line-height: 1.5`

### 注意：TopBarWithBack 偏移

页面使用 `navigationStyle: 'custom'`，内容需要 `marginTop` 偏移。参考已实现的 VIP 预约页面（`src/pages-sub/reservation/index.tsx`）中的 `topOffset` 计算方式。

但注意预约成功页的背景是渐变色，TopBarWithBack 需要透明背景效果。可以将 `marginTop` 应用到成功标题之前，或者将整个 `success-container` 设置 `paddingTop` 包含 topOffset。

---

## 产出

- 修改预约页 3 个文件（`pages-sub/reservation-change/` 下的 index.tsx + index.config.ts + index.module.scss）
- 预约成功页 3 个文件（`pages-sub/reservation-success/` 下的 index.tsx + index.config.ts + index.module.scss）

## 要求

- 修改预约页直接参考 `src/pages-sub/reservation/index.tsx` 的 JSX 结构，几乎 1:1 复制，只修改差异点
- 修改预约页的 SCSS 直接复制 VIP 预约页的 `index.module.scss`
- 使用已有的共享 Hook `useReservationForm`（从 `@/hooks/useReservationForm` 导入），调用前先读取确认接口
- 使用已有的 services（reservation.service / user.service），调用前先读取确认方法签名
- 修改预约页通过 `useRouter()` 获取 `reservationId` 参数（先用 context7 确认 `useRouter` 的正确导入和用法）
- 加载已有预约数据时：姓名解析用 `charAt(0)` 为姓、`substring(1)` 为名；人数匹配遍历 `peopleOptions`；时间段匹配用 `includes`
- 修改预约页提交前弹出 `Taro.showModal` 确认对话框，显示已修改次数
- 修改预约页调用 `updateReservation` 后，成功时本地 `modificationCount + 1`；服务端返回 403 时显示限制提示
- 修改预约页的 `auth` 默认为 `true`，表单中保留授权勾选 UI 但默认已勾选
- 预约成功页从 URL query 解析参数时使用 `decodeURIComponent`
- 预约成功页二维码生成：构建 JSON 内容 → 调用 `generateQRCode` → 优先使用 `fileId`，其次 `qrCodeUrl`
- 预约成功页三个操作按钮：「查看我的预约」用 `pageScrollTo`、「修改预约信息」用 `redirectTo`（替换当前页面）、「返回首页」用 `navigateBack` 到栈底
- 预约成功页使用 `useShareAppMessage` 配置分享
- 所有页面使用 TopBarWithBack + marginTop 偏移
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 完成后运行 `npm run build:weapp` 确认编译通过

---
