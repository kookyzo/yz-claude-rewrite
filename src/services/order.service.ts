import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse } from '@/types/api'
import type { Order, OrderStatus } from '@/types/order'

/** 从购物车创建订单 */
export function createOrderFromCart(
  userId: string,
  addressId: string
): Promise<CloudResponse<Order>> {
  return callCloudFunction<Order>('manage-order-easy', {
    action: 'createOrderFromCart',
    _userId: userId,
    _addressId: addressId,
  })
}

/** 直接购买创建订单 */
export function createDirectOrder(params: {
  userId: string
  addressId: string
  skuId: string
  quantity: number
}): Promise<CloudResponse<Order>> {
  return callCloudFunction<Order>('manage-order-easy', {
    action: 'createDirectOrder',
    _userId: params.userId,
    _addressId: params.addressId,
    _skuId: params.skuId,
    quantity: params.quantity,
  })
}

/** 更新订单状态 */
export function updateOrderStatus(params: {
  orderId: string
  userId: string
  newStatus: OrderStatus
  [key: string]: any
}): Promise<CloudResponse> {
  return callCloudFunction('manage-order-easy', {
    action: 'updateOrderStatus',
    updateData: {
      _orderId: params.orderId,
      _userId: params.userId,
      newStatus: params.newStatus,
      ...params,
    },
  })
}

/** 取消订单 */
export function cancelOrder(
  orderId: string,
  userId: string
): Promise<CloudResponse> {
  return callCloudFunction('manage-order-easy', {
    action: 'cancelOrder',
    _orderId: orderId,
    _userId: userId,
  })
}

/** 确认收货 */
export function confirmReceipt(
  orderId: string,
  userId: string
): Promise<CloudResponse> {
  return callCloudFunction('manage-order-easy', {
    action: 'confirmReceipt',
    _orderId: orderId,
    _userId: userId,
  })
}

/** 申请退款 */
export function applyRefund(params: {
  orderId: string
  userId: string
  refundReason: string
  refundAmount: number
}): Promise<CloudResponse> {
  return callCloudFunction('manage-order-easy', {
    action: 'applyRefund',
    _orderId: params.orderId,
    _userId: params.userId,
    refundReason: params.refundReason,
    refundAmount: params.refundAmount,
  })
}

/** 查询退款状态 */
export function queryRefundStatus(
  orderId: string,
  userId: string
): Promise<CloudResponse> {
  return callCloudFunction('manage-order-easy', {
    action: 'queryRefundStatus',
    _orderId: orderId,
    _userId: userId,
  })
}

/** 获取订单详情 */
export function getOrderDetail(
  orderId: string,
  userId: string
): Promise<CloudResponse<Order>> {
  return callCloudFunction<Order>('manage-order-easy', {
    action: 'getOrderDetail',
    _orderId: orderId,
    _userId: userId,
  })
}

/** 获取用户订单列表 */
export function getUserOrders(
  userId: string,
  status?: OrderStatus
): Promise<CloudResponse<Order[]>> {
  return callCloudFunction<Order[]>('manage-order-easy', {
    action: 'getUserOrders',
    _userId: userId,
    ...(status !== undefined && { status }),
  })
}
