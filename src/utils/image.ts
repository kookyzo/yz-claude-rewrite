import Taro from '@tarojs/taro'
import { IMAGE_BATCH_SIZE, IMAGE_BATCH_CONCURRENCY } from '@/constants'

/** 将 cloud:// URL 转为临时 HTTP URL */
export async function processCloudUrl(cloudUrl: string): Promise<string> {
  if (!cloudUrl.startsWith('cloud://')) return cloudUrl
  const res = await Taro.cloud.getTempFileURL({ fileList: [cloudUrl] })
  return res.fileList[0]?.tempFileURL || cloudUrl
}

/** 批量转换 cloud:// URLs */
export async function batchConvertUrls(
  urls: string[],
  batchSize: number = IMAGE_BATCH_SIZE,
  concurrency: number = IMAGE_BATCH_CONCURRENCY,
): Promise<string[]> {
  // 分离 cloud:// 和非 cloud:// URL，记录原始位置
  const result: string[] = [...urls]
  const cloudEntries: { index: number; url: string }[] = []

  urls.forEach((url, i) => {
    if (url.startsWith('cloud://')) {
      cloudEntries.push({ index: i, url })
    }
  })

  if (cloudEntries.length === 0) return result

  // 按 batchSize 分批
  const batches: { index: number; url: string }[][] = []
  for (let i = 0; i < cloudEntries.length; i += batchSize) {
    batches.push(cloudEntries.slice(i, i + batchSize))
  }

  // 按 concurrency 并发执行批次
  for (let i = 0; i < batches.length; i += concurrency) {
    const concurrentBatches = batches.slice(i, i + concurrency)
    const responses = await Promise.all(
      concurrentBatches.map((batch) =>
        Taro.cloud.getTempFileURL({ fileList: batch.map((e) => e.url) }),
      ),
    )

    responses.forEach((res, batchIdx) => {
      const batch = concurrentBatches[batchIdx]
      res.fileList.forEach((file, fileIdx) => {
        const entry = batch[fileIdx]
        result[entry.index] = file.tempFileURL || entry.url
      })
    })
  }

  return result
}

/** 拼接腾讯云 COS 图片压缩参数 */
export function compressImageUrl(
  httpUrl: string,
  width: number,
  height: number,
  quality: number = 80,
): string {
  if (!httpUrl.startsWith('http')) return httpUrl
  if (httpUrl.includes('imageView2') || httpUrl.includes('imageMogr2')) return httpUrl
  return `${httpUrl}?imageView2/1/w/${width}/h/${height}/q/${quality}`
}
