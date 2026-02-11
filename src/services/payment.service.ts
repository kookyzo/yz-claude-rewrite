import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse } from '@/types/api'

/** 创建微信支付订单 */
export function createPayment(
  orderId: string,
  orderNo: string,
  desc: string
): Promise<CloudResponse> {
  return callCloudFunction('wxpayFunctions', {
    action: 'wxpay_order',
    _orderId: orderId,
    orderNo,
    description: desc,
  })
}

/** 查询支付状态 */
export function queryPayment(outTradeNo: string): Promise<CloudResponse> {
  return callCloudFunction('wxpayFunctions', {
    action: 'wxpay_query_order_by_out_trade_no',
    out_trade_no: outTradeNo,
  })
}
