import { useState, useRef, useCallback, useEffect } from 'react'
import { batchConvertUrls, compressImageUrl } from '@/utils/image'

interface UseImageProcessorReturn {
  processImages: (
    cloudUrls: string[],
    options?: { width?: number; height?: number; quality?: number },
  ) => Promise<string[]>
  processing: boolean
}

export function useImageProcessor(): UseImageProcessorReturn {
  const [processing, setProcessing] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const processImages = useCallback(
    async (
      cloudUrls: string[],
      options?: { width?: number; height?: number; quality?: number },
    ): Promise<string[]> => {
      const width = options?.width ?? 300
      const height = options?.height ?? 300
      const quality = options?.quality ?? 50

      if (mountedRef.current) setProcessing(true)

      try {
        // Batch convert cloud:// URLs to HTTP URLs
        const httpUrls = await batchConvertUrls(cloudUrls)

        // Compress all HTTP URLs
        return httpUrls.map((url) => compressImageUrl(url, width, height, quality))
      } finally {
        if (mountedRef.current) setProcessing(false)
      }
    },
    [],
  )

  return { processImages, processing }
}
