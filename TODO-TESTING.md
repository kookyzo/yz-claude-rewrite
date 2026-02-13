# 待办测试事项

## 微信支付流程测试

- **状态**：待测试
- **涉及页面**：`pages-sub/payment/index`（Session 18 实现）
- **操作**：在后台设置一个 1 块钱的商品，用于走通完整支付流程
- **验证点**：
  - `Taro.requestPayment` 调用（signType: `RSA`）
  - 支付成功 → 查询支付结果 → 更新订单状态为 `paid` → 购物车模式清除已购商品 → 跳转订单列表
  - 支付失败/取消 → 更新订单状态为 `payment_failed` → Toast 提示 → 返回
  - 三种入口模式都需要测试：购物车结算、直接购买、订单重新支付

## Phase 07 用户中心功能测试

> 所有用户中心页面需要等全部实现完成后统一测试，因为页面间存在大量跳转和数据传递依赖。

### 1. 注册流程（register）
- **状态**：待测试
- **涉及页面**：`pages-sub/register/index`（Session 20）
- **验证点**：
  - 姓名输入 + 称谓选择（先生/女士/其他）
  - 手机号手动输入（11位限制）
  - 手机号一键授权（`Button openType="getPhoneNumber"` → `bindPhone(code)` → 返回手机号）
  - 生日日期选择器（范围限制 + 18岁年龄校验）
  - 条款勾选逻辑（privacy 必选 + 全选联动）
  - 表单验证错误态（红色边框提示）
  - 提交注册 → `userService.register()` → 成功后 `fetchUserInfo()` 刷新 store → navigateBack
  - 重复注册（code 409）提示处理

### 2. 编辑个人信息（edit-info）
- **状态**：待测试
- **涉及页面**：`pages-sub/edit-info/index`（Session 20）
- **验证点**：
  - 页面加载时从 `getUserInfo()` 回填表单数据
  - 本地缓存 fallback（云函数失败时）
  - 性别选择（女士/男士）
  - 称谓 Picker（selector 模式）
  - 生日 Picker（date 模式）
  - 地区 Picker（region 模式，显示格式 `省 - 市 - 区`）
  - 电话/邮箱输入 + 验证（邮箱可选）
  - 验证失败红色边框 + 红色 placeholder
  - 隐私协议勾选检查
  - 提交保存 → `updateUser()` → `fetchUserInfo()` → 延迟 400ms navigateBack
  - "前往编辑地址信息"跳转到地址列表页

### 3. 地址列表（address-list）
- **状态**：待测试
- **涉及页面**：`pages-sub/address-list/index`（Session 21）
- **验证点**：
  - 空状态显示 + 新增地址按钮
  - 地址卡片展示（收件人、电话、省市区、详细地址、默认标签）
  - 编辑按钮 → 跳转编辑页（带 addressId 参数）
  - 删除按钮 → showModal 确认 → 删除 → 刷新列表
  - 设为默认 → 刷新列表
  - 新增地址按钮 → 跳转编辑页（无参数）
  - `useDidShow` 每次显示刷新列表（从编辑页返回后自动更新）
  - 选择模式（`?select=1`）：点击地址 → eventCenter 回传 → navigateBack

### 4. 新增/编辑地址（address-edit）
- **状态**：待测试
- **涉及页面**：`pages-sub/address-edit/index`（Session 21）
- **验证点**：
  - 新增模式：空表单
  - 编辑模式：从 `listAddresses` 找到对应地址 → 回填表单（`provinceCity.split('-')` 还原 region）
  - 收件人/电话/详细地址输入 + 验证
  - 地区 Picker（region 模式）+ 动态字号调整
  - 一键定位（`Taro.chooseLocation()`）→ 解析地址字符串 → 填充地区和详细地址
  - 一键定位权限拒绝 → 引导去设置页
  - 设为默认 checkbox
  - `provinceCity` 存储格式 `region.join('-')`
  - 保存成功 → navigateBack

### 5. 订单列表（order-list）
- **状态**：待测试（Session 22 实现后）
- **验证点**：
  - 5 Tab 切换（全部/待付款/待发货/待收货/待评价）
  - 从"我的"页不同入口进入时 Tab 定位正确（`?type=pending_payment` 等）
  - 订单卡片展示（日期、编号、状态、商品图片、名称、价格）
  - 待付款：取消订单 + 立即支付跳转
  - 待发货：申请售后跳转
  - 待收货：确认收货
  - 已完成：评价弹窗
  - 空状态 + "去挑选商品"跳转
  - 每次 onShow 刷新当前 Tab 数据

### 6. 售后相关页面
- **状态**：待测试（Session 23-24 实现后）
- **验证点**：
  - 售后入口页：保养指南 4 Tab + 售后申请表单（选商品、选原因、描述、上传图片）
  - 售后详情页：4 个可折叠服务项目（手风琴效果）
  - 退款申请页：订单编号只读 + 问题描述 + 联系方式 + 提交
  - 退换详情页：静态政策展示

### 关键跨页面流程测试

以下流程涉及多个页面间的数据传递，需要端到端测试：

1. **注册 → 我的页**：注册成功后 navigateBack，"我的"页应显示已注册状态
2. **我的页 → 编辑信息 → 地址列表 → 地址编辑**：完整的个人信息编辑链路
3. **支付页 → 选地址 → 地址列表/编辑**：eventCenter 地址回传机制
4. **订单列表 → 支付页**：待付款订单重新支付
5. **订单列表 → 退款申请**：售后流程入口
