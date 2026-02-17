import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import TopBarWithBack from '@/components/TopBarWithBack'
import FloatPopup from '@/components/FloatPopup'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import styles from './index.module.scss'

interface ServiceSection {
  key: string
  title: string
  content: string
  expanded: boolean
}

const INITIAL_SECTIONS: ServiceSection[] = [
  {
    key: 'daily_wear',
    title: '日常佩戴',
    content: '穿脱衣物并佩戴珠宝时，珠宝始终应该最后佩戴，最先摘下。',
    expanded: false,
  },
  {
    key: 'storage',
    title: '存放建议',
    content: '当您不佩戴珠宝时，请简单清洁作品并保存在原包装内，或放置在品牌提供的珠宝软袋里。请分开存放每一件珠宝，避免磨损。',
    expanded: false,
  },
  {
    key: 'maintenance',
    title: '定期保养',
    content: '我们建议您每年进行一次珠宝检查。您可联系官方客服寄送作品至品牌工坊，由工作人员为您检查是否存在磨损导致的镶嵌损坏。',
    expanded: false,
  },
  {
    key: 'jewelry_care',
    title: '珠宝护理',
    content: '您在家中可使用珠宝擦拭布沾取温水轻轻擦洗作品，如需专业清洁护理服务，您可联系官方客服寄送作品至品牌工坊，由工作人员为您提供专业的珠宝清洁护理。',
    expanded: false,
  },
]

export default function AfterSalesDetail() {
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const topOffset = statusBarHeight + navBarHeight

  const [sections, setSections] = useState<ServiceSection[]>(INITIAL_SECTIONS)
  const [isPopupShow, setIsPopupShow] = useState(false)

  const toggleSection = (key: string) => {
    setSections((prev) =>
      prev.map((s) => (s.key === key ? { ...s, expanded: !s.expanded } : s)),
    )
  }

  return (
    <View className={styles.page}>
      <TopBarWithBack />

      <View className={styles.container} style={{ marginTop: `${topOffset}px` }}>
        <View className={styles.mainTitle}>
          <Text className={styles.mainTitleText}>保养情节</Text>
        </View>

        <View className={styles.serviceItems}>
          {sections.map((section) => (
            <View className={styles.serviceItem} key={section.key}>
              <View className={styles.serviceHeader} onClick={() => toggleSection(section.key)}>
                <Text className={styles.serviceTitle}>{section.title}</Text>
                <View
                  className={`${styles.serviceArrow} ${section.expanded ? styles.serviceArrowExpanded : ''}`}
                />
              </View>
              <View
                className={`${styles.serviceContent} ${section.expanded ? styles.serviceContentExpanded : ''}`}
              >
                <Text className={styles.contentText}>{section.content}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className={styles.footerText}>
          <View className={styles.footerLine}>感谢您选购Y.ZHENG悦涧珠宝作品</View>
          <View className={styles.footerLine}>
            如需协助，请联系
            <Text className={styles.serviceLinkText} onClick={() => setIsPopupShow(true)}>
              官方客服
            </Text>
          </View>
        </View>
      </View>

      <FloatPopup visible={isPopupShow} onClose={() => setIsPopupShow(false)} />
    </View>
  )
}
