import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse } from '@/types/api'
import type { CartItem } from '@/types/cart'

/** 添加商品到购物车 */
export function addToCart(
  userId: string,
  skuId: string,
  qty: number
): Promise<CloudResponse> {
  return callCloudFunction('manage-cart', {
    action: 'add',
    _userId: userId,
    _skuId: skuId,
    quantity: qty,
    useSpecification: true,
  })
}

/** 获取购物车列表 */
export function getCartItems(userId: string): Promise<CloudResponse<CartItem[]>> {
  return callCloudFunction<CartItem[]>('manage-cart', {
    action: 'list',
    _userId: userId,
  })
}

/** 切换单个商品选中状态 */
export function toggleItemSelected(
  cartItemId: string,
  selected: boolean
): Promise<CloudResponse> {
  return callCloudFunction('manage-cart', {
    action: 'selected',
    _cartItemId: cartItemId,
    selected,
  })
}

/** 切换全选状态 */
export function toggleAllSelected(
  userId: string,
  selected: boolean
): Promise<CloudResponse> {
  return callCloudFunction('manage-cart', {
    action: 'selectedAll',
    _userId: userId,
    selected,
  })
}

/** 移除购物车商品 */
export function removeCartItem(cartItemId: string): Promise<CloudResponse> {
  return callCloudFunction('manage-cart', {
    action: 'remove',
    _cartItemId: cartItemId,
  })
}

/** 更新购物车商品数量 */
export function updateCartItemQty(
  cartItemId: string,
  qty: number
): Promise<CloudResponse> {
  return callCloudFunction('manage-cart', {
    action: 'update',
    _cartItemId: cartItemId,
    quantity: qty,
  })
}
