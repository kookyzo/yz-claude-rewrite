import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse } from '@/types/api'
import type { Category, Material, ProductSize, SubSeries } from '@/types/product'

// ---- Category CRUD ----

export function addCategory(data: {
  categoryName: string
  status: boolean
  displayImage?: string
}): Promise<CloudResponse> {
  return callCloudFunction('manage-category', {
    action: 'add',
    ...data,
  })
}

export function updateCategory(data: {
  _categoryId: string
  updateData: Partial<Category>
}): Promise<CloudResponse> {
  return callCloudFunction('manage-category', {
    action: 'update',
    ...data,
  })
}

export function removeCategory(data: {
  _categoryId: string
}): Promise<CloudResponse> {
  return callCloudFunction('manage-category', {
    action: 'remove',
    ...data,
  })
}

export function getCategory(data: {
  _categoryId: string
}): Promise<CloudResponse<Category>> {
  return callCloudFunction<Category>('manage-category', {
    action: 'get',
    ...data,
  })
}

export function listCategories(): Promise<CloudResponse<Category[]>> {
  return callCloudFunction<Category[]>('manage-category', {
    action: 'list',
  })
}

// ---- Material CRUD ----

export function addMaterial(data: {
  nameCN: string
  materialImage: string
  sortNum?: number
  isEnabled?: boolean
}): Promise<CloudResponse> {
  return callCloudFunction('manage-material', {
    action: 'add',
    ...data,
  })
}

export function updateMaterial(data: {
  _materialId: string
  updateData: Partial<Material>
}): Promise<CloudResponse> {
  return callCloudFunction('manage-material', {
    action: 'update',
    ...data,
  })
}

export function removeMaterial(data: {
  _materialId: string
}): Promise<CloudResponse> {
  return callCloudFunction('manage-material', {
    action: 'remove',
    ...data,
  })
}

export function getMaterial(data: {
  _materialId: string
}): Promise<CloudResponse<Material>> {
  return callCloudFunction<Material>('manage-material', {
    action: 'get',
    ...data,
  })
}

export function listMaterials(): Promise<CloudResponse<Material[]>> {
  return callCloudFunction<Material[]>('manage-material', {
    action: 'list',
  })
}

// ---- ProductSize CRUD ----

export function addProductSize(data: {
  category: { _id: string }
  type: string
  standard: string
  sizeNum: number
  value: string
  sortNum?: number
  isEnabled?: boolean
}): Promise<CloudResponse> {
  return callCloudFunction('manage-size', {
    action: 'add',
    ...data,
  })
}

export function updateProductSize(data: {
  _sizeId: string
  updateData: Partial<ProductSize>
}): Promise<CloudResponse> {
  return callCloudFunction('manage-size', {
    action: 'update',
    ...data,
  })
}

export function removeProductSize(data: {
  _sizeId: string
}): Promise<CloudResponse> {
  return callCloudFunction('manage-size', {
    action: 'remove',
    ...data,
  })
}

export function getProductSize(data: {
  _sizeId: string
}): Promise<CloudResponse<ProductSize>> {
  return callCloudFunction<ProductSize>('manage-size', {
    action: 'get',
    ...data,
  })
}

export function listProductSizes(): Promise<CloudResponse<ProductSize[]>> {
  return callCloudFunction<ProductSize[]>('manage-size', {
    action: 'list',
  })
}

// ---- SubSeries CRUD ----

export function addSubSeries(data: {
  name: string
  displayImage: string
  introduction?: string
  parentSeriesId?: string
  sortNum?: number
  isEnabled?: boolean
}): Promise<CloudResponse> {
  return callCloudFunction('manage-subseries', {
    action: 'add',
    ...data,
  })
}

export function updateSubSeries(data: {
  _subSeriesId: string
  updateData: Partial<SubSeries>
}): Promise<CloudResponse> {
  return callCloudFunction('manage-subseries', {
    action: 'update',
    ...data,
  })
}

export function removeSubSeries(data: {
  _subSeriesId: string
}): Promise<CloudResponse> {
  return callCloudFunction('manage-subseries', {
    action: 'remove',
    ...data,
  })
}

export function getSubSeries(data: {
  _subSeriesId: string
}): Promise<CloudResponse<SubSeries>> {
  return callCloudFunction<SubSeries>('manage-subseries', {
    action: 'get',
    ...data,
  })
}

export function listSubSeries(): Promise<CloudResponse<SubSeries[]>> {
  return callCloudFunction<SubSeries[]>('manage-subseries', {
    action: 'list',
  })
}

// ---- Product Update ----

export function updateProduct(data: {
  _spuId: string
  updateData: Record<string, any>
}): Promise<CloudResponse> {
  return callCloudFunction('update-product', {
    action: 'update',
    ...data,
  })
}
