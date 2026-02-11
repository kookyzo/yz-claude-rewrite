import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse } from '@/types/api'

/** 获取轮播图列表 */
export function listBanners(): Promise<CloudResponse> {
  return callCloudFunction('manage-banner', {
    action: 'list',
    filterEnabled: false,
  })
}
