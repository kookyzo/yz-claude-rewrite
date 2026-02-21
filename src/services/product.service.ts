import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse, PaginatedData } from '@/types/api'
import type { Sku, SubSeries, Category, Material } from '@/types/product'

/** 获取商品详情 */
export function getProductDetail(skuId: string): Promise<CloudResponse<Sku>> {
  return callCloudFunction<Sku>('get-product', {
    action: 'getProductDetail',
    data: { _skuId: skuId },
  })
}

/** 按子系列查询商品 */
export function getProductsBySubSeries(params: {
  subSeriesId: string
  sortBy?: string
  page?: number
  pageSize?: number
  materialIds?: string[]
}): Promise<CloudResponse<PaginatedData<Sku>>> {
  return callCloudFunction<PaginatedData<Sku>>('get-product', {
    action: 'getProductsBySubSeries',
    data: params,
  })
}

/** 按分类查询商品 */
export function getProductsByCategory(params: {
  categoryId: string
  sortBy?: string
  page?: number
  pageSize?: number
}): Promise<CloudResponse<PaginatedData<Sku>>> {
  return callCloudFunction<PaginatedData<Sku>>('get-product', {
    action: 'getProductsByCategory',
    data: params,
  })
}

/** 按材质查询商品 */
export function getProductsByMaterial(params: {
  materialId: string
  sortBy?: string
  page?: number
  pageSize?: number
}): Promise<CloudResponse<PaginatedData<Sku>>> {
  return callCloudFunction<PaginatedData<Sku>>('get-product', {
    action: 'getProductsByMaterial',
    data: params,
  })
}

/** 多条件筛选商品 */
export function getProductsByFilter(params: {
  subSeriesIds?: string[]
  categoryIds?: string[]
  materialIds?: string[]
  sortBy?: string
  page?: number
  pageSize?: number
}): Promise<CloudResponse<PaginatedData<Sku>>> {
  return callCloudFunction<PaginatedData<Sku>>('get-product', {
    action: 'getProductsByFilter',
    data: params,
  })
}

/** 获取模特展示数据 */
export function getModelShowData(skuIds: string[]): Promise<CloudResponse<Sku[]>> {
  return callCloudFunction<Sku[]>('get-product', {
    action: 'getModelShowData',
    data: { skuIds },
  })
}

/** 获取单个子系列信息 */
export function getSubSeriesInfo(subSeriesId: string): Promise<CloudResponse<{ subSeries: SubSeries }>> {
  return callCloudFunction<{ subSeries: SubSeries }>('manage-subseries', {
    action: 'get',
    data: { id: subSeriesId },
  })
}

/** 获取子系列列表 */
export function listSubSeries(filterEnabled?: boolean): Promise<CloudResponse<SubSeries[]>> {
  return callCloudFunction<SubSeries[]>('manage-subseries', {
    action: 'list',
    data: { filterEnabled },
  })
}

/** 获取分类列表 */
export function listCategories(): Promise<CloudResponse<Category[]>> {
  return callCloudFunction<Category[]>('manage-category', {
    action: 'list',
  })
}

/** 获取材质列表 */
export function listMaterials(filterEnabled?: boolean): Promise<CloudResponse<Material[]>> {
  return callCloudFunction<Material[]>('manage-material', {
    action: 'list',
    data: { filterEnabled },
  })
}

/** 根据 ID 列表获取材质信息 */
export function listMaterialsByIds(ids: string[]): Promise<CloudResponse<{ materials: Material[] }>> {
  return callCloudFunction<{ materials: Material[] }>('manage-material', {
    action: 'listByIds',
    data: { ids },
  })
}

/** 获取推荐商品 */
export function getRecommendations(skuId: string): Promise<CloudResponse<Sku[]>> {
  return callCloudFunction<Sku[]>('manage-recommendations', {
    action: 'getRecommendations',
    data: { skuId, limit: 3 },
  })
}

/** 根据购物车商品分类获取推荐 */
export function getRecommendationsByCategories(
  spuIds: string[],
  excludeSkuIds: string[],
  limit = 8
): Promise<CloudResponse<any>> {
  return callCloudFunction('manage-recommendations', {
    action: 'getRecommendationsByCategories',
    data: { spuIds, excludeSkuIds, limit },
  })
}
