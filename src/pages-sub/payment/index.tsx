import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, Image, ScrollView, Textarea } from '@tarojs/components'
import Taro, { useLoad, useDidShow, useUnload, useRouter } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import FloatPopup from '@/components/FloatPopup'
import { useAuth } from '@/hooks/useAuth'
import { useImageProcessor } from '@/hooks/useImageProcessor'
import * as orderService from '@/services/order.service'
import * as paymentService from '@/services/payment.service'
import * as addressService from '@/services/address.service'
import * as cartService from '@/services/cart.service'
import { formatPrice } from '@/utils/format'
import { navigateTo, switchTab } from '@/utils/navigation'
import type { Order } from '@/types/order'
import type { Address } from '@/types/user'
import styles from './index.module.scss'

type PaymentMode = 'cart' | 'directBuy' | 'repay'

interface PaymentItem {
  _cartItemId?: string
  skuId: string
  name: string
  nameEN: string
  price: number
  quantity: number
  image: string
  material: string
  size?: string
  formattedPrice: string
  formattedSubtotal: string
}

export default function Payment() {
  const router = useRouter()
  const { userId } = useAuth()
  const { processImages } = useImageProcessor()

  const [mode, setMode] = useState<PaymentMode>('cart')
  const [address, setAddress] = useState<Address | null>(null)
  const [items, setItems] = useState<PaymentItem[]>([])
  const [totalPrice, setTotalPrice] = useState(0)
  const [formattedTotalPrice, setFormattedTotalPrice] = useState('0.00')
  const [authAgreed, setAuthAgreed] = useState(false)
  const [remark, setRemark] = useState('')
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)
  const [paying, setPaying] = useState(false)
  const [showFloatPopup, setShowFloatPopup] = useState(false)

  const modeRef = useRef<PaymentMode>('cart')

  // Keep modeRef in sync
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  /* ---------- helpers ---------- */

  const calculateTotal = useCallback((list: PaymentItem[]) => {
    const total = list.reduce((s, it) => s + (Number(it.price) || 0) * (it.quantity || 1), 0)
    const updated = list.map(it => ({
      ...it,
      formattedPrice: formatPrice(it.price || 0),
      formattedSubtotal: formatPrice((Number(it.price) || 0) * (it.quantity || 1)),
    }))
    setItems(updated)
    setTotalPrice(Number(total.toFixed(2)))
    setFormattedTotalPrice(formatPrice(total))
  }, [])

  /* ---------- 加载默认地址 ---------- */

  const fetchDefaultAddress = useCallback(async () => {
    if (!userId) return
    try {
      const defaultRes = await addressService.getDefaultAddress(userId)
      if (defaultRes.code === 200 && defaultRes.data) {
        setAddress(defaultRes.data)
        return
      }
      // fallback: first address
      const listRes = await addressService.listAddresses(userId)
      if (listRes.code === 200 && listRes.data && listRes.data.length > 0) {
        setAddress(listRes.data[0])
      }
    } catch {
      // no address available
    }
  }, [userId])

  /* ---------- 加载购物车已选商品 ---------- */

  const fetchSelectedCartItems = useCallback(async () => {
    if (!userId) return
    try {
      const res = await cartService.getCartItems(userId)
      if (res.code !== 200 || !res.data) return

      const cartItems = Array.isArray(res.data) ? res.data : []
      const selected = cartItems.filter(i => i.checked)

      if (!selected.length) {
        setItems([])
        setTotalPrice(0)
        setFormattedTotalPrice('0.00')
        return
      }

      // Collect images for batch processing
      const rawImages = selected.map(it => it.image).filter(Boolean)
      let processedImages: string[] = []
      try {
        processedImages = await processImages(rawImages, { width: 200, height: 200, quality: 80 })
      } catch {
        processedImages = rawImages
      }

      const paymentItems: PaymentItem[] = selected.map((it, idx) => ({
        _cartItemId: it._cartItemId,
        skuId: it.skuId,
        name: it.name || '',
        nameEN: it.nameEN || '',
        price: Number(it.price) || 0,
        quantity: Math.max(1, Number(it.quantity) || 1),
        image: processedImages[idx] || it.image || '',
        material: it.material || '',
        size: it.size || '',
        formattedPrice: '',
        formattedSubtotal: '',
      }))

      calculateTotal(paymentItems)
    } catch {
      Taro.showToast({ title: '加载结算清单失败', icon: 'none' })
    }
  }, [userId, processImages, calculateTotal])

  /* ---------- 加载订单信息（repay 模式） ---------- */

  const loadOrderInfo = useCallback(async (orderId: string) => {
    if (!userId) return
    try {
      Taro.showLoading({ title: '加载订单信息...', mask: true })
      const res = await orderService.getOrderDetail(orderId, userId)
      Taro.hideLoading()

      if (res.code !== 200 || !res.data) {
        Taro.showToast({ title: '获取订单信息失败', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 1500)
        return
      }

      const order = res.data as Order
      setCurrentOrder(order)

      // Build items from order
      const orderItems: PaymentItem[] = (order.items || []).map(it => ({
        skuId: it.skuId,
        name: it.skuNameCN || '',
        nameEN: it.skuNameEN || '',
        price: Number(it.unitPrice) || 0,
        quantity: it.quantity || 1,
        image: it.skuImage?.[0] || '',
        material: it.materialName || '',
        formattedPrice: '',
        formattedSubtotal: '',
      }))

      calculateTotal(orderItems)

      // Use order's address if available, otherwise fetch default
      if (order.addressId) {
        // We don't have full address from order detail, fetch default
        await fetchDefaultAddress()
      }
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '订单信息加载失败', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1500)
    }
  }, [userId, calculateTotal, fetchDefaultAddress])

  /* ---------- 生命周期 ---------- */

  useLoad(() => {
    const { orderId } = router.params

    if (orderId) {
      setMode('repay')
      modeRef.current = 'repay'
      loadOrderInfo(orderId)
      return
    }

    const directBuyProduct = Taro.getStorageSync('directBuyProduct')
    if (directBuyProduct) {
      setMode('directBuy')
      modeRef.current = 'directBuy'
      Taro.removeStorageSync('directBuyProduct')

      const item: PaymentItem = {
        skuId: directBuyProduct.skuId || directBuyProduct._skuId || '',
        name: directBuyProduct.name || '',
        nameEN: directBuyProduct.nameEN || directBuyProduct.foreign_name || '',
        price: Number(directBuyProduct.price) || 0,
        quantity: Math.max(1, Number(directBuyProduct.quantity) || 1),
        image: directBuyProduct.image || '',
        material: directBuyProduct.material || '',
        size: directBuyProduct.size || '',
        formattedPrice: '',
        formattedSubtotal: '',
      }
      calculateTotal([item])
      fetchDefaultAddress()
      return
    }

    setMode('cart')
    modeRef.current = 'cart'
    fetchDefaultAddress()
  })

  useDidShow(() => {
    // Listen for address selection events
    Taro.eventCenter.on('selectAddress', (addr: Address) => {
      setAddress(addr)
    })

    // Cart mode: refresh items on every show
    if (modeRef.current === 'cart') {
      fetchSelectedCartItems()
    }
  })

  useUnload(() => {
    Taro.eventCenter.off('selectAddress')
  })

  /* ---------- 地址选择 ---------- */

  const handleSelectAddress = () => {
    navigateTo('/pages-sub/payment-select-address/index')
  }

  const handleAddAddress = () => {
    navigateTo('/pages-sub/address-edit/index')
  }

  /* ---------- 返回购物车 ---------- */

  const handleBackToCart = () => {
    switchTab('/pages/cart/index')
  }

  /* ---------- 备注 ---------- */

  const handleRemarkInput = (e) => {
    const val = e.detail.value || ''
    setRemark(val)
  }

  /* ---------- 隐私协议 ---------- */

  const handleToggleAuth = () => {
    setAuthAgreed(prev => !prev)
  }

  const handlePrivacyLink = (e) => {
    e.stopPropagation()
    navigateTo('/pages-sub/privacy-policy/index')
  }

  const handleAgreementLink = (e) => {
    e.stopPropagation()
    navigateTo('/pages-sub/user-agreement/index')
  }

  /* ---------- 支付流程 ---------- */

  const handlePaymentSuccess = async (order: Order) => {
    try {
      // 1. Query payment result
      const queryRes = await paymentService.queryPayment(order.orderNo)
      const transactionId = queryRes.code === 0 ? queryRes.data?.transaction_id : undefined
      const payTime = queryRes.code === 0 ? queryRes.data?.time_end : undefined

      // 2. Update order status
      await orderService.updateOrderStatus({
        orderId: order._id,
        userId: userId!,
        newStatus: 'paid',
        payMethod: 'wechat',
        transactionId,
        payTime,
      })

      // 3. Cart mode: clear purchased items
      if (mode === 'cart' && userId) {
        try {
          const cartRes = await cartService.getCartItems(userId)
          if (cartRes.code === 200 && cartRes.data) {
            const checkedItems = cartRes.data.filter(i => i.checked)
            await Promise.all(
              checkedItems.map(it => cartService.removeCartItem(it._cartItemId))
            )
          }
        } catch {
          // non-critical
        }
      }
    } catch {
      // Payment itself succeeded even if post-processing fails
    }

    // 4. Redirect to order list
    Taro.redirectTo({ url: '/pages-sub/order-list/index?type=pending_delivery' })
  }

  const handlePaymentFailure = async (order: Order) => {
    try {
      await orderService.updateOrderStatus({
        orderId: order._id,
        userId: userId!,
        newStatus: 'payment_failed',
      })
    } catch {
      // ignore
    }

    Taro.showToast({ title: '支付失败', icon: 'none', duration: 2000 })
    setTimeout(() => {
      Taro.navigateBack({ fail: () => switchTab('/pages/home/index') })
    }, 2000)
  }

  const handlePay = async () => {
    // 1. Validations
    if (!authAgreed) {
      Taro.showToast({ title: '请先同意隐私协议', icon: 'none' })
      return
    }
    if (!address) {
      Taro.showToast({ title: '请选择收货地址', icon: 'none' })
      return
    }
    if (items.length === 0) {
      Taro.showToast({ title: '没有待支付商品', icon: 'none' })
      return
    }
    if (!userId) {
      Taro.showToast({ title: '用户信息获取失败', icon: 'none' })
      return
    }

    setPaying(true)

    try {
      // 2. Create order if needed
      let order = currentOrder
      if (!order) {
        Taro.showLoading({ title: '创建订单中...', mask: true })
        const orderRes = mode === 'directBuy'
          ? await orderService.createDirectOrder({
              userId,
              addressId: address._id,
              skuId: items[0].skuId,
              quantity: items[0].quantity,
            })
          : await orderService.createOrderFromCart(userId, address._id)

        Taro.hideLoading()

        if (orderRes.code !== 200 || !orderRes.data) {
          Taro.showToast({ title: '创建订单失败', icon: 'none' })
          setPaying(false)
          return
        }
        order = orderRes.data
        setCurrentOrder(order)
      }

      // 3. Create payment
      Taro.showLoading({ title: '支付中...', mask: true })
      const payRes = await paymentService.createPayment(
        order._id,
        order.orderNo,
        `YZHENG订单-${order.orderNo}`
      )
      Taro.hideLoading()

      if (payRes.code !== 0 || !payRes.data) {
        Taro.showToast({ title: '支付创建失败', icon: 'none' })
        setPaying(false)
        return
      }

      // 4. Request payment
      const { timeStamp, nonceStr, packageVal, paySign } = payRes.data
      try {
        await Taro.requestPayment({
          timeStamp,
          nonceStr,
          package: packageVal,
          signType: 'RSA' as any,
          paySign,
        })
        await handlePaymentSuccess(order)
      } catch {
        await handlePaymentFailure(order)
      }
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '支付异常，请重试', icon: 'none' })
    } finally {
      setPaying(false)
    }
  }

  /* ---------- Render ---------- */

  return (
    <View className={styles.container}>
      <TopBarWithBack />

      {/* 地址区 */}
      {address ? (
        <View className={styles.address}>
          <View>
            <View className={styles.title}>收件地址</View>
            <View className={styles.addressContainer}>
              <View className={styles.addressFirstRow}>
                <Image
                  className={styles.locationIcon}
                  src='/assets/icons/location.png'
                  mode='aspectFit'
                />
                <Text className={styles.detailAddress}>{address.detailAddress}</Text>
              </View>
              <View className={styles.addressSecondRow}>
                <Text className={styles.provinceCity}>{address.provinceCity}</Text>
              </View>
              <View className={styles.namePhone}>
                <Text className={styles.receiverName}>{address.receiver}</Text>
                <Text className={styles.phone}>{address.phone}</Text>
              </View>
            </View>
          </View>
          <View
            className={`${styles.addressBtn} ${styles.selectAddress}`}
            onClick={handleSelectAddress}
          >
            <Text>选择地址</Text>
          </View>
        </View>
      ) : (
        <View className={styles.noAddress}>
          <View className={styles.addAddressBtn} onClick={handleAddAddress}>
            <Text>+ 添加新地址</Text>
          </View>
        </View>
      )}

      {/* 发货提示 */}
      <View className={styles.shippingNotice}>
        <Text>*商品将会在付款后20个工作日内发货*</Text>
      </View>

      {/* 商品信息 */}
      <View className={styles.title}>商品信息</View>

      <ScrollView className={styles.productList} scrollY>
        {items.length > 0 ? (
          items.map((item, idx) => (
            <View className={styles.product} key={item._cartItemId || item.skuId || idx}>
              <View className={styles.detail}>
                <View className={styles.display}>
                  <Image
                    className={styles.displayImage}
                    src={item.image}
                    mode='aspectFill'
                  />
                </View>
                <View className={styles.exceptDisplay}>
                  <View className={styles.exceptDisplayTop}>
                    <View className={styles.exceptDisplayLeft}>
                      <Text className={styles.productName}>{item.name}</Text>
                      {item.nameEN ? (
                        <Text className={styles.foreignName}>{item.nameEN}</Text>
                      ) : null}
                      {item.material ? (
                        <Text className={styles.material}>{item.material}</Text>
                      ) : null}
                      {item.size ? (
                        <Text className={styles.specInfo}>尺寸: {item.size}</Text>
                      ) : null}
                      <Text className={styles.quantity}>数量: {item.quantity}件</Text>
                    </View>
                    <View className={styles.exceptDisplayRight}>
                      <Text className={styles.unitPrice}>{item.formattedPrice}</Text>
                    </View>
                  </View>
                  <View className={styles.subtotalRow}>
                    <Text className={styles.subtotal}>小计: {item.formattedSubtotal}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        ) : mode === 'cart' ? (
          <View className={styles.emptyState}>
            <Text className={styles.emptyText}>购物车中没有选中的商品</Text>
            <Text className={styles.emptyTip}>请返回购物车选择要结算的商品</Text>
            <View className={styles.backToCartBtn} onClick={handleBackToCart}>
              <Text>返回购物车</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* 支付方式 */}
      <View className={styles.paymentSection}>
        <View className={styles.paymentList}>
          <View className={styles.iconText}>
            <Image
              className={styles.paymentIcon}
              src='/assets/icons/wechat_pay.png'
              mode='aspectFit'
            />
            <Text className={styles.paymentIconText}>微信支付</Text>
          </View>
          <View className={styles.checkBox}>
            <Image
              className={styles.checkBoxImage}
              src='/assets/icons/selected.png'
              mode='aspectFit'
            />
          </View>
        </View>
      </View>

      {/* 订单备注 */}
      <View>
        <View className={styles.title}>订单备注</View>
        <View className={styles.orderTextarea}>
          <Textarea
            className={styles.textarea}
            placeholder='选填，付款后对商家可见'
            placeholderStyle='color:#999'
            maxlength={500}
            onInput={handleRemarkInput}
            value={remark}
          />
          <View className={styles.wordCount}>
            <Text>{remark.length}/500</Text>
          </View>
        </View>
        <View className={styles.totalPrice}>
          <Text>订单总金额:{formattedTotalPrice}</Text>
        </View>
      </View>

      <View className={styles.bottomSpacer} />

      {/* 底部固定区：授权 + 支付按钮 */}
      <View className={styles.authBtn}>
        <View className={styles.auth} onClick={handleToggleAuth}>
          <View className={styles.authCheckBox}>
            <Image
              className={styles.authCheckBoxImage}
              src={authAgreed ? '/assets/icons/selected.png' : '/assets/icons/not_selected.png'}
              mode='aspectFit'
            />
          </View>
          <Text className={styles.otherText}>*请确认您已阅读并同意我们的</Text>
          <View className={styles.privacyPolicy} onClick={handlePrivacyLink}>
            <Text>隐私条例</Text>
          </View>
          <Text className={styles.otherText}>和</Text>
          <View className={styles.userAgreement} onClick={handleAgreementLink}>
            <Text>用户协议</Text>
          </View>
        </View>
        <View className={styles.payBtn}>
          <View className={styles.payButton} onClick={paying ? undefined : handlePay}>
            <Text>{paying ? '支付中...' : '立即支付'}</Text>
          </View>
        </View>
      </View>

      {/* 浮动咨询 */}
      <FloatPopup visible={showFloatPopup} onClose={() => setShowFloatPopup(false)} />
    </View>
  )
}
