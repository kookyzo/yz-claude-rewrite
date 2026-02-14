import { useState, useEffect } from 'react'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useShareAppMessage, useRouter } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import * as reservationService from '@/services/reservation.service'
import styles from './index.module.scss'

interface ReservationInfo {
  reservationId: string
  name: string
  phone: string
  people: string
  date: string
  activityTitle: string
  address: string
}

export default function ReservationSuccess() {
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const topOffset = statusBarHeight + navBarHeight
  const router = useRouter()

  const [reservationInfo, setReservationInfo] = useState<ReservationInfo | null>(null)
  const [qrCodeImage, setQrCodeImage] = useState('')
  const [reservationTime, setReservationTime] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useShareAppMessage(() => ({
    title: 'Y.ZHENG Fine Jewelry品牌发布会',
    path: '/pages-sub/reservation/index',
  }))

  useEffect(() => {
    const params = router.params
    if (!params.reservationId) {
      setIsLoading(false)
      return
    }
    setReservationInfo({
      reservationId: params.reservationId,
      name: decodeURIComponent(params.name || ''),
      phone: decodeURIComponent(params.phone || ''),
      people: decodeURIComponent(params.people || ''),
      date: decodeURIComponent(params.date || ''),
      activityTitle: decodeURIComponent(params.activityTitle || 'Y.ZHENG Fine Jewelry品牌发布会'),
      address: decodeURIComponent(params.address || '上海市静安区富民路89号巨富大厦18A'),
    })
    setReservationTime(decodeURIComponent(params.reservationTime || String(Date.now())))
    generateQRCodeImage(params.reservationId, decodeURIComponent(params.name || ''))
  }, [])

  async function generateQRCodeImage(id: string, name: string) {
    setIsLoading(true)
    try {
      const content = JSON.stringify({ type: 'reservation', reservationId: id, name })
      const res = await reservationService.generateQRCode(content, 'reservation')
      if (res.code === 200 && res.data) {
        const qrSrc = res.data.fileId || res.data.qrCodeUrl || ''
        if (qrSrc) {
          setQrCodeImage(qrSrc)
        } else {
          Taro.showToast({ title: '二维码生成失败', icon: 'none' })
        }
      } else {
        Taro.showToast({ title: '二维码生成失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '二维码生成失败', icon: 'none' })
    } finally {
      setIsLoading(false)
    }
  }

  function viewMyReservations() {
    Taro.pageScrollTo({ scrollTop: 0, duration: 300 })
  }

  function modifyReservation() {
    if (!reservationInfo) return
    Taro.redirectTo({
      url: `/pages-sub/reservation-change/index?reservationId=${reservationInfo.reservationId}`,
    })
  }

  function goHome() {
    const pages = Taro.getCurrentPages()
    const delta = pages.length > 1 ? pages.length - 1 : 1
    Taro.navigateBack({ delta })
  }

  return (
    <View className={styles.container}>
      <TopBarWithBack />
      <View className={styles.successContainer} style={{ paddingTop: `${topOffset}px` }}>
        {/* 成功标题 */}
        <View className={styles.successTitle}>预约成功！</View>

        {/* 成功描述 */}
        <View className={styles.successDesc}>
          您的预约已确认，请截图保存此页面作为入场凭证
        </View>

        {/* 预约信息卡片 */}
        {reservationInfo && (
          <View className={styles.reservationCard}>
            <View className={styles.cardTitle}>预约详情</View>

            <View className={styles.infoItem}>
              <Text className={styles.infoLabel}>活动名称：</Text>
              <Text className={styles.infoValue}>{reservationInfo.activityTitle}</Text>
            </View>

            <View className={styles.infoItem}>
              <Text className={styles.infoLabel}>预约人：</Text>
              <Text className={styles.infoValue}>{reservationInfo.name}</Text>
            </View>

            <View className={styles.infoItem}>
              <Text className={styles.infoLabel}>联系电话：</Text>
              <Text className={styles.infoValue}>{reservationInfo.phone}</Text>
            </View>

            <View className={styles.infoItem}>
              <Text className={styles.infoLabel}>预约人数：</Text>
              <Text className={styles.infoValue}>{reservationInfo.people}人</Text>
            </View>

            <View className={styles.infoItem}>
              <Text className={styles.infoLabel}>预约时间：</Text>
              <Text className={styles.infoValue}>{reservationInfo.date}</Text>
            </View>

            <View className={styles.infoItem}>
              <Text className={styles.infoLabel}>活动地址：</Text>
              <Text className={styles.infoValue}>{reservationInfo.address}</Text>
            </View>

            <View className={styles.infoItem}>
              <Text className={styles.infoLabel}>预约编号：</Text>
              <Text className={styles.infoValue}>{reservationInfo.reservationId}</Text>
            </View>
          </View>
        )}

        {/* 二维码区域 */}
        <View className={styles.qrCodeSection}>
          <View className={styles.qrTitle}>入场二维码</View>

          {isLoading ? (
            <View className={styles.qrLoading}>
              <Text>正在生成二维码...</Text>
            </View>
          ) : (
            <View className={styles.qrCodeContainer}>
              <View className={styles.qrCodeWrapper}>
                {qrCodeImage ? (
                  <Image
                    className={styles.qrCodeImage}
                    src={qrCodeImage}
                    mode='aspectFit'
                  />
                ) : (
                  <View className={styles.qrCodePlaceholder}>
                    <Text>二维码生成中...</Text>
                  </View>
                )}
              </View>

              <View className={styles.qrDesc}>
                <Text>请</Text>
                <Text className={styles.boldText}>截图保存</Text>
                <Text>此页面作为入场凭证，活动现场扫码入场</Text>
              </View>
            </View>
          )}
        </View>

        {/* 操作按钮区域 */}
        <View className={styles.actionButtons}>
          <View className={styles.buttonRow}>
            <Button
              className={`${styles.actionBtn} ${styles.secondary}`}
              onClick={viewMyReservations}
            >
              查看我的预约
            </Button>
            <Button
              className={`${styles.actionBtn} ${styles.secondary}`}
              onClick={modifyReservation}
            >
              修改预约信息
            </Button>
          </View>

          <View className={styles.buttonRow}>
            <Button
              className={`${styles.actionBtn} ${styles.primary}`}
              onClick={goHome}
            >
              返回首页
            </Button>
          </View>
        </View>

        {/* 温馨提示 */}
        <View className={styles.tips}>
          <View className={styles.tipsTitle}>温馨提示：</View>
          <View className={styles.tipsContent}>
            <Text>• 请提前15分钟到达活动现场</Text>
            <Text>• 入场时请出示此二维码</Text>
            <Text>• 如有疑问请联系客服</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
