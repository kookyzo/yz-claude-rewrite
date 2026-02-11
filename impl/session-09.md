# 会话 9：Phase 04b 商品展示组件 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 04 的第二部分：商品展示相关共享组件。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认（Taro 组件 API、NutUI 等），绝对不要凭经验猜测。
2. 优先使用 NutUI（`@nutui/nutui-react-taro`）提供的基础组件作为构建块，仅在 NutUI 无法满足时才完全手写。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/04-core-components.md`（只需关注实现要求 3、4、9：ProductCard、SizePopup、SlidingBar）

## 前置依赖

Sessions 01-08 已完成：基础设施 + 导航组件就绪。

## 本次任务

1. 创建 `src/components/ProductCard/index.tsx` + `index.module.scss`
   - Props：skuId、image、name、nameEN、productId、price、onAddToCart、onPress
   - 点击大图跳转商品详情页，点击加购按钮调用 onAddToCart
   - 价格使用 formatPrice 格式化
   - 卡片高度 750rpx，大图占 80%，底部信息区 flex 布局

2. 创建 `src/components/SizePopup/index.tsx` + `index.module.scss`
   - Props：visible、onClose
   - 内部状态切换 bracelet/ring 两套尺寸对照表
   - 全屏遮罩 + 居中弹窗，底部"我了解了"按钮
   - 可考虑使用 NutUI 的 Popup 组件作为底层

3. 创建 `src/components/SlidingBar/index.tsx` + `index.module.scss`
   - Props：items、activeId、onSelect、scrollX、scrollY
   - 使用 Taro ScrollView，完全受控组件
   - 选中状态通过 activeId 控制，点击触发 onSelect

## 产出

- 3 个组件（6 个文件）

## 要求

- 遵循 CONVENTIONS.md 组件模板（函数组件 + SCSS Modules）
- ProductCard 使用 `@/utils/format` 的 formatPrice
- 样式使用 rpx 单位，关键样式值按照 spec 中的数值
- 完成后运行 `npm run build:weapp` 确认编译通过

---
