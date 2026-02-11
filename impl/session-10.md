# 会话 10：Phase 04c 浮窗与弹窗组件 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 04 的第三部分：浮窗与弹窗组件。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认（Taro 组件 API、NutUI 等），绝对不要凭经验猜测。
2. 优先使用 NutUI（`@nutui/nutui-react-taro`）提供的基础组件作为构建块（如 Popup、Overlay），仅在 NutUI 无法满足时才完全手写。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/04-core-components.md`（只需关注实现要求 5、6、7：FloatPopup、FloatBtn、CartSuccessPopup）

## 前置依赖

Sessions 01-09 已完成：基础设施 + 导航组件 + 商品展示组件就绪。

## 本次任务

1. 创建 `src/components/FloatPopup/index.tsx` + `index.module.scss`
   - Props：visible、onClose
   - 底部弹出式咨询弹窗，三个按钮：在线客服（openType="contact"）、客服电话（Taro.makePhoneCall）、取消
   - 滑入动画 translateY，过渡 0.3s ease-in-out
   - 点击遮罩关闭

2. 创建 `src/components/FloatBtn/index.tsx` + `index.module.scss`
   - Props：onPress
   - 固定定位圆形浮动按钮，bottom: 220rpx, right: 40rpx
   - 80rpx 圆形，白色背景，阴影，点击缩放 scale(0.95)

3. 创建 `src/components/CartSuccessPopup/index.tsx` + `index.module.scss`
   - Props：visible、onContinue、onGoToCart、onClose
   - 居中弹窗，"已加入购物车"标题
   - 两个横排按钮：继续选购（黑底白字）、前往购物车（灰底黑字）
   - 缩放动画 scale(0.8) → scale(1)

## 产出

- 3 个组件（6 个文件）

## 要求

- 遵循 CONVENTIONS.md 组件模板（函数组件 + SCSS Modules）
- FloatPopup 的电话号码使用 `@/constants` 中的 CONSULTATION_PHONE
- 所有弹窗支持点击遮罩关闭
- 样式使用 rpx 单位，关键样式值按照 spec
- 完成后运行 `npm run build:weapp` 确认编译通过

---
