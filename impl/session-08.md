# 会话 8：Phase 04a 导航组件 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 04 的第一部分：导航相关共享组件。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认（Taro 组件 API、NutUI 等），绝对不要凭经验猜测。
2. 优先使用 NutUI（`@nutui/nutui-react-taro`）提供的基础组件作为构建块，仅在 NutUI 无法满足时才完全手写。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/04-core-components.md`（只需关注实现要求 1、2、12：TopBar、TopBarWithBack、CustomTabBar）

## 前置依赖

Sessions 01-07 已完成：types/、services/、utils/、constants/、stores/、hooks/ 全部就绪。

## 本次任务

1. 创建 `src/components/TopBar/index.tsx` + `index.module.scss`
   - Props：imageSrc、backgroundColor、barHeight
   - 使用 useSystemInfo 获取 statusBarHeight
   - fixed 定位，z-index 999，logo 居中 heightFix
   - backgroundColor 通过 inline style 支持动态传入（配合 useNavBarScroll）

2. 创建 `src/components/TopBarWithBack/index.tsx` + `index.module.scss`
   - Props：imageSrc、backgroundColor、barHeight
   - 始终显示返回按钮（左侧 back.png 图标）
   - 返回逻辑：页面栈 > 1 则 navigateBack，否则 switchTab 到首页

3. 创建 `src/custom-tab-bar/index.tsx` + `index.module.scss`
   - 4 个 Tab：首页、分类、购物车、我的
   - 从 useAppStore 读取 currentTab，点击时 switchTab + setCurrentTab
   - 选中/未选中两套图标，颜色 #999999 / #333333
   - fixed 定位底部，安全区 padding，z-index 999

## 产出

- 3 个组件（6 个文件）

## 要求

- 遵循 CONVENTIONS.md 组件模板（函数组件 + SCSS Modules）
- TopBar/TopBarWithBack 的 statusBarHeight 通过 useSystemInfo hook 获取
- CustomTabBar 的图标文件路径先用占位路径（`/assets/icons/home.png` 等），后续 session 补充实际图标
- 样式使用 rpx 单位
- 完成后运行 `npm run build:weapp` 确认编译通过

---
