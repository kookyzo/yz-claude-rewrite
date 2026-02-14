# 会话 29：Phase 09b Wishlist 收藏夹 + Product CMS 商品管理 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 09 的第二部分：收藏夹（wishlist）和商品 CMS 管理（product-cms）。Wishlist 是一个带数据交互的列表页面（加载、删除、跳转），Product CMS 是一个管理后台页面（4 个 Tab + CRUD 操作）。两个页面都是分包页面（`pages-sub/`）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. Service 调用前先读取 service 文件确认方法签名，避免参数传递错误。
3. 两个页面都是分包页面（`pages-sub/`），路由已在 `app.config.ts` 中配置好。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定）
2. `specs/09-misc-pages.md`（**完整阅读**，关注「2. Wishlist 收藏夹」和「6. Product CMS 商品管理」部分）
3. `src/services/wish.service.ts`（**必读**，确认 `listWishes`、`removeWish` 方法签名）
4. `src/services/user.service.ts`（**必读**，确认 `getUserInfo` 方法签名）
5. `src/services/cms.service.ts`（**必读**，确认所有 CRUD 方法签名）
6. `src/hooks/useImageProcessor.ts`（**必读**，确认 `processImages` 接口）
7. `src/hooks/useAuth.ts`（了解 `ensureRegistered` 接口，但 wishlist 页面直接调用 `getUserInfo` 检查注册状态）
8. `src/utils/format.ts`（确认 `formatPrice` 签名）
9. `src/hooks/useSystemInfo.ts`（`statusBarHeight`, `navBarHeight`）

## 参考旧代码（必读，1:1 还原 UI 和交互逻辑）

**收藏夹：**
- `legacy_ro/yz-legacy-code/pages/wishlist/wishlist.wxml`
- `legacy_ro/yz-legacy-code/pages/wishlist/wishlist.wxss`
- `legacy_ro/yz-legacy-code/pages/wishlist/wishlist.js`

**商品 CMS 管理：**
- `legacy_ro/yz-legacy-code/pages/manage-product-cms/manage-product-cms.wxml`
- `legacy_ro/yz-legacy-code/pages/manage-product-cms/manage-product-cms.wxss`
- `legacy_ro/yz-legacy-code/pages/manage-product-cms/manage-product-cms.js`

## 前置依赖

Sessions 01-28 已完成。所有基础设施已就绪。

### 已有的关键基础设施

- `src/services/wish.service.ts`:
  - `listWishes(userId: string)` — 获取收藏列表，参数 `{ action: 'list', userId: { _id: userId } }`
  - `removeWish(wishId: string)` — 移除收藏，参数 `{ action: 'remove', _wishId: wishId }`
- `src/services/user.service.ts`:
  - `getUserInfo()` — 获取当前用户信息，返回 `CloudResponse<User>`
- `src/services/cms.service.ts`:
  - 分类 CRUD：`addCategory`、`updateCategory`、`removeCategory`、`getCategory`、`listCategories`
  - 材质 CRUD：`addMaterial`、`updateMaterial`、`removeMaterial`、`getMaterial`、`listMaterials`
  - 尺寸 CRUD：`addProductSize`、`updateProductSize`、`removeProductSize`、`getProductSize`、`listProductSizes`
  - 子系列 CRUD：`addSubSeries`、`updateSubSeries`、`removeSubSeries`、`getSubSeries`、`listSubSeries`
- `src/hooks/useImageProcessor.ts`:
  - `processImages(cloudUrls: string[], options?)` — 批量转换云存储 URL 为 HTTP URL 并压缩
- `src/utils/format.ts`:
  - `formatPrice(price: number)` — 格式化价格 `12345 → "12,345.00"`
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏
- `src/components/LoadingBar/` — 顶部进度条加载指示器
- `src/hooks/useSystemInfo.ts` — `statusBarHeight`, `navBarHeight`

---

## 页面 A：收藏夹 `pages-sub/wishlist/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '',
})
```

### 页面内部类型定义

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

### 页面状态

```typescript
const [items, setItems] = useState<WishItem[]>([])
const [loading, setLoading] = useState(true)
const [isEmpty, setIsEmpty] = useState(true)
```

### 核心功能点

#### 1. 页面显示时加载

使用 Taro `useDidShow` 钩子（先用 context7 确认 `useDidShow` 的正确导入方式），每次页面显示时调用 `refreshWishlist()`。

#### 2. refreshWishlist() 流程

```typescript
const refreshWishlist = async () => {
  setLoading(true)
  try {
    // 1. 检查用户注册状态
    const userRes = await getUserInfo()
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
    const res = await listWishes(userRes.data._id)
    if (res.code === 200) {
      const wishes = res.data?.wishes || []
      // 3. 归一化字段
      const normalized = wishes.map(normalizeWishItem)
      // 4. 图片处理（批量转换云存储 URL）
      const imageUrls = normalized.map(item => item.image).filter(Boolean)
      if (imageUrls.length > 0) {
        const processedUrls = await processImages(imageUrls)
        // 5. 映射处理后的图片 URL 回列表
        let urlIndex = 0
        normalized.forEach(item => {
          if (item.image) {
            item.image = processedUrls[urlIndex++]
          }
        })
      }
      setItems(normalized)
      setIsEmpty(normalized.length === 0)
    }
  } catch (err) {
    console.error('refreshWishlist error:', err)
  } finally {
    setLoading(false)
  }
}
```

#### 3. 归一化函数 normalizeWishItem(raw)

与旧代码逻辑一致，从云函数返回的 `skuInfo`/`spuInfo`/`materialInfo` 中提取字段：

```typescript
const normalizeWishItem = (raw: any): WishItem => {
  const skuInfo = raw.skuInfo || {}
  const spuInfo = raw.spuInfo || {}
  const materialInfo = raw.materialInfo ||

  const name = skuInfo.nameCN || spuInfo.name || ''
  const nameEN = skuInfo.nameEN || ''
  const price = skuInfo.price || spuInfo.referencePrice || 0
  const image = skuInfo.skuMainImages?.[0] || spuInfo.mainImages?.[0] || ''
  const material = materialInfo.nameCN || ''

  // 处理 skuId/spuId 可能是对象 {_id: "xxx"} 的情况
  const skuId = typeof skuInfo._id === 'object' ? skuInfo._id._id : (skuInfo._id || '')
  const spuId = typeof spuInfo._id === 'object' ? spuInfo._id._id : (spuInfo._id || '')

  return {
    _wishId: raw._id || '',
    skuId,
    spuId,
    name,
    nameEN,
    price,
    formattedPrice: formatPrice(price),
    image,
    material,
  }
}
```

#### 4. 删除收藏

```typescript
const handleRemove = async (wishId: string) => {
  const res = await removeWish(wishId)
  if (res.code === 200) {
    Taro.showToast({ title: '已移除', icon: 'success' })
    await refreshWishlist()
  } else {
    Taro.showToast({ title: '移除失败', icon: 'none' })
  }
}
```

#### 5. 跳转商品详情

```typescript
const handleGoDetail = (skuId: string, spuId: string) => {
  if (skuId) {
    Taro.navigateTo({ url: `/pages/product-detail/index?skuId=${skuId}` })
  } else if (spuId) {
    Taro.navigateTo({ url: `/pages/product-detail/index?spuId=${spuId}` })
  }
}
```

#### 6. 空状态跳转

```typescript
const handleGoShop = () => {
  Taro.switchTab({ url: '/pages/category/index' })
}
```

### UI 结构

```
TopBarWithBack
└── container（marginTop 偏移）
    ├── loading 状态：spinner + "正在加载心愿单..."
    ├── 空状态（isEmpty && !loading）：
    │   ├── empty-text「您的心愿单为空」
    │   └── go-shop-btn「去添加心愿」→ handleGoShop()
    └── 列表状态（!isEmpty && !loading）：
        └── ScrollView（scrollY）
            └── wish-item（每项，点击 → handleGoDetail）
                ├── item-image（商品图片 200rpx × 200rpx）
                ├── item-info
                │   ├── item-name（中文名）
                │   ├── item-nameEN（英文名）
                │   ├── item-material（材质）
                │   └── item-price（格式化价格，带 ¥ 前缀）
                └── remove-btn（×）→ handleRemove(wishId)，阻止冒泡
```

### 关键样式要点

- 页面容器：`min-height: 100vh; background: #fff`
- 加载容器：`display: flex; align-items: center; justify-content: center; height: 60vh`
- 空状态容器：`display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh`
- 空状态提示：`font-size: 30rpx; color: #999; margin-bottom: 30rpx`
- 去添加按钮：`width: 300rpx; height: 80rpx; background: #000; color: #fff; border-radius: 8rpx; font-size: 28rpx; display: flex; align-items: center; justify-content: center`
- 列表项容器：`position: relative; display: flex; padding: 30rpx; border-bottom: 1rpx solid #f0f0f0`
- 商品图片：`width: 200rpx; height: 200rpx; border-radius: 8rpx; flex-shrink: 0`
- 信息区：`flex: 1; margin-left: 20rpx; display: flex; flex-direction: column; justify-content: space-between`
- 商品名称：`font-size: 28rpx; color: #333; font-weight: 500`
- 英文名：`font-size: 24rpx; color: #999; margin-top: 8rpx`
- 材质：`font-size: 24rpx; color: #999`
- 价格：`font-size: 30rpx; color: #333; font-weight: 600`
- 删除按钮（×）：`position: absolute; top: 30rpx; right: 30rpx; font-size: 36rpx; color: #ccc; width: 50rpx; height: 50rpx; text-align: center; line-height: 50rpx`
- 详细样式参考旧代码 `wishlist.wxss` 1:1 还原

---

## 页面 B：商品 CMS 管理 `pages-sub/product-cms/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
  navigationBarTitleText: '',
})
```

### 页面内部类型定义

```typescript
type CmsTab = 'categories' | 'materials' | 'productSizes' | 'subSeries'

interface DisplayItem {
  key: string
  value: string
}
```

### 页面状态

```typescript
const [currentTab, setCurrentTab] = useState<CmsTab>('categories')
const [result, setResult] = useState('请选择上方的选项卡开始操作...')
const [currentObject, setCurrentObject] = useState<DisplayItem[] | null>(null)
const [currentObjectType, setCurrentObjectType] = useState('')
const [createdIds, setCreatedIds] = useState({
  categoryId: '',
  materialId: '',
  productSizeId: '',
  subSeriesId: '',
})
```

### 核心功能点

#### 1. Tab 切换

4 个选项卡：分类（categories）、材质（materials）、尺寸（productSizes）、子系列（subSeries）。点击切换 `currentTab`，清空 `result` 和 `currentObject`。

```typescript
const tabs: { key: CmsTab; label: string }[] = [
  { key: 'categories', label: '分类' },
  { key: 'materials', label: '材质' },
  { key: 'productSizes', label: '尺寸' },
  { key: 'subSeries', label: '子系列' },
]

const handleTabChange = (tab: CmsTab) => {
  setCurrentTab(tab)
  setResult('')
  setCurrentObject(null)
  setCurrentObjectType('')
}
```

#### 2. 通用结果展示函数

```typescript
const showResult = (text: string, obj?: any) => {
  setResult(text)
  if (obj) {
    setCurrentObject(formatObjectForDisplay(obj))
    setCurrentObjectType(currentTab)
  } else {
    setCurrentObject(null)
  }
}

const formatObjectForDisplay = (obj: any): DisplayItem[] => {
  return Object.entries(obj)
    .filter(([key]) => !['_id', '_createTime', '_updateTime'].includes(key))
    .filter(([, value]) => typeof value !== 'object' || value === null)
    .map(([key, value]) => ({
      key,
      value: String(value ?? ''),
    }))
}
```

#### 3. 分类 CRUD 操作（其余三个模块模式完全相同）

**注意：调用 `cms.service.ts` 前必须先读取该文件确认方法签名。**

```typescript
// 新增分类
const handleCreateCategory = async () => {
  const res = await addCategory({
    categoryName: '测试分类_' + Date.now(),
    status: true,
    displayImage: '',
  })
  if (res.code === 200) {
    const id = res.data?._id || ''
    setCreatedIds(prev => ({ ...prev, categoryId: id }))
    showResult(`分类创建成功，ID: ${id}`, res.data)
  } else {
    showResult(`创建失败: ${res.message}`)
  }
}

// 获取分类列表
const handleListCategories = async () => {
  const res = await listCategories()
  if (res.code === 200) {
    const list = res.data || []
    showResult(`共 ${list.length} 个分类`)
  } else {
    showResult(`获取列表失败: ${res.message}`)
  }
}

// 获取分类详情（需要先有 categoryId）
const handleGetCategory = async () => {
  if (!createdIds.categoryId) {
    showResult('请先创建一个分类')
    return
  }
  const res = await getCategory({ _categoryId: createdIds.categoryId })
  if (res.code === 200) {
    showResult('获取详情成功', res.data)
  } else {
    showResult(`获取详情失败: ${res.message}`)
  }
}

// 更新分类
const handleUpdateCategory = async () => {
  if (!createdIds.categoryId) {
    showResult('请先创建一个分类')
    return
  }
  const res = await updateCategory({
    _categoryId: createdIds.categoryId,
    updateData: { categoryName: '更新后的分类_' + Date.now() },
  })
  if (res.code === 200) {
    showResult('更新成功', res.data)
  } else {
    showResult(`更新失败: ${res.message}`)
  }
}

// 删除分类
const handleDeleteCategory = async () => {
  if (!createdIds.categoryId) {
    showResult('请先创建一个分类')
    return
  }
  const res = await removeCategory({ _categoryId: createdIds.categoryId })
  if (res.code === 200) {
    setCreatedIds(prev => ({ ...prev, categoryId: '' }))
    showResult('删除成功')
  } else {
    showResult(`删除失败: ${res.message}`)
  }
}
```

材质、尺寸、子系列的操作模式完全相同，仅调用不同的 `cmsService` 函数，测试数据字段不同：

- **材质**：`addMaterial({ nameCN: '测试材质_' + Date.now(), materialImage: '' })`
- **尺寸**：`addProductSize({ category: { _id: 'test' }, type: '戒指', standard: 'CN', sizeNum: 10, value: '10号' })`
- **子系列**：`addSubSeries({ name: '测试子系列_' + Date.now(), displayImage: '' })`

#### 4. 根据当前 Tab 渲染操作按钮

每个 Tab 显示 5 个操作按钮：新增、获取列表、获取详情、更新、删除。根据 `currentTab` 动态绑定对应的处理函数。可以用一个映射对象来简化：

```typescript
const operations = {
  categories: {
    create: handleCreateCategory,
    list: handleListCategories,
    get: handleGetCategory,
    update: handleUpdateCategory,
    delete: handleDeleteCategory,
  },
  materials: { /* 同理 */ },
  productSizes: { /* 同理 */ },
  subSeries: { /* 同理 */ },
}
```

### UI 结构

```
TopBarWithBack
└── container（marginTop 偏移）
    ├── tab-bar（4 个选项卡，水平排列）
    │   ├── tab-item「分类」（选中态高亮 + 底部线条）
    │   ├── tab-item「材质」
    │   ├── tab-item「尺寸」
    │   └── tab-item「子系列」
    ├── info-card（当前 Tab 的已创建 ID 展示）
    │   └── info-text（如 "当前分类 ID: xxx" 或 "暂无"）
    ├── action-card（操作按钮区）
    │   ├── btn「新增」（黑色）
    │   ├── btn「获取列表」（黑色）
    │   ├── btn「获取详情」（黑色）
    │   ├── btn「更新」（黑色）
    │   └── btn「删除」（红色警示）
    ├── result-card（操作结果文本展示区）
    │   └── result-text
    └── object-card（当前对象信息展示区，currentObject 非空时显示）
        ├── object-title（如 "分类详情"）
        └── object-rows
            └── row（每行：key + value）
```

### 关键样式要点

- 页面容器：`min-height: 100vh; background: #f5f5f5`
- Tab 栏容器：`display: flex; background: #fff; padding: 20rpx 0; border-bottom: 1rpx solid #eee`
- Tab 项：`flex: 1; text-align: center; font-size: 26rpx; color: #999; padding: 16rpx 0`
- Tab 选中：`color: #333; font-weight: 600; border-bottom: 4rpx solid #333`
- 卡片通用：`background: #fff; margin: 20rpx; padding: 30rpx; border-radius: 12rpx`
- 操作按钮容器：`display: flex; flex-wrap: wrap; gap: 16rpx`
- 操作按钮：`padding: 16rpx 30rpx; background: #000; color: #fff; border-radius: 8rpx; font-size: 26rpx`
- 删除按钮：`background: #ff4d4f`（红色警示）
- 结果文本：`font-size: 26rpx; color: #666; word-break: break-all`
- 对象信息区：`background: #fafafa; padding: 20rpx; border-radius: 8rpx; margin-top: 20rpx`
- 对象信息行：`display: flex; padding: 8rpx 0; font-size: 24rpx`
- Key 文字：`color: #999; width: 200rpx; flex-shrink: 0`
- Value 文字：`color: #333; flex: 1`
- 详细样式参考旧代码 `manage-product-cms.wxss` 1:1 还原

---

## 产出

- 收藏夹 3 个文件（`pages-sub/wishlist/` 下的 index.tsx + index.config.ts + index.module.scss）
- 商品 CMS 管理 3 个文件（`pages-sub/product-cms/` 下的 index.tsx + index.config.ts + index.module.scss）

## 要求

- Wishlist 使用 Taro `useDidShow` 钩子（先用 context7 确认正确导入方式），每次页面显示时刷新列表
- Wishlist 先调用 `getUserInfo()` 检查用户注册状态，未注册则提示并跳转注册页
- Wishlist 调用 `listWishes(userId)` 获取收藏列表，归一化字段逻辑与旧代码一致
- Wishlist 图片使用 `useImageProcessor` 的 `processImages` 批量处理
- Wishlist 删除调用 `removeWish(wishId)`，成功后刷新列表并提示"已移除"
- Wishlist 空状态显示"您的心愿单为空"和"去添加心愿"按钮，点击跳转分类页（`switchTab`）
- Wishlist 点击商品项跳转商品详情页，优先使用 `skuId`，无则使用 `spuId`
- Wishlist 删除按钮点击需阻止事件冒泡，避免同时触发跳转
- Product CMS 4 个选项卡正确切换，切换时清空结果区
- Product CMS 每个 Tab 的 5 个 CRUD 操作按钮均能调用对应的 `cmsService` 函数
- Product CMS 操作结果正确展示在结果区域
- Product CMS `formatObjectForDisplay` 正确过滤 `_id`、`_createTime`、`_updateTime` 和嵌套对象字段
- Product CMS 删除按钮使用红色（`#ff4d4f`）区分
- 所有分包页面使用 TopBarWithBack + marginTop 偏移（参考已实现的其他分包页面）
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 完成后运行 `npm run build:weapp` 确认编译通过

---
