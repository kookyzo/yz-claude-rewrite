import { View, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import styles from './index.module.scss'

interface TopBarWithBackProps {
  /** Logo 图片路径，默认 '/assets/icons/top.png' */
  imageSrc?: string
  /** 背景色，默认 'white' */
  backgroundColor?: string
  /** 内容栏高度 (rpx)，默认 110 */
  barHeight?: number
}

export default function TopBarWithBack({
  imageSrc = '/assets/icons/top.png',
  backgroundColor = 'white',
  barHeight = 110,
}: TopBarWithBackProps) {
  const { statusBarHeight } = useSystemInfo()

  const handleBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      Taro.navigateBack()
    } else {
      Taro.switchTab({ url: '/pages/home/index' })
    }
  }

  return (
    <View
      className={styles.wrapper}
      style={{
        paddingTop: `${statusBarHeight}px`,
        backgroundColor,
      }}
    >
      <View
        className={styles.content}
        style={{ height: `${barHeight}rpx` }}
      >
        <View className={styles.backBtn} onClick={handleBack}>
          <Image
            className={styles.backIcon}
            src='/assets/icons/back.png'
            mode='aspectFit'
          />
        </View>
        <Image
          className={styles.logo}
          src={imageSrc}
          mode='heightFix'
          style={{ height: `calc(${barHeight}rpx - 35rpx)` }}
        />
      </View>
    </View>
  )
}
