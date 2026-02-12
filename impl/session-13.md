# 会话 13：Phase 05b 分类页 category — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 05 的第二部分：分类页（category）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用时业务参数必须包在 `data` 字段下（`{ action, data: { ... } }`），不要平铺在顶层。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定，特别注意 Service 调用模式和已知配置要点）
2. `specs/05-tab-pages.md`（关注「旧代码摘要 → 2. 分类页」部分）

## 参考旧代码（必读，1:1 还原 UI）

开始编码前，必须先完整阅读以下旧代码，理解页面结构、布局、间距、颜色等视觉要素：
- `legacy_ro/yz-legacy-code/pages/Category/Category.wxml`（页面结构，优先读）
- `legacy_ro/yz-legacy-code/pages/Category/Category.wxss`（样式细节，优先读）
- `legacy_ro/yz-legacy-code/pages/Category/Category.js`（交互逻辑和数据流）

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-12 已完成：所有基础设施 + 共享组件 + 首页就绪。

## 本次任务

创建 `src/pages/category/index.tsx` + `index.config.ts` + `index.module.scss`

### 核心功能点

1. **三层筛选体系**
   - ALL 默认视图：显示子系列网格（大图 + 名称）
   - 一级筛选：点击子系列/品类/材质进入对应筛选视图，显示商品列表
   - 二次筛选面板：在一级筛选基础上叠加多条件组合筛选（subSeriesIds + categoryIds + materialIds）

2. **筛选区块（filterSections）**
   - 三个区块：子系列、品类、材质
   - 每个区块水平滚动展示选项（图片 + 名称）
   - 点击选项进入对应筛选，高亮选中项

3. **排序功能**
   - 三种排序：默认、价格升序、价格降序
   - 排序选项面板（下拉展示）

4. **商品列表**
   - 使用 ProductCard 组件展示
   - 分页加载（pageSize: 200）
   - 加载状态和空状态处理

5. **图片处理** — 使用 useImageProcessor 批量转换 cloud:// URL

6. **浮动咨询** — FloatBtn + FloatPopup

### 数据加载

- onLoad 并行加载：子系列列表、品类列表、材质列表
- 切换筛选时加载对应商品列表
- 图片批量转换和压缩

## 产出

- 分类页 3 个文件（index.tsx + index.config.ts + index.module.scss）

## 要求

- 使用已有的 services：productService（注意参数包在 data 下）
- 使用已有的 hooks：useSystemInfo、useImageProcessor
- 使用已有的组件：TopBar、ProductCard、FloatBtn、FloatPopup、LoadingBar
- onShow 时设置 useAppStore.setCurrentTab(1)
- 样式使用 rpx 单位
- 完成后运行 `npm run build:weapp` 确认编译通过

---
