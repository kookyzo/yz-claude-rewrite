# 会话 11：Phase 04d 加载与表单弹窗组件 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 04 的第四部分：加载指示器与表单弹窗组件。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认（Taro 组件 API、NutUI 等），绝对不要凭经验猜测。
2. 优先使用 NutUI（`@nutui/nutui-react-taro`）提供的基础组件作为构建块（如 Popup、Rate、TextArea、Picker 等），仅在 NutUI 无法满足时才完全手写。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/04-core-components.md`（只需关注实现要求 8、10、11：LoadingBar、ReviewPopup、SignUpPopup）

## 前置依赖

Sessions 01-10 已完成：基础设施 + 前三批组件就绪。

## 本次任务

1. 创建 `src/components/LoadingBar/index.tsx` + `index.module.scss`
   - Props：visible、onFinish
   - 全屏白色半透明遮罩，居中 logo + 进度条
   - 进度条逻辑：150ms 间隔随机增长 5-15，上限 95%；隐藏时设为 100%，300ms 后重置
   - useRef 存储 interval ID，useEffect cleanup 清除定时器

2. 创建 `src/components/ReviewPopup/index.tsx` + `index.module.scss`
   - Props：visible、productImage、productName、productNameEN、onSubmit、onClose
   - 底部弹出式评价弹窗，高度 1250rpx
   - 三维星级评分（描述相符、物流服务、服务态度），各 5 星，默认 5 分
   - 星级文字映射：['非常差', '差', '一般', '好', '非常好']
   - 文字评价 Textarea 最多 500 字，实时字数统计
   - 图片上传（Taro.chooseImage，最多 9 张）
   - 可考虑使用 NutUI 的 Rate 组件处理星级评分

3. 创建 `src/components/SignUpPopup/index.tsx` + `index.module.scss`
   - Props：visible、onSubmit、onClose
   - 居中注册表单弹窗，完整注册流程
   - 表单字段：性别（单选）、称谓（Picker）、昵称、生日（DatePicker）、电话（支持微信一键获取）、邮箱、地区（RegionPicker）
   - 表单验证：称谓必选、昵称非空、电话 /^1[3-9]\d{9}$/、邮箱格式（若填写）
   - 验证失败：placeholder 变红 #CE1616
   - 隐私协议勾选必须同意才能提交
   - 提交调用 userService.register()

## 产出

- 3 个组件（6 个文件）

## 要求

- 遵循 CONVENTIONS.md 组件模板（函数组件 + SCSS Modules）
- SignUpPopup 使用 `@/utils/validate` 的验证函数和 `@/services/user.service` 的 register
- ReviewPopup 的星星点击逻辑：点击第 N 颗则 1~N 全部点亮
- 所有弹窗支持点击遮罩关闭
- 样式使用 rpx 单位
- 完成后运行 `npm run build:weapp` 确认编译通过

---
