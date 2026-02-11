# 会话 1：Phase 01 项目初始化 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 01：项目初始化。

**极其重要的原则：**
1. 遇到任何 Taro API、配置项、CLI 命令不确定的地方，必须先用 context7 MCP 工具查 Taro 官方文档确认，绝对不要凭经验猜测。
2. 云函数原样复制，不做任何修改。
3. 备份/副本云函数不复制（目录名含"副本"或"备份"的跳过）。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/01-project-init.md`（完整读取，本次任务的全部 spec）

无依赖文件，这是第一个实现会话。

## 当前状态

Taro 项目已通过 `npx @tarojs/cli init` 初始化完成，使用 react-NutUI 模板（Vite + TypeScript + Sass）。项目文件已移动到根目录，tsconfig.json 已配置好（strict + ESNext + paths alias）。已安装的关键依赖：
- Taro 4.1.10 + React 18 + TypeScript 5
- Vite 构建（`@tarojs/vite-runner`）
- NutUI 组件库（`@nutui/nutui-react-taro`）
- Zustand **尚未安装**

## 本次任务

1. 安装 Zustand 依赖：`npm install zustand`
2. 配置 `project.config.json`（AppID: `wxfe20c0865a438545`，云环境: `cloud1-9glm8muj52815539`）
3. 配置 `app.ts` 中的云开发初始化（`Taro.cloud.init()`）
4. 配置 `app.config.ts`（页面路由、自定义 TabBar、窗口配置）— 严格按照 spec 中的配置
5. 确认 `config/index.ts` 中 `compiler: 'vite'`，启用 SCSS Modules
6. 从 `legacy_ro/yz-legacy-code/cloudfunctions/` 复制云函数到项目根目录 `cloudfunctions/`，排除以下目录：
   - `bindPhoneNumber - 副本`
   - `get-product备份`
   - `manage-cart - 副本`
   - `manage-activity`（未使用）
7. 创建基础目录结构（src/types/、src/services/、src/stores/、src/hooks/、src/utils/、src/constants/、src/components/、src/assets/）
8. 确保项目能通过 `npm run build:weapp` 编译

## 产出

- 可编译运行的 Taro 项目骨架（Vite + NutUI）
- 云函数已复制到 `cloudfunctions/`
- `app.ts` 中云开发已初始化
- `app.config.ts` 中页面路由已配置
- 所有 src 子目录已创建
- Zustand 已安装

## 要求

- 遵循 CONVENTIONS.md 中的命名和文件结构规范
- spec 中有详细的 `app.config.ts` 配置内容，请严格按照 spec 实现
- 构建工具为 Vite（不是 Webpack），确认 config/index.ts 中 compiler 配置正确
- 完成后运行 `npm run build:weapp` 确认编译通过

---
