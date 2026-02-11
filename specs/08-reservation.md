# Phase 08: 预约系统（5 个页面）

## 目标

实现预约系统的 5 个页面，覆盖 VIP 预约、普通预约、修改预约、预约成功、通用预约完整流程。所有页面均为 React 函数组件 + SCSS Modules，遵循 TypeScript strict 模式。

## 前置依赖

- Phase 02 完成（`types/reservation.ts`、`services/reservation.service.ts`、`services/cloud.ts`、`utils/validate.ts`）
- Phase 03 完成（`stores/useUserStore.ts`、`hooks/useAuth.ts`）
- Phase 04 完成（`components/TopBarWithBack`、`components/FloatPopup`、`components/FloatBtn`）

## 云函数背景

项目有三套独立的预约云函数：

| 云函数 | 集合 | Actions | 说明 |
|--------|------|---------|------|
| `reservation-easy` | `reservation-easy` | `add`、`list`、`get`、`delete` | 通用预约，按 openId 防重复，单用户只能有一条预约 |
| `reservation-change` | `reservation-easy`（同一集合） | `get`、`update` | 修改预约，`submissionCount >= 2` 时返回 403 禁止修改 |
| `manage-reservation` | `Reservations`（云开发数据模型） | `add`、`edit`、`delete`、`getList`、`getOne` | 活动预约，关联 Activities 模型，验证活动状态和时间窗口 |

### `reservation-easy` 云函数参数格式

**add：**
```
请求: { action: 'add', name, phone, people, date, selectedTimes, submissionCount: 0 }
响应: { code: 200, message: '预约成功', data: { _id, openId, name, phone, people, date, selectedTimes, submissionCount, createTime, status } }
错误: { code: 400, message: '您已预约过，请勿重复预约' }
```

**list：**
```
请求: { action: 'list' }
响应: { code: 200, message: '获取预约列表成功', data: Reservation[] }
```

**get：**
```
请求: { action: 'get', reservationId }
响应: { code: 200, data: Reservation }
```

**delete：**
```
请求: { action: 'delete', reservationId }
响应: { code: 200, message: '预约删除成功' }
```

### `reservation-change` 云函数参数格式

**get：**
```
请求: { action: 'get', reservationId }
响应: { code: 200, data: { _id, name, phone, people, date, selectedTimes, submissionCount, ... } }
```

**update：**
```
请求: { action: 'update', reservationId, name, phone, people, date, selectedTimes }
响应成功: { code: 200, message: '修改成功', data: { ...updatedFields, submissionCount: N+1 } }
响应限制: { code: 403, message: '您已修改预约信息2次，无法再次修改' }
```

### `manage-reservation` 云函数参数格式

**add：**
```
请求: { action: 'add', data: { _activityId, reservationData: { _userId, title, phone, people, arriveTime, leaveTime } } }
响应: { code: 200, message: '活动预约成功', data: newReservation }
错误: { code: 400, message: '您已经预约过该活动' } | { code: 404, message: '活动不存在或已结束' }
```

**getList：**
```
请求: { action: 'getList', data: { _userId, page, pageSize, _activityId? } }
响应: { code: 200, data: { items: [], total, page, pageSize } }
```

---

## 旧代码摘要

### 1. VIP 预约页（`pages/reservation/reservation`）

**页面状态字段：**
- `image`: 顶部横幅图片路径（`../../Image/reservation/top_image.jpg`）
- `title`: 活动标题（`"Y.ZHENG Fine Jewelry品牌发布会VIP预览"`）
- `address_text`: 活动地址（`"上海市静安区富民路89号巨富大厦18A"`）
- `time_text`: 活动时间（`"2025/10/11 17:00-20:00"`）
- `lastName` / `firstName`: 姓/名输入
- `phone`: 联系电话
- `people_num_List`: 人数选项数组 `['预约人数*', '1', '2']`
- `people_num_Index`: 当前选中人数索引（默认 0 = 未选择）
- `auth`: 营销授权勾选状态（默认 false）
- `auth_text`: 授权文本（营销信息接收同意）
- `isTimePickerShow`: 自定义时间选择弹窗显示状态
- `selectedTime`: 已选时间文本（默认 `'10月11日 17:00-20:00'`）
- `date_list`: 日期网格数据 `{ day, activity, isToday, isSelected }[]`（VIP 版仅 11 日可选）
- `timeSlots`: 时间段数据 `{ time, isSelected }[]`（VIP 版仅 `'17:00-20:00'` 一个选项）
- `isPopupShow`: FloatPopup 在线咨询弹窗状态
- 各字段错误状态：`not_correct_lastName`、`not_correct_firstName`、`not_correct_phone`、`not_correct_people_num`、`not_correct_time`、`not_correct_auth`

**生命周期逻辑：**
- `onLoad`: 空（无参数处理）
- `onReady`: 空
- `onShareAppMessage`: 返回分享标题和路径

**云函数调用：**
1. `login-easy`（action: `checkLogin`）— 提交前检查登录状态
2. `login-easy`（action: `login`）— 未登录时通过 `wx.getUserProfile` 获取信息后登录
3. `bindPhoneNumber`（data: `{ code }`）— 一键获取手机号
4. `reservation-easy`（action: `list`）— 提交前检查是否已有预约（防重复）
5. `reservation-easy`（action: `add`）— 提交预约

**表单字段和验证规则：**
| 字段 | 类型 | 必填 | 验证规则 |
|------|------|------|----------|
| 姓（lastName） | text input | 是 | `trim() !== ''` |
| 名（firstName） | text input | 是 | `trim() !== ''` |
| 联系电话（phone） | number input | 是 | `/^1[3-9]\d{9}$/`，输入时自动过滤非数字并截断 11 位 |
| 预约人数（people） | Picker selector | 是 | `people_num_Index !== 0`（不能是占位符） |
| 预约时间（selectedTime） | 自定义弹窗 | 是 | 不能为空或等于 `'预约时间*'` |
| 营销授权（auth） | checkbox | 是 | 必须为 true |

**验证失败行为：** 对应字段添加 `not-correct` CSS 类（红色边框 `#CE1616`），显示 `showToast` 错误提示。

**提交流程：**
1. 检查登录状态（`login-easy` checkLogin），未登录则弹出 `showModal` 授权确认
2. 调用 `reservation-easy` list 检查是否已有预约，若有则直接跳转成功页
3. 表单验证（姓、名、电话、人数、时间、授权）
4. 拼接 `fullName = lastName + firstName`
5. 调用 `reservation-easy` add 提交
6. 成功后 `showToast` + 延迟 2s 跳转到 `reservation_success` 页面，携带 query 参数：`reservationId`、`name`、`phone`、`people`、`date`、`activityTitle`、`address`、`reservationTime`

**UI 结构概要：**
- 顶部横幅图片（25vh 高度，cover 模式）
- 活动信息区（标题、地址图标+文字、时间图标+文字、分享按钮）
- 表单区（姓、名、电话+一键获取按钮、人数 Picker、时间选择触发按钮、授权勾选、提交按钮）
- 自定义时间选择弹窗（底部弹出，包含日期网格+时间段列表+确认按钮）
- FloatPopup 在线咨询弹窗

**页面间数据传递：**
- 输出：跳转 `reservation_success` 时通过 URL query 传递所有预约信息

### 2. 普通预约页（`pages/reservation_normal/reservation_normal`）

**与 VIP 预约页的差异：**
- 活动标题：`"Y.ZHENG Fine Jewelry品牌发布会"`（无"VIP预览"后缀）
- 活动时间：`"2025/10/12 - 2025/10/18"`（日期范围而非单日）
- `date_list`：11 日不可选（`activity: false`），12-18 日均可选（`activity: true`），默认无选中
- `timeSlots`：3 个时间段 `['14:00-15:00', '15:00-17:00', '17:00-19:00']`，默认均未选中
- `selectedTime`：默认为空字符串（VIP 版有默认值）
- 分享路径指向 `reservation_normal` 而非 `reservation`

**其余逻辑完全相同：** 状态字段、表单验证规则、云函数调用、提交流程、UI 结构均与 VIP 预约页一致。两个页面共享同一套表单逻辑，仅活动配置数据不同。

**页面状态字段（仅列出差异）：**
- `title`: `"Y.ZHENG Fine Jewelry品牌发布会"`
- `time_text`: `"2025/10/12 - 2025/10/18"`
- `date_list`: 8 项，day 11-18，其中 12-18 的 `activity: true`
- `timeSlots`: 3 项，均 `isSelected: false`
- `selectedTime`: `''`（空）

**云函数调用：** 与 VIP 预约页完全相同（`login-easy`、`bindPhoneNumber`、`reservation-easy`）。

**UI 结构概要：** 与 VIP 预约页完全相同。

**页面间数据传递：** 与 VIP 预约页完全相同。

### 3. 修改预约页（`pages/reservation-changge/reservation-changge`）

**页面状态字段：**
- 与 VIP 预约页相同的表单字段（lastName、firstName、phone、people_num_List/Index、selectedTime 等）
- `auth`: 默认 `true`（修改预约时默认已勾选）
- `reservationId`: 当前预约 ID（从页面参数获取）
- `modificationCount`: 已修改次数（从服务端加载）
- `date_list` / `timeSlots`: 与 VIP 预约页相同的配置（VIP 活动的日期和时间段）

**生命周期逻辑：**
- `onLoad(options)`: 从 `options.reservationId` 获取预约 ID，调用 `loadExistingReservation()` 加载已有预约数据。若无 reservationId 则提示错误并返回上一页。

**云函数调用：**
1. `reservation-change`（action: `get`）— `onLoad` 时加载已有预约信息
2. `login-easy`（action: `checkLogin`）— 提交前检查登录（与预约页相同）
3. `reservation-change`（action: `update`）— 提交修改

**加载已有预约数据流程（`loadExistingReservation`）：**
1. 调用 `reservation-change` get 获取预约详情
2. 解析姓名：第一个字符为姓，其余为名（`lastName = name.charAt(0)`，`firstName = name.substring(1)`）
3. 匹配人数索引：遍历 `people_num_List` 找到对应值的索引
4. 匹配已选时间段：将 `reservationData.selectedTimes` 与 `timeSlots` 比对设置 `isSelected`
5. 设置 `modificationCount = reservationData.submissionCount || 0`

**表单字段和验证规则：** 与 VIP 预约页相同（姓、名、电话、人数、时间），但授权勾选不再验证（默认已勾选）。

**提交流程（修改预约）：**
1. 弹出 `Taro.showModal` 确认：`"预约信息只可以修改两次，您已修改${modificationCount}次，是否确认修改？"`
2. 用户确认后执行 `performModification()`
3. 前端表单验证（姓、名、电话、人数、时间）
4. 拼接 `fullName = lastName + firstName`
5. 调用 `reservation-change` update，携带 `{ reservationId, name, phone, people, date, selectedTimes }`
6. 成功后更新本地 `modificationCount + 1`，`showToast` + 延迟 2s 跳转到 `reservation_success`
7. 若服务端返回 403（已修改 2 次），显示错误提示

**UI 结构概要：** 与 VIP 预约页几乎相同，但提交按钮文字为"修改预约"而非"立即预约"。

**页面间数据传递：**
- 输入：从 `reservation_success` 页面通过 URL query 接收 `reservationId`
- 输出：跳转 `reservation_success` 时通过 URL query 传递更新后的预约信息

### 4. 预约成功页（`pages/reservation_success/reservation_success`）

**页面状态字段：**
- `reservationInfo`: 预约详情对象 `{ reservationId, name, phone, people, date, activityTitle, address }`
- `qrCodeData`: 二维码内容 JSON 字符串
- `qrCodeImage`: 二维码图片路径（云存储 fileId 或 HTTP URL）
- `reservationTime`: 预约时间戳
- `isLoading`: 二维码加载状态（默认 true）

**生命周期逻辑：**
- `onLoad(options)`: 从 URL query 参数解析预约信息，设置 `reservationInfo` 和 `reservationTime`，然后调用 `generateQRCode()`
- `onShareAppMessage`: 返回分享标题和路径（指向预约页）

**云函数调用：**
1. `generate-qrcode`（data: `{ content, type: 'reservation' }`）— 生成入场二维码

**二维码生成流程：**
1. 构建二维码内容：`JSON.stringify({ type: 'reservation', reservationId, name })`（仅包含最少信息）
2. 调用 `generate-qrcode` 云函数
3. 从返回值提取 `fileId` 或 `qrCodeUrl`
4. 设置 `qrCodeImage` 并关闭 loading 状态
5. 失败时显示 `showToast` 提示

**操作按钮：**
- 「查看我的预约」— 滚动到页面顶部（`wx.pageScrollTo({ scrollTop: 0 })`）
- 「修改预约信息」— `wx.redirectTo` 跳转到 `reservation-changge` 页面，携带 `reservationId`
- 「返回首页」— 计算页面栈深度，`wx.navigateBack({ delta })` 返回到栈底

**UI 结构概要：**
- 渐变背景（`linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)`）
- 成功标题"预约成功！"+ 描述文字
- 预约详情卡片（白色圆角卡片，阴影，包含活动名称、预约人、电话、人数、时间、地址、编号）
- 二维码区域（白色圆角卡片，400rpx × 400rpx 二维码图片，加载状态/占位符）
- 操作按钮区（两行：查看预约+修改预约 并排，返回首页 独占一行）
- 温馨提示区（白色圆角卡片，3 条提示文字）

**页面间数据传递：**
- 输入：从 `reservation` 或 `reservation-changge` 页面通过 URL query 接收 `reservationId`、`name`、`phone`、`people`、`date`、`activityTitle`、`address`、`reservationTime`
- 输出：跳转 `reservation-changge` 时通过 URL query 传递 `reservationId`

### 5. 通用预约页（无独立旧页面，逻辑提取自 reservation 相关页面）

**背景：** 旧代码中 VIP 预约和普通预约是两个几乎完全相同的页面，仅活动配置数据不同。新项目将通用预约逻辑抽取为独立页面 `reservation-easy`，通过页面参数动态配置活动信息，避免代码重复。

**设计思路：**
- 接收活动配置参数（标题、地址、时间、日期列表、时间段列表）
- 复用与 VIP/普通预约相同的表单逻辑和验证规则
- 使用 `reservation-easy` 云函数进行预约提交
- 作为未来新活动预约的通用入口

**页面参数（通过 URL query 或页面间传参）：**
- `activityTitle`: 活动标题
- `activityAddress`: 活动地址
- `activityTime`: 活动时间描述
- `bannerImage`: 顶部横幅图片（可选，有默认值）

**云函数调用：** 与 VIP/普通预约页相同（`login-easy`、`bindPhoneNumber`、`reservation-easy`）。

**页面间数据传递：**
- 输入：从其他页面通过 URL query 接收活动配置参数
- 输出：跳转 `reservation_success` 时通过 URL query 传递预约信息

## 补充 Service 层

`specs/02-foundation.md` 中的 `reservation.service.ts` 仅覆盖了 `reservation-easy` 和 `reservation-change` 两个云函数。本 Phase 需要补充以下函数：

```typescript
// 补充到 src/services/reservation.service.ts

/** 生成预约二维码 */
export async function generateQRCode(content: string, type: string): Promise<CloudResponse<{ fileId?: string; qrCodeUrl?: string }>>
// 云函数: generate-qrcode, 参数: { content, type }
```

> **注意**：`manage-reservation` 云函数当前未被前端页面直接使用（VIP/普通预约均使用 `reservation-easy`），暂不封装。若后续需要活动预约管理功能再补充。

## 产出文件清单

```
src/
├── pages-sub/
│   ├── reservation/
│   │   ├── index.tsx
│   │   ├── index.config.ts
│   │   └── index.module.scss
│   ├── reservation-normal/
│   │   ├── index.tsx
│   │   ├── index.config.ts
│   │   └── index.module.scss
│   ├── reservation-change/
│   │   ├── index.tsx
│   │   ├── index.config.ts
│   │   └── index.module.scss
│   ├── reservation-success/
│   │   ├── index.tsx
│   │   ├── index.config.ts
│   │   └── index.module.scss
│   └── reservation-easy/
│       ├── index.tsx
│       ├── index.config.ts
│       └── index.module.scss
└── services/
    └── reservation.service.ts  （补充 generateQRCode）
```

## 共享类型与 Hook

VIP 预约、普通预约、修改预约、通用预约四个页面共享相同的表单逻辑。为避免重复，抽取以下共享类型和自定义 Hook。

### 共享类型 — 定义在各页面文件内部（无需独立文件）

```typescript
/** 日期网格项 */
interface DateItem {
  day: number
  /** 该日期是否有活动可选 */
  activity: boolean
  isToday: boolean
  isSelected: boolean
}

/** 时间段项 */
interface TimeSlot {
  time: string
  isSelected: boolean
}

/** 预约表单数据 */
interface ReservationFormData {
  lastName: string
  firstName: string
  phone: string
  /** 人数选项索引（0 = 未选择占位符） */
  peopleIndex: number
  /** 已选时间文本（用于显示） */
  selectedTime: string
  /** 营销授权勾选 */
  auth: boolean
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

/** 活动配置（区分 VIP / 普通 / 通用） */
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
```

### 共享 Hook — `useReservationForm`（定义在 VIP 预约页文件内，其他页面复制或提取）

> **说明**：由于 VIP、普通、修改、通用四个页面的表单逻辑高度一致，建议将表单状态管理和验证逻辑封装为页面内部的自定义 Hook `useReservationForm`。若后续需要跨页面复用，可提取到 `src/hooks/useReservationForm.ts`。

```typescript
function useReservationForm(config: ActivityConfig) {
  // 返回：formData, errors, dateList, timeSlots,
  //       handlers (setLastName, setFirstName, setPhone, setPeopleIndex,
  //                 selectDate, selectTimeSlot, toggleAuth, confirmTimePicker),
  //       validate() → boolean
}
```

## 实现要求

### 1. VIP 预约页 — `src/pages-sub/reservation/index.tsx`

**页面配置 — `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: 'VIP预约',
})
```

**依赖：**
- `hooks/useAuth.ts`（`ensureLogin`）
- `hooks/useSystemInfo.ts`（`statusBarHeight`）
- `services/reservation.service.ts`（`addReservation`、`listReservations`）
- `services/user.service.ts`（`checkLogin`、`loginEasy`、`bindPhone`）
- `utils/validate.ts`（`isValidPhone`、`isNotEmpty`）
- `components/TopBarWithBack`
- `components/FloatPopup`
- `components/FloatBtn`

**活动配置常量（组件内部）：**

```typescript
const VIP_CONFIG: ActivityConfig = {
  title: 'Y.ZHENG Fine Jewelry品牌发布会VIP预览',
  address: '上海市静安区富民路89号巨富大厦18A',
  timeText: '2025/10/11 17:00-20:00',
  bannerImage: '/assets/images/reservation/top_image.jpg',
  dateList: [
    { day: 11, activity: true, isToday: false, isSelected: true },
    { day: 12, activity: false, isToday: false, isSelected: false },
    // ... 13-18 均 activity: false
  ],
  timeSlots: [
    { time: '17:00-20:00', isSelected: true },
  ],
  defaultSelectedTime: '10月11日 17:00-20:00',
  peopleOptions: ['预约人数*', '1', '2'],
  sharePath: '/pages-sub/reservation/index',
}
```

**核心逻辑：**

1. **页面状态**：使用 `useState` 管理 `formData: ReservationFormData`、`errors: FormErrors`、`dateList: DateItem[]`、`timeSlots: TimeSlot[]`、`isTimePickerShow: boolean`、`isPopupShow: boolean`
2. **电话输入过滤**：`onInput` 时自动过滤非数字字符并截断为 11 位（`value.replace(/\D/g, '').slice(0, 11)`）
3. **一键获取手机号**：Taro `Button` 的 `openType="getPhoneNumber"`，成功后调用 `userService.bindPhone(e.detail.code)` 获取手机号并填入表单
4. **人数选择**：使用 Taro `Picker` 组件，`mode="selector"`，`range={peopleOptions}`，`onChange` 回调中 `e.detail.value` 为选中索引
5. **自定义时间选择弹窗**：
   - 底部弹出（非 Taro 原生 Picker），内部包含日期网格和时间段列表
   - 点击日期项：仅 `activity: true` 的日期可选，选中后更新 `isSelected` 状态（单选）
   - 点击时间段：切换 `isSelected` 状态（多选）
   - 点击「确认」：拼接 `selectedTime` 文本（格式：`"X月X日 HH:MM-HH:MM"`），关闭弹窗
6. **表单验证**（`validate` 函数）：
   - 姓：`isNotEmpty(formData.lastName.trim())`，失败设 `errors.lastName = true`
   - 名：`isNotEmpty(formData.firstName.trim())`，失败设 `errors.firstName = true`
   - 电话：`isValidPhone(formData.phone)`，失败设 `errors.phone = true`
   - 人数：`formData.peopleIndex !== 0`，失败设 `errors.people = true`
   - 时间：`formData.selectedTime !== '' && formData.selectedTime !== '预约时间*'`，失败设 `errors.time = true`
   - 授权：`formData.auth === true`，失败设 `errors.auth = true`
   - 任一失败时 `Taro.showToast({ title: '请填写完整信息', icon: 'none' })`，返回 `false`

7. **提交流程**（`handleSubmit` 函数）：

```typescript
async function handleSubmit() {
  // 1. 检查登录
  const loginRes = await userService.checkLogin()
  if (loginRes.code !== 200) {
    const { confirm } = await Taro.showModal({
      title: '提示',
      content: '请先授权登录',
      confirmText: '确认授权',
      cancelText: '取消',
    })
    if (!confirm) return
    await userStore.login()
  }

  // 2. 检查是否已有预约（防重复）
  const listRes = await reservationService.listReservations()
  if (listRes.code === 200 && listRes.data && listRes.data.length > 0) {
    const existing = listRes.data[0]
    // 直接跳转成功页，携带已有预约信息
    Taro.navigateTo({ url: buildSuccessUrl(existing) })
    return
  }

  // 3. 表单验证
  if (!validate()) return

  // 4. 提交预约
  const fullName = formData.lastName + formData.firstName
  const res = await reservationService.addReservation({
    name: fullName,
    phone: formData.phone,
    people: peopleOptions[formData.peopleIndex],
    date: formData.selectedTime,
    selectedTimes: timeSlots.filter(s => s.isSelected).map(s => s.time),
    submissionCount: 0,
  })

  if (res.code === 200) {
    Taro.showToast({ title: '预约成功', icon: 'success' })
    setTimeout(() => {
      Taro.navigateTo({ url: buildSuccessUrl(res.data) })
    }, 2000)
  } else {
    Taro.showToast({ title: res.message || '预约失败', icon: 'none' })
  }
}
```

8. **分享**：`useShareAppMessage(() => ({ title: config.title, path: config.sharePath }))`

**关键样式：**

- 页面容器：`min-height: 100vh; background: #fff; padding-bottom: env(safe-area-inset-bottom)`
- 横幅图片：`width: 100%; height: 25vh; object-fit: cover`
- 活动信息区：`padding: 30rpx 40rpx`
  - 标题：`font-size: 36rpx; font-weight: bold; color: #333; margin-bottom: 20rpx`
  - 地址/时间行：`display: flex; align-items: center; gap: 12rpx; margin-bottom: 16rpx; font-size: 28rpx; color: #666`
  - 图标：`width: 32rpx; height: 32rpx`
  - 分享按钮：`float: right` 或 flex 右对齐
- 表单区：`padding: 0 40rpx`
  - 输入框：`width: 100%; height: 88rpx; border: 1rpx solid #ddd; border-radius: 8rpx; padding: 0 20rpx; font-size: 28rpx; margin-bottom: 24rpx`
  - 错误状态输入框：`border-color: #CE1616`（通过 `errors.xxx` 条件添加 CSS 类）
  - 电话输入行：`display: flex; gap: 16rpx`，一键获取按钮 `flex-shrink: 0; background: #000; color: #fff; border-radius: 8rpx; padding: 0 24rpx; font-size: 26rpx`
  - 人数 Picker 触发区：样式与输入框一致，右侧显示下拉箭头图标
  - 时间选择触发按钮：样式与输入框一致，未选择时显示占位文字 `color: #999`
  - 授权勾选区：`display: flex; align-items: center; gap: 12rpx; font-size: 24rpx; color: #666; margin: 30rpx 0`
  - 提交按钮：`width: 100%; height: 96rpx; background: #000; color: #fff; font-size: 32rpx; font-weight: 600; border-radius: 8rpx; margin-top: 40rpx`
- 时间选择弹窗：
  - 遮罩：`position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999`
  - 弹窗容器：`position: fixed; bottom: 0; width: 100%; background: #fff; border-radius: 20rpx 20rpx 0 0; padding: 40rpx; max-height: 70vh`
  - 日期网格：`display: grid; grid-template-columns: repeat(4, 1fr); gap: 16rpx; margin-bottom: 30rpx`
  - 日期项：`height: 80rpx; border-radius: 8rpx; display: flex; align-items: center; justify-content: center; font-size: 28rpx`
  - 日期项（可选）：`background: #f5f5f5; color: #333`
  - 日期项（不可选）：`background: #f5f5f5; color: #ccc; opacity: 0.5`
  - 日期项（选中）：`background: #000; color: #fff`
  - 时间段列表：`display: flex; flex-direction: column; gap: 16rpx`
  - 时间段项：`height: 80rpx; border: 1rpx solid #ddd; border-radius: 8rpx; display: flex; align-items: center; justify-content: center; font-size: 28rpx`
  - 时间段项（选中）：`border-color: #000; background: #000; color: #fff`
  - 确认按钮：`width: 100%; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx; margin-top: 30rpx; font-size: 30rpx`

### 2. 普通预约页 — `src/pages-sub/reservation-normal/index.tsx`

**页面配置 — `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '普通预约',
})
```

**依赖：** 与 VIP 预约页完全相同。

**活动配置常量（仅列出与 VIP 的差异）：**

```typescript
const NORMAL_CONFIG: ActivityConfig = {
  title: 'Y.ZHENG Fine Jewelry品牌发布会',
  address: '上海市静安区富民路89号巨富大厦18A',
  timeText: '2025/10/12 - 2025/10/18',
  bannerImage: '/assets/images/reservation/top_image.jpg',
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

**核心逻辑：** 与 VIP 预约页完全相同，仅使用 `NORMAL_CONFIG` 替代 `VIP_CONFIG`。表单验证、提交流程、云函数调用、UI 结构均一致。

**关键样式：** 与 VIP 预约页完全相同，共享同一套 SCSS 结构。建议两个页面的 `index.module.scss` 内容一致，或通过 `@import` 共享样式文件。

### 3. 修改预约页 — `src/pages-sub/reservation-change/index.tsx`

**页面配置 — `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '修改预约',
})
```

**依赖：**
- `hooks/useAuth.ts`（`ensureLogin`）
- `hooks/useSystemInfo.ts`（`statusBarHeight`）
- `services/reservation.service.ts`（`getReservation`、`updateReservation`）
- `services/user.service.ts`（`checkLogin`）
- `utils/validate.ts`（`isValidPhone`、`isNotEmpty`）
- `components/TopBarWithBack`
- `components/FloatPopup`
- `components/FloatBtn`

**额外页面状态：**

```typescript
const [reservationId, setReservationId] = useState<string>('')
const [modificationCount, setModificationCount] = useState<number>(0)
const [dataLoaded, setDataLoaded] = useState<boolean>(false)
```

**核心逻辑：**

1. **页面参数获取**：通过 Taro `useRouter()` 获取 `router.params.reservationId`，若无则 `Taro.showToast` 提示错误并 `Taro.navigateBack()`

2. **加载已有预约数据**（`useEffect` 中调用）：

```typescript
async function loadExistingReservation(id: string) {
  const res = await reservationService.getReservation(id)
  if (res.code !== 200 || !res.data) {
    Taro.showToast({ title: '获取预约信息失败', icon: 'none' })
    Taro.navigateBack()
    return
  }
  const data = res.data
  // 解析姓名：第一个字符为姓，其余为名
  setFormData(prev => ({
    ...prev,
    lastName: data.name.charAt(0),
    firstName: data.name.substring(1),
    phone: data.phone,
    peopleIndex: peopleOptions.indexOf(data.people) || 0,
    selectedTime: data.date,
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
}
```

3. **表单验证**：与 VIP 预约页相同（姓、名、电话、人数、时间），但**不验证授权勾选**（修改预约时默认已勾选）

4. **提交流程**（`handleSubmit` 函数）：

```typescript
async function handleSubmit() {
  // 1. 弹出确认对话框
  const { confirm } = await Taro.showModal({
    title: '提示',
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

  // 3. 表单验证
  if (!validate()) return

  // 4. 提交修改
  const fullName = formData.lastName + formData.firstName
  const res = await reservationService.updateReservation({
    reservationId,
    name: fullName,
    phone: formData.phone,
    people: peopleOptions[formData.peopleIndex],
    date: formData.selectedTime,
    selectedTimes: timeSlots.filter(s => s.isSelected).map(s => s.time),
  })

  if (res.code === 200) {
    setModificationCount(prev => prev + 1)
    Taro.showToast({ title: '修改成功', icon: 'success' })
    setTimeout(() => {
      Taro.navigateTo({ url: buildSuccessUrl(res.data) })
    }, 2000)
  } else if (res.code === 403) {
    Taro.showToast({ title: '您已修改预约信息2次，无法再次修改', icon: 'none' })
  } else {
    Taro.showToast({ title: res.message || '修改失败', icon: 'none' })
  }
}
```

**关键样式：** 与 VIP 预约页基本相同，差异如下：
- 提交按钮文字为「修改预约」而非「立即预约」
- 页面加载完成前（`dataLoaded === false`）显示加载占位状态
- 日期和时间段配置使用 VIP 活动的配置（day 11 可选，17:00-20:00 单时间段）

### 4. 预约成功页 — `src/pages-sub/reservation-success/index.tsx`

**页面配置 — `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '预约成功',
})
```

**依赖：**
- `hooks/useSystemInfo.ts`（`statusBarHeight`）
- `services/reservation.service.ts`（`generateQRCode`）
- `components/TopBarWithBack`

**页面状态：**

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
const [qrCodeImage, setQrCodeImage] = useState<string>('')
const [reservationTime, setReservationTime] = useState<string>('')
const [isLoading, setIsLoading] = useState<boolean>(true)
```

**核心逻辑：**

1. **页面参数解析**：通过 Taro `useRouter()` 获取 URL query 参数，解析并设置 `reservationInfo` 和 `reservationTime`

```typescript
useEffect(() => {
  const params = router.params
  if (!params.reservationId) return
  setReservationInfo({
    reservationId: params.reservationId,
    name: decodeURIComponent(params.name || ''),
    phone: decodeURIComponent(params.phone || ''),
    people: decodeURIComponent(params.people || ''),
    date: decodeURIComponent(params.date || ''),
    activityTitle: decodeURIComponent(params.activityTitle || ''),
    address: decodeURIComponent(params.address || ''),
  })
  setReservationTime(decodeURIComponent(params.reservationTime || ''))
  generateQRCodeImage(params.reservationId, decodeURIComponent(params.name || ''))
}, [])
```

2. **二维码生成**：

```typescript
async function generateQRCodeImage(id: string, name: string) {
  setIsLoading(true)
  const content = JSON.stringify({ type: 'reservation', reservationId: id, name })
  const res = await reservationService.generateQRCode(content, 'reservation')
  if (res.code === 200 && res.data) {
    setQrCodeImage(res.data.fileId || res.data.qrCodeUrl || '')
  } else {
    Taro.showToast({ title: '二维码生成失败', icon: 'none' })
  }
  setIsLoading(false)
}
```

3. **操作按钮**：
   - 「查看我的预约」：`Taro.pageScrollTo({ scrollTop: 0, duration: 300 })`
   - 「修改预约信息」：`Taro.redirectTo({ url: '/pages-sub/reservation-change/index?reservationId=' + reservationInfo.reservationId })`
   - 「返回首页」：计算页面栈深度 `const pages = Taro.getCurrentPages(); Taro.navigateBack({ delta: pages.length - 1 })`

4. **分享**：`useShareAppMessage(() => ({ title: 'Y.ZHENG Fine Jewelry品牌发布会', path: '/pages-sub/reservation/index' }))`

**关键样式：**

- 页面容器：`min-height: 100vh; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 0 30rpx env(safe-area-inset-bottom)`
- 成功标题区：`text-align: center; padding: 60rpx 0 40rpx`
  - 标题：`font-size: 44rpx; font-weight: bold; color: #333; margin-bottom: 16rpx`
  - 描述：`font-size: 28rpx; color: #666`
- 预约详情卡片：`background: #fff; border-radius: 20rpx; padding: 40rpx; margin-bottom: 30rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.08)`
  - 信息行：`display: flex; justify-content: space-between; padding: 16rpx 0; border-bottom: 1rpx solid #f5f5f5`
  - 标签：`font-size: 28rpx; color: #999`
  - 值：`font-size: 28rpx; color: #333; font-weight: 500`
- 二维码区域：`background: #fff; border-radius: 20rpx; padding: 40rpx; margin-bottom: 30rpx; display: flex; flex-direction: column; align-items: center; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.08)`
  - 二维码图片：`width: 400rpx; height: 400rpx`
  - 加载占位：`width: 400rpx; height: 400rpx; background: #f5f5f5; display: flex; align-items: center; justify-content: center; font-size: 28rpx; color: #999`
  - 提示文字：`font-size: 24rpx; color: #999; margin-top: 20rpx`
- 操作按钮区：`margin-bottom: 30rpx`
  - 第一行（两个并排按钮）：`display: flex; gap: 20rpx; margin-bottom: 20rpx`
  - 「查看我的预约」按钮：`flex: 1; height: 88rpx; background: #fff; color: #333; border-radius: 8rpx; font-size: 28rpx; border: 1rpx solid #ddd`
  - 「修改预约信息」按钮：`flex: 1; height: 88rpx; background: #fff; color: #333; border-radius: 8rpx; font-size: 28rpx; border: 1rpx solid #ddd`
  - 「返回首页」按钮：`width: 100%; height: 88rpx; background: #000; color: #fff; border-radius: 8rpx; font-size: 28rpx`
- 温馨提示区：`background: #fff; border-radius: 20rpx; padding: 30rpx; margin-bottom: 40rpx; box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.08)`
  - 标题：`font-size: 28rpx; font-weight: 600; color: #333; margin-bottom: 16rpx`
  - 提示项：`font-size: 24rpx; color: #666; line-height: 1.8; padding-left: 20rpx`
  - 提示内容（3 条）：
    1. 请您按照预约时间准时到达活动现场
    2. 如需修改预约信息，请在活动开始前完成修改
    3. 每位用户最多可修改预约信息 2 次

### 5. 通用预约页 — `src/pages-sub/reservation-easy/index.tsx`

**页面配置 — `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '预约',
})
```

**依赖：**
- `hooks/useAuth.ts`（`ensureLogin`）
- `hooks/useSystemInfo.ts`（`statusBarHeight`）
- `services/reservation.service.ts`（`addReservation`、`listReservations`）
- `services/user.service.ts`（`checkLogin`、`loginEasy`、`bindPhone`）
- `utils/validate.ts`（`isValidPhone`、`isNotEmpty`）
- `components/TopBarWithBack`
- `components/FloatPopup`
- `components/FloatBtn`

**核心逻辑：**

1. **页面参数解析**：通过 Taro `useRouter()` 获取 URL query 参数，构建 `ActivityConfig`：

```typescript
useEffect(() => {
  const params = router.params
  const config: ActivityConfig = {
    title: decodeURIComponent(params.activityTitle || 'Y.ZHENG Fine Jewelry'),
    address: decodeURIComponent(params.activityAddress || ''),
    timeText: decodeURIComponent(params.activityTime || ''),
    bannerImage: decodeURIComponent(
      params.bannerImage || '/assets/images/reservation/top_image.jpg'
    ),
    dateList: buildDefaultDateList(),
    timeSlots: buildDefaultTimeSlots(),
    defaultSelectedTime: '',
    peopleOptions: ['预约人数*', '1', '2'],
    sharePath: '/pages-sub/reservation-easy/index',
  }
  setActivityConfig(config)
}, [])
```

2. **默认日期/时间段构建函数**：

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

3. **表单逻辑、验证、提交流程**：与 VIP 预约页完全相同，使用动态加载的 `activityConfig` 替代硬编码的 `VIP_CONFIG`

4. **分享**：`useShareAppMessage(() => ({ title: activityConfig.title, path: activityConfig.sharePath }))`

**关键样式：** 与 VIP 预约页完全相同。通用预约页的 `index.module.scss` 可直接复用 VIP 预约页的样式文件。

**与 VIP/普通预约页的关键区别：**
- 活动配置不再硬编码，而是从 URL query 参数动态构建
- 日期列表和时间段使用通用默认值（未来 7 天 + 3 个时间段），而非特定活动的固定配置
- 作为未来新活动预约的通用入口，无需为每个新活动创建独立页面

## 验收标准

1. 所有 5 个页面文件（含 `index.config.ts` 和 `index.module.scss`）无 TypeScript 编译错误
2. 每个页面均为 React 函数组件，使用 SCSS Modules 进行样式隔离
3. VIP 预约页和普通预约页的表单验证规则一致：姓非空、名非空、电话 `/^1[3-9]\d{9}$/`、人数已选择、时间已选择、授权已勾选
4. 验证失败时对应字段添加红色边框（`border-color: #CE1616`），并通过 `Taro.showToast` 显示错误提示
5. 电话输入自动过滤非数字字符并截断为 11 位
6. 一键获取手机号功能正确：使用 Taro `Button` 的 `openType="getPhoneNumber"`，成功后调用 `userService.bindPhone(code)` 获取手机号
7. 人数选择使用 Taro `Picker` 组件（`mode="selector"`），`onChange` 回调正确处理 `e.detail.value` 索引值
8. 自定义时间选择弹窗功能正确：日期单选（仅 `activity: true` 可选）、时间段多选、确认后拼接显示文本
9. VIP 预约页的 `date_list` 仅 11 日可选且默认选中，`timeSlots` 仅 `'17:00-20:00'` 且默认选中
10. 普通预约页的 `date_list` 中 12-18 日可选且默认无选中，`timeSlots` 有 3 个时间段且默认均未选中
11. 提交流程正确：先检查登录（未登录弹出 `showModal` 授权确认）→ 检查重复预约（已有则跳转成功页）→ 表单验证 → 提交 → 成功后延迟 2s 跳转成功页
12. 跳转成功页时通过 URL query 正确传递所有预约信息（`reservationId`、`name`、`phone`、`people`、`date`、`activityTitle`、`address`、`reservationTime`）
13. 修改预约页能通过 `useRouter()` 正确获取 `reservationId` 参数，无参数时提示错误并返回上一页
14. 修改预约页的 `loadExistingReservation` 正确解析姓名（`charAt(0)` 为姓、`substring(1)` 为名）、匹配人数索引、匹配已选时间段
15. 修改预约页提交前弹出 `Taro.showModal` 确认对话框，显示已修改次数
16. 修改预约页调用 `reservation-change` update 后，成功时本地 `modificationCount + 1`；服务端返回 403 时显示「已修改 2 次，无法再次修改」提示
17. 预约成功页能从 URL query 正确解析所有预约信息（使用 `decodeURIComponent`）
18. 预约成功页的二维码生成流程正确：构建 JSON 内容 → 调用 `generateQRCode` → 设置图片 URL → 关闭 loading
19. 预约成功页三个操作按钮功能正确：「查看我的预约」滚动到顶部、「修改预约信息」`redirectTo` 修改页、「返回首页」`navigateBack` 到栈底
20. 通用预约页能从 URL query 动态构建活动配置（`activityTitle`、`activityAddress`、`activityTime`、`bannerImage`）
21. `reservation.service.ts` 中补充的 `generateQRCode` 函数能正确调用 `generate-qrcode` 云函数
22. 所有页面的 `useShareAppMessage` 正确配置分享标题和路径
23. 所有页面使用 `TopBarWithBack` 组件，正确传递 `statusBarHeight`
24. 所有文件 `import` 路径正确，无循环依赖
