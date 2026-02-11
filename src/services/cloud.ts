import Taro from '@tarojs/taro'
import type { CloudResponse } from '@/types/api'

export type { CloudResponse }

export async function callCloudFunction<T = any>(
  name: string,
  data: Record<string, any> = {}
): Promise<CloudResponse<T>> {
  try {
    const res = await Taro.cloud.callFunction({ name, data })
    return res.result as CloudResponse<T>
  } catch (err: any) {
    return {
      code: 500,
      message: err?.errMsg || 'cloud.callFunction failed',
    }
  }
}
