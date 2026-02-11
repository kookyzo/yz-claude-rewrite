import { View, Image } from '@tarojs/components'
import styles from './index.module.scss'

interface FloatBtnProps {
  /** 点击回调（通常用于打开 FloatPopup） */
  onPress: () => void
}

export default function FloatBtn({ onPress }: FloatBtnProps) {
  return (
    <View className={styles.wrapper} onClick={onPress}>
      <Image
        className={styles.icon}
        src='/assets/icons/phone.png'
        mode='aspectFit'
      />
    </View>
  )
}
