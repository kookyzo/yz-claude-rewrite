import { View, Text } from '@tarojs/components'
import { Popup } from '@nutui/nutui-react-taro'
import styles from './index.module.scss'

interface CartSuccessPopupProps {
  /** 控制弹窗显示 */
  visible: boolean
  /** 继续选购回调 */
  onContinue: () => void
  /** 前往购物车回调 */
  onGoToCart: () => void
  /** 关闭回调（点击遮罩） */
  onClose: () => void
}

export default function CartSuccessPopup({
  visible,
  onContinue,
  onGoToCart,
  onClose,
}: CartSuccessPopupProps) {
  return (
    <Popup
      visible={visible}
      position='center'
      closeable={false}
      overlay
      closeOnOverlayClick
      onClose={onClose}
      style={{ borderRadius: '20rpx', width: '600rpx' }}
    >
      <View className={styles.container}>
        <Text className={styles.title}>已加入购物车</Text>
        <View className={styles.btnGroup}>
          <View className={styles.continueBtn} onClick={onContinue}>
            <Text className={styles.continueBtnText}>继续选购</Text>
          </View>
          <View className={styles.cartBtn} onClick={onGoToCart}>
            <Text className={styles.cartBtnText}>前往购物车</Text>
          </View>
        </View>
      </View>
    </Popup>
  )
}
