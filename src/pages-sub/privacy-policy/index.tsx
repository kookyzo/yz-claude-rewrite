import { View } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import styles from './index.module.scss'

export default function UprivacyUpolicy() {
  useLoad(() => {})
  return <View className={styles.container}>UprivacyUpolicy</View>
}
