import { useState } from 'react'
import { View, Text, Video } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAppStore } from '@/stores/useAppStore'
import { SPLASH_VIDEO_URL } from '@/constants'
import styles from './index.module.scss'

export default function Splash() {
  const [videoEnded, setVideoEnded] = useState(false)
  const [showPrivacyPopup, setShowPrivacyPopup] = useState(false)
  const privacyAgreed = useAppStore(state => state.privacyAgreed)
  const agreePrivacy = useAppStore(state => state.agreePrivacy)

  const navigateToHome = () => {
    Taro.switchTab({ url: '/pages/home/index' })
  }

  const checkPrivacyAgreement = () => {
    if (privacyAgreed) {
      navigateToHome()
    } else {
      setShowPrivacyPopup(true)
    }
  }

  const handleVideoEnd = () => {
    if (videoEnded) return
    setVideoEnded(true)
    checkPrivacyAgreement()
  }

  const handleAgree = () => {
    agreePrivacy()
    navigateToHome()
  }

  const handleCheckDetails = () => {
    Taro.navigateTo({ url: '/pages-sub/privacy-policy/index' })
  }

  return (
    <View className={styles.container}>
      <Video
        className={styles.video}
        src={SPLASH_VIDEO_URL}
        autoplay
        loop={false}
        muted={false}
        controls={false}
        showPlayBtn={false}
        showCenterPlayBtn={false}
        showFullscreenBtn={false}
        showProgress={false}
        objectFit='cover'
        onEnded={handleVideoEnd}
        onError={handleVideoEnd}
      />

      {!videoEnded && (
        <View className={styles.skipBtn} onClick={handleVideoEnd}>
          <Text className={styles.skipText}>跳过</Text>
        </View>
      )}

      {showPrivacyPopup && (
        <>
          <View className={styles.mask} />
          <View className={styles.popup}>
            <Text className={styles.popupTitle}>温馨提示</Text>
            <Text className={styles.popupContent}>
              我们根据法律法规要求对《隐私条款》进行了更新，以完善我们的店铺、网站和其他服务涉及的个人信息处理规则。为了保障您的权益，请查阅《隐私政策》所有条款
            </Text>
            <Text className={styles.detailLink} onClick={handleCheckDetails}>
              点击查看更多详情
            </Text>
            <View className={styles.btnRow}>
              <View className={styles.btnDisagree}>
                <Text>不同意</Text>
              </View>
              <View className={styles.btnAgree} onClick={handleAgree}>
                <Text>同意</Text>
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  )
}
