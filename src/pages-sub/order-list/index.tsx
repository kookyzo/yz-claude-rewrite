import { useState, useCallback, useRef } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useLoad, useDidShow } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import SlidingBar from '@/components/SlidingBar'
import LoadingBar from '@/components/LoadingBar'
import ReviewPopup from '@/components/ReviewPopup'
import FloatPopup from '@/components/FloatPopup'
import { useAuth } from '@/hooks/useAuth'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import { useImageProcessor } from '@/hooks/useImageProcessor'
import * as orderService from '@/services/order.service'
import * as userService from '@/services/user.service'
import { formatDate, formatPrice } from '@/utils/format'
import type { Order, OrderStatus } from '@/types/order'
import styles from './index.module.scss'

type TabId = '1' | '2' | '3' | '4' | '5'

const TAB_LIST = [
  { id: '1', text: '全部' },
  { id: '2', text: '待付款' },
  { id: '3', text: '待发货' },
  { id: '4', text: '待收货' },
  { id: '5', text: '待评价' },
]

const TAB_STATUS_MAP: Record<TabId, OrderStatus | null> = {
  '1': null,
  '2': 'pending_payment',
  '3': 'paid',
  '4': 'shipping',
  '5': 'signed',
}

const STATUS_DISPLAY: Record<string, string> = {
  pending_payment: 'PENDING_PAYMENT',
  paid: 'PAID',
  shipping: 'SHIPPED',
  signed: 'SIGNED',
}

interface FormattedOrder {
  id: string
  orderId: string
  date: string
  status: OrderStatus
  statusText: string
  image: string
  name: string
  nameEN: string
  material: string
  formattedUnitPrice: string
  quantity: number
  formattedTotalPrice: string
}

function formatOrders(list: Order[]): FormattedOrder[] {
  return list.map((order) => ({
    id: order.orderNo || order._id,
    orderId: order._id,
    date: formatDate(order.createdAt),
    status: order.status,
    statusText: STATUS_DISPLAY[order.status] || order.status,
    image: order.items[0]?.skuImage?.[0] || '',
    name: order.items[0]?.skuNameCN || '',
    nameEN: order.items[0]?.skuNameEN || '',
    material: order.items[0]?.materialName || '',
    formattedUnitPrice: formatPrice(order.items[0]?.unitPrice || 0),
    quantity: order.items[0]?.quantity || 1,
    formattedTotalPrice: formatPrice(order.totalAmount),
  }))
}

export default function OrderList() {
  const { ensureLogin } = useAuth()
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const { processImages } = useImageProcessor()
  const topOffset = statusBarHeight + navBarHeight

  const [selectedTab, setSelectedTab] = useState<TabId>('1')
  const [orders, setOrders] = useState<Record<TabId, FormattedOrder[]>>({
    '1': [], '2': [], '3': [], '4': [], '5': [],
  })
  const [loading, setLoading] = useState(false)
  const [showReviewPopup, setShowReviewPopup] = useState(false)
  const [reviewProduct, setReviewProduct] = useState({ image: '', name: '', nameEN: '' })
  const [reviewOrderId, setReviewOrderId] = useState('')
  const [isPopupShow, setIsPopupShow] = useState(false)

  const selectedTabRef = useRef<TabId>('1')
  const userIdRef = useRef('')

  const getUserId = useCallback(async (): Promise<string> => {
    if (userIdRef.current) return userIdRef.current
    const userRes = await userService.getUserInfo()
    if (userRes.code === 200 && userRes.data) {
      userIdRef.current = userRes.data._id
      return userRes.data._id
    }
    return ''
  }, [])

  const processOrderImages = useCallback(async (formatted: FormattedOrder[]): Promise<FormattedOrder[]> => {
    const cloudUrls = formatted.map((o) => o.image).filter(Boolean)
    if (cloudUrls.length === 0) return formatted

    try {
      const httpUrls = await processImages(cloudUrls, { width: 200, height: 200, quality: 60 })
      const urlMap = new Map<string, string>()
      cloudUrls.forEach((cloud, i) => {
        if (httpUrls[i]) urlMap.set(cloud, httpUrls[i])
      })
      return formatted.map((o) => ({
        ...o,
        image: urlMap.get(o.image) || o.image,
      }))
    } catch {
      return formatted
    }
  }, [processImages])

  const loadOrders = useCallback(async (tabId: TabId) => {
    setLoading(true)
    try {
      const userId = await getUserId()
      if (!userId) return

      const status = TAB_STATUS_MAP[tabId]
      let orderList: Order[] = []

      if (status === null) {
        const [r1, r2, r3, r4] = await Promise.all([
          orderService.getUserOrders(userId, 'pending_payment'),
          orderService.getUserOrders(userId, 'paid'),
          orderService.getUserOrders(userId, 'shipping'),
          orderService.getUserOrders(userId, 'signed'),
        ])
        orderList = [
          ...(r1.code === 200 && r1.data ? r1.data : []),
          ...(r2.code === 200 && r2.data ? r2.data : []),
          ...(r3.code === 200 && r3.data ? r3.data : []),
          ...(r4.code === 200 && r4.data ? r4.data : []),
        ]
      } else {
        const res = await orderService.getUserOrders(userId, status)
        if (res.code === 200 && res.data) {
          orderList = Array.isArray(res.data) ? res.data : []
        }
      }

      orderList.sort((a, b) => b.createdAt - a.createdAt)

      let formatted = formatOrders(orderList)
      formatted = await processOrderImages(formatted)
      setOrders((prev) => ({ ...prev, [tabId]: formatted }))
    } finally {
      setLoading(false)
    }
  }, [getUserId, processOrderImages])

  useLoad((params) => {
    const mapTypeToTab: Record<string, TabId> = {
      pending_payment: '2',
      pending_delivery: '3',
      pending_receipt: '4',
      completed: '5',
      all: '1',
    }
    const tabFromType = params?.type ? (mapTypeToTab[params.type] || '1') : null
    const initialTab = (params?.tab as TabId) || tabFromType || '1'
    setSelectedTab(initialTab)
    selectedTabRef.current = initialTab

    ensureLogin().then(() => loadOrders(initialTab))
  })

  useDidShow(() => {
    loadOrders(selectedTabRef.current)
  })

  const handleTabSelect = useCallback((item: { id: string }) => {
    const tabId = item.id as TabId
    setSelectedTab(tabId)
    selectedTabRef.current = tabId
    if (orders[tabId].length === 0) {
      loadOrders(tabId)
    }
  }, [orders, loadOrders])

  const handleCopyId = useCallback((orderId: string) => {
    Taro.setClipboardData({ data: orderId })
  }, [])

  const handleCancelOrder = useCallback(async (orderId: string) => {
    const { confirm } = await Taro.showModal({
      title: '确认取消',
      content: '确定要取消该订单吗？',
    })
    if (!confirm) return

    const userId = await getUserId()
    if (!userId) return

    try {
      const res = await orderService.cancelOrder(orderId, userId)
      if (res.code === 200) {
        Taro.showToast({ title: '订单已取消', icon: 'success' })
        loadOrders(selectedTabRef.current)
      } else {
        Taro.showToast({ title: '取消失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '网络异常', icon: 'none' })
    }
  }, [getUserId, loadOrders])

  const handlePayNow = useCallback((orderId: string) => {
    Taro.navigateTo({ url: `/pages-sub/payment/index?orderId=${orderId}` })
  }, [])

  const handleAfterSales = useCallback((orderId: string) => {
    Taro.navigateTo({ url: `/pages-sub/refund/index?orderId=${orderId}` })
  }, [])

  const handleLogistics = useCallback(() => {
    setIsPopupShow(true)
  }, [])

  const handleConfirmReceipt = useCallback(async (orderId: string) => {
    const { confirm } = await Taro.showModal({
      title: '确认收货',
      content: '确认已收到商品？',
    })
    if (!confirm) return

    const userId = await getUserId()
    if (!userId) return

    try {
      const res = await orderService.confirmReceipt(orderId, userId)
      if (res.code === 200) {
        Taro.showToast({ title: '确认收货成功', icon: 'success' })
        loadOrders(selectedTabRef.current)
      } else {
        Taro.showToast({ title: '操作失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '网络异常', icon: 'none' })
    }
  }, [getUserId, loadOrders])

  const handleReview = useCallback((order: FormattedOrder) => {
    setReviewProduct({ image: order.image, name: order.name, nameEN: order.nameEN })
    setReviewOrderId(order.orderId)
    setShowReviewPopup(true)
  }, [])

  const handleReviewSubmit = useCallback(() => {
    Taro.showToast({ title: '评价提交成功', icon: 'success' })
    setShowReviewPopup(false)
    loadOrders(selectedTabRef.current)
  }, [loadOrders])

  const handleGoShop = useCallback(() => {
    Taro.switchTab({ url: '/pages/category/index' })
  }, [])

  const renderButtons = (order: FormattedOrder) => {
    switch (order.status) {
      case 'pending_payment':
        return (
          <>
            <Text className={styles.btn} onClick={() => handleCancelOrder(order.orderId)}>取消订单</Text>
            <Text className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => handlePayNow(order.orderId)}>立即支付</Text>
          </>
        )
      case 'paid':
        return (
          <>
            <Text className={styles.btn} onClick={() => handleAfterSales(order.orderId)}>申请售后</Text>
            <Text className={styles.btn} onClick={handleLogistics}>物流咨询</Text>
          </>
        )
      case 'shipping':
        return (
          <>
            <Text className={styles.btn} onClick={handleLogistics}>查看物流</Text>
            <Text className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => handleConfirmReceipt(order.orderId)}>确认收货</Text>
          </>
        )
      case 'signed':
        return (
          <>
            <Text className={styles.btn} onClick={() => handleAfterSales(order.orderId)}>申请售后</Text>
            <Text className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => handleReview(order)}>立即评价</Text>
          </>
        )
      default:
        return null
    }
  }

  const currentOrders = orders[selectedTab]

  return (
    <View className={styles.page}>
      <TopBarWithBack />

      <View className={styles.container} style={{ marginTop: `${topOffset}px` }}>
        <SlidingBar items={TAB_LIST} activeId={selectedTab} onSelect={handleTabSelect} />

        <LoadingBar visible={loading} />

        {!loading && currentOrders.length > 0 && (
          <ScrollView className={styles.orderList} scrollY>
            {currentOrders.map((order) => (
              <View className={styles.orderCard} key={order.orderId}>
                <View className={styles.cardHeader}>
                  <View className={styles.dateId}>
                    <Text className={styles.date}>{order.date}</Text>
                    <View className={styles.idRow}>
                      <Text className={styles.orderId}>订单编号:{order.id}</Text>
                      <Text className={styles.copy} onClick={() => handleCopyId(order.id)}>复制</Text>
                    </View>
                  </View>
                  <Text className={styles.statusText}>{order.statusText}</Text>
                </View>

                <View className={styles.cardBody}>
                  <Image className={styles.productImg} src={order.image} mode='aspectFill' lazyLoad />
                  <View className={styles.productInfo}>
                    <View className={styles.infoTop}>
                      <View className={styles.infoLeft}>
                        <Text className={styles.productName}>{order.name}</Text>
                        <Text className={styles.productNameEN}>{order.nameEN}</Text>
                        {order.material ? <Text className={styles.material}>{order.material}</Text> : null}
                      </View>
                      <View className={styles.infoRight}>
                        <Text className={styles.unitPrice}>{order.formattedUnitPrice}</Text>
                        <Text className={styles.quantity}>x{order.quantity}</Text>
                      </View>
                    </View>
                    <View className={styles.infoBottom}>
                      <Text className={styles.total}>合计：{order.formattedTotalPrice}</Text>
                    </View>
                  </View>
                </View>

                <View className={styles.cardFooter}>
                  {renderButtons(order)}
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        {!loading && currentOrders.length === 0 && (
          <View className={styles.empty}>
            <Image className={styles.emptyIcon} src='/assets/icons/empty_order.png' mode='aspectFit' />
            <Text className={styles.emptyText}>暂无订单</Text>
            <View className={styles.goShopBtn} onClick={handleGoShop}>
              <Text className={styles.goShopText}>去挑选商品</Text>
            </View>
          </View>
        )}
      </View>

      <ReviewPopup
        visible={showReviewPopup}
        productImage={reviewProduct.image}
        productName={reviewProduct.name}
        productNameEN={reviewProduct.nameEN}
        onSubmit={handleReviewSubmit}
        onClose={() => setShowReviewPopup(false)}
      />

      <FloatPopup visible={isPopupShow} onClose={() => setIsPopupShow(false)} />
    </View>
  )
}
