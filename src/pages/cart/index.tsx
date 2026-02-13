import { useState, useCallback } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import { useAuth } from '@/hooks/useAuth'
import { useCartStore } from '@/stores/useCartStore'
import { useAppStore } from '@/stores/useAppStore'
import { formatPrice } from '@/utils/format'
import { navigateTo, switchTab } from '@/utils/navigation'
import TopBar from '@/components/TopBar'
import FloatBtn from '@/components/FloatBtn'
import FloatPopup from '@/components/FloatPopup'
import LoadingBar from '@/components/LoadingBar'
import styles from './index.module.scss'

export default function Cart() {
  const { ensureLogin } = useAuth()
  const { items, loading, totalPrice, selectedCount, isAllChecked } = useCartStore()
  const { fetchCart, toggleItem, toggleAll, updateQuantity, removeItem } = useCartStore()

  const [isPopupShow, setIsPopupShow] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  const isEmpty = items.length === 0 && !loading

  const refreshCart = useCallback(async () => {
    const loggedIn = await ensureLogin()
    if (!loggedIn) return
    await fetchCart()
    setPageLoading(false)
  }, [ensureLogin, fetchCart])

  useLoad(() => {
    setPageLoading(true)
  })

  useDidShow(() => {
    useAppStore.getState().setCurrentTab(2)
    refreshCart()
  })

  /** 勾选单个商品 */
  const handleToggleItem = (cartItemId: string, checked: boolean) => {
    toggleItem(cartItemId, !checked)
  }

  /** 全选/全不选 */
  const handleToggleAll = () => {
    toggleAll(!isAllChecked)
  }

  /** 增加数量 */
  const handlePlus = (cartItemId: string, currentQty: number) => {
    updateQuantity(cartItemId, currentQty + 1)
  }

  /** 减少数量 */
  const handleMinus = (cartItemId: string, currentQty: number) => {
    if (currentQty <= 1) return
    updateQuantity(cartItemId, currentQty - 1)
  }

  /** 删除商品 */
  const handleRemove = (cartItemId: string) => {
    Taro.showModal({
      title: '提示',
      content: '确定要删除该商品吗？',
      success: (res) => {
        if (res.confirm) {
          removeItem(cartItemId)
        }
      },
    })
  }

  /** 跳转商品详情 */
  const goToProductDetail = (skuId: string, spuId: string) => {
    if (skuId) {
      navigateTo(`/pages/product-detail/index?skuId=${skuId}`)
    } else if (spuId) {
      navigateTo(`/pages/product-detail/index?spuId=${spuId}`)
    }
  }

  /** 去逛逛 */
  const goShop = () => {
    switchTab('/pages/category/index')
  }

  /** 结算 */
  const goPay = () => {
    if (selectedCount <= 0) {
      Taro.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    navigateTo('/pages/payment/payment')
  }

  return (
    <View className={styles.container}>
      <TopBar backgroundColor='white' />
      <LoadingBar visible={pageLoading && loading} />

      {/* 加载中 */}
      {loading && (
        <View className={styles.loadingContainer} />
      )}

      {/* 空购物车 */}
      {isEmpty && !pageLoading && (
        <View className={styles.emptyContainer}>
          <Image
            className={styles.cartIcon}
            src='/assets/icons/shopping_cart.png'
            mode='aspectFit'
          />
          <Text className={styles.emptyTip}>购物车是空的</Text>
          <View className={styles.goShopBtnContainer}>
            <View className={styles.goShopBtn} onClick={goShop}>
              <Text>去逛逛</Text>
            </View>
          </View>
        </View>
      )}

      {/* 非空购物车 */}
      {items.length > 0 && !loading && (
        <View className={styles.cartContainer}>
          <ScrollView className={styles.cartList} scrollY>
            {items.map((item) => (
              <View className={styles.item} key={item._cartItemId}>
                {/* 勾选框 */}
                <View
                  className={styles.productCheckbox}
                  onClick={() => handleToggleItem(item._cartItemId, item.checked)}
                >
                  <View className={styles.checkboxView}>
                    <Image
                      className={styles.checkboxImg}
                      src={item.checked ? '/assets/icons/selected.png' : '/assets/icons/not_selected.png'}
                    />
                  </View>
                </View>

                {/* 商品区域 */}
                <View className={styles.product}>
                  {/* 商品图片 */}
                  <View
                    className={styles.display}
                    onClick={() => goToProductDetail(item.skuId, item.spuId)}
                  >
                    <Image className={styles.displayImg} src={item.image} mode='aspectFill' />
                  </View>

                  {/* 信息区 */}
                  <View className={styles.infoTop}>
                    <View
                      className={styles.infoContent}
                      onClick={() => goToProductDetail(item.skuId, item.spuId)}
                    >
                      <Text className={styles.foreignName}>{item.nameEN}</Text>
                      <Text className={styles.name}>{item.name}</Text>
                      {item.size && (
                        <Text className={styles.size}>作品尺寸：{item.size}</Text>
                      )}
                      {item.material && (
                        <Text className={styles.material}>作品材质：{item.material}</Text>
                      )}

                      {/* 数量 + 价格 */}
                      <View className={styles.infoBottom}>
                        <View className={styles.quantity}>
                          <View
                            className={styles.minus}
                            onClick={(e) => { e.stopPropagation(); handleMinus(item._cartItemId, item.quantity) }}
                          >
                            <Image className={styles.minusImg} src='/assets/icons/minus.png' />
                          </View>
                          <Text className={styles.number}>{item.quantity}</Text>
                          <View
                            className={styles.plus}
                            onClick={(e) => { e.stopPropagation(); handlePlus(item._cartItemId, item.quantity) }}
                          >
                            <Image className={styles.plusImg} src='/assets/icons/add.png' />
                          </View>
                        </View>
                        <Text className={styles.price}>
                          ¥{formatPrice(item.price * item.quantity)}
                        </Text>
                      </View>
                    </View>

                    {/* 删除按钮 */}
                    <Text
                      className={styles.cancel}
                      onClick={() => handleRemove(item._cartItemId)}
                    >
                      ×
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* 底部结算栏 */}
          <View className={styles.bottomBar}>
            <View className={styles.selectAllContainer}>
              <View className={styles.checkboxLabel} onClick={handleToggleAll}>
                <View className={styles.productCheckbox}>
                  <View className={styles.checkboxView}>
                    <Image
                      className={styles.checkboxImg}
                      src={isAllChecked ? '/assets/icons/selected.png' : '/assets/icons/not_selected.png'}
                    />
                  </View>
                </View>
                <Text className={styles.checkboxText}>全选</Text>
              </View>
            </View>
            <View className={styles.total}>
              <Text>共计：</Text>
              <Text className={styles.totalPrice}>¥{formatPrice(totalPrice)}</Text>
            </View>
          </View>

          <View className={styles.checkoutContainer}>
            <View className={styles.checkoutBtn} onClick={goPay}>
              <Text>去结算</Text>
            </View>
          </View>
        </View>
      )}

      <FloatBtn onPress={() => setIsPopupShow(true)} />
      <FloatPopup visible={isPopupShow} onClose={() => setIsPopupShow(false)} />
    </View>
  )
}
