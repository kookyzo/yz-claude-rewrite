import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Popup } from '@nutui/nutui-react-taro'
import styles from './index.module.scss'

type ProductType = 'bracelet' | 'ring'

interface SizePopupProps {
  /** 控制弹窗显示 */
  visible: boolean
  /** 关闭回调 */
  onClose: () => void
}

const BRACELET_SIZES = [
  { wrist: '13–15.5cm', size: '16.5寸' },
  { wrist: '16–16.9cm', size: '18寸' },
]

const RING_SIZES = [
  { diameter: '16.1mm', size: '12寸' },
  { diameter: '16.5mm', size: '13寸' },
  { diameter: '16.85mm', size: '14寸' },
]

export default function SizePopup({ visible, onClose }: SizePopupProps) {
  const [productType, setProductType] = useState<ProductType>('bracelet')

  return (
    <Popup
      visible={visible}
      position='center'
      closeable={false}
      overlay
      closeOnOverlayClick
      onClose={onClose}
      style={{ borderRadius: 0 }}
    >
      <View className={styles.container}>
        <Image
          className={styles.logo}
          src='/assets/icons/top.png'
          mode='heightFix'
        />
        <Text className={styles.title}>尺码选择指南</Text>

        <View className={styles.tabs}>
          <View
            className={`${styles.tab} ${productType === 'bracelet' ? styles.tabActive : ''}`}
            onClick={() => setProductType('bracelet')}
          >
            <View className={styles.radio}>
              {productType === 'bracelet' && <View className={styles.radioInner} />}
            </View>
            <Text>手镯</Text>
          </View>
          <View
            className={`${styles.tab} ${productType === 'ring' ? styles.tabActive : ''}`}
            onClick={() => setProductType('ring')}
          >
            <View className={styles.radio}>
              {productType === 'ring' && <View className={styles.radioInner} />}
            </View>
            <Text>戒指</Text>
          </View>
        </View>

        {productType === 'bracelet' ? (
          <View className={styles.table}>
            <View className={styles.tableHeader}>
              <Text className={styles.tableCell}>手腕周长</Text>
              <Text className={styles.tableCell}>建议尺寸</Text>
            </View>
            {BRACELET_SIZES.map((item) => (
              <View className={styles.tableRow} key={item.wrist}>
                <Text className={styles.tableCell}>{item.wrist}</Text>
                <Text className={styles.tableCell}>{item.size}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View className={styles.table}>
            <View className={styles.tableHeader}>
              <Text className={styles.tableCell}>手指直径</Text>
              <Text className={styles.tableCell}>建议尺寸</Text>
            </View>
            {RING_SIZES.map((item) => (
              <View className={styles.tableRow} key={item.diameter}>
                <Text className={styles.tableCell}>{item.diameter}</Text>
                <Text className={styles.tableCell}>{item.size}</Text>
              </View>
            ))}
          </View>
        )}

        <View className={styles.btnWrap}>
          <View className={styles.confirmBtn} onClick={onClose}>
            <Text className={styles.confirmText}>我了解了</Text>
          </View>
        </View>
      </View>
    </Popup>
  )
}
