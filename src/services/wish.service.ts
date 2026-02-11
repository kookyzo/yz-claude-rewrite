import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse } from '@/types/api'

/** 添加心愿 */
export function addWish(
  userId: string,
  spuId: string,
  skuId: string
): Promise<CloudResponse> {
  return callCloudFunction('manage-wish', {
    action: 'add',
    userId,
    spuId,
    skuId,
  })
}

/** 移除心愿 */
export function removeWish(wishId: string): Promise<CloudResponse> {
  return callCloudFunction('manage-wish', {
    action: 'remove',
    _wishId: wishId,
  })
}

/** 检查是否已收藏 */
export function checkWish(
  userId: string,
  spuId: string,
  skuId: string
): Promise<CloudResponse<{ exists: boolean }>> {
  return callCloudFunction<{ exists: boolean }>('manage-wish', {
    action: 'check',
    userId,
    spuId,
    skuId,
  })
}

/** 获取心愿列表 */
export function listWishes(userId: string): Promise<CloudResponse> {
  return callCloudFunction('manage-wish', {
    action: 'list',
    userId: { _id: userId },
  })
}
