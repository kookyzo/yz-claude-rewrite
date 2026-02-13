# 会话 20：Phase 07a 注册 + 编辑个人信息 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 07 的第一部分：注册页（register）和编辑个人信息页（edit-info）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用前先读取 service 文件确认方法签名，避免参数传递错误。
4. 这两个页面都是分包页面（pages-sub/），不是 Tab 页，不需要 CustomTabBar 组件。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/07-user-center.md`（关注「旧代码摘要 → 1. 注册页」和「2. 编辑个人信息页」部分，以及对应的「实现要求」部分）
3. `src/services/user.service.ts`（用户服务 — 必读，理解 register / updateUser / bindPhone 方法签名）
4. `src/stores/useUserStore.ts`（用户状态 — 必读，理解 fetchUserInfo / isRegistered）
5. `src/types/user.ts`（User 类型定义）
6. `src/utils/validate.ts`（isValidPhone / isValidEmail / isNotEmpty）

## 参考旧代码（必读，1:1 还原 UI）

**注册页：**
- `legacy_ro/yz-legacy-code/pages/register/register.wxml`
- `legacy_ro/yz-legacy-code/pages/register/register.wxss`
- `legacy_ro/yz-legacy-code/pages/register/register.js`

**编辑个人信息页：**
- `legacy_ro/yz-legacy-code/pages/edit_information/edit_information.wxml`
- `legacy_ro/yz-legacy-code/pages/edit_information/edit_information.wxss`
- `legacy_ro/yz-legacy-code/pages/edit_information/edit_information.js`

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-19 已完成。用户相关基础设施已就绪。

### 已有的关键基础设施

- `src/services/user.service.ts` — `register(userInfo)`, `getUserInfo()`, `updateUser(data)`, `bindPhone(code)`
- `src/stores/useUserStore.ts` — `isRegistered`, `userInfo`, `fetchUserInfo()`, `login()`
- `src/types/user.ts` — `User`（`_id, openId, userId, firstName, lastName, nickname?, phone?, birthday?, gender?, title?, mail?, region?`）
- `src/utils/validate.ts` — `isValidPhone()`, `isValidEmail()`, `isNotEmpty()`
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏
- `src/assets/icons/selected.png` + `not_selected.png` — 勾选/未勾选图标（已存在）

---

## 页面 A：注册页 `pages-sub/register/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 页面状态

```typescript
const [lastName, setLastName] = useState('')        // 姓
const [firstName, setFirstName] = useState('')      // 名
const [gender, setGender] = useState<'mr' | 'ms' | 'other'>('mr')  // 称谓
const [phone, setPhone] = useState('')              // 手机号
const [birthday, setBirthday] = useState('')        // 生日 YYYY-MM-DD
const [phoneBtnDisabled, setPhoneBtnDisabled] = useState(false)  // 一键授权按钮禁用
const [agreements, setAgreements] = useState({
  privacy: false,     // 隐私声明（必选）
  marketing: false,   // 营销信息
  analysis: false,    // 分析个人信息
})
const [isAllSelected, setIsAllSelected] = useState(false)
const [errors, setErrors] = useState({
  lastName: false, firstName: false, phone: false, birthday: false, privacy: false,
})
const [submitting, setSubmitting] = useState(false)
```

### 核心功能点

#### 1. 最大日期计算

`useLoad` 中计算 `maxDate` 为当天日期（`YYYY-MM-DD` 格式），用于生日选择器的 `end` 属性。

#### 2. 称谓选择

三个单选按钮：先生（mr）/ 女士（ms）/ 其他（other）。使用 `selected.png` / `not_selected.png` 图标切换。

#### 3. 手机号输入

- 手动输入：`type="number"`，限制 11 位，`replace(/\D/g, '').slice(0, 11)`
- 一键授权：`<Button openType="getPhoneNumber">`
  - 成功时（`e.detail.errMsg === 'getPhoneNumber:ok'`）调用 `userService.bindPhone(e.detail.code)`
  - 返回 `{ code: 200, data: { phoneNumber } }` → 设置 phone 并禁用按钮
  - 失败时 Toast 提示

#### 4. 生日选择

- 使用 Taro `<Picker mode="date">`（注意：不是 NutUI 的 DatePicker）
- 范围：`1900-01-01` 到 `maxDate`（当天）
- `onChange` 回调 `e.detail.value` 为日期字符串

#### 5. 条款勾选

- 3 个独立条款 + 全选按钮
- `privacy` 为必选项
- 全选逻辑：点击全选 → 所有条款设为 `!isAllSelected`；单个条款变化时检查是否全部选中更新 `isAllSelected`
- 条款文案（从旧代码 WXML 中 1:1 复制）：
  - privacy: `* 我同意 Y.ZHENG 依照隐私声明使用收集我的个人信息，亦允许第三方依此存储和处理相同内容。(必选)`
  - marketing: `我同意收取微信，短彩信，电话，邮寄，电邮等一般营销信息。我了解 Y.ZHENG 隐私权中心可提供设置协助。`
  - analysis: `我同意 Y.ZHENG 依照隐私声明使用分析个人信息，以此建立个人档案与个性化互动营销。`

#### 6. 年龄校验

提交时检查生日是否满 18 周岁：

```typescript
function checkAge(birthday: string): boolean {
  const birth = new Date(birthday)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age >= 18
}
```

#### 7. 表单验证 & 提交

验证规则：
- 姓（lastName）：`isNotEmpty()`
- 名（firstName）：`isNotEmpty()`
- 手机号（phone）：`/^1\d{10}$/`（注意旧代码用的是 `/^1\d{10}$/` 而非 `isValidPhone`，保持一致）
- 生日（birthday）：非空 + 满 18 周岁
- 隐私声明（privacy）：必须勾选

提交流程：
1. 验证所有字段，设置 `errors` 状态
2. 验证失败 → Toast 提示具体错误
3. 验证通过 → `setSubmitting(true)` 防重复提交
4. gender 映射 title：`mr→'先生'`、`ms→'女士'`、`other→'其他'`
5. nickname = `lastName + firstName`
6. 调用 `userService.register({ gender, title, nickname, phone, birthday, region: [], mail: '' })`
7. 成功（code === 200）→ 调用 `useUserStore.getState().fetchUserInfo()` 刷新用户状态 → Toast 提示 → `Taro.navigateBack()`
8. 已存在（code === 409）→ Toast 提示"用户已注册"
9. 失败 → Toast 提示错误
10. finally → `setSubmitting(false)`

### UI 结构

```
TopBarWithBack
└── register-container（min-height: 100vh, bg: #f5f5f5）
    ├── register-content（padding: 28rpx）
    │   ├── section-title「个人信息」（居中, 32rpx, 600 weight）
    │   ├── name-row（flex, gap: 24rpx）
    │   │   ├── name-item 姓（label + input-wrapper + required-star *）
    │   │   └── name-item 名（label + input-wrapper + required-star *）
    │   ├── gender-section 称谓（label + 三个 gender-option 水平排列）
    │   │   └── 每个 option: checkbox-icon + text（先生/女士/其他）
    │   ├── phone-section 电话
    │   │   └── phone-input-wrapper（required-star + input + 一键授权按钮）
    │   ├── birthday-section 生日
    │   │   └── Picker mode="date"（picker-display: star + text/placeholder + arrow）
    │   └── agreements-section 条款
    │       ├── agreement-item × 3（checkbox-icon + 条款文字）
    │       └── select-all-item（checkbox-icon + "以上全选"）
    └── submit-btn（底部按钮，disabled={!agreements.privacy}）
        └── 「我已满18周岁，自愿选择并同意以上内容」
```

### 关键样式要点

- 容器背景 `#f5f5f5`，底部 `padding-bottom: env(safe-area-inset-bottom)`
- 输入框背景 `rgb(210,210,210)`，高度 `96rpx`，padding `0 32rpx`
- 错误态：`border: 2rpx solid #ff0000`
- 必填星号 `*`：绝对定位在输入框左侧 `left: 14rpx`
- 称谓选项间距 `gap: 100rpx`，checkbox 图标 `40rpx × 40rpx`
- 一键授权按钮：透明背景，下划线文字，颜色 `#606061`，字号 `24rpx`
- 提交按钮：宽度 `calc(100% - 56rpx)`，高度 `96rpx`，启用态 `bg: #111 color: #fff`，禁用态 `bg: #333 color: #fff`，无圆角
- 条款文字 `24rpx`，行高 `1.7`，checkbox `36rpx × 36rpx`
- 详细样式参考旧代码 `register.wxss` 1:1 还原

### 注意：TopBarWithBack 偏移

注册页使用 `navigationStyle: 'custom'`，页面内容需要添加 `marginTop` 来避免被 TopBarWithBack 遮挡。参考已实现的 product-detail 页面的做法，读取该页面看它如何处理 TopBarWithBack 的偏移量。

---

## 页面 B：编辑个人信息页 `pages-sub/edit-info/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 页面状态

```typescript
const [gender, setGender] = useState<'female' | 'male'>('female')
const [titleIndex, setTitleIndex] = useState(1)
const titleList = ['称谓*', '女士', '小姐', '男士', '先生', '其他']
const [nickname, setNickname] = useState('')
const [birthday, setBirthday] = useState('')
const [phone, setPhone] = useState('')
const [mail, setMail] = useState('')
const [region, setRegion] = useState<string[]>(['请', '选择', '地区'])
const [auth, setAuth] = useState(false)
const [submitting, setSubmitting] = useState(false)

// 校验错误态
const [errors, setErrors] = useState({
  title: false, nickname: false, phone: false, mail: false,
})
```

### 核心功能点

#### 1. 页面加载 & 数据回填

`useLoad` 中：
1. 调用 `userService.getUserInfo()` 获取用户资料
2. 回填表单（`fillFormFromProfile`）：
   - `title` → 在 `titleList` 中查找索引，找不到默认 `1`
   - `nickname` → 直接设置
   - `birthday` → 直接设置
   - `phone` → 直接设置
   - `mail` / `email` → 兼容两种 key
   - `region` → 兼容数组和字符串格式：
     - 如果是数组直接使用
     - 如果是字符串，尝试 `split('/')` 或 `split('-')` 解析
   - `gender` → 直接设置（`'female'` / `'male'`）

#### 2. 性别选择

女士 / 男士 两个单选按钮，使用 `selected.png` / `not_selected.png` 图标。

#### 3. 称谓选择

使用 Taro `<Picker mode="selector">`，`range={titleList}`，`onChange` 回调 `e.detail.value` 为选中索引。

#### 4. 表单输入

- 昵称：文本输入
- 生日：`<Picker mode="date">`，范围 `1900-01-01` 到 `2100-12-31`
- 电话：数字输入，限 11 位 `replace(/\D/g, '').slice(0, 11)`
- 邮箱：文本输入
- 地区：`<Picker mode="region">`，显示格式 `省 - 市 - 区`

#### 5. 表单验证

验证规则：
- 称谓：`titleIndex !== 0`（不能为默认的"称谓*"）
- 昵称：`isNotEmpty()`
- 电话：`/^1\d{10}$/`
- 邮箱：若填写则 `isValidEmail()`（可选字段）

验证失败时：对应字段添加红色边框（`border: 2rpx solid #CE1616`）。

#### 6. 提交保存

1. 验证所有字段
2. 检查 `auth` 隐私协议是否勾选，未勾选 → Toast 提示
3. `setSubmitting(true)` 防重复
4. 调用 `userService.updateUser({ gender, title: titleList[titleIndex], nickname, birthday, phone, email: mail, region })`
5. 成功 → 调用 `useUserStore.getState().fetchUserInfo()` 刷新 → Toast 提示 → 延迟 400ms → `Taro.navigateBack()`
6. 失败 → Toast 提示
7. finally → `setSubmitting(false)`

#### 7. 前往编辑地址

点击"前往编辑地址信息"按钮 → `Taro.navigateTo({ url: '/pages-sub/address-list/index' })`

#### 8. 关闭按钮

右上角 × 按钮 → `Taro.navigateBack()`

### UI 结构

编辑信息页采用弹窗式布局（全屏背景图 + 居中白色弹窗表单）：

```
TopBarWithBack（backgroundColor 透明或不显示，此页面用自己的关闭按钮）
└── splash-container（100vw × 100vh, 居中）
    ├── splash-image（背景大图，absolute 铺满）
    └── form-popup-mask（fixed 遮罩 rgba(0,0,0,0.5)）
        └── form-popup（白色弹窗，85% 宽，80% 高）
            ├── close-btn（右上角 ×，absolute）
            ├── logo（居中 logo 图片）
            ├── sex_selection（性别选择：女士 / 男士）
            │   ├── left-item（checkbox + 女士）
            │   └── right-item（checkbox + 男士）
            ├── required-field「*必填项」（右对齐提示）
            ├── form 表单区域
            │   ├── form-item 称谓（Picker mode="selector"）
            │   ├── form-item 昵称（input）
            │   ├── form-item 生日（Picker mode="date"）
            │   ├── form-item 电话（input type="number"）
            │   ├── form-item 邮箱（input）
            │   ├── form-item 地区（Picker mode="region"）
            │   └── form-item 前往编辑地址信息（按钮）
            └── auth-btn 区域
                ├── auth 隐私协议（checkbox + 文字 + 隐私条例链接 + 用户协议链接）
                └── submit-btn「立即注册」（实际为保存修改）
```

### 关键样式要点

- 背景图：全屏铺满，`position: absolute; top: 0; left: 0; width: 100%; height: 100%`
- 遮罩层：`position: fixed; background: rgba(0,0,0,0.5); z-index: 999`
- 弹窗：`width: 85%; height: 80%; background: #fff; padding: 20rpx; border-radius: 0`
- 关闭按钮：`position: absolute; top: 20rpx; right: 20rpx; width: 60rpx; height: 60rpx; font-size: 40rpx`
- 性别选择：两列布局，中间 `border-right: 2rpx solid black` 分隔
- 表单项：`width: 600rpx; margin-bottom: 20rpx`，输入框 `border: 2rpx solid black; color: #929191`
- 错误态：`border: 2rpx solid #CE1616; color: #CE1616`
- 前往编辑地址按钮：`height: 65rpx; background: white; color: #000; 居中文字`
- 隐私协议文字：`font-size: 21rpx`，链接文字 `font-size: 23rpx; font-weight: 500; color: #000`
- 提交按钮：`background: black; color: white; width: 100%`
- 详细样式参考旧代码 `edit_information.wxss` 1:1 还原

### 背景图和 Logo 资源

编辑信息页需要背景图和 logo：
- 背景图：旧代码引用 `../../Image/splash/splash.jpg`，在 legacy 目录中查找 `legacy_ro/yz-legacy-code/Image/splash/` 下的 jpg 文件。如果找不到 splash.jpg，可以使用已有的 `src/assets/icons/my_top_image.jpg` 作为替代背景，或者使用纯色背景 `#f5f5f5`
- Logo：旧代码引用 `../../Image/tabBar/home_selected.png`，对应 `legacy_ro/yz-legacy-code/Image/tabBar/home_selected.png`，需要复制到 `src/assets/icons/` 下

如果 legacy 中找不到 splash.jpg 背景图，使用纯灰色背景 `#e8e8e8` 替代即可，不要卡在找图片上。

### 注意：此页面不使用 TopBarWithBack

编辑信息页是弹窗式布局，有自己的关闭按钮（×），不需要 TopBarWithBack 组件。但仍需 `navigationStyle: 'custom'` 来隐藏原生导航栏。

---

## 产出

- 注册页 3 个文件（`pages-sub/register/` 下的 index.tsx + index.config.ts + index.module.scss）
- 编辑信息页 3 个文件（`pages-sub/edit-info/` 下的 index.tsx + index.config.ts + index.module.scss）
- 如有缺失的图标/图片资源，从 legacy 复制到 `src/assets/icons/`

## 要求

- 使用已有的 services（user.service），调用前先读取确认方法签名
- 使用已有的 validate 工具函数
- 使用已有的 useUserStore（fetchUserInfo 刷新用户状态）
- 注册页使用 Taro 原生 `<Picker>` 组件（非 NutUI），因为需要 `mode="date"` 功能
- 编辑信息页使用 Taro 原生 `<Picker>` 组件（`mode="selector"` / `mode="date"` / `mode="region"`）
- 手机号一键授权使用 Taro `<Button openType="getPhoneNumber">`，回调中调用 `userService.bindPhone(code)`
- 注册成功后调用 `fetchUserInfo()` 刷新 store 再 `navigateBack()`
- 编辑保存成功后调用 `fetchUserInfo()` 刷新 store，延迟 400ms 再 `navigateBack()`
- 表单验证错误态用红色边框标识
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 完成后运行 `npm run build:weapp` 确认编译通过

---
