# 会话 24：Phase 08a VIP预约 + 普通预约 + 通用预约 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 08 的第一部分：VIP 预约页（reservation）、普通预约页（reservation-normal）、通用预约页（reservation-easy）。这三个页面共享几乎完全相同的表单逻辑，仅活动配置数据不同。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用前先读取 service 文件确认方法签名，避免参数传递错误。
4. 这三个页面都是分包页面（pages-sub/），不是 Tab 页，不需要 CustomTabBar 组件。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/08-reservation.md`（**完整阅读**，关注「旧代码摘要 → 1. VIP 预约页」「2. 普通预约页」「5. 通用预约页」部分，以及对应的「实现要求」部分和「共享类型与 Hook」部分）
3. `src/services/reservation.service.ts`（预约服务 — **必读**，理解 addReservation / listReservations 方法签名）
4. `src/services/user.service.ts`（用户服务 — checkLogin / loginEasy / bindPhone）
5. `src/types/reservation.ts`（Reservation 类型定义）
6. `src/utils/validate.ts`（isValidPhone / isNotEmpty）
7. `src/hooks/useAuth.ts`（ensureLogin）

## 参考旧代码（必读，1:1 还原 UI）

**VIP 预约页：**
- `legacy_ro/yz-legacy-code/pages/reservation/reservation.wxml`
- `legacy_ro/yz-legacy-code/pages/reservation/reservation.wxss`
- `legacy_ro/yz-legacy-code/pages/reservation/reservation.js`

**普通预约页：**
- `legacy_ro/yz-legacy-code/pages/reservation_normal/reservation_normal.wxml`
- `legacy_ro/yz-legacy-code/pages/reservation_normal/reservation_normal.wxss`
- `legacy_ro/yz-legacy-code/pages/reservation_normal/reservation_normal.js`

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。通用预约页无旧代码，样式复用 VIP 预约页。

## 前置依赖

Sessions 01-23 已完成。预约服务和用户服务已就绪。

### 已有的关键基础设施

- `src/services/reservation.service.ts`:
  - `addReservation({ name, phone, people, date, selectedTimes })` — 提交预约（云函数 `reservation-easy` action: `add`）
  - `listReservations()` — 获取预约列表（用于防重复检查）
- `src/services/user.service.ts` — `checkLogin()`, `loginEasy()`, `bindPhone(code)`
- `src/types/reservation.ts` — `Reservation`（`_id, userId, name, phone, people, date, selectedTimes, submissionCount`）
- `src/utils/validate.ts` — `isValidPhone()`, `isNotEmpty()`
- `src/hooks/useAuth.ts` — `ensureLogin()`
- `src/stores/useUserStore.ts` — `login()`
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏
- `src/components/FloatPopup/` + `src/components/FloatBtn/` — 浮动咨询

---

## 代码复用策略

VIP、普通、通用三个页面的表单逻辑高度一致。为避免重复代码，请创建一个共享 Hook：

### 共享 Hook — `src/hooks/useReservationForm.ts`

```typescript
/** 日期网格项 */
interface DateItem {
  day: number
  activity: boolean   // 该日期是否有活动可选
  isToday: boolean
  isSelected: boolean
}

/** 时间段项 */
interface TimeSlot {
  time: string
  isSelected: boolean
}

/** 活动配置 */
interface ActivityConfig {
  title: string
  address: string
  timeText: string
  bannerImage: string
  dateList: DateItem[]
  timeSlots: TimeSlot[]
  defaultSelectedTime: string
  peopleOptions: string[]
  sharePath: string
}

/** 表单错误状态 */
interface FormErrors {
  lastName: boolean
  firstName: boolean
  phone: boolean
  people: boolean
  time: boolean
  auth: boolean
}
```

Hook 返回值：
- `formData` — `{ lastName, firstName, phone, peopleIndex, selectedTime, auth }`
- `errors` — FormErrors
- `dateList` / `timeSlots` — 可变状态（选中态）
- `isTimePickerShow` — 时间选择弹窗显示状态
- handlers: `setLastName`, `setFirstName`, `handlePhoneInput`, `setPeopleIndex`, `selectDate`, `selectTimeSlot`, `toggleAuth`, `openTimePicker`, `closeTimePicker`, `confirmTimePicker`
- `validate()` → boolean
- `setFormData` — 用于修改预约页回填数据

这个 Hook 封装所有表单状态管理、输入处理、验证逻辑。三个页面只需传入不同的 `ActivityConfig` 即可。

---

## 页面 A：VIP 预约页 `pages-sub/reservation/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 活动配置常量

```typescript
const VIP_CONFIG: ActivityConfig = {
  title: 'Y.ZHENG Fine Jewelry品牌发布会VIP预览',
  address: '上海市静安区富民路89号巨富大厦18A',
  timeText: '2025/10/11 17:00-20:00',
  bannerImage: '', // 从 legacy 复制横幅图片，或使用占位色
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
  timeSlots: [
    { time: '17:00-20:00', isSelected: true },
  ],
  defaultSelectedTime: '10月11日 17:00-20:00',
  peopleOptions: ['预约人数*', '1', '2'],
  sharePath: '/pages-sub/reservation/index',
}
```

### 核心功能点

#### 1. 使用共享 Hook

```typescript
const {
  formData, errors, dateList, timeSlots,
  isTimePickerShow, setLastName, setFirstName,
  handlePhoneInput, setPeopleIndex, selectDate,
  selectTimeSlot, toggleAuth, openTimePicker,
  closeTimePicker, confirmTimePicker, validate,
} = useReservationForm(VIP_CONFIG)
```

#### 2. 一键获取手机号

Taro `<Button openType="getPhoneNumber">` → 成功时调用 `userService.bindPhone(e.detail.code)` → 返回手机号填入表单。

#### 3. 人数选择

Taro `<Picker mode="selector" range={VIP_CONFIG.peopleOptions}>` → `onChange` 回调 `e.detail.value` 为索引。

#### 4. 自定义时间选择弹窗

底部弹出弹窗（用 NutUI `Popup` position="bottom" 或自定义实现）：
- 日期网格：`grid-template-columns: repeat(4, 1fr)`，仅 `activity: true` 的日期可点击，单选
- 时间段列表：纵向排列，多选（点击切换 `isSelected`）
- 确认按钮：拼接 `selectedTime` 文本（格式 `"X月X日 HH:MM-HH:MM"`），关闭弹窗

#### 5. 提交流程

```
1. 检查登录 → userService.checkLogin()
   未登录 → showModal 确认 → userStore.login()
2. 检查重复预约 → reservationService.listReservations()
   已有预约 → 直接跳转成功页（携带已有预约信息）
3. 表单验证 → validate()
4. 提交 → reservationService.addReservation({
     name: lastName + firstName,
     phone, people: peopleOptions[peopleIndex],
     date: selectedTime,
     selectedTimes: timeSlots.filter(s => s.isSelected).map(s => s.time),
   })
5. 成功 → Toast + 延迟 2s → navigateTo 成功页
   失败 → Toast 提示
```

#### 6. 跳转成功页

构建 URL query 参数（所有值需 `encodeURIComponent`）：

```typescript
function buildSuccessUrl(data: any): string {
  const params = new URLSearchParams({
    reservationId: data._id || data.reservationId || '',
    name: data.name || '',
    phone: data.phone || '',
    people: data.people || '',
    date: data.date || '',
    activityTitle: VIP_CONFIG.title,
    address: VIP_CONFIG.address,
    reservationTime: String(data.createTime || Date.now()),
  })
  return `/pages-sub/reservation-success/index?${params.toString()}`
}
```

#### 7. 分享

使用 Taro `useShareAppMessage`（先用 context7 确认正确导入和用法）：
```typescript
useShareAppMessage(() => ({
  title: VIP_CONFIG.title,
  path: VIP_CONFIG.sharePath,
}))
```

### UI 结构

```
TopBarWithBack
└── page-container（min-height: 100vh, bg: #fff）
    ├── banner-image（顶部横幅，25vh 高度，cover 模式）
    ├── activity-info（活动信息区）
    │   ├── activity-title（标题）
    │   ├── info-row（地址图标 + 地址文字）
    │   ├── info-row（时间图标 + 时间文字）
    │   └── share-btn（分享按钮，使用 Button open-type="share"）
    ├── form-section（表单区）
    │   ├── name-row（姓 + 名，两列布局）
    │   ├── phone-row（电话输入 + 一键获取按钮）
    │   ├── people-picker（人数 Picker）
    │   ├── time-trigger（时间选择触发按钮，点击打开弹窗）
    │   ├── auth-row（营销授权勾选）
    │   └── submit-btn「立即预约」
    ├── time-picker-popup（自定义时间选择弹窗）
    │   ├── date-grid（日期网格 4 列）
    │   ├── time-slots（时间段列表）
    │   └── confirm-btn「确认」
    ├── FloatBtn
    └── FloatPopup
```

### 关键样式要点

- 横幅图片：`width: 100%; height: 25vh; object-fit: cover`
- 活动信息区：`padding: 30rpx 40rpx`
- 活动标题：`font-size: 36rpx; font-weight: bold; color: #333; margin-bottom: 20rpx`
- 地址/时间行：`display: flex; align-items: center; gap: 12rpx; margin-bottom: 16rpx; font-size: 28rpx; color: #666`
- 输入框：`width: 100%; height: 88rpx; border: 1rpx solid #ddd; border-radius: 8rpx; padding: 0 20rpx; font-size: 28rpx; margin-bottom: 24rpx`
- 错误态输入框：`border-color: #CE1616`
- 电话行：`display: flex; gap: 16rpx`，一键获取按钮 `flex-shrink: 0; background: #000; color: #fff; border-radius: 8rpx; padding: 0 24rpx; font-size: 26rpx`
- 提交按钮：`width: 100%; height: 96rpx; background: #000; color: #fff; font-size: 32rpx; font-weight: 600; border-radius: 8rpx; margin-top: 40rpx`
- 时间弹窗：`position: fixed; bottom: 0; width: 100%; background: #fff; border-radius: 20rpx 20rpx 0 0; padding: 40rpx; max-height: 70vh`
- 日期网格：`display: grid; grid-template-columns: repeat(4, 1fr); gap: 16rpx`
- 日期项（可选）：`height: 80rpx; border-radius: 8rpx; background: #f5f5f5; color: #333; 居中`
- 日期项（不可选）：`opacity: 0.5; color: #ccc`
- 日期项（选中）：`background: #000; color: #fff`
- 时间段项：`height: 80rpx; border: 1rpx solid #ddd; border-radius: 8rpx; 居中`
- 时间段项（选中）：`border-color: #000; background: #000; color: #fff`
- 详细样式参考旧代码 `reservation.wxss` 1:1 还原

### 横幅图片资源

旧代码引用 `../../Image/reservation/top_image.jpg`。在 `legacy_ro/yz-legacy-code/Image/reservation/` 下查找。如果找到，复制到 `src/assets/images/reservation/top_image.jpg`（需要在 `src/assets/images/` 下创建 `reservation` 目录）。如果找不到，使用渐变色背景 `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` 替代，不要卡在找图片上。

### 注意：TopBarWithBack 偏移

页面使用 `navigationStyle: 'custom'`，内容需要 `marginTop` 偏移。参考已实现的 product-detail 页面。

---

## 页面 B：普通预约页 `pages-sub/reservation-normal/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 与 VIP 预约页的差异

**仅活动配置不同，其余逻辑、UI、样式完全相同。**

```typescript
const NORMAL_CONFIG: ActivityConfig = {
  title: 'Y.ZHENG Fine Jewelry品牌发布会',
  address: '上海市静安区富民路89号巨富大厦18A',
  timeText: '2025/10/12 - 2025/10/18',
  bannerImage: '', // 同 VIP 页横幅图片
  dateList: [
    { day: 11, activity: false, isToday: false, isSelected: false },
    { day: 12, activity: true, isToday: false, isSelected: false },
    { day: 13, activity: true, isToday: false, isSelected: false },
    { day: 14, activity: true, isToday: false, isSelected: false },
    { day: 15, activity: true, isToday: false, isSelected: false },
    { day: 16, activity: true, isToday: false, isSelected: false },
    { day: 17, activity: true, isToday: false, isSelected: false },
    { day: 18, activity: true, isToday: false, isSelected: false },
  ],
  timeSlots: [
    { time: '14:00-15:00', isSelected: false },
    { time: '15:00-17:00', isSelected: false },
    { time: '17:00-19:00', isSelected: false },
  ],
  defaultSelectedTime: '',
  peopleOptions: ['预约人数*', '1', '2'],
  sharePath: '/pages-sub/reservation-normal/index',
}
```

关键差异：
- 标题无"VIP预览"后缀
- 时间范围是 10/12-10/18（非单日）
- `dateList` 中 11 日不可选，12-18 日可选，默认无选中
- `timeSlots` 有 3 个时间段，默认均未选中
- `defaultSelectedTime` 为空（VIP 有默认值）

页面组件直接复用 VIP 页面的 JSX 结构，只传入 `NORMAL_CONFIG`。SCSS 文件内容与 VIP 页面一致。

---

## 页面 C：通用预约页 `pages-sub/reservation-easy/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 与 VIP/普通预约页的差异

活动配置不再硬编码，而是从 URL query 参数动态构建。

#### 页面参数解析

```typescript
useLoad((params) => {
  const config: ActivityConfig = {
    title: decodeURIComponent(params.activityTitle || 'Y.ZHENG Fine Jewelry'),
    address: decodeURIComponent(params.activityAddress || ''),
    timeText: decodeURIComponent(params.activityTime || ''),
    bannerImage: decodeURIComponent(params.bannerImage || ''),
    dateList: buildDefaultDateList(),
    timeSlots: buildDefaultTimeSlots(),
    defaultSelectedTime: '',
    peopleOptions: ['预约人数*', '1', '2'],
    sharePath: '/pages-sub/reservation-easy/index',
  }
  setActivityConfig(config)
})
```

#### 默认日期/时间段构建

```typescript
/** 构建未来 7 天的日期列表 */
function buildDefaultDateList(): DateItem[] {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return {
      day: d.getDate(),
      activity: true,
      isToday: i === 0,
      isSelected: false,
    }
  })
}

/** 构建默认时间段 */
function buildDefaultTimeSlots(): TimeSlot[] {
  return [
    { time: '10:00-12:00', isSelected: false },
    { time: '14:00-16:00', isSelected: false },
    { time: '16:00-18:00', isSelected: false },
  ]
}
```

其余表单逻辑、验证、提交流程与 VIP 页面完全相同，使用动态 `activityConfig`。SCSS 文件内容与 VIP 页面一致。

---

## 补充 Service 层

在 `src/services/reservation.service.ts` 中补充二维码生成函数（session-25 预约成功页需要）：

```typescript
/** 生成预约二维码 */
export function generateQRCode(
  content: string,
  type: string
): Promise<CloudResponse<{ fileId?: string; qrCodeUrl?: string }>> {
  return callCloudFunction<{ fileId?: string; qrCodeUrl?: string }>('generate-qrcode', {
    content,
    type,
  })
}
```

---

## 产出

- 共享 Hook 1 个文件：`src/hooks/useReservationForm.ts`
- VIP 预约页 3 个文件（`pages-sub/reservation/` 下的 index.tsx + index.config.ts + index.module.scss）
- 普通预约页 3 个文件（`pages-sub/reservation-normal/` 下）
- 通用预约页 3 个文件（`pages-sub/reservation-easy/` 下）
- 补充 `src/services/reservation.service.ts`（添加 `generateQRCode` 函数）
- 如有缺失的图片资源（横幅图、地址/时间图标），从 legacy 复制到 `src/assets/`

## 要求

- 创建共享 Hook `useReservationForm.ts` 封装表单状态、输入处理、验证逻辑，三个页面复用
- 使用已有的 services（reservation.service / user.service），调用前先读取确认方法签名
- 使用已有的 validate 工具函数
- 使用已有的组件：TopBarWithBack、FloatBtn、FloatPopup
- 一键获取手机号使用 Taro `<Button openType="getPhoneNumber">`
- 人数选择使用 Taro `<Picker mode="selector">`
- 时间选择弹窗使用 NutUI `Popup` position="bottom" 或自定义实现
- 提交前先检查登录、再检查重复预约、再验证表单
- 跳转成功页时 URL query 参数需要 `encodeURIComponent`
- 分享功能使用 Taro `useShareAppMessage`（先用 context7 确认用法）
- 验证失败时对应字段红色边框（`border-color: #CE1616`）+ Toast 提示
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 完成后运行 `npm run build:weapp` 确认编译通过

---
