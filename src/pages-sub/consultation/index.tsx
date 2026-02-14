import { useState } from 'react'
import { View, Text, Navigator } from '@tarojs/components'
import TopBarWithBack from '@/components/TopBarWithBack'
import FloatBtn from '@/components/FloatBtn'
import FloatPopup from '@/components/FloatPopup'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import styles from './index.module.scss'

export default function Consultation() {
  const [showPopup, setShowPopup] = useState(false)
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const topOffset = statusBarHeight + navBarHeight

  return (
    <View className={styles.page}>
      <TopBarWithBack />

      <View className={styles.container} style={{ marginTop: `${topOffset}px` }}>
        <Text className={styles.brandTitle}>Y.ZHENG Fine Jewelry</Text>
        <View className={styles.contactInfo}>
          <Text className={styles.infoText}>联系电话：19988266351</Text>
          <Text className={styles.infoText}>服务时间：周一至周日 9:00-21:00</Text>
          <Text className={styles.infoText}>客服邮箱：Yzhengjewelry@163.com</Text>
        </View>
        <Navigator url='/pages/home/index' openType='switchTab' className={styles.homeLink}>
          导航到home界面
        </Navigator>
      </View>

      <FloatBtn onPress={() => setShowPopup(true)} />
      <FloatPopup visible={showPopup} onClose={() => setShowPopup(false)} />
    </View>
  )
}
