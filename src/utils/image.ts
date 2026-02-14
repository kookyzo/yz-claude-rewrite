import Taro from '@tarojs/taro'
import { IMAGE_BATCH_SIZE, IMAGE_BATCH_CONCURRENCY } from '@/constants'

const preloadedImagePathMap = new Map<string, string>()
const preloadImageTaskMap = new Map<string, Promise<boolean>>()

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

/** 获取预加载后的本地路径（若存在） */
export function getPreloadedImagePath(url: string): string | undefined {
  return preloadedImagePathMap.get(url)
}

function withTimeout(task: Promise<boolean>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let done = false

    const finish = (ok: boolean) => {
      if (done) return
      done = true
      if (timer) clearTimeout(timer)
      resolve(ok)
    }

    timer = setTimeout(() => finish(false), timeoutMs)
    task.then((ok) => finish(ok)).catch(() => finish(false))
  })
}

/** 预加载单张图片到本地缓存（像素级） */
export async function preloadImage(url: string, timeoutMs: number = 3000): Promise<boolean> {
  if (!url) return false
  if (preloadedImagePathMap.has(url)) return true

  const existingTask = preloadImageTaskMap.get(url)
  if (existingTask) {
    return withTimeout(existingTask, timeoutMs)
  }

  const task = Taro.getImageInfo({ src: url })
    .then((res) => {
      const localPath = (res as { path?: string }).path
      if (localPath) {
        preloadedImagePathMap.set(url, localPath)
      }
      return true
    })
    .catch(() => false)
    .finally(() => {
      preloadImageTaskMap.delete(url)
    })

  preloadImageTaskMap.set(url, task)
  return withTimeout(task, timeoutMs)
}

export interface PreloadImagesResult {
  total: number
  success: number
  failed: string[]
}

/** 批量预加载图片，默认低并发，避免瞬时请求洪峰 */
export async function preloadImages(
  urls: string[],
  options?: { concurrency?: number; timeoutMs?: number },
): Promise<PreloadImagesResult> {
  const timeoutMs = options?.timeoutMs ?? 3000
  const concurrency = Math.max(1, options?.concurrency ?? 3)

  const uniqueUrls = [...new Set(urls.filter((u): u is string => !!u))]
  if (uniqueUrls.length === 0) {
    return { total: 0, success: 0, failed: [] }
  }

  let success = 0
  const failed: string[] = []

  for (let i = 0; i < uniqueUrls.length; i += concurrency) {
    const batch = uniqueUrls.slice(i, i + concurrency)
    const results = await Promise.all(batch.map((url) => preloadImage(url, timeoutMs)))
    results.forEach((ok, idx) => {
      if (ok) {
        success += 1
        return
      }
      failed.push(batch[idx])
    })
  }

  return {
    total: uniqueUrls.length,
    success,
    failed,
  }
}
