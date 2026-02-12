# 会话 12：Phase 05a 首页 home — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 05 的第一部分：首页（home）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认（Taro Swiper、IntersectionObserver、usePageScroll 等），绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. 首页逻辑复杂（旧代码 1365 行），请仔细阅读 spec 和旧代码后再动手。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/05-tab-pages.md`（只需关注「旧代码摘要 → 1. 首页」部分，约前 130 行）

## 参考旧代码（必读，1:1 还原 UI）

本次任务要求 1:1 还原旧版首页的 UI 样式和交互。开始编码前，必须先完整阅读以下旧代码，理解页面结构、布局细节、间距、颜色、动画等视觉要素：
- `legacy_ro/yz-legacy-code/pages/home/home.wxml`（页面结构，优先读）
- `legacy_ro/yz-legacy-code/pages/home/home.wxss`（样式细节，优先读）
- `legacy_ro/yz-legacy-code/pages/home/home.js`（交互逻辑和数据流）

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。如果 spec 与旧代码有出入，样式方面以旧代码为准。

## 前置依赖

Sessions 01-11 已完成：所有基础设施 + 共享组件就绪。

## 本次任务

创建 `src/pages/home/index.tsx` + `index.config.ts` + `index.module.scss`

### 核心功能点

1. **导航栏滚动变色** — 使用 useNavBarScroll hook，将 backgroundColor 传给 TopBar
2. **全屏轮播 Banner** — Taro Swiper 组件，数据从 bannerService.listBanners() 获取，点击跳转分类页
3. **预约入口** — 图片+文字，点击跳转预约页
4. **系列展示区**
   - 系列 Tab 栏（SlidingBar 组件）+ 系列大图 Swiper + 商品卡片横向滚动
   - IntersectionObserver 监听进入视口时启动自动滑动（3s 间隔）
   - 触摸暂停，触摸结束 3s 后恢复
   - 商品预加载策略：首屏优先 → 相邻系列 → 批量剩余
5. **模特展示区** — 与系列展示区逻辑类似，4 个固定 SKU ID
6. **浮动咨询** — FloatBtn + FloatPopup 组件
7. **加载指示器** — LoadingBar 组件

### 布局计算

- rpx 转换比例：`750 / windowWidth`
- TopBar 总高度 = `110rpx + statusBarHeight * rpxRatio`
- Swiper 容器高度 = `windowHeightRpx - topBarTotalHeight`
- Banner 高度 = `windowHeightRpx - topBarTotalHeight - 100rpx（tabBar）`

### 数据加载

- onLoad 并行调用：loadBanners、loadSubSeries、loadModelShowData
- 图片处理：使用 useImageProcessor 批量转换 cloud:// URL 并压缩

## 产出

- 首页 3 个文件（index.tsx + index.config.ts + index.module.scss）

## 要求

- 使用已有的 hooks：useNavBarScroll、useSystemInfo、useImageProcessor
- 使用已有的 services：bannerService、productService
- 使用已有的组件：TopBar、ProductCard、FloatBtn、FloatPopup、LoadingBar、SlidingBar
- onShow 时设置 useAppStore.setCurrentTab(0)
- 样式使用 rpx 单位
- 完成后运行 `npm run build:weapp` 确认编译通过

---
