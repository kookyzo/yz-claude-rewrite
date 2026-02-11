# 会话 3：Phase 02b 工具函数 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 02 的第二部分：工具函数。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 严格按照 spec 中的函数签名实现。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/02-foundation.md`（只需关注实现要求 9-12）

## 前置依赖

Phase 01 + Session 02 已完成：项目骨架就绪，types/、constants/、services/cloud.ts 已创建。

## 本次任务

1. 创建 `src/utils/format.ts`
   - `formatPrice(price: number): string` — 12345 → "12,345.00"
   - `formatDate(timestamp: number): string` — timestamp → "YYYY-MM-DD"
   - `formatPhone(phone: string): string` — 13812345678 → "138****5678"

2. 创建 `src/utils/image.ts`
   - `processCloudUrl(cloudUrl: string): Promise<string>` — cloud:// → HTTP URL（使用 `Taro.cloud.getTempFileURL`）
   - `batchConvertUrls(urls: string[], batchSize?: number, concurrency?: number): Promise<string[]>` — 批量转换，默认 50/批、3 并发
   - `compressImageUrl(httpUrl: string, width: number, height: number, quality?: number): string` — 拼接腾讯云 COS 压缩参数 `?imageView2/1/w/{w}/h/{h}/q/{q}`，跳过已含 imageView2/imageMogr2 的 URL

3. 创建 `src/utils/validate.ts`
   - `isValidPhone(phone: string): boolean` — 正则 `/^1[3-9]\d{9}$/`
   - `isValidEmail(email: string): boolean`
   - `isNotEmpty(value: string): boolean`

4. 创建 `src/utils/navigation.ts`
   - `navigateTo(url: string): void`
   - `switchTab(url: string): void`
   - `navigateBack(delta?: number): void`
   - `redirectTo(url: string): void`
   - 均为 Taro 导航 API 的简单封装

## 产出

- 4 个工具函数文件（utils/）

## 要求

- 遵循 CONVENTIONS.md 中的命名规范
- image.ts 中 `batchConvertUrls` 的批量+并发逻辑要与旧代码一致（50/批、最多3并发）
- image.ts 中 `compressImageUrl` 仅处理 http/https URL，跳过已含压缩参数的 URL
- 使用 `@/` 路径别名导入 constants（如 IMAGE_BATCH_SIZE）
- 完成后运行 `npm run build:weapp` 确认编译通过

---
