import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import FloatPopup from '@/components/FloatPopup'
import styles from './index.module.scss'

export default function PaymentFailed() {
  const [showFloatPopup, setShowFloatPopup] = useState(false)

  const handleRePay = () => {
    Taro.redirectTo({ url: '/pages-sub/payment/index' })
  }

  const handleViewOrder = () => {
    Taro.redirectTo({ url: '/pages-sub/order-list/index?type=pending_payment' })
  }

  return (
    <View className={styles.container}>
      <TopBarWithBack />

      <View className={styles.iconContainer}>
        <Image
          className={styles.icon}
          src='/assets/icons/payment_failed.png'
          mode='aspectFit'
        />
        <Text className={styles.paymentFailed}>支付失败</Text>
      </View>

      <View className={styles.explainContainer}>
        <Text>请前往个人中心-我的订单完成付款如您需要任何信息或帮助，请联系</Text>
        <Text className={styles.explain} onClick={() => setShowFloatPopup(true)}>在线客服</Text>
      </View>

      <View className={styles.btn}>
        <View className={`${styles.bottomBtn} ${styles.rePay}`} onClick={handleRePay}>
          <Text>重新支付</Text>
        </View>
        <View className={`${styles.bottomBtn} ${styles.viewOrder}`} onClick={handleViewOrder}>
          <Text>查看订单</Text>
        </View>
      </View>

      <FloatPopup visible={showFloatPopup} onClose={() => setShowFloatPopup(false)} />
    </View>
  )
}
