import { View, Image, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAppStore } from '@/stores/useAppStore'
import styles from './index.module.scss'

interface TabItem {
  pagePath: string
  text: string
  iconPath: string
  selectedIconPath: string
}

const TAB_LIST: TabItem[] = [
  { pagePath: '/pages/home/index', text: '首页', iconPath: '/assets/icons/home.png', selectedIconPath: '/assets/icons/home-active.png' },
  { pagePath: '/pages/category/index', text: '分类', iconPath: '/assets/icons/category.png', selectedIconPath: '/assets/icons/category-active.png' },
  { pagePath: '/pages/cart/index', text: '购物车', iconPath: '/assets/icons/cart.png', selectedIconPath: '/assets/icons/cart-active.png' },
  { pagePath: '/pages/my/index', text: '我的', iconPath: '/assets/icons/my.png', selectedIconPath: '/assets/icons/my-active.png' },
]

export default function CustomTabBar() {
  const currentTab = useAppStore((s) => s.currentTab)
  const setCurrentTab = useAppStore((s) => s.setCurrentTab)

  const handleTabClick = (index: number, pagePath: string) => {
    setCurrentTab(index)
    Taro.switchTab({ url: pagePath })
  }

  return (
    <View className={styles.wrapper}>
      <View className={styles.inner}>
        {TAB_LIST.map((item, index) => {
          const isActive = currentTab === index
          return (
            <View
              key={item.pagePath}
              className={styles.tabItem}
              onClick={() => handleTabClick(index, item.pagePath)}
            >
              <Image
                className={styles.icon}
                src={isActive ? item.selectedIconPath : item.iconPath}
                mode='aspectFit'
              />
              <Text className={`${styles.text} ${isActive ? styles.textActive : ''}`}>
                {item.text}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
