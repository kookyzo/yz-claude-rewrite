import { useState, useCallback, useRef } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useLoad, useShareAppMessage } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import LoadingBar from '@/components/LoadingBar'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import { useImageProcessor } from '@/hooks/useImageProcessor'
import {
  getSubSeriesInfo,
  getProductsBySubSeries,
  listCategories,
  listMaterials,
  getProductsByFilter,
} from '@/services/product.service'
import { formatPrice } from '@/utils/format'
import { navigateTo } from '@/utils/navigation'
import type { SubSeries } from '@/types/product'
import styles from './index.module.scss'

interface SeriesProduct {
  _id: string
  nameEN: string
  nameCN: string
  price: number
  formattedPrice: string
  image: string
  materialId?: string
}

type FilterType = 'category' | 'material'
type SortType = 'default' | 'price_asc' | 'price_desc'

interface FilterItem {
  id: string
  name: string
  type: FilterType
  isSelected: boolean
  isMaterialGroup?: boolean
  materialIds?: string[]
}

interface FilterSection {
  id: string
  title: string
  type: FilterType
  items: FilterItem[]
}

const SORT_TEXT_MAP: Record<SortType, string> = {
  default: '默认排序',
  price_asc: '价格↑',
  price_desc: '价格↓',
}

const MATERIAL_GROUPS = [
  { id: 'material_18k_gold', name: '18k黄金', colorKey: '黄金' },
  { id: 'material_18k_white', name: '18k白金', colorKey: '白金' },
  { id: 'material_18k_black', name: '18k黑金', colorKey: '黑金' },
]

const PAGE_SIZE = 20

export default function SeriesDetail() {
  const router = useRouter()
  const subSeriesId = router.params.subSeriesId || ''
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const { processImages } = useImageProcessor()

  // Sub-series info
  const [subSeriesInfo, setSubSeriesInfo] = useState<SubSeries | null>(null)
  const [headerImage, setHeaderImage] = useState('')

  // Product list
  const [products, setProducts] = useState<SeriesProduct[]>([])
  const [productCount, setProductCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)

  // Sort & filter
  const [currentSort, setCurrentSort] = useState<SortType>('default')
  const [showSortPanel, setShowSortPanel] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filterSections, setFilterSections] = useState<FilterSection[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([])

  // Refs for stable access in callbacks
  const loadingRef = useRef(false)
  const currentSortRef = useRef<SortType>('default')
  const filterSectionsRef = useRef<FilterSection[]>([])

  /** Expand material group IDs to real material IDs */
  const expandMaterialIds = useCallback((rawIds: string[]): string[] => {
    const materialSection = filterSectionsRef.current.find(
      (s) => s.type === 'material',
    )
    const items = materialSection?.items || []
    const groupMap = new Map(items.map((it) => [String(it.id), it]))

    const out: string[] = []
    rawIds.forEach((id) => {
      const key = String(id)
      const it = groupMap.get(key)
      if (it?.materialIds?.length) {
        out.push(...it.materialIds)
      } else {
        out.push(key)
      }
    })
    return [...new Set(out.filter(Boolean))]
  }, [])

  /** Load filter sections (categories + material groups) */
  const loadFilterData = useCallback(async () => {
    try {
      const [categoriesRes, materialsRes] = await Promise.all([
        listCategories(),
        listMaterials(true),
      ])

      const sections: FilterSection[] = []

      // Categories
      if (categoriesRes.code === 200) {
        const rawData = categoriesRes.data as any
        let rawList: any[] = Array.isArray(rawData)
          ? rawData
          : rawData?.categories || []
        rawList = rawList.filter((item: any) => item.status === true)
        rawList.sort(
          (a: any, b: any) =>
            (parseInt(a.categoryId, 10) || 999) -
            (parseInt(b.categoryId, 10) || 999),
        )

        sections.push({
          id: 'category',
          title: '分类',
          type: 'category',
          items: rawList.map((item: any) => ({
            id: item._id,
            name: item.categoryName || item.typeName || '',
            type: 'category' as FilterType,
            isSelected: false,
          })),
        })
      }

      // Materials (grouped into 18k gold types)
      if (materialsRes.code === 200) {
        const rawData = materialsRes.data as any
        const rawList: any[] = Array.isArray(rawData)
          ? rawData
          : rawData?.materials || []

        const normalize = (v: string) => String(v || '').toLowerCase()
        const getSearchText = (m: any) =>
          normalize([m?.nameCN, m?.description].filter(Boolean).join(' '))
        const isMatchGroup = (text: string, colorKey: string) =>
          text.includes(`18k${colorKey}`) ||
          (text.includes('18k') && text.includes(colorKey))

        const groupAgg = new Map(
          MATERIAL_GROUPS.map((g) => [
            g.id,
            { ...g, materialIds: [] as string[] },
          ]),
        )

        rawList.forEach((m: any) => {
          const text = getSearchText(m)
          MATERIAL_GROUPS.forEach((g) => {
            if (isMatchGroup(text, g.colorKey)) {
              const agg = groupAgg.get(g.id)!
              if (m?._id) agg.materialIds.push(m._id)
            }
          })
        })

        sections.push({
          id: 'material',
          title: '材质',
          type: 'material',
          items: MATERIAL_GROUPS.map((g) => {
            const agg = groupAgg.get(g.id)!
            return {
              id: g.id,
              name: g.name,
              type: 'material' as FilterType,
              isSelected: false,
              isMaterialGroup: true,
              materialIds: [
                ...new Set(agg.materialIds.filter(Boolean).map(String)),
              ],
            }
          }),
        })
      }

      setFilterSections(sections)
      filterSectionsRef.current = sections
    } catch (e) {
      console.error('[SeriesDetail] loadFilterData error:', e)
    }
  }, [])

  /** Process raw products from cloud response */
  const processProductData = useCallback(
    async (rawProducts: any[]): Promise<SeriesProduct[]> => {
      const cloudUrls = rawProducts
        .map((p) => p.skuMainImages?.[0])
        .filter(Boolean)

      let processedUrls: string[] = []
      if (cloudUrls.length > 0) {
        try {
          processedUrls = await processImages(cloudUrls)
        } catch {
          processedUrls = cloudUrls
        }
      }

      let urlIndex = 0
      return rawProducts.map((p) => {
        const hasImage = !!p.skuMainImages?.[0]
        const image = hasImage ? processedUrls[urlIndex++] || '' : ''
        return {
          _id: p._id,
          nameEN: p.nameEN || '',
          nameCN: p.nameCN || '',
          price: p.price || 0,
          formattedPrice: formatPrice(p.price || 0),
          image,
          materialId: p.materialId,
        }
      })
    },
    [processImages],
  )

  /** Load products (reset=true for first page, false for load more) */
  const loadProducts = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return
      if (!reset && !hasMore && currentPage > 0) return

      loadingRef.current = true
      setLoading(true)

      const page = reset ? 1 : currentPage + 1

      try {
        const params: any = {
          subSeriesId,
          sortBy: currentSortRef.current,
          page,
          pageSize: PAGE_SIZE,
        }

        const res = await getProductsBySubSeries(params)

        if (res?.code === 200) {
          const rawData = res.data as any
          const rawProducts = rawData?.products || rawData?.items || []
          const skuCount =
            rawData?.skuCount || rawData?.total || rawProducts.length
          const pagination = rawData?.pagination || {}

          const processed = await processProductData(rawProducts)

          if (reset) {
            setProducts(processed)
          } else {
            setProducts((prev) => [...prev, ...processed])
          }

          setProductCount(skuCount)
          setCurrentPage(page)

          const moreAvailable = pagination.page
            ? pagination.page < pagination.totalPages
            : rawProducts.length >= PAGE_SIZE
          setHasMore(moreAvailable)
        }
      } catch (e) {
        console.error('[SeriesDetail] loadProducts error:', e)
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [
      subSeriesId,
      hasMore,
      currentPage,
      processProductData,
    ],
  )

  /** Load products with combined secondary filters */
  const loadProductsWithFilter = useCallback(
    async (catIds: string[], matIds: string[], sort: SortType) => {
      loadingRef.current = true
      setLoading(true)

      try {
        const filterData: Record<string, any> = {
          subSeriesIds: [subSeriesId],
          sortBy: sort,
          page: 1,
          pageSize: PAGE_SIZE,
        }

        if (catIds.length > 0) filterData.categoryIds = catIds
        const expandedMatIds = expandMaterialIds(matIds)
        if (expandedMatIds.length > 0) filterData.materialIds = expandedMatIds

        const res = await getProductsByFilter(filterData)

        if (res?.code === 200) {
          const rawData = res.data as any
          const rawProducts = rawData?.products || rawData?.items || []
          const skuCount = rawData?.skuCount || rawProducts.length
          const pagination = rawData?.pagination || {}

          const processed = await processProductData(rawProducts)
          const moreAvailable = pagination.page < pagination.totalPages

          setProducts(processed)
          setProductCount(skuCount)
          setCurrentPage(1)
          setHasMore(moreAvailable)
        }
      } catch (e) {
        console.error('[SeriesDetail] loadProductsWithFilter error:', e)
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [subSeriesId, expandMaterialIds, processProductData],
  )

  /** Load sub-series info */
  const loadSubSeriesInfoData = useCallback(async () => {
    if (!subSeriesId) return
    try {
      const res = await getSubSeriesInfo(subSeriesId)
      if (res?.code === 200) {
        const info = (res.data as any)?.subSeries || res.data || null
        setSubSeriesInfo(info)

        // Process header image
        if (info?.displayImage) {
          try {
            const [processed] = await processImages([info.displayImage])
            setHeaderImage(processed)
          } catch {
            setHeaderImage(info.displayImage)
          }
        }
      }
    } catch (e) {
      console.error('[SeriesDetail] loadSubSeriesInfo error:', e)
    }
  }, [subSeriesId, processImages])

  // Page load
  useLoad(() => {
    if (subSeriesId) {
      loadSubSeriesInfoData()
      loadProducts(true)
      loadFilterData()
    }
  })

  // Share
  useShareAppMessage(() => ({
    title: subSeriesInfo?.nameEN || 'YZHENG',
    path: `/pages-sub/series-detail/index?subSeriesId=${subSeriesId}`,
  }))

  // ===== Event handlers =====

  const handleScrollToLower = useCallback(() => {
    loadProducts(false)
  }, [loadProducts])

  const handleProductTap = useCallback((productId: string) => {
    navigateTo(`/pages/product-detail/index?skuId=${productId}`)
  }, [])

  const handleToggleSortPanel = useCallback(() => {
    setShowSortPanel((prev) => !prev)
    setShowFilterPanel(false)
  }, [])

  const handleSelectSort = useCallback(
    (sort: SortType) => {
      currentSortRef.current = sort
      setCurrentSort(sort)
      setShowSortPanel(false)
      setCurrentPage(0)
      setHasMore(true)

      const hasSecondary =
        selectedCategories.length > 0 || selectedMaterials.length > 0
      if (hasSecondary) {
        loadProductsWithFilter(selectedCategories, selectedMaterials, sort)
      } else {
        setTimeout(() => loadProducts(true), 0)
      }
    },
    [loadProducts, loadProductsWithFilter, selectedCategories, selectedMaterials],
  )

  const handleToggleFilterPanel = useCallback(() => {
    setShowFilterPanel((prev) => !prev)
    setShowSortPanel(false)
  }, [])

  const handleToggleFilterItem = useCallback((type: FilterType, id: string) => {
    const toggle = (prev: string[]) => {
      const idx = prev.indexOf(id)
      return idx > -1 ? prev.filter((x) => x !== id) : [...prev, id]
    }

    if (type === 'category') setSelectedCategories(toggle)
    else if (type === 'material') setSelectedMaterials(toggle)

    // Sync isSelected flag in filterSections
    const sections = filterSectionsRef.current.map((s) => {
      if (s.type !== type) return s
      return {
        ...s,
        items: s.items.map((it) =>
          String(it.id) === String(id)
            ? { ...it, isSelected: !it.isSelected }
            : it,
        ),
      }
    })
    setFilterSections(sections)
    filterSectionsRef.current = sections
  }, [])

  const handleResetFilter = useCallback(() => {
    setSelectedCategories([])
    setSelectedMaterials([])

    const sections = filterSectionsRef.current.map((s) => ({
      ...s,
      items: s.items.map((it) => ({ ...it, isSelected: false })),
    }))
    setFilterSections(sections)
    filterSectionsRef.current = sections
  }, [])

  const handleConfirmFilter = useCallback(() => {
    const hasSecondary =
      selectedCategories.length > 0 || selectedMaterials.length > 0

    setShowFilterPanel(false)

    if (hasSecondary) {
      loadProductsWithFilter(selectedCategories, selectedMaterials, currentSortRef.current)
    } else {
      setCurrentPage(0)
      setHasMore(true)
      setTimeout(() => loadProducts(true), 0)
    }
  }, [selectedCategories, selectedMaterials, loadProducts, loadProductsWithFilter])

  // ===== Layout calculation =====
  const topBarTotalHeight = statusBarHeight + navBarHeight
  const contentTop = `${topBarTotalHeight}px`

  return (
    <View className={styles.container}>
      <TopBarWithBack />
      <LoadingBar visible={loading && products.length === 0} />

      <ScrollView
        className={styles.content}
        scrollY
        style={{ top: contentTop, bottom: 0 }}
        onScrollToLower={handleScrollToLower}
        lowerThreshold={100}
      >
        {/* Header image */}
        {headerImage && (
          <View className={styles.headerImageContainer}>
            <Image
              className={styles.headerImage}
              src={headerImage}
              mode='aspectFill'
              lazyLoad
            />
          </View>
        )}

        {/* Title section */}
        <View className={styles.titleSection}>
          <Text className={styles.seriesTitleEn}>
            {subSeriesInfo?.nameEN || ''}
          </Text>
          <Text className={styles.seriesTitleCn}>
            {subSeriesInfo?.name || ''}
          </Text>
        </View>

        {/* Summary bar with sort & filter */}
        <View className={styles.summaryBar}>
          <Text className={styles.productCount}>
            共{productCount}件作品
          </Text>
          <View className={styles.summaryRight}>
            <View
              className={styles.filterBtn}
              onClick={handleToggleFilterPanel}
            >
              <Image
                className={styles.filterIcon}
                src='/assets/icons/filter.png'
                mode='aspectFit'
              />
              <Text className={styles.filterText}>筛选</Text>
            </View>
            <View
              className={styles.sortBtn}
              onClick={handleToggleSortPanel}
            >
              <Image
                className={styles.sortIcon}
                src='/assets/icons/sort.png'
                mode='aspectFit'
              />
              <Text className={styles.sortText}>
                {SORT_TEXT_MAP[currentSort]}
              </Text>
            </View>
          </View>

          {/* Sort panel */}
          {showSortPanel && (
            <View className={styles.sortPanel}>
              {(['default', 'price_asc', 'price_desc'] as SortType[]).map(
                (sort) => (
                  <View
                    key={sort}
                    className={`${styles.sortOption} ${
                      currentSort === sort ? styles.sortOptionActive : ''
                    }`}
                    onClick={() => handleSelectSort(sort)}
                  >
                    <Text>
                      {sort === 'default'
                        ? '默认排序'
                        : sort === 'price_asc'
                          ? '价格从低到高'
                          : '价格从高到低'}
                    </Text>
                  </View>
                ),
              )}
            </View>
          )}

          {/* Filter panel */}
          {showFilterPanel && (
            <View className={styles.filterPanel}>
              <ScrollView scrollY className={styles.filterOptionsContainer}>
                {filterSections.map((section) => (
                  <View key={section.id} className={styles.filterSection}>
                    <Text className={styles.filterSectionTitle}>
                      {section.title}
                    </Text>
                    <View className={styles.filterItems}>
                      {section.items.map((item) => (
                        <View
                          key={item.id}
                          className={styles.filterItemOption}
                          onClick={() =>
                            handleToggleFilterItem(section.type, item.id)
                          }
                        >
                          <Image
                            className={styles.filterCheckIcon}
                            src={
                              item.isSelected
                                ? '/assets/icons/selected.png'
                                : '/assets/icons/not_selected.png'
                            }
                            mode='aspectFit'
                          />
                          <Text className={styles.filterItemText}>
                            {item.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View className={styles.filterButtons}>
                <View
                  className={`${styles.filterBtnBase} ${styles.filterBtnReset}`}
                  onClick={handleResetFilter}
                >
                  <Text>重置</Text>
                </View>
                <View
                  className={`${styles.filterBtnBase} ${styles.filterBtnConfirm}`}
                  onClick={handleConfirmFilter}
                >
                  <Text>确定</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Product grid */}
        <View className={styles.productGridContainer}>
          {loading && products.length === 0 ? (
            <View className={styles.loadingContainer}>
              <Text>加载中...</Text>
            </View>
          ) : (
            <>
              <View className={styles.productGrid}>
                {products.map((product) => (
                  <View
                    key={product._id}
                    className={styles.productItem}
                    onClick={() => handleProductTap(product._id)}
                  >
                    <View className={styles.productImageWrapper}>
                      {product.image ? (
                        <Image
                          className={styles.productImage}
                          src={product.image}
                          mode='aspectFill'
                          lazyLoad
                        />
                      ) : (
                        <View className={styles.productImagePlaceholder}>
                          <Text>暂无图片</Text>
                        </View>
                      )}
                    </View>
                    <View className={styles.productInfo}>
                      <Text className={styles.productNameEn}>
                        {product.nameEN}
                      </Text>
                      <Text className={styles.productNameCn}>
                        {product.nameCN}
                      </Text>
                      <Text className={styles.productPrice}>
                        {product.formattedPrice}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Empty state */}
              {products.length === 0 && !loading && (
                <View className={styles.emptyProducts}>
                  <Text>暂无商品</Text>
                </View>
              )}

              {/* Loading more */}
              {loading && products.length > 0 && (
                <View className={styles.loadingMore}>
                  <Text>加载中...</Text>
                </View>
              )}

              {/* No more */}
              {!hasMore && products.length > 0 && (
                <View className={styles.noMore}>
                  <Text>没有更多商品了</Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
