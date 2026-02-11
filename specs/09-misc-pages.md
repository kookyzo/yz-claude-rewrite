# Phase 09: 杂项页面

## 目标

实现 6 个杂项页面：启动页（splash）、收藏夹（wishlist）、咨询（consultation）、隐私政策（privacy-policy）、用户协议（user-agreement）、商品 CMS 管理（product-cms）。

## 前置依赖

- Phase 02 完成（`services/`、`types/`、`utils/`、`constants/`）
- Phase 03 完成（`stores/`、`hooks/`）
- Phase 04 完成（`components/`，特别是 `TopBarWithBack`、`FloatPopup`、`LoadingBar`）

---

## 旧代码摘要

### 1. Splash 启动页（`pages/splash/splash`）

**状态字段：**
- `videoUrl: string` — 云存储视频 URL（`cloud://cloud1-9glm8muj52815539.636c-cloud1-9glm8muj52815539-1379477689/splash.mp4`）
- `showPopup: boolean` — 隐私协议弹窗显示状态，初始 `false`
- `popup_title: string` — 弹窗标题（"温馨提示"）
- `popup_content: string` — 弹窗内容（隐私条款更新说明文本）
- `videoEnded: boolean` — 视频是否播放结束，初始 `false`

**生命周期逻辑：**
- `onLoad`：打印日志，调用 `checkAudioPermission()` 检查音频权限（创建 `InnerAudioContext` 测试播放）
- `onShow`：空实现，不重复检查

**核心流程（三步串行）：**
1. **视频播放** → 全屏 `<video>` 自动播放，无控件，右上角"跳过"按钮
2. **隐私协议检查** → 视频结束/跳过/出错后调用 `checkPrivacyAgreement()`：
   - 读取 `wx.getStorageSync('privacyAgreed')`
   - 未同意 → 显示隐私弹窗（标题 + 内容 + "查看详情"链接 + 不同意/同意按钮）
   - 已同意 → 进入下一步
   - 点击"同意" → `wx.setStorageSync('privacyAgreed', true)`，进入下一步
   - 点击"查看详情" → `navigateTo('/pages/privacy_policy/privacy_policy')`
3. **地理位置权限** → `checkLocationPermission()`：
   - 通过 `wx.getSetting()` 检查 `scope.userLocation`
   - 未处理过 → 调用 `wx.authorize({ scope: 'scope.userLocation' })`
   - 无论授权成功或失败，都保存状态到 `wx.setStorageSync('locationAuthorized', bool)` 并跳转首页
4. **跳转首页** → `wx.switchTab({ url: '/pages/home/home' })`，失败时 fallback `wx.redirectTo`

**UI 结构：**
- 全屏 `<video>` 组件（autoplay、无控件、无进度条）
- 右上角"跳过"按钮
- 隐私协议弹窗：遮罩层 + 居中弹窗（标题 + 内容 + 查看详情链接 + 不同意/同意按钮）

**云函数调用：** 无

### 2. Wishlist 收藏夹（`pages/wishlist/wishlist`）

**状态字段：**
- `is_empty_wishlist: boolean` — 收藏夹是否为空，初始 `true`
- `loading: boolean` — 加载状态，初始 `false`
- `showTabBarLoading: boolean` — TabBar 加载动画，初始 `false`
- `items: WishItem[]` — 收藏商品列表

**生命周期逻辑：**
- `onLoad`：设置 `showTabBarLoading: true`
- `onShow`：设置 `showTabBarLoading: true`，调用 `refreshWishlistFromCloud()`

**核心逻辑 — `refreshWishlistFromCloud()`：**
1. 调用 `getUserInfo` 云函数获取用户信息
2. 若用户未注册（`code === 404` 或无 `_id`）→ 提示"请先完成注册"，1 秒后跳转注册页
3. 调用 `manage-wish` 云函数（`action: 'list'`，参数 `{ userId: { _id: _userId } }`）
4. 归一化返回数据字段：
   - `name` ← `skuInfo.nameCN` || `spuInfo.name`
   - `foreign_name` ← `skuInfo.nameEN`
   - `price` ← `skuInfo.price` || `spuInfo.referencePrice`
   - `image` ← `skuInfo.skuMainImages[0]` || `spuInfo.mainImages[0]`
   - `material` ← `materialInfo.nameCN`
   - `skuId` ← `skuInfo._id`（注意可能是对象 `{_id: "xxx"}`）
   - `formattedPrice` ← `formatPrice(price)`
5. 更新 `items`、`is_empty_wishlist`、`loading`

**删除收藏 — `remove(e)`：**
- 从 `dataset` 获取 `index` 和 `wishid`
- 调用 `manage-wish` 云函数（`action: 'remove'`，参数 `{ _wishId }`）
- 成功后提示"已移除"，重新调用 `refreshWishlistFromCloud()` 刷新列表

**跳转商品详情 — `goToProductDetail(e)`：**
- 优先使用 `skuId` 跳转：`/pages/Product_Details/Product_Details?_skuId=${skuId}`
- 无 `skuId` 时使用 `spuId` 跳转

**空状态 — `go_shop()`：**
- `wx.switchTab({ url: '/pages/Category/Category' })`

**UI 结构：**
- `TabBarLoading` 组件（加载动画）
- 加载中状态：spinner + "正在加载心愿单..."
- 空状态：提示文字"您的心愿单为空" + "去添加心愿"按钮
- 列表状态：`scroll-view` 垂直滚动，每项包含商品图片、名称、英文名、材质、格式化价格、删除按钮（×）

**云函数调用：** `getUserInfo`、`manage-wish`（list、remove）

### 3. Consultation 咨询（`pages/Consultation/Consultation`）

**状态字段：**
- `isPopupShow: boolean` — 在线咨询弹窗显示状态，初始 `false`

**生命周期逻辑：**
- `onLoad`、`onShow`、`onReady`：均为空实现

**核心逻辑：**
- `open_popup()` — 设置 `isPopupShow: true`
- `onPopupClose()` — 设置 `isPopupShow: false`

**UI 结构：**
- 页面仅包含一行文字和一个导航链接（`navigator` 到首页，`open-type="switchTab"`）
- 引用 `FloatPopup` 组件，通过 `show` 属性控制显示，`bind:close` 监听关闭事件

**云函数调用：** 无

> **注意**：旧代码中 Consultation 页面实际上是一个极简页面，核心功能完全依赖 `FloatPopup` 组件。新版应重新设计为一个完整的咨询页面，包含 `TopBarWithBack` 导航栏和 `FloatPopup` 弹窗。

### 4. Privacy Policy 隐私政策（`pages/privacy_policy/privacy_policy`）

**状态字段：** 无（`data: {}`）

**生命周期逻辑：** 所有生命周期函数（`onLoad`、`onShow`、`onReady`、`onHide`、`onUnload`）均为空实现。

**核心逻辑：** 纯静态页面，无任何业务逻辑。

**UI 结构：**
- `scroll-view`（`scroll-y="true"`）包裹全部内容
- 主标题："微信小程序用户隐私协议"
- 副标题："【Y.Zheng悦涧】用户隐私保护指引"
- 8 个章节，每章包含 `chapter-title` + 多个 `paragraph`：
  1. 引言 — 隐私保护承诺
  2. 一、我们如何收集和使用您的个人信息 — 核心功能必需信息（手机号、称谓、姓名、配送信息）+ 特定功能信息（位置、相机、麦克风、通讯录、手机号、剪贴板）
  3. 二、Cookie 和同类技术
  4. 三、共享、转让、公开披露
  5. 四、存储和保护
  6. 五、您的权利（访问、更正、删除、撤回授权、注销、投诉）
  7. 六、未成年人信息处理
  8. 七、本指引的更新
  9. 八、联系方式 — 客服邮箱 `Yzhengjewelry@163.com`
- 更新日期/生效日期：2025年12月5日
- 底部留白 `bottom-view`

**云函数调用：** 无

### 5. User Agreement 用户协议/销售条款（`pages/user_agreement/user_agreement`）

**状态字段：** 无（`data: {}`）

**生命周期逻辑：** 所有生命周期函数均为空实现。

**核心逻辑：** 纯静态页面，无任何业务逻辑。

**UI 结构：**
- `scroll-view`（`scroll-y="true"`）包裹全部内容
- 标题："销售条款"
- 13 个章节（编号 1.1 ~ 13.1），每章包含 `chapter-title` + 多个 `paragraph`：
  1. 一般条件（1.1-1.3）— 适用范围、消费者定义、条款确认
  2. 卖方信息（2.1）— 广州市言几珠宝有限公司
  3. 珠宝作品信息（3.1-3.3）— 商品描述、库存限制、连接责任
  4. 价格（4.1-4.2）— 人民币计价、定价错误处理
  5. 订单（5.1-5.8）— 购买流程（立即购买/购物袋两种路径）、订单生效、终止条件、所有权转移
  6. 支付（6.1-6.2）— 微信支付、转账费用
  7. 交付（7.1-7.5）— 配送地址、快递验收、物流查询
  8. 退货（8.1）— 定制商品不适用七日无理由退货
  9. 瑕疵（9.1-9.3）— 出厂瑕疵处理
  10. 隐私政策（10.1）— 引用隐私政策
  11. 责任限制（11.1-11.5）— 不可预见损害、不可抗力
  12. 保证和知识产权（12.1-12.2）— 正品保证、商标归属
  13. 适用法律（13.1）— 中国法律管辖
- 底部留白 `bottom-view`

**云函数调用：** 无（纯静态）

### 6. Product CMS 商品管理（`pages/manage-product-cms/manage-product-cms`）

**状态字段：**
- `currentTab: string` — 当前选项卡（`'categories'` | `'materials'` | `'productSizes'` | `'subSeries'`），默认 `'categories'`
- `testResult: string` — 操作结果文本
- `currentObject: object | null` — 当前操作对象详情
- `currentObjectType: string` — 当前对象类型名称
- `currentObjectDisplay: Array<{key, value}>` — 格式化后的对象展示数据
- `currentStep: number` — 完整流程测试当前步骤（0-4）
- `isTestingCompleteFlow: boolean` — 是否正在执行完整流程测试
- `testData: Record<string, Array<{key, value}>>` — 各 Tab 的测试数据（ID、名称等）
- `createdIds: Record<string, string>` — 已创建记录的 ID 缓存（`categoryId`、`materialId`、`productSizeId`、`subSeriesId`、`parentSeriesId`）
- 各 Tab 状态文本：`categoryStatusText`、`materialStatusText`、`productSizeStatusText`、`subSeriesStatusText`

**生命周期逻辑：**
- `onLoad`：调用 `initTestData()` 初始化测试环境

**核心逻辑 — 四个管理模块，每个模块支持完整 CRUD：**

**分类管理（Categories）：**
- `createCategory()` → `manage-category`（`action: 'add'`，参数 `{ categoryName, status, displayImage }`）
- `updateCategory()` → `manage-category`（`action: 'update'`，参数 `{ _categoryId, updateData: { categoryName, status, displayImage } }`）
- `deleteCategory()` → `manage-category`（`action: 'remove'`，参数 `{ _categoryId }`）
- `getCategory()` → `manage-category`（`action: 'get'`，参数 `{ _categoryId }`）
- `getCategoryList()` → `manage-category`（`action: 'list'`）

**材质管理（Materials）：**
- `createMaterial()` → `manage-material`（`action: 'add'`，参数 `{ nameCN, materialImage, sortNum, isEnabled, description }`）
- `updateMaterial()` → `manage-material`（`action: 'update'`，参数 `{ _materialId, updateData: { nameCN, sortNum, description } }`）
- `deleteMaterial()` → `manage-material`（`action: 'remove'`，参数 `{ _materialId }`）
- `getMaterial()` → `manage-material`（`action: 'get'`，参数 `{ _materialId }`）
- `getMaterialList()` → `manage-material`（`action: 'list'`，参数 `{ filterEnabled }`）

**尺寸管理（ProductSizes）：**
- `createProductSize()` → `manage-size`（`action: 'add'`，参数 `{ category: {_id}, type, standard, sizeNum, value, sortNum, isEnabled }`）
- `updateProductSize()` → `manage-size`（`action: 'update'`，参数 `{ _sizeId, updateData: { sizeNum, sortNum } }`）
- `deleteProductSize()` → `manage-size`（`action: 'remove'`，参数 `{ _sizeId }`）
- `getProductSize()` → `manage-size`（`action: 'get'`，参数 `{ _sizeId }`）
- `getProductSizeList()` → `manage-size`（`action: 'list'`，参数 `{ category: {_id}, filterEnabled }`）

**子系列管理（SubSeries）：**
- `createSubSeries()` → `manage-subseries`（`action: 'add'`，参数 `{ parentSeriesId, name, displayImage, introduction, sortNum, isEnabled }`）
- `updateSubSeries()` → `manage-subseries`（`action: 'update'`，参数 `{ _subSeriesId, updateData: { name, introduction, sortNum } }`）
- `deleteSubSeries()` → `manage-subseries`（`action: 'remove'`，参数 `{ _subSeriesId }`）
- `getSubSeries()` → `manage-subseries`（`action: 'get'`，参数 `{ _subSeriesId }`）
- `getSubSeriesList()` → `manage-subseries`（`action: 'list'`，参数 `{ parentSeriesId, filterEnabled }`）

**通用功能：**
- `startCompleteFlow()` — 按顺序执行：创建 → 更新 → 状态切换 → 批量操作
- `batchEnable()` / `batchDisable()` — 批量启用/禁用（当前为占位实现）
- `toggleXxxStatus()` — 各模块状态切换（仅切换本地文本，未调用云函数）
- `formatObjectForDisplay(obj)` — 将对象转为 `[{key, value}]` 数组用于展示

**UI 结构：**
- 顶部 4 个选项卡（分类/材质/尺寸/子系列）
- 测试数据展示区（当前 Tab 的 ID 和名称）
- 完整流程测试按钮
- 动态操作区（根据 `currentTab` 显示对应的 6 个操作按钮：新增/更新/删除/获取详情/获取列表/状态切换）
- 批量操作区（批量启用/批量禁用）
- 当前对象信息展示区
- 测试结果文本区
- 流程状态指示器（4 步进度：创建记录 → 更新信息 → 状态管理 → 批量操作）

**云函数调用：** `manage-category`、`manage-material`、`manage-size`、`manage-subseries`（各支持 add/update/remove/get/list）

---

## 产出文件清单

```
src/
├── pages/
│   └── splash/
│       ├── index.tsx
│       ├── index.config.ts
│       └── index.module.scss
└── pages-sub/
    ├── wishlist/
    │   ├── index.tsx
    │   ├── index.config.ts
    │   └── index.module.scss
    ├── consultation/
    │   ├── index.tsx
    │   ├── index.config.ts
    │   └── index.module.scss
    ├── privacy-policy/
    │   ├── index.tsx
    │   ├── index.config.ts
    │   └── index.module.scss
    ├── user-agreement/
    │   ├── index.tsx
    │   ├── index.config.ts
    │   └── index.module.scss
    └── product-cms/
        ├── index.tsx
        ├── index.config.ts
        └── index.module.scss
```

---

## 实现要求

### 1. Splash 启动页 — `src/pages/splash/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '',
  disableScroll: true,
})
```

**依赖：**
- `stores/useAppStore.ts`（`agreePrivacy`、`privacyAgreed`）
- `constants/index.ts`（`SPLASH_VIDEO_URL`）

**新增常量（`constants/index.ts`）：**

```typescript
export const SPLASH_VIDEO_URL = 'cloud://cloud1-9glm8muj52815539.636c-cloud1-9glm8muj52815539-1379477689/splash.mp4'
```

**组件状态：**

```typescript
const [videoEnded, setVideoEnded] = useState(false)
const [showPrivacyPopup, setShowPrivacyPopup] = useState(false)
```

**核心逻辑：**

1. **视频播放**：使用 Taro `Video` 组件，全屏自动播放，隐藏所有控件
   - `autoplay`、`loop={false}`、`muted={false}`、`controls={false}`
   - `showPlayBtn={false}`、`showCenterPlayBtn={false}`、`showFullscreenBtn={false}`、`showProgress={false}`
   - `onEnded` → 调用 `handleVideoEnd()`
   - `onError` → 调用 `handleVideoEnd()`（视频出错也进入下一步）

2. **跳过按钮**：右上角固定定位，点击调用 `handleVideoEnd()`

3. **`handleVideoEnd()` 流程**：
   ```typescript
   const handleVideoEnd = () => {
     setVideoEnded(true)
     checkPrivacyAgreement()
   }
   ```

4. **隐私协议检查 `checkPrivacyAgreement()`**：
   - 读取 `useAppStore.privacyAgreed`
   - 若未同意 → `setShowPrivacyPopup(true)`
   - 若已同意 → 调用 `navigateToHome()`

5. **隐私弹窗交互**：
   - 点击"同意" → `useAppStore.agreePrivacy()`，调用 `navigateToHome()`
   - 点击"不同意" → 无操作（弹窗保持显示）
   - 点击"查看详情" → `Taro.navigateTo({ url: '/pages-sub/privacy-policy/index' })`

6. **跳转首页 `navigateToHome()`**：
   ```typescript
   const navigateToHome = () => {
     Taro.switchTab({ url: '/pages/home/index' })
   }
   ```

> **简化决策**：旧代码中的地理位置权限检查（`checkLocationPermission`）在新版中移除。地理位置权限应在实际需要时按需请求，而非启动时强制请求。旧代码中的音频权限检查（`checkAudioPermission`）同样移除，属于调试代码。

**关键样式：**
- 容器：`position: relative; width: 100vw; height: 100vh; overflow: hidden`
- Video：`width: 100%; height: 100%; object-fit: cover`
- 跳过按钮：`position: absolute; top: 100rpx; right: 30rpx; padding: 10rpx 30rpx; background: rgba(0,0,0,0.3); color: #fff; border-radius: 30rpx; font-size: 26rpx; z-index: 10`
- 隐私弹窗遮罩：`position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999`
- 隐私弹窗：`position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 85%; background: #fff; border-radius: 20rpx; padding: 40rpx; z-index: 1000`
- 弹窗标题：`font-size: 36rpx; font-weight: 600; text-align: center; margin-bottom: 30rpx`
- 弹窗内容：`font-size: 28rpx; color: #666; line-height: 1.6; margin-bottom: 20rpx`
- 查看详情链接：`font-size: 26rpx; color: #333; text-decoration: underline; margin-bottom: 40rpx`
- 按钮容器：`display: flex; gap: 20rpx`
- 不同意按钮：`flex: 1; height: 80rpx; background: #f5f5f5; color: #999; border-radius: 8rpx`
- 同意按钮：`flex: 1; height: 80rpx; background: #000; color: #fff; border-radius: 8rpx`

### 2. Wishlist 收藏夹 — `src/pages-sub/wishlist/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '',
})
```

**依赖：**
- `components/TopBarWithBack`
- `components/LoadingBar`
- `hooks/useAuth.ts`（`ensureRegistered`）
- `hooks/useImageProcessor.ts`（`processImages`）
- `services/wish.service.ts`（`listWishes`、`removeWish`）
- `services/user.service.ts`（`getUserInfo`）
- `utils/format.ts`（`formatPrice`）

**类型定义（页面内部）：**

```typescript
interface WishItem {
  _wishId: string
  skuId: string
  spuId: string
  name: string
  nameEN: string
  price: number
  formattedPrice: string
  image: string
  material: string
}
```

**组件状态：**

```typescript
const [items, setItems] = useState<WishItem[]>([])
const [loading, setLoading] = useState(true)
const [isEmpty, setIsEmpty] = useState(true)
```

**核心逻辑：**

1. **页面显示时加载**：使用 `useDidShow` 钩子（Taro 页面生命周期），每次页面显示时调用 `refreshWishlist()`

2. **`refreshWishlist()` 流程**：
   ```typescript
   const refreshWishlist = async () => {
     setLoading(true)
     // 1. 检查用户注册状态
     const userRes = await userService.getUserInfo()
     if (userRes.code !== 200 || !userRes.data?._id) {
       Taro.showToast({ title: '请先完成注册', icon: 'none' })
       setItems([])
       setIsEmpty(true)
       setLoading(false)
       setTimeout(() => {
         Taro.navigateTo({ url: '/pages-sub/register/index' })
       }, 1000)
       return
     }
     // 2. 获取收藏列表
     const res = await wishService.listWishes(userRes.data._id)
     if (res.code === 200) {
       const wishes = res.data?.wishes || []
       // 3. 归一化字段
       const normalized = wishes.map(normalizeWishItem)
       // 4. 图片处理
       const imageUrls = normalized.map(item => item.image).filter(Boolean)
       const processedUrls = await processImages(imageUrls)
       // 5. 映射回列表
       // ...
       setItems(normalized)
       setIsEmpty(normalized.length === 0)
     }
     setLoading(false)
   }
   ```

3. **归一化函数 `normalizeWishItem(raw)`**：
   - 与旧代码逻辑一致，从 `skuInfo`/`spuInfo`/`materialInfo` 中提取字段
   - 处理 `skuId`/`spuId` 可能是对象 `{_id: "xxx"}` 的情况

4. **删除收藏 `handleRemove(wishId)`**：
   ```typescript
   const handleRemove = async (wishId: string) => {
     const res = await wishService.removeWish(wishId)
     if (res.code === 200) {
       Taro.showToast({ title: '已移除', icon: 'success' })
       await refreshWishlist()
     } else {
       Taro.showToast({ title: '移除失败', icon: 'none' })
     }
   }
   ```

5. **跳转商品详情 `handleGoDetail(skuId, spuId)`**：
   - 优先使用 `skuId`：`Taro.navigateTo({ url: '/pages/product-detail/index?skuId=${skuId}' })`
   - 无 `skuId` 时使用 `spuId`

6. **空状态跳转 `handleGoShop()`**：
   - `Taro.switchTab({ url: '/pages/category/index' })`

**关键样式：**
- 加载容器：`display: flex; align-items: center; justify-content: center; height: 60vh`
- 空状态容器：`display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh`
- 空状态提示：`font-size: 30rpx; color: #999; margin-bottom: 30rpx`
- 去添加按钮：`width: 300rpx; height: 80rpx; background: #000; color: #fff; border-radius: 8rpx; font-size: 28rpx`
- 列表项容器：`display: flex; padding: 30rpx; border-bottom: 1rpx solid #f0f0f0`
- 商品图片：`width: 200rpx; height: 200rpx; border-radius: 8rpx; flex-shrink: 0`
- 信息区：`flex: 1; margin-left: 20rpx; display: flex; flex-direction: column; justify-content: space-between`
- 商品名称：`font-size: 28rpx; color: #333; font-weight: 500`
- 英文名：`font-size: 24rpx; color: #999; margin-top: 8rpx`
- 材质：`font-size: 24rpx; color: #999`
- 价格：`font-size: 30rpx; color: #333; font-weight: 600`
- 删除按钮（×）：`position: absolute; top: 30rpx; right: 30rpx; font-size: 36rpx; color: #ccc; width: 50rpx; height: 50rpx; text-align: center; line-height: 50rpx`

### 3. Consultation 咨询 — `src/pages-sub/consultation/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '',
})
```

**依赖：**
- `components/TopBarWithBack`
- `components/FloatPopup`
- `components/FloatBtn`

**组件状态：**

```typescript
const [showPopup, setShowPopup] = useState(false)
```

**核心逻辑：**
- 页面展示 `TopBarWithBack` 导航栏
- 页面主体显示咨询相关信息（品牌联系方式、服务时间等静态内容）
- 右下角 `FloatBtn`，点击 → `setShowPopup(true)`
- `FloatPopup` 通过 `visible={showPopup}` 控制，`onClose` → `setShowPopup(false)`

**关键样式：**
- 页面容器：`padding-top` 为导航栏高度，`min-height: 100vh; background: #fff`
- 内容区：`padding: 40rpx; text-align: center`
- 品牌 Logo：`width: 200rpx; margin: 60rpx auto 40rpx`
- 联系信息：`font-size: 28rpx; color: #666; line-height: 2`

### 4. Privacy Policy 隐私政策 — `src/pages-sub/privacy-policy/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '',
})
```

**依赖：**
- `components/TopBarWithBack`

**核心逻辑：** 纯静态页面，无状态、无副作用、无云函数调用。

**实现方式：**
- `TopBarWithBack` 导航栏
- `ScrollView`（`scrollY`）包裹全部内容
- 内容直接以 JSX 硬编码，保留旧代码中的完整隐私政策文本
- 8 个章节结构与旧代码一致（引言 → 收集使用 → Cookie → 共享 → 存储保护 → 权利 → 未成年人 → 更新 → 联系方式）
- 底部留白区域

**关键样式：**
- 页面容器：`padding-top` 为导航栏高度，`background: #fff`
- 内容容器：`padding: 30rpx 40rpx 60rpx`
- 主标题：`font-size: 36rpx; font-weight: 600; text-align: center; margin-bottom: 20rpx; color: #333`
- 副标题：`font-size: 30rpx; font-weight: 500; text-align: center; margin-bottom: 40rpx; color: #333`
- 章节标题：`font-size: 30rpx; font-weight: 600; color: #333; margin-top: 40rpx; margin-bottom: 20rpx`
- 段落：`font-size: 28rpx; color: #666; line-height: 1.8; margin-bottom: 16rpx`
- 缩进段落：`padding-left: 30rpx`
- 更新日期：`font-size: 24rpx; color: #999; text-align: center; margin-top: 60rpx`
- 底部留白：`height: 100rpx`

### 5. User Agreement 用户协议 — `src/pages-sub/user-agreement/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '',
})
```

**依赖：**
- `components/TopBarWithBack`

**核心逻辑：** 纯静态页面，无状态、无副作用、无云函数调用。与隐私政策页面结构完全一致。

**实现方式：**
- `TopBarWithBack` 导航栏
- `ScrollView`（`scrollY`）包裹全部内容
- 内容直接以 JSX 硬编码，保留旧代码中的完整销售条款文本
- 13 个章节结构与旧代码一致（一般条件 → 卖方信息 → 珠宝作品信息 → 价格 → 订单 → 支付 → 交付 → 退货 → 瑕疵 → 隐私政策 → 责任限制 → 知识产权 → 适用法律）
- 底部留白区域

**关键样式：** 与隐私政策页面共用相同的样式规范（标题、章节标题、段落、缩进段落等）。

> **复用建议**：隐私政策和用户协议页面的样式几乎完全相同，可以提取一个共用的 `legal-page.module.scss` 样式文件，两个页面共同引用。但为保持简单，也可以各自维护独立的 SCSS 文件。

### 6. Product CMS 商品管理 — `src/pages-sub/product-cms/index.tsx`

**页面配置 `index.config.ts`：**

```typescript
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '',
})
```

**依赖：**
- `components/TopBarWithBack`
- `services/cms.service.ts`（全部 CRUD 函数）

**类型定义（页面内部）：**

```typescript
type CmsTab = 'categories' | 'materials' | 'productSizes' | 'subSeries'

interface CmsItem {
  key: string
  value: string
}
```

**组件状态：**

```typescript
const [currentTab, setCurrentTab] = useState<CmsTab>('categories')
const [result, setResult] = useState('请选择上方的选项卡开始操作...')
const [currentObject, setCurrentObject] = useState<CmsItem[] | null>(null)
const [currentObjectType, setCurrentObjectType] = useState('')
const [createdIds, setCreatedIds] = useState({
  categoryId: '',
  materialId: '',
  productSizeId: '',
  subSeriesId: '',
})
```

**核心逻辑：**

1. **Tab 切换**：4 个选项卡（分类/材质/尺寸/子系列），点击切换 `currentTab`，动态渲染对应操作区

2. **每个 Tab 的 CRUD 操作**（以分类为例）：
   - **新增** → 调用 `cmsService.addCategory({ categoryName, status, displayImage })`，成功后保存 `categoryId` 到 `createdIds`
   - **更新** → 调用 `cmsService.updateCategory({ _categoryId, updateData })`，需先有 `categoryId`
   - **删除** → 调用 `cmsService.removeCategory({ _categoryId })`，成功后清空 `categoryId`
   - **获取详情** → 调用 `cmsService.getCategory({ _categoryId })`，展示返回数据
   - **获取列表** → 调用 `cmsService.listCategories()`，展示列表摘要
   - 材质、尺寸、子系列的操作模式完全相同，仅调用不同的 `cmsService` 函数

3. **结果展示**：每次操作后更新 `result` 文本和 `currentObject` 展示数据

4. **`formatObjectForDisplay(obj)`**：将对象转为 `[{key, value}]` 数组，过滤 `_id`、`_createTime`、`_updateTime` 和嵌套对象

**关键样式：**
- 页面容器：`padding-top` 为导航栏高度，`min-height: 100vh; background: #f5f5f5`
- Tab 栏容器：`display: flex; background: #fff; padding: 20rpx 0; border-bottom: 1rpx solid #eee`
- Tab 项：`flex: 1; text-align: center; font-size: 26rpx; color: #999; padding: 16rpx 0`
- Tab 选中：`color: #333; font-weight: 600; border-bottom: 4rpx solid #333`
- 测试数据区：`background: #fff; margin: 20rpx; padding: 30rpx; border-radius: 12rpx`
- 操作按钮容器：`display: flex; flex-wrap: wrap; gap: 16rpx; padding: 20rpx; background: #fff; margin: 20rpx; border-radius: 12rpx`
- 操作按钮：`padding: 16rpx 30rpx; background: #000; color: #fff; border-radius: 8rpx; font-size: 26rpx`
- 删除按钮：`background: #ff4d4f`（红色警示）
- 结果展示区：`background: #fff; margin: 20rpx; padding: 30rpx; border-radius: 12rpx; font-size: 26rpx; color: #666; word-break: break-all`
- 对象信息区：`background: #fafafa; padding: 20rpx; border-radius: 8rpx; margin-top: 20rpx`
- 对象信息行：`display: flex; padding: 8rpx 0; font-size: 24rpx`
- Key 文字：`color: #999; width: 200rpx; flex-shrink: 0`
- Value 文字：`color: #333; flex: 1`

---

## 验收标准

1. 所有 6 个页面文件（含 `index.tsx`、`index.config.ts`、`index.module.scss`）无 TypeScript 编译错误
2. **Splash**：视频全屏自动播放，右上角"跳过"按钮可点击，视频结束/跳过/出错均触发隐私协议检查
3. **Splash**：隐私弹窗正确显示标题、内容、查看详情链接、不同意/同意按钮；点击"同意"调用 `useAppStore.agreePrivacy()` 并跳转首页
4. **Splash**：点击"查看详情"正确跳转到 `/pages-sub/privacy-policy/index`
5. **Wishlist**：`useDidShow` 每次页面显示时调用 `refreshWishlist()`，正确检查用户注册状态
6. **Wishlist**：收藏列表正确归一化字段（从 `skuInfo`/`spuInfo`/`materialInfo` 提取），图片经过 `processImages` 处理
7. **Wishlist**：删除收藏调用 `wishService.removeWish(wishId)`，成功后刷新列表并提示"已移除"
8. **Wishlist**：空状态显示"您的心愿单为空"提示和"去添加心愿"按钮，点击跳转分类页
9. **Consultation**：页面包含 `TopBarWithBack` 导航栏、静态咨询信息、`FloatBtn` 浮动按钮和 `FloatPopup` 弹窗
10. **Privacy Policy**：纯静态页面，`ScrollView` 包裹 8 个章节，内容与旧代码完全一致
11. **User Agreement**：纯静态页面，`ScrollView` 包裹 13 个章节，内容与旧代码完全一致
12. **Product CMS**：4 个选项卡正确切换，每个 Tab 的 6 个 CRUD 操作按钮均能调用对应的 `cmsService` 函数
13. **Product CMS**：操作结果正确展示在结果区域，`formatObjectForDisplay` 正确过滤内部字段
14. 所有页面的 `index.config.ts` 均设置 `navigationStyle: 'custom'`
15. 所有文件 `import` 路径正确，无循环依赖
16. `constants/index.ts` 中新增 `SPLASH_VIDEO_URL` 常量
