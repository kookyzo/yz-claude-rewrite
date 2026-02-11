import { View, Image, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { formatPrice } from '@/utils/format'
import styles from './index.module.scss'

interface ProductCardProps {
  /** 商品 SKU ID */
  skuId: string
  /** 商品大图 URL */
  image: string
  /** 商品中文名 */
  name: string
  /** 商品英文名 */
  nameEN?: string
  /** 商品编号（显示用） */
  productId?: string
  /** 价格（数字，组件内部 formatPrice） */
  price: number
  /** 点击加购回调 */
  onAddToCart?: (skuId: string) => void
  /** 点击卡片跳转回调（默认跳转商品详情页） */
  onPress?: (skuId: string) => void
}

export default function ProductCard({
  skuId,
  image,
  name,
  nameEN,
  productId,
  price,
  onAddToCart,
  onPress,
}: ProductCardProps) {
  const handlePress = () => {
    if (onPress) {
      onPress(skuId)
    } else {
      Taro.navigateTo({ url: `/pages/product-detail/index?skuId=${skuId}` })
    }
  }

  const handleAddToCart = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onAddToCart?.(skuId)
  }

  return (
    <View className={styles.card}>
      <View className={styles.imageArea} onClick={handlePress}>
        <Image className={styles.image} src={image} mode='aspectFill' />
      </View>
      <View className={styles.info}>
        <View className={styles.infoLeft}>
          {productId && <Text className={styles.productId}>{productId}</Text>}
          <Text className={styles.name}>{name}</Text>
          {nameEN && <Text className={styles.nameEN}>{nameEN}</Text>}
        </View>
        <View className={styles.infoRight}>
          <View className={styles.addBtn} onClick={handleAddToCart}>
            <Text className={styles.addIcon}>+</Text>
          </View>
          <Text className={styles.price}>¥{formatPrice(price)}</Text>
        </View>
      </View>
    </View>
  )
}
