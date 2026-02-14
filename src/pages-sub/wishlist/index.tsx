import { useState, useCallback } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import { useImageProcessor } from '@/hooks/useImageProcessor'
import { getUserInfo } from '@/services/user.service'
import { listWishes, removeWish } from '@/services/wish.service'
import { formatPrice } from '@/utils/format'
import styles from './index.module.scss'

interface WishItem {
  _wishId: string
  skuId: string
  spuId: string
  name: string
  nameEN: string
  price: number
  formattedPrice: string
  image: string
  material: string
}

const normalizeWishItem = (raw: any): WishItem => {
  const skuInfo = raw.skuInfo || {}
  const spuInfo = raw.spuInfo || {}
  const materialInfo = raw.materialInfo || {}

  const name = skuInfo.nameCN || spuInfo.name || ''
  const nameEN = skuInfo.nameEN || ''
  const price = Number(skuInfo.price ?? spuInfo.referencePrice ?? 0) || 0
  const image = skuInfo.skuMainImages?.[0] || spuInfo.mainImages?.[0] || ''
  const material = materialInfo.nameCN || ''

  const skuId = skuInfo._id
    ? (typeof skuInfo._id === 'object' ? skuInfo._id._id : skuInfo._id)
    : (raw.skuId?._id ? raw.skuId._id : (raw.skuId || ''))
  const spuId = spuInfo._id
    ? (typeof spuInfo._id === 'object' ? spuInfo._id._id : spuInfo._id)
    : (raw.spuId?._id ? raw.spuId._id : (raw.spuId || ''))

  return {
    _wishId: raw._id || raw._wishId || '',
    skuId,
    spuId,
    name,
    nameEN,
    price,
    formattedPrice: formatPrice(price),
    image,
    material,
  }
}

export default function Wishlist() {
  const [items, setItems] = useState<WishItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isEmpty, setIsEmpty] = useState(true)
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const { processImages } = useImageProcessor()
  const topOffset = statusBarHeight + navBarHeight

  const refreshWishlist = useCallback(async () => {
    setLoading(true)
    try {
      const userRes = await getUserInfo()
      if (userRes.code !== 200 || !userRes.data?._id) {
        Taro.showToast({ title: '请先完成注册', icon: 'none' })
        setItems([])
        setIsEmpty(true)
        setLoading(false)
        setTimeout(() => {
          Taro.navigateTo({ url: '/pages-sub/register/index' })
        }, 1000)
        return
      }

      const res = await listWishes(userRes.data._id)
      if (res.code === 200) {
        const wishes = (res.data as any)?.wishes || []
        const normalized = wishes.map(normalizeWishItem)

        const imageUrls = normalized.map((item) => item.image).filter(Boolean)
        if (imageUrls.length > 0) {
          const processedUrls = await processImages(imageUrls)
          let urlIndex = 0
          normalized.forEach((item) => {
            if (item.image) {
              item.image = processedUrls[urlIndex++]
            }
          })
        }

        setItems(normalized)
        setIsEmpty(normalized.length === 0)
      }
    } catch (err) {
      console.error('refreshWishlist error:', err)
    } finally {
      setLoading(false)
    }
  }, [processImages])

  useDidShow(() => {
    refreshWishlist()
  })

  const handleRemove = async (e: any, wishId: string) => {
    e.stopPropagation()
    const res = await removeWish(wishId)
    if (res.code === 200) {
      Taro.showToast({ title: '已移除', icon: 'success' })
      await refreshWishlist()
    } else {
      Taro.showToast({ title: '移除失败', icon: 'none' })
    }
  }

  const handleGoDetail = (skuId: string, spuId: string) => {
    if (skuId) {
      Taro.navigateTo({ url: `/pages/product-detail/index?skuId=${skuId}` })
    } else if (spuId) {
      Taro.navigateTo({ url: `/pages/product-detail/index?spuId=${spuId}` })
    }
  }

  const handleGoShop = () => {
    Taro.switchTab({ url: '/pages/category/index' })
  }

  return (
    <View className={styles.page}>
      <TopBarWithBack />

      <View style={{ marginTop: `${topOffset}px` }}>
        {loading && (
          <View className={styles.loadingContainer}>
            <View className={styles.loadingContent}>
              <View className={styles.loadingSpinner} />
              <Text className={styles.loadingText}>正在加载心愿单...</Text>
            </View>
          </View>
        )}

        {isEmpty && !loading && (
          <View className={styles.emptyContainer}>
            <Text className={styles.emptyTip}>您的心愿单为空</Text>
            <View className={styles.goShopBtnWrap}>
              <View className={styles.goShopBtn} onClick={handleGoShop}>
                去添加心愿
              </View>
            </View>
          </View>
        )}

        {!isEmpty && !loading && (
          <View className={styles.listContainer}>
            <ScrollView className={styles.wishlist} scrollY>
              {items.map((item) => (
                <View
                  key={item._wishId}
                  className={styles.item}
                  onClick={() => handleGoDetail(item.skuId, item.spuId)}
                >
                  <View className={styles.product}>
                    <View className={styles.display}>
                      <Image
                        className={styles.displayImage}
                        src={item.image}
                        mode='aspectFill'
                      />
                    </View>
                    <View className={styles.exceptDisplayTop}>
                      <View className={styles.exceptDisplayCancelTop}>
                        <Text className={styles.name}>{item.name}</Text>
                        <Text className={styles.foreignName}>{item.nameEN}</Text>
                        <Text className={styles.material}>{item.material}</Text>
                        <View className={styles.exceptDisplayBottom}>
                          <Text className={styles.price}>{item.formattedPrice}</Text>
                        </View>
                      </View>
                      <Text
                        className={styles.cancel}
                        onClick={(e) => handleRemove(e, item._wishId)}
                      >
                        ×
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  )
}
