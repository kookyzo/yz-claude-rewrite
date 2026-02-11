import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import styles from './index.module.scss'

export default function CustomTabBar() {
  const tabList = [
    { pagePath: '/pages/home/index', text: '首页' },
    { pagePath: '/pages/category/index', text: '分类' },
    { pagePath: '/pages/cart/index', text: '购物车' },
    { pagePath: '/pages/my/index', text: '我的' },
  ]

  const switchTab = (url: string) => {
    Taro.switchTab({ url })
  }

  return (
    <View className={styles.tabBar}>
      {tabList.map((item) => (
        <View
          key={item.pagePath}
          className={styles.tabItem}
          onClick={() => switchTab(item.pagePath)}
        >
          <Text>{item.text}</Text>
        </View>
      ))}
    </View>
  )
}
