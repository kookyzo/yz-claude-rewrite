import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse } from '@/types/api'
import type { CartItem } from '@/types/cart'

interface RawCartItem {
  _id?: string
  _cartItemId?: string
  cartItem_Sku?: { _id?: string } | string
  cartItem_Spu?: { _id?: string } | string
  quantity?: number
  status?: boolean
  unitPrice?: number
  material?: string
  size?: string
  skuInfo?: {
    _id?: string
    skuId?: string
    nameCN?: string
    nameEN?: string
    skuMainImages?: string[]
    price?: number
    size?: string
  }
  spuInfo?: {
    _id?: string
    spuId?: string
    name?: string
    mainImages?: string[]
    referencePrice?: number
  }
  materialInfo?: {
    nameCN?: string
  }
  sizeInfo?: {
    value?: string
  }
}

interface RawCartListData {
  cart?: any
  items?: RawCartItem[]
}

function toId(value: { _id?: string } | string | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value._id || ''
}

function normalizeCartItem(item: RawCartItem): CartItem {
  const skuInfo = item.skuInfo || {}
  const spuInfo = item.spuInfo || {}
  const materialInfo = item.materialInfo || {}
  const sizeInfo = item.sizeInfo || {}

  const skuId = toId(item.cartItem_Sku) || skuInfo._id || ''
  const spuId = toId(item.cartItem_Spu) || spuInfo._id || ''
  const price =
    Number(item.unitPrice ?? skuInfo.price ?? spuInfo.referencePrice ?? 0) || 0
  const quantity = Math.max(1, Number(item.quantity) || 1)

  return {
    _cartItemId: item._id || item._cartItemId || '',
    skuId,
    spuId,
    quantity,
    checked: !!item.status,
    name: skuInfo.nameCN || spuInfo.name || '',
    nameEN: skuInfo.nameEN || '',
    price,
    image:
      (Array.isArray(skuInfo.skuMainImages) ? skuInfo.skuMainImages[0] : '') ||
      (Array.isArray(spuInfo.mainImages) ? spuInfo.mainImages[0] : '') ||
      '',
    material: item.material || materialInfo.nameCN || '',
    size: item.size || sizeInfo.value || skuInfo.size || '',
  }
}

/** 添加商品到购物车 */
export function addToCart(
  userId: string,
  skuId: string,
  qty: number
): Promise<CloudResponse> {
  return callCloudFunction('manage-cart', {
    action: 'add',
    data: {
      _userId: userId,
      _skuId: skuId,
      quantity: qty,
      useSpecification: true,
    },
  })
}

/** 获取购物车列表 */
export async function getCartItems(
  userId: string
): Promise<CloudResponse<CartItem[]>> {
  const res = await callCloudFunction<RawCartListData>('manage-cart', {
    action: 'list',
    data: {
      _userId: userId,
    },
  })

  if (res.code !== 200) {
    return res as CloudResponse<CartItem[]>
  }

  const data = res.data as any
  const rawItems: RawCartItem[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : []

  const items = rawItems
    .map(normalizeCartItem)
    .filter((item) => !!item._cartItemId)

  return {
    ...res,
    data: items,
  }
}

/** 切换单个商品选中状态 */
export function toggleItemSelected(
  cartItemId: string,
  selected: boolean
): Promise<CloudResponse> {
  return callCloudFunction('manage-cart', {
    action: 'selected',
    data: {
      _cartItemId: cartItemId,
      selected,
    },
  })
}

/** 切换全选状态 */
export function toggleAllSelected(
  userId: string,
  selected: boolean
): Promise<CloudResponse> {
  return callCloudFunction('manage-cart', {
    action: 'selectedAll',
    data: {
      _userId: userId,
      selected,
    },
  })
}

/** 移除购物车商品 */
export function removeCartItem(cartItemId: string): Promise<CloudResponse> {
  return callCloudFunction('manage-cart', {
    action: 'remove',
    data: {
      _cartItemId: cartItemId,
    },
  })
}

/** 更新购物车商品数量 */
export function updateCartItemQty(
  cartItemId: string,
  qty: number
): Promise<CloudResponse> {
  return callCloudFunction('manage-cart', {
    action: 'update',
    data: {
      _cartItemId: cartItemId,
      quantity: qty,
    },
  })
}
