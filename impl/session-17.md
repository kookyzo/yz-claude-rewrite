# 会话 17：Phase 06b 系列详情 + 系列推广 — 实现提示词

> 复制下面 `---` 之间的内容，粘贴到新的 Claude Code 会话中。

---

## 任务

你正在为 YZHENG 小程序 Taro React 重构项目执行 Phase 06 的第二部分：系列详情页（series-detail）和系列推广页（series-promotion）。

**极其重要的原则：**
1. 遇到任何技术细节不确定的地方，必须先用 context7 MCP 工具查官方文档确认，绝对不要凭经验猜测。
2. 优先使用 NutUI 组件作为构建块。
3. Service 调用时业务参数必须包在 `data` 字段下（`{ action, data: { ... } }`），不要平铺在顶层。
4. 这两个页面都是分包页面（pages-sub/），不是 Tab 页，不需要 CustomTabBar 组件。

## 开始前必须读取的文件

1. `CONVENTIONS.md`（编码约定，特别注意 Service 调用模式和已知配置要点）
2. `specs/06-product-flow.md`（关注「旧代码摘要 → 2. SeriesDetail」和「3. series_promotion」部分，以及对应的「实现要求」部分）

## 参考旧代码（必读，1:1 还原 UI）

**系列详情页：**
- `legacy_ro/yz-legacy-code/pages/SeriesDetail/SeriesDetail.wxml`（页面结构，优先读）
- `legacy_ro/yz-legacy-code/pages/SeriesDetail/SeriesDetail.wxss`（样式细节，优先读）
- `legacy_ro/yz-legacy-code/pages/SeriesDetail/SeriesDetail.js`（交互逻辑和数据流）

**系列推广页：**
- `legacy_ro/yz-legacy-code/pages/series_promotion/series_promotion.wxml`
- `legacy_ro/yz-legacy-code/pages/series_promotion/series_promotion.wxss`
- `legacy_ro/yz-legacy-code/pages/series_promotion/series_promotion.js`

spec 提供了核心逻辑摘要，但样式还原以旧代码 WXML + WXSS 为准。

## 前置依赖

Sessions 01-16 已完成：所有基础设施 + 共享组件 + 4 个 Tab 主页面 + 商品详情页就绪。

### 已有的关键基础设施（必须先读取理解）

- `src/services/product.service.ts` — `getProductsBySubSeries()`、`listSubSeries()`、`listMaterials()`
- `src/types/product.ts` — Sku、SubSeries、Material 类型
- `src/hooks/useImageProcessor.ts` — `processImages()` 图片批量转换
- `src/hooks/usePagination.ts` — 分页 Hook
- `src/components/TopBarWithBack/` — 带返回按钮的顶部导航栏（props: `imageSrc?`、`backgroundColor?`）
- `src/components/LoadingBar/` — 加载指示器
- `src/utils/format.ts` — `formatPrice()`
- `src/utils/navigation.ts` — `navigateTo()`

---

## 页面 A：系列详情页 `pages-sub/series-detail/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
  enableShareAppMessage: true,
})
```

### 页面参数

通过 `useRouter()` 获取：
- `subSeriesId` — 子系列 ID

### 核心功能点

#### 1. 页面初始化（`useLoad`）

- 通过 `useRouter().params` 获取 `subSeriesId`
- 并行调用：`loadSubSeriesInfo(subSeriesId)` + `loadProducts()`

#### 2. 加载子系列信息

- 调用 `productService.listSubSeries()` 获取全部子系列，从中找到匹配 `subSeriesId` 的项
- 或者如果 `getProductsBySubSeries` 返回中附带了子系列信息，也可以从中提取
- 提取 `nameEN`、`nameCN`、`displayImage`、`introduction`
- `displayImage` 通过 `processImages()` 转换

#### 3. 加载商品列表（使用 `usePagination`）

- `fetchFn` 调用 `productService.getProductsBySubSeries({ subSeriesId, sortBy: currentSort, page, pageSize: 20, materialIds? })`
- 返回数据使用 `processImages()` 处理商品图片
- 价格使用 `formatPrice()` 格式化
- `pageSize = 20`

#### 4. 筛选逻辑

- 从已加载商品中提取不重复的 `materialId` 列表
- 调用 `productService.listMaterials()` 获取材质名称
- 构建材质复选框列表
- 选择/取消材质后，调用 `usePagination.refresh()` 重新加载

#### 5. 排序逻辑

- 三种排序：`default`（默认）、`price_asc`（价格从低到高）、`price_desc`（价格从高到低）
- 切换排序后更新 `currentSort`，调用 `usePagination.refresh()` 重新加载

#### 6. 商品点击

- `navigateTo('/pages/product-detail/index?skuId=${product._id}')`

#### 7. 分享

```typescript
useShareAppMessage(() => ({
  title: subSeriesInfo?.nameEN || 'YZHENG',
  path: `/pages-sub/series-detail/index?subSeriesId=${subSeriesId}`,
}))
```

### UI 结构

```
TopBarWithBack
├── ScrollView（纵向滚动，onScrollToLower 触发加载更多）
│   ├── 头图区
│   │   └── 子系列 displayImage（mode="widthFix"，宽度 100%）
│   ├── 标题区
│   │   ├── nameEN（大字）
│   │   └── nameCN（副标题）
│   ├── 工具栏
│   │   ├── 左侧：商品数量文字（如"共 12 件商品"）
│   │   ├── 右侧：筛选按钮（点击弹出筛选面板）
│   │   └── 右侧：排序按钮（点击展开排序选项）
│   ├── 商品网格（2 列）
│   │   └── 每项：图片（aspectFill）+ nameEN + nameCN + formattedPrice
│   └── 底部状态文字（加载中 / 暂无商品 / 没有更多了）
├── 排序面板（下拉展开，3 个选项）
│   ├── 默认排序
│   ├── 价格从低到高
│   └── 价格从高到低
└── 筛选面板（底部弹出，覆盖层）
    ├── 材质复选框列表
    ├── 重置按钮
    └── 确认按钮
```

### 关键样式要点

- 头图：`width: 100%; mode: widthFix`
- 标题区：`padding: 30rpx`，nameEN `font-size: 36rpx; font-weight: 600`，nameCN `font-size: 28rpx; color: #999`
- 工具栏：`display: flex; justify-content: space-between; align-items: center; padding: 20rpx 30rpx; border-bottom: 1rpx solid #eee`
- 商品网格：`display: grid; grid-template-columns: repeat(2, 1fr); gap: 20rpx; padding: 20rpx`
- 商品图片：`width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8rpx`
- 筛选面板：`position: fixed; bottom: 0; width: 100%; background: #fff; z-index: 999; border-radius: 20rpx 20rpx 0 0`
- 排序面板：下拉展开，选中态 `font-weight: 600; color: #000`
- 底部状态文字：`text-align: center; padding: 30rpx; font-size: 24rpx; color: #999`

---

## 页面 B：系列推广页 `pages-sub/series-promotion/index`

### 页面配置

```typescript
// index.config.ts
export default definePageConfig({
  navigationStyle: 'custom',
})
```

### 页面参数

通过 `useRouter()` 获取：
- `image` — 推广图片 URL（需要 `decodeURIComponent` 解码）

### 核心逻辑

- 纯展示页面，无云函数调用，无交互逻辑
- 仅显示一张全宽推广图片

### UI 结构

```
TopBarWithBack
└── Image（src=decodeURIComponent(image), mode="widthFix", width: 100%）
```

### 关键样式

- 容器：`min-height: 100vh; background: #fff`
- 图片：`width: 100%; mode: widthFix`

---

## 产出

- 系列详情页 3 个文件（`pages-sub/series-detail/` 下的 index.tsx + index.config.ts + index.module.scss）
- 系列推广页 3 个文件（`pages-sub/series-promotion/` 下的 index.tsx + index.config.ts + index.module.scss）

## 要求

- 使用已有的 services（product.service），不新建 service
- 使用已有的 hooks：useImageProcessor、usePagination
- 使用已有的组件：TopBarWithBack、LoadingBar
- 使用已有的 utils：formatPrice、navigateTo
- 两个页面都是分包页面（pages-sub/），不是 Tab 页，不需要 CustomTabBar
- 样式使用 rpx 单位，1:1 还原旧代码视觉效果
- 系列详情页需要 `enableShareAppMessage: true` 并使用 `useShareAppMessage` Hook
- 系列推广页的 `image` 参数需要 `decodeURIComponent` 解码
- 完成后运行 `npm run build:weapp` 确认编译通过

---
