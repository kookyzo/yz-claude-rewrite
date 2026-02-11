import { useState, useRef, useCallback, useEffect } from 'react'
import { DEFAULT_PAGE_SIZE } from '@/constants'

interface UsePaginationOptions<T> {
  fetchFn: (page: number, pageSize: number) => Promise<{
    items: T[]
    hasMore: boolean
  }>
  pageSize?: number
}

interface UsePaginationReturn<T> {
  data: T[]
  loading: boolean
  hasMore: boolean
  page: number
  refresh: () => Promise<void>
  loadMore: () => Promise<void>
}

export function usePagination<T>(
  options: UsePaginationOptions<T>,
): UsePaginationReturn<T> {
  const { fetchFn, pageSize = DEFAULT_PAGE_SIZE } = options

  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)

  const mountedRef = useRef(true)
  const loadingRef = useRef(false)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    if (mountedRef.current) setLoading(true)

    try {
      const res = await fetchFn(1, pageSize)
      if (mountedRef.current) {
        setData(res.items)
        setHasMore(res.hasMore)
        setPage(1)
      }
    } finally {
      loadingRef.current = false
      if (mountedRef.current) setLoading(false)
    }
  }, [fetchFn, pageSize])

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    if (mountedRef.current) setLoading(true)

    try {
      const nextPage = page + 1
      const res = await fetchFn(nextPage, pageSize)
      if (mountedRef.current) {
        setData((prev) => [...prev, ...res.items])
        setHasMore(res.hasMore)
        setPage(nextPage)
      }
    } finally {
      loadingRef.current = false
      if (mountedRef.current) setLoading(false)
    }
  }, [fetchFn, pageSize, hasMore, page])

  return { data, loading, hasMore, page, refresh, loadMore }
}
