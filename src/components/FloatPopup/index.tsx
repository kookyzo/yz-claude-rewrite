import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Popup } from '@nutui/nutui-react-taro'
import { CONSULTATION_PHONE } from '@/constants'
import styles from './index.module.scss'

interface FloatPopupProps {
  /** 控制弹窗显示 */
  visible: boolean
  /** 关闭回调 */
  onClose: () => void
}

export default function FloatPopup({ visible, onClose }: FloatPopupProps) {
  const handleCall = () => {
    Taro.makePhoneCall({ phoneNumber: CONSULTATION_PHONE })
  }

  return (
    <Popup
      visible={visible}
      position='bottom'
      overlay
      closeOnOverlayClick
      onClose={onClose}
      overlayStyle={{ background: 'rgba(0,0,0,0.808)' }}
    >
      <View className={styles.container}>
        <Button className={styles.btn} openType='contact'>
          <Text className={styles.btnText}>在线客服</Text>
        </Button>
        <View className={styles.divider} />
        <View className={styles.btn} onClick={handleCall}>
          <Text className={styles.btnText}>客服电话：{CONSULTATION_PHONE}</Text>
        </View>
        <View className={styles.divider} />
        <View className={styles.btn} onClick={onClose}>
          <Text className={styles.cancelText}>取消</Text>
        </View>
      </View>
    </Popup>
  )
}
