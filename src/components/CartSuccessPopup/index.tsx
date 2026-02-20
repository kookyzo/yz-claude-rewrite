import { View, Text } from '@tarojs/components'
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
  if (!visible) return null

  return (
    <View className={styles.overlay} onClick={onClose}>
      <View
        className={styles.panel}
        onClick={(e) => {
          e.stopPropagation()
        }}
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
      </View>
    </View>
  )
}
