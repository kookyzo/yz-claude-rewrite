import { View } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import styles from './index.module.scss'

export default function UreservationUnormal() {
  useLoad(() => {})
  return <View className={styles.container}>UreservationUnormal</View>
}
