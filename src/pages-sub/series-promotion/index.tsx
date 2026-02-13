import { View, Image } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import styles from './index.module.scss'

export default function SeriesPromotion() {
  const router = useRouter()
  const image = router.params.image
    ? decodeURIComponent(router.params.image)
    : ''

  return (
    <View className={styles.container}>
      <TopBarWithBack />
      {image && (
        <Image className={styles.image} src={image} mode='widthFix' />
      )}
    </View>
  )
}
