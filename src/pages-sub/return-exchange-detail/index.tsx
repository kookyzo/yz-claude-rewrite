import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import TopBarWithBack from '@/components/TopBarWithBack'
import FloatBtn from '@/components/FloatBtn'
import FloatPopup from '@/components/FloatPopup'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import styles from './index.module.scss'

export default function ReturnExchangeDetail() {
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const topOffset = statusBarHeight + navBarHeight

  const [isPopupShow, setIsPopupShow] = useState(false)

  return (
    <View className={styles.page}>
      <TopBarWithBack />

      <ScrollView className={styles.contentScroll} scrollY style={{ marginTop: `${topOffset}px` }}>
        <View className={styles.contentContainer}>
          <View className={styles.sectionTitle}>
            <Text className={styles.sectionTitleText}>订单追踪查询</Text>
          </View>

          <View className={styles.contentSection}>
            <View className={styles.paragraph}>
              您可通过Y.ZHENG悦涧小程序上"我的"页面来追踪查询订单。
            </View>
          </View>

          <View className={styles.sectionTitle}>
            <Text className={styles.sectionTitleText}>退换货服务</Text>
          </View>

          <View className={styles.contentSection}>
            <View className={styles.paragraph}>
              作为居住在中华人民共和国的客户，通过小程序订购的作品，您有权在签收之日起三十(30)天内申请退换货。
            </View>

            <View className={styles.paragraph}>
              为了享受退换货权利，您需要致电Y.ZHENG悦涧官方客服 19988266351，或联系Y.ZHENG悦涧官方微信小程序客服，他们将协助您完成退换货流程。
            </View>

            <View className={styles.paragraph}>
              Y.ZHENG悦涧在收到退换货时，将检验退换货作品是否符合销售条款。
            </View>

            <View className={styles.paragraph}>
              如您选择退货，在通过我们的质量管理检测后，我们将在签收退货之日起七(7)天内以购物时支付的价格退款至最初订购人(而非礼品接收人)，我们仅退款至最初订购人本人，并以其购物时使用的支付方式退款。
            </View>

            <View className={styles.paragraph}>
              在通过我们的质量管理检测后如两件作品之间存在差价， Y.ZHENG悦涧会向您退回差额，或要求您支付差额，在这种情况下我们会将退回的作品的销售订单取消并为拟交换的作品创建新的订单。
            </View>
          </View>
        </View>

        <View className={styles.bottomView} />
      </ScrollView>

      <FloatBtn onPress={() => setIsPopupShow(true)} />
      <FloatPopup visible={isPopupShow} onClose={() => setIsPopupShow(false)} />
    </View>
  )
}
