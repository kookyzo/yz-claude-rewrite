# 会话 15：Phase 05d 我的页 my — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 05 的第四部分：我的页（my）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用时业务参数必须包在 `data` 字段下（`{ action, data: { ... } }`），不要平铺在顶层。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定，特别注意 Service 调用模式和已知配置要点）
2. `specs/05-tab-pages.md`（关注「旧代码摘要 → 4. 我的页」部分）

## 参考旧代码（必读，1:1 还原 UI）

开始编码前，必须先完整阅读以下旧代码，理解页面结构、布局、间距、颜色等视觉要素：
- `legacy_ro/yz-legacy-code/pages/My/My.wxml`（页面结构，优先读）
- `legacy_ro/yz-legacy-code/pages/My/My.wxss`（样式细节，优先读）
- `legacy_ro/yz-legacy-code/pages/My/My.js`（交互逻辑和数据流）

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-14 已完成：所有基础设施 + 共享组件 + 首页 + 分类页 + 购物车页就绪。

### 已有的关键基础设施（必须先读取理解）

- `src/stores/useUserStore.ts` — 用户状态管理（fetchUserInfo → 更新 isRegistered / userInfo）
- `src/services/user.service.ts` — 用户云函数封装（getUserInfo、login、checkLogin）
- `src/services/wish.service.ts` — 心愿单服务（listWishes 用于获取心愿单数量）
- `src/types/user.ts` — User 类型定义（_id、firstName、lastName、nickname、phone、birthday、gender、title、mail、region）
- `src/hooks/useAuth.ts` — 登录/注册状态检查（ensureLogin）
- `src/stores/useAppStore.ts` — setCurrentTab(3) 设置 TabBar 选中状态

## 本次任务

改写 `src/pages/my/index.tsx` + `index.config.ts` + `index.module.scss`（当前为占位文件）

### 核心功能点

1. **登录与注册状态检查**
   - `useLoad` 中调用 `useAuth.ensureLogin()` 确保已登录
   - 调用 `useUserStore.fetchUserInfo()` 获取用户信息并更新 `isRegistered`
   - 根据 `isRegistered` 设置按钮文字：已注册 → "编辑地址"，未注册 → "立即注册"

2. **用户信息加载**
   - 通过 `useUserStore.fetchUserInfo()` 从云端加载
   - 调用 `wishService.listWishes(userId)` 获取心愿单列表，仅取数量用于角标显示
   - 构建 `personal_info` 展示数组：昵称、电话、生日、地区、收货地址

3. **问候语计算（`computeGreeting`）**
   - 从 `userInfo` 中获取 `nickname` 或 `lastName`
   - 支持复姓识别：欧阳、司马、诸葛、上官、皇甫、令狐、司徒、东方、西门、南宫
   - 拼接称谓：`{姓}{title}`，如"刘女士"、"欧阳先生"
   - 未注册用户显示默认问候语"欢迎"
   - 在 `useDidShow` 中重新计算（用户可能在编辑信息页修改了姓名）

4. **页面导航**（路径已映射到新项目的 subPackages 结构）

   | 功能 | 新路径 |
   |------|--------|
   | 我的订单（默认待付款） | `navigateTo('/pages-sub/order-list/index?tab=1')` |
   | 按状态跳转订单 | `navigateTo('/pages-sub/order-list/index?tab=${n}')` — 1=待付款, 2=待发货, 3=待收货, 4=已完成, 5=全部, 6=售后 |
   | 心愿单 | `navigateTo('/pages-sub/wishlist/index')` |
   | 编辑个人信息（已注册） | `navigateTo('/pages-sub/edit-info/index')` |
   | 立即注册（未注册） | `navigateTo('/pages-sub/register/index')` |
   | 售后服务 | `navigateTo('/pages-sub/after-sales/index')` |
   | 预约 | 检查登录 → 跳转 `navigateTo('/pages-sub/reservation/index')` |
   | 隐私政策 | `navigateTo('/pages-sub/privacy-policy/index')` |
   | 用户协议 | `navigateTo('/pages-sub/user-agreement/index')` |
   | 在线咨询 | `setIsPopupShow(true)` 打开 FloatPopup |

5. **浮动咨询** — FloatBtn + FloatPopup

### 生命周期

| Taro Hook | 逻辑 |
|-----------|------|
| `useLoad` | 调用 `ensureLogin()`；调用 `loadUserData()`（fetchUserInfo + listWishes） |
| `useDidShow` | `useAppStore.getState().setCurrentTab(3)`；重新计算问候语；可选：重新 fetchUserInfo 以获取最新数据 |

### UI 结构

```
TopBar（白色背景）
├── 顶部欢迎区
│   ├── 背景图片（旧代码中的欢迎背景）
│   ├── 欢迎文字 "Welcome"
│   └── 问候语（如"刘女士"，未注册显示"欢迎"）
├── 功能入口区（4 个图标按钮，水平排列）
│   ├── 我的订单（图标 + 文字，跳转订单列表）
│   ├── 心愿单（图标 + 文字 + 数量角标，跳转心愿单）
│   ├── 个人信息（图标 + 文字，已注册→编辑信息 / 未注册→注册页）
│   └── 售后服务（图标 + 文字，跳转售后列表）
├── 滚动内容区
│   ├── 客服服务区
│   │   └── "联系在线客服"按钮（使用 Button open-type="contact"）
│   ├── 微信二维码区
│   │   └── 品牌微信二维码图片
│   ├── 政策链接区
│   │   ├── 销售条款（跳转用户协议）
│   │   └── 隐私政策（跳转隐私政策）
│   └── 账号注销说明文字
├── FloatBtn（浮动咨询按钮）
└── FloatPopup（在线咨询弹窗）
```

### 数据流

```
useLoad
  → ensureLogin()
  → fetchUserInfo()（store 方法，更新 isRegistered + userInfo）
  → listWishes(userId)（仅取 count）
  → computeGreeting(userInfo)

useDidShow
  → setCurrentTab(3)
  → 重新 computeGreeting（用户可能修改了信息）
```

### 图标资源

旧代码中"我的"页面使用了多个图标（订单、心愿单、个人信息、售后等）。如果 `src/assets/icons/` 中缺少对应图标，从 `legacy_ro/yz-legacy-code/` 中找到并复制过来。旧代码的图片资源可能在 `pages/My/` 目录或 `images/` 目录下。

## 产出

- 我的页 3 个文件（index.tsx + index.config.ts + index.module.scss）
- 如有缺失的图标资源，从 legacy 复制到 `src/assets/icons/`

## 要求

- 用户状态读取通过 `useUserStore`，心愿单数量通过 `wishService.listWishes` 直接调用
- 使用已有的 hooks：useAuth
- 使用已有的组件：TopBar、FloatBtn、FloatPopup、LoadingBar
- 使用已有的 utils：navigateTo / switchTab（from `@/utils/navigation`）
- `useDidShow` 中设置 `useAppStore.getState().setCurrentTab(3)`
- 页面配置使用 `navigationStyle: 'custom'` 配合 TopBar 组件
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- "联系在线客服"按钮使用微信原生 `Button` 的 `open-type="contact"` 能力
- 完成后运行 `npm run build:weapp` 确认编译通过

---
