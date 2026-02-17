import { useState, useCallback } from 'react'
import { View, Text, Image, Textarea, Picker, ScrollView } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import SlidingBar from '@/components/SlidingBar'
import FloatPopup from '@/components/FloatPopup'
import { useAuth } from '@/hooks/useAuth'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import { useImageProcessor } from '@/hooks/useImageProcessor'
import * as orderService from '@/services/order.service'
import * as userService from '@/services/user.service'
import { callCloudFunction } from '@/services/cloud'
import type { OrderItem } from '@/types/order'
import styles from './index.module.scss'

const CARE_TABS = [
  { id: '1', text: '日常佩戴' },
  { id: '2', text: '存放建议' },
  { id: '3', text: '定期保养' },
  { id: '4', text: '珠宝护理' },
]

const CARE_CONTENT: Record<string, { title: string; text: string }> = {
  '1': {
    title: '日常佩戴',
    text: '穿脱衣物并佩戴珠宝时，珠宝始终应该最后佩戴，最先摘下。',
  },
  '2': {
    title: '存放建议',
    text: '当您不佩戴珠宝时，请简单清洁作品并保存在原包装内，或放置在品牌提供的珠宝软袋里。请分开存放每一件珠宝，避免磨损。',
  },
  '3': {
    title: '定期保养',
    text: '我们建议您每年进行一次珠宝检查。您可联系官方客服寄送作品至品牌工坊，由工作人员为您检查是否存在磨损导致的镶嵌损坏。',
  },
  '4': {
    title: '珠宝护理',
    text: '您在家中可使用珠宝擦拭布沾取温水轻轻擦洗作品，如需专业清洁护理服务，您可联系官方客服寄送作品至品牌工坊，由工作人员为您提供专业的珠宝清洁护理。',
  },
}

const REASON_LIST = ['质量问题', '少件/错发', '外观破损', '不想要/七天无理由', '其它']

interface DisplayItem extends OrderItem {
  displayImage: string
}

export default function AfterSales() {
  const { ensureLogin } = useAuth()
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const { processImages } = useImageProcessor()
  const topOffset = statusBarHeight + navBarHeight

  const [selectedTab, setSelectedTab] = useState('1')
  const [orderId, setOrderId] = useState('')
  const [orderItems, setOrderItems] = useState<DisplayItem[]>([])
  const [chosenOrderItemId, setChosenOrderItemId] = useState('')
  const [reasonIndex, setReasonIndex] = useState(-1)
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isPopupShow, setIsPopupShow] = useState(false)

  const loadOrderItems = useCallback(async (oid: string) => {
    try {
      const userRes = await userService.getUserInfo()
      if (userRes.code !== 200 || !userRes.data) return

      const res = await orderService.getOrderDetail(oid, userRes.data._id)
      if (res.code === 200 && res.data) {
        const items = res.data.items || []
        // Convert cloud images
        const cloudUrls = items.map((it) => it.skuImage?.[0] || '').filter(Boolean)
        let httpUrls: string[] = []
        if (cloudUrls.length > 0) {
          try {
            httpUrls = await processImages(cloudUrls, { width: 150, height: 150, quality: 60 })
          } catch {
            // fallback to original URLs
          }
        }

        const urlMap = new Map<string, string>()
        cloudUrls.forEach((cloud, i) => {
          if (httpUrls[i]) urlMap.set(cloud, httpUrls[i])
        })

        const displayItems: DisplayItem[] = items.map((it) => ({
          ...it,
          displayImage: urlMap.get(it.skuImage?.[0] || '') || it.skuImage?.[0] || '',
        }))

        setOrderItems(displayItems)
        if (displayItems.length > 0) {
          setChosenOrderItemId(displayItems[0].skuId)
        }
      }
    } catch {
      // silently fail, don't block the page
    }
  }, [processImages])

  useLoad((params) => {
    const oid = params?.orderId ? String(params.orderId) : ''
    setOrderId(oid)
    if (oid) {
      ensureLogin().then(() => loadOrderItems(oid))
    }
  })

  const handleTabSelect = useCallback((item: { id: string }) => {
    setSelectedTab(item.id)
  }, [])

  const handleReasonChange = useCallback((e) => {
    setReasonIndex(Number(e.detail.value))
  }, [])

  const handleDescInput = useCallback((e) => {
    setDescription(e.detail.value || '')
  }, [])

  const handleAddPhotos = useCallback(async () => {
    if (photos.length >= 9) return

    try {
      const chooseRes = await Taro.chooseImage({
        count: 9 - photos.length,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      const files = chooseRes.tempFilePaths || []
      if (!files.length) return

      setUploading(true)
      const uploads = files.map((filePath, index) => {
        const ext = filePath.slice(filePath.lastIndexOf('.')) || '.jpg'
        const cloudPath = `afterSales/${Date.now()}_${index}${ext}`
        return Taro.cloud.uploadFile({ cloudPath, filePath }).then((r) => r.fileID)
      })
      const ids = await Promise.all(uploads)
      setPhotos((prev) => [...prev, ...ids])
      Taro.showToast({ title: '上传成功', icon: 'success' })
    } catch {
      Taro.showToast({ title: '选择/上传失败', icon: 'none' })
    } finally {
      setUploading(false)
    }
  }, [photos.length])

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!chosenOrderItemId) {
      Taro.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    if (reasonIndex < 0) {
      Taro.showToast({ title: '请选择申请原因', icon: 'none' })
      return
    }
    if (!description.trim()) {
      Taro.showToast({ title: '请填写问题描述', icon: 'none' })
      return
    }

    try {
      setSubmitting(true)
      const userRes = await userService.getUserInfo()
      if (userRes.code !== 200 || !userRes.data?._id) {
        Taro.showToast({ title: '用户信息获取失败', icon: 'none' })
        return
      }

      const res = await callCloudFunction('after-sales', {
        action: 'create',
        data: {
          _userId: userRes.data._id,
          orderId,
          orderItemId: chosenOrderItemId,
          reason: REASON_LIST[reasonIndex],
          description: description.trim(),
          photos,
        },
      })

      if (res.code === 200) {
        Taro.showToast({ title: '已提交', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 500)
      } else {
        Taro.showToast({ title: res.message || '提交失败，请稍后重试', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '提交失败，请稍后重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [chosenOrderItemId, reasonIndex, description, orderId, photos])

  const currentCare = CARE_CONTENT[selectedTab]

  return (
    <View className={styles.page}>
      <TopBarWithBack />

      <ScrollView scrollY style={{ marginTop: `${topOffset}px`, height: `calc(100vh - ${topOffset}px)` }}>
        <View className={styles.container}>
          <SlidingBar items={CARE_TABS} activeId={selectedTab} onSelect={handleTabSelect} />

          {/* 保养指南内容 */}
          <View className={styles.careContent}>
            <Text className={styles.careTitle}>{currentCare.title}</Text>
            <Text className={styles.careText}>{currentCare.text}</Text>
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

          {/* 售后申请表单 — 仅 orderId 存在时渲染 */}
          {orderId ? (
            <>
              <View className={styles.divider} />
              <View className={styles.applySection}>
                <Text className={styles.applyTitle}>售后申请</Text>

                {/* 选择商品 */}
                <View className={styles.applyBlock}>
                  <Text className={styles.blockTitle}>选择商品</Text>
                  {orderItems.map((item) => (
                    <View
                      className={styles.orderItem}
                      key={item.skuId}
                      onClick={() => setChosenOrderItemId(item.skuId)}
                    >
                      <View className={styles.itemLeft}>
                        <Image className={styles.itemThumb} src={item.displayImage} mode='aspectFill' />
                      </View>
                      <View className={styles.itemMid}>
                        <Text className={styles.itemName}>{item.skuNameCN}</Text>
                        <Text className={styles.itemSub}>{item.skuNameEN}</Text>
                        {item.materialName ? <Text className={styles.itemSub}>{item.materialName}</Text> : null}
                      </View>
                      <View className={styles.itemRight}>
                        <View
                          className={`${styles.radioOuter} ${chosenOrderItemId === item.skuId ? styles.radioOuterChecked : ''}`}
                        >
                          {chosenOrderItemId === item.skuId && <View className={styles.radioInner} />}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                {/* 申请原因 */}
                <View className={styles.applyBlock}>
                  <Text className={styles.blockTitle}>申请原因</Text>
                  <Picker mode='selector' range={REASON_LIST} value={reasonIndex >= 0 ? reasonIndex : 0} onChange={handleReasonChange}>
                    <View className={styles.pickerView}>
                      <Text className={reasonIndex >= 0 ? '' : styles.pickerPlaceholder}>
                        {reasonIndex >= 0 ? REASON_LIST[reasonIndex] : '请选择原因'}
                      </Text>
                      <Text className={styles.pickerArrow}>{'>'}</Text>
                    </View>
                  </Picker>
                </View>

                {/* 问题描述 */}
                <View className={styles.applyBlock}>
                  <Text className={styles.blockTitle}>问题描述</Text>
                  <Textarea
                    className={styles.descTextarea}
                    placeholder='请尽量详细描述问题'
                    onInput={handleDescInput}
                    maxlength={500}
                  />
                  <Text className={styles.charCount}>{description.length}/500</Text>
                </View>

                {/* 上传凭证 */}
                <View className={styles.applyBlock}>
                  <Text className={styles.blockTitle}>上传凭证（最多9张）</Text>
                  <View className={styles.photos}>
                    {photos.map((photo, idx) => (
                      <View className={styles.photoItem} key={photo}>
                        <Image className={styles.photoImg} src={photo} mode='aspectFill' />
                        <View className={styles.photoDel} onClick={() => handleRemovePhoto(idx)}>
                          <Text>×</Text>
                        </View>
                      </View>
                    ))}
                    {photos.length < 9 && (
                      <View className={styles.photoAdd} onClick={handleAddPhotos}>
                        <Text className={styles.addIcon}>+</Text>
                        <Text className={styles.addText}>添加图片</Text>
                      </View>
                    )}
                  </View>
                  {uploading && <Text className={styles.uploadTip}>正在上传...</Text>}
                </View>

                {/* 提交 */}
                <View className={styles.submitWrap}>
                  <View
                    className={`${styles.submitBtn} ${submitting ? styles.submitBtnDisabled : ''}`}
                    onClick={submitting ? undefined : handleSubmit}
                  >
                    <Text>提交申请</Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>

      <FloatPopup visible={isPopupShow} onClose={() => setIsPopupShow(false)} />
    </View>
  )
}
