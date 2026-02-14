# 会话 26：Phase 09a Splash 启动页 + 咨询页 + 隐私政策 + 用户协议 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 09 的第一部分：Splash 启动页、咨询页（consultation）、隐私政策页（privacy-policy）、用户协议页（user-agreement）。其中隐私政策和用户协议是纯静态文本页面，咨询页极简，Splash 有视频播放和隐私弹窗逻辑。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. Service 调用前先读取 service 文件确认方法签名，避免参数传递错误。
3. Splash 是主包页面（`pages/splash/`），其余三个是分包页面（`pages-sub/`）。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/09-misc-pages.md`（**完整阅读**，关注「1. Splash 启动页」「3. Consultation 咨询」「4. Privacy Policy 隐私政策」「5. User Agreement 用户协议」部分）
3. `src/stores/useAppStore.ts`（**必读**，理解 `privacyAgreed` 和 `agreePrivacy()` 接口）
4. `src/constants/index.ts`（查看已有常量，需要补充 `SPLASH_VIDEO_URL`）
5. `src/hooks/useSystemInfo.ts`（`statusBarHeight`, `navBarHeight`）

## 参考旧代码（必读，1:1 还原 UI 和文案）

**Splash 启动页：**
- `legacy_ro/yz-legacy-code/pages/splash/splash.wxml`
- `legacy_ro/yz-legacy-code/pages/splash/splash.wxss`
- `legacy_ro/yz-legacy-code/pages/splash/splash.js`

**咨询页：**
- `legacy_ro/yz-legacy-code/pages/Consultation/Consultation.wxml`
- `legacy_ro/yz-legacy-code/pages/Consultation/Consultation.wxss`
- `legacy_ro/yz-legacy-code/pages/Consultation/Consultation.js`

**隐私政策页（文案必须 1:1 复制）：**
- `legacy_ro/yz-legacy-code/pages/privacy_policy/privacy_policy.wxml`（**必读**，包含完整隐私政策文案，8 个章节）
- `legacy_ro/yz-legacy-code/pages/privacy_policy/privacy_policy.wxss`

**用户协议页（文案必须 1:1 复制）：**
- `legacy_ro/yz-legacy-code/pages/user_agreement/user_agreement.wxml`（**必读**，包含完整销售条款文案，13 个章节）
- `legacy_ro/yz-legacy-code/pages/user_agreement/user_agreement.wxss`

## 前置依赖

Sessions 01-25 已完成。所有基础设施已就绪。

### 已有的关键基础设施

- `src/stores/useAppStore.ts`:
  - `privacyAgreed: boolean` — 隐私协议是否已同意（持久化到 Taro Storage）
  - `agreePrivacy()` — 设置 `privacyAgreed = true`
- `src/constants/index.ts` — 已有 `CLOUD_ENV_ID`、`APP_ID`、`CONSULTATION_PHONE` 等常量
- `src/hooks/useSystemInfo.ts` — `statusBarHeight`, `navBarHeight`
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏
- `src/components/FloatPopup/` + `src/components/FloatBtn/` — 浮动咨询

---

## 页面 A：Splash 启动页 `pages/splash/index`

**注意：这是主包页面，路径是 `src/pages/splash/`，不是 `pages-sub/`。**

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '',
  disableScroll: true,
})
```

### 补充常量

在 `src/constants/index.ts` 中添加：

```typescript
export const SPLASH_VIDEO_URL = 'cloud://cloud1-9glm8muj52815539.636c-cloud1-9glm8muj52815539-1379477689/splash.mp4'
```

### 页面状态

```typescript
const [videoEnded, setVideoEnded] = useState(false)
const [showPrivacyPopup, setShowPrivacyPopup] = useState(false)
```

### 核心功能点

#### 1. 视频播放

使用 Taro `Video` 组件（先用 context7 确认 Taro Video 组件的正确导入和属性用法）：
- 全屏自动播放，隐藏所有控件
- `src={SPLASH_VIDEO_URL}`
- `autoplay`、`loop={false}`、`controls={false}`
- `showPlayBtn={false}`、`showCenterPlayBtn={false}`、`showFullscreenBtn={false}`、`showProgress={false}`
- `objectFit="cover"`
- `onEnded` → `handleVideoEnd()`
- `onError` → `handleVideoEnd()`（视频出错也进入下一步）

#### 2. 跳过按钮

右上角固定定位，点击调用 `handleVideoEnd()`。视频结束后隐藏。

#### 3. handleVideoEnd 流程

```typescript
const handleVideoEnd = () => {
  if (videoEnded) return  // 防止重复触发
  setVideoEnded(true)
  checkPrivacyAgreement()
}
```

#### 4. 隐私协议检查

```typescript
const { privacyAgreed, agreePrivacy } = useAppStore()

const checkPrivacyAgreement = () => {
  if (privacyAgreed) {
    navigateToHome()
  } else {
    setShowPrivacyPopup(true)
  }
}
```

#### 5. 隐私弹窗交互

弹窗内容：
- 标题：「温馨提示」
- 内容：隐私条款更新说明文本（从旧代码 `splash.js` 中的 `popup_content` 字段 1:1 复制）
- 「查看详情」链接 → `Taro.navigateTo({ url: '/pages-sub/privacy-policy/index' })`
- 「不同意」按钮 → 无操作（弹窗保持显示）
- 「同意」按钮 → `agreePrivacy()` → `navigateToHome()`

#### 6. 跳转首页

```typescript
const navigateToHome = () => {
  Taro.switchTab({ url: '/pages/home/index' })
}
```

**简化决策**：旧代码中的地理位置权限检查（`checkLocationPermission`）和音频权限检查（`checkAudioPermission`）在新版中移除。

### UI 结构

```
container（全屏，position: relative）
├── Video（全屏自动播放，无控件）
├── skip-btn（右上角"跳过"按钮，videoEnded 后隐藏）
└── privacy-popup（showPrivacyPopup 时显示）
    ├── mask（半透明遮罩）
    └── popup-content（居中白色弹窗）
        ├── popup-title「温馨提示」
        ├── popup-body（隐私条款说明文字）
        ├── detail-link「查看详情」
        └── button-row
            ├── 「不同意」按钮
            └── 「同意」按钮
```

### 关键样式要点

- 容器：`position: relative; width: 100vw; height: 100vh; overflow: hidden`
- Video：`width: 100%; height: 100%; object-fit: cover`
- 跳过按钮：`position: absolute; top: 100rpx; right: 30rpx; padding: 10rpx 30rpx; background: rgba(0,0,0,0.3); color: #fff; border-radius: 30rpx; font-size: 26rpx; z-index: 10`
- 隐私弹窗遮罩：`position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999`
- 隐私弹窗：`position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 85%; background: #fff; border-radius: 20rpx; padding: 40rpx; z-index: 1000`
- 弹窗标题：`font-size: 36rpx; font-weight: 600; text-align: center; margin-bottom: 30rpx`
- 弹窗内容：`font-size: 28rpx; color: #666; line-height: 1.6; margin-bottom: 20rpx`
- 查看详情链接：`font-size: 26rpx; color: #333; text-decoration: underline; margin-bottom: 40rpx`
- 按钮容器：`display: flex; gap: 20rpx`
- 不同意按钮：`flex: 1; height: 80rpx; background: #f5f5f5; color: #999; border-radius: 8rpx; display: flex; align-items: center; justify-content: center; font-size: 28rpx`
- 同意按钮：`flex: 1; height: 80rpx; background: #000; color: #fff; border-radius: 8rpx; display: flex; align-items: center; justify-content: center; font-size: 28rpx`

---

## 页面 B：咨询页 `pages-sub/consultation/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 核心逻辑

极简页面。展示品牌联系信息 + FloatPopup 在线咨询弹窗。

```typescript
const [showPopup, setShowPopup] = useState(false)
```

### UI 结构

```
TopBarWithBack
└── container（marginTop 偏移）
    ├── content-area（居中展示）
    │   ├── brand-title「Y.ZHENG Fine Jewelry」
    │   ├── contact-info（联系方式、服务时间等静态文字）
    │   └── home-link（返回首页链接，使用 navigator open-type="switchTab"）
    ├── FloatBtn → setShowPopup(true)
    └── FloatPopup visible={showPopup} onClose={() => setShowPopup(false)}
```

参考旧代码 `Consultation.wxml` 和 `Consultation.wxss` 还原 UI。旧代码中页面非常简单，主要就是一行文字和一个导航链接，核心功能依赖 FloatPopup。

### 关键样式要点

- 页面容器：`min-height: 100vh; background: #fff`
- 内容区：`padding: 40rpx; text-align: center`
- 品牌标题：`font-size: 36rpx; font-weight: 600; color: #333; margin-top: 100rpx; margin-bottom: 40rpx`
- 联系信息：`font-size: 28rpx; color: #666; line-height: 2`
- 首页链接：`font-size: 28rpx; color: #333; text-decoration: underline; margin-top: 60rpx`

---

## 页面 C：隐私政策页 `pages-sub/privacy-policy/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 核心逻辑

纯静态页面，无状态、无副作用、无云函数调用。

### 实现方式

1. 先读取旧代码 `legacy_ro/yz-legacy-code/pages/privacy_policy/privacy_policy.wxml`，**完整复制所有文案内容**
2. 使用 `TopBarWithBack` 导航栏 + `ScrollView`（scrollY）包裹全部内容
3. 内容以 JSX 硬编码，保留旧代码中的完整隐私政策文本
4. 8 个章节结构：引言 → 收集使用 → Cookie → 共享 → 存储保护 → 权利 → 未成年人 → 更新 → 联系方式
5. 底部留白区域

**重要**：文案必须从旧代码 WXML 中 1:1 复制，不要自己编写或修改任何法律文本。

### UI 结构

```
TopBarWithBack
└── ScrollView（scrollY, marginTop 偏移）
    ├── main-title「微信小程序用户隐私协议」
    ├── sub-title「【Y.Zheng悦涧】用户隐私保护指引」
    ├── chapter-1（引言）
    │   ├── chapter-title
    │   └── paragraphs...
    ├── chapter-2（收集和使用个人信息）
    │   ├── chapter-title
    │   └── paragraphs...（含缩进子项）
    ├── ... chapters 3-8 ...
    ├── update-date（更新日期/生效日期）
    └── bottom-spacer（底部留白）
```

### 关键样式要点

- 内容容器：`padding: 30rpx 40rpx 60rpx`
- 主标题：`font-size: 36rpx; font-weight: 600; text-align: center; margin-bottom: 20rpx; color: #333`
- 副标题：`font-size: 30rpx; font-weight: 500; text-align: center; margin-bottom: 40rpx; color: #333`
- 章节标题：`font-size: 30rpx; font-weight: 600; color: #333; margin-top: 40rpx; margin-bottom: 20rpx`
- 段落：`font-size: 28rpx; color: #666; line-height: 1.8; margin-bottom: 16rpx`
- 缩进段落：`padding-left: 30rpx`
- 更新日期：`font-size: 24rpx; color: #999; text-align: center; margin-top: 60rpx`
- 底部留白：`height: 100rpx`
- 详细样式参考旧代码 `privacy_policy.wxss` 1:1 还原

---

## 页面 D：用户协议页 `pages-sub/user-agreement/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 核心逻辑

纯静态页面，与隐私政策页结构完全一致。

### 实现方式

1. 先读取旧代码 `legacy_ro/yz-legacy-code/pages/user_agreement/user_agreement.wxml`，**完整复制所有文案内容**
2. 使用 `TopBarWithBack` 导航栏 + `ScrollView`（scrollY）包裹全部内容
3. 内容以 JSX 硬编码，保留旧代码中的完整销售条款文本
4. 13 个章节结构：一般条件 → 卖方信息 → 珠宝作品信息 → 价格 → 订单 → 支付 → 交付 → 退货 → 瑕疵 → 隐私政策 → 责任限制 → 知识产权 → 适用法律
5. 底部留白区域

**重要**：文案必须从旧代码 WXML 中 1:1 复制，不要自己编写或修改任何法律文本。

### UI 结构

```
TopBarWithBack
└── ScrollView（scrollY, marginTop 偏移）
    ├── main-title「销售条款」
    ├── chapter-1（一般条件 1.1-1.3）
    │   ├── chapter-title
    │   └── paragraphs...
    ├── chapter-2（卖方信息 2.1）
    │   ├── chapter-title
    │   └── paragraphs...
    ├── ... chapters 3-13 ...
    └── bottom-spacer（底部留白）
```

### 关键样式要点

与隐私政策页完全相同的样式规范。SCSS 文件内容可以与隐私政策页一致。

---

## 产出

- Splash 启动页 3 个文件（`pages/splash/` 下的 index.tsx + index.config.ts + index.module.scss）
- 咨询页 3 个文件（`pages-sub/consultation/` 下）
- 隐私政策页 3 个文件（`pages-sub/privacy-policy/` 下）
- 用户协议页 3 个文件（`pages-sub/user-agreement/` 下）
- 补充 `src/constants/index.ts`（添加 `SPLASH_VIDEO_URL` 常量）

## 要求

- Splash 页面使用 Taro `Video` 组件（先用 context7 确认正确导入和属性用法）
- Splash 页面使用 `useAppStore` 的 `privacyAgreed` 和 `agreePrivacy()`，调用前先读取 store 确认接口
- Splash 页面视频结束/跳过/出错均触发隐私协议检查，防止重复触发
- Splash 页面隐私弹窗的「查看详情」跳转到 `/pages-sub/privacy-policy/index`
- Splash 页面隐私弹窗的「同意」调用 `agreePrivacy()` 后跳转首页（`switchTab`）
- Splash 页面不需要 TopBarWithBack（全屏视频页面）
- 咨询页使用 TopBarWithBack + FloatBtn + FloatPopup
- 隐私政策和用户协议的文案必须从旧代码 WXML 中 1:1 完整复制，不要自己编写或修改任何法律文本
- 隐私政策和用户协议使用 TopBarWithBack + ScrollView（scrollY）
- 所有分包页面使用 TopBarWithBack + marginTop 偏移（参考已实现的 VIP 预约页面）
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 完成后运行 `npm run build:weapp` 确认编译通过

---
