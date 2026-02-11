# 会话 7：Phase 03b 自定义 Hooks — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 03 的第二部分：自定义 React Hooks。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认（Taro Hooks API 等），绝对不要凭经验猜测。
2. 特别注意 `usePageScroll` 是 Taro 专有 Hook，只能在页面级组件中使用。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/03-stores-and-hooks.md`（只需关注实现要求 4-8：useAuth、useSystemInfo、useImageProcessor、useNavBarScroll、usePagination）

## 前置依赖

Sessions 01-06 已完成：types/、services/、utils/、constants/、stores/ 全部就绪。

## 本次任务

1. 创建 `src/hooks/useAuth.ts`
   - 从 useUserStore 读取状态
   - ensureLogin：未登录则自动调用 login()
   - ensureRegistered：未注册则跳转注册页

2. 创建 `src/hooks/useSystemInfo.ts`
   - 从 useAppStore 读取 systemInfo
   - 若未初始化返回安全默认值（statusBarHeight: 20、navBarHeight: 44）
   - 纯读取，无副作用

3. 创建 `src/hooks/useImageProcessor.ts`
   - processImages：批量转换 cloud:// URLs 并压缩
   - 内部使用 useRef 跟踪 processing 状态，防止卸载后 setState
   - 默认压缩参数：width=300, height=300, quality=50

4. 创建 `src/hooks/useNavBarScroll.ts`
   - 使用 Taro 的 `usePageScroll` 监听滚动
   - 滚动变色算法：opacity = scrollTop / criticalScrollTop（默认 400）
   - RGB 线性插值从黑到白，opacity > 0.5 时文字切换为黑色
   - 返回 backgroundColor、textColor、opacity

5. 创建 `src/hooks/usePagination.ts`
   - 泛型 Hook：`usePagination<T>(options)`
   - refresh：重置到第一页
   - loadMore：hasMore && !loading 时加载下一页追加数据
   - useRef 防止并发请求，组件卸载时取消后续 setState

## 产出

- 5 个自定义 Hook 文件

## 要求

- 从 stores 和 services 导入时使用 `@/` 路径别名
- useNavBarScroll 的 `usePageScroll` 从 `@tarojs/taro` 导入
- usePagination 的默认 pageSize 为 200（与 constants 中 DEFAULT_PAGE_SIZE 一致）
- 完成后运行 `npm run build:weapp` 确认编译通过

---
