import { View, Image } from '@tarojs/components'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import styles from './index.module.scss'

interface TopBarProps {
  /** Logo 图片路径，默认 '/assets/icons/top.png' */
  imageSrc?: string
  /** 背景色，默认 'transparent' */
  backgroundColor?: string
  /** 内容栏高度 (rpx)，默认 110 */
  barHeight?: number
}

export default function TopBar({
  imageSrc = '/assets/icons/top.png',
  backgroundColor = 'transparent',
  barHeight = 110,
}: TopBarProps) {
  const { statusBarHeight } = useSystemInfo()

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
