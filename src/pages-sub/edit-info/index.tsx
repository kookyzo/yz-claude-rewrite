import { View } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import styles from './index.module.scss'

export default function UeditUinfo() {
  useLoad(() => {})
  return <View className={styles.container}>UeditUinfo</View>
}
