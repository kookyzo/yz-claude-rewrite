import { View, Text } from '@tarojs/components'
import { ScrollView } from '@tarojs/components'
import styles from './index.module.scss'

interface SlidingBarItem {
  /** 选项唯一标识 */
  id: string
  /** 显示文字 */
  text: string
}

interface SlidingBarProps {
  /** 选项列表 */
  items: SlidingBarItem[]
  /** 当前选中项 ID */
  activeId?: string
  /** 选中回调 */
  onSelect: (item: SlidingBarItem) => void
  /** 水平滚动，默认 true */
  scrollX?: boolean
  /** 垂直滚动，默认 false */
  scrollY?: boolean
}

export default function SlidingBar({
  items,
  activeId,
  onSelect,
  scrollX = true,
  scrollY = false,
}: SlidingBarProps) {
  return (
    <ScrollView
      className={styles.wrapper}
      scrollX={scrollX}
      scrollY={scrollY}
      enhanced
      showScrollbar={false}
    >
      <View className={styles.inner}>
        {items.map((item) => (
          <Text
            key={item.id}
            className={`${styles.item} ${item.id === activeId ? styles.itemActive : ''}`}
            onClick={() => onSelect(item)}
          >
            {item.text}
          </Text>
        ))}
      </View>
    </ScrollView>
  )
}
