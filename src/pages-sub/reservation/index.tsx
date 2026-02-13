import { useState } from 'react'
import { View, Text, Image, Input, Button, Picker } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import FloatBtn from '@/components/FloatBtn'
import FloatPopup from '@/components/FloatPopup'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import { useUserStore } from '@/stores/useUserStore'
import {
  useReservationForm,
  type ActivityConfig,
} from '@/hooks/useReservationForm'
import * as reservationService from '@/services/reservation.service'
import * as userService from '@/services/user.service'
import styles from './index.module.scss'

const AUTH_TEXT =
  '*我希望收到有关作品或服务的商业信息。可能会经电邮、短信、电话向您发送这些信息，也可能在社交媒体或其他数字平台向您发送个性化信息。'

const VIP_CONFIG: ActivityConfig = {
  title: 'Y.ZHENG Fine Jewelry品牌发布会VIP预览',
  address: '上海市静安区富民路89号巨富大厦18A',
  timeText: '2025/10/11 17:00-20:00',
  bannerImage: '/assets/images/reservation/top_image.jpg',
  dateList: [
    { day: 11, activity: true, isToday: false, isSelected: true },
    { day: 12, activity: false, isToday: false, isSelected: false },
    { day: 13, activity: false, isToday: false, isSelected: false },
    { day: 14, activity: false, isToday: false, isSelected: false },
    { day: 15, activity: false, isToday: false, isSelected: false },
    { day: 16, activity: false, isToday: false, isSelected: false },
    { day: 17, activity: false, isToday: false, isSelected: false },
    { day: 18, activity: false, isToday: false, isSelected: false },
  ],
  timeSlots: [{ time: '17:00-20:00', isSelected: true }],
  defaultSelectedTime: '10月11日 17:00-20:00',
  peopleOptions: ['预约人数*', '1', '2'],
  sharePath: '/pages-sub/reservation/index',
}

function buildSuccessUrl(
  data: any,
  config: ActivityConfig,
): string {
  const params = new URLSearchParams({
    reservationId: data._id || data.reservationId || '',
    name: data.name || '',
    phone: data.phone || '',
    people: data.people || '',
    date: data.date || '',
    activityTitle: config.title,
    address: config.address,
    reservationTime: String(data.createTime || Date.now()),
  })
  return `/pages-sub/reservation-success/index?${params.toString()}`
}

export default function Reservation() {
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const topOffset = statusBarHeight + navBarHeight
  const userStore = useUserStore()

  const {
    formData,
    errors,
    dateList,
    timeSlots,
    isTimePickerShow,
    setLastName,
    setFirstName,
    handlePhoneInput,
    setPhone,
    setPeopleIndex,
    selectDate,
    selectTimeSlot,
    toggleAuth,
    openTimePicker,
    closeTimePicker,
    confirmTimePicker,
    validate,
  } = useReservationForm(VIP_CONFIG)

  const [isPopupShow, setIsPopupShow] = useState(false)

  useShareAppMessage(() => ({
    title: VIP_CONFIG.title,
    path: VIP_CONFIG.sharePath,
  }))

  const handleGetPhoneNumber = async (e: any) => {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      Taro.showToast({ title: '获取手机号失败', icon: 'none' })
      return
    }
    const { code } = e.detail
    if (!code) {
      Taro.showToast({ title: '获取授权码失败', icon: 'none' })
      return
    }
    try {
      Taro.showLoading({ title: '获取手机号中...' })
      const res = await userService.bindPhone(code)
      Taro.hideLoading()
      if (res.code === 200 && res.data) {
        setPhone((res.data as any).phoneNumber)
        Taro.showToast({ title: '手机号获取成功', icon: 'success' })
      } else {
        Taro.showToast({ title: (res as any).message || '获取手机号失败', icon: 'none' })
      }
    } catch {
      Taro.hideLoading()
      Taro.showToast({ title: '网络错误，请重试', icon: 'none' })
    }
  }

  const handlePeopleChange = (e: any) => {
    setPeopleIndex(Number(e.detail.value))
  }

  const handleSubmit = async () => {
    // 1. 检查登录
    const loginRes = await userService.checkLogin()
    if (loginRes.code !== 200) {
      const { confirm } = await Taro.showModal({
        title: '需要微信授权',
        content: '为了完成预约，需要获取您的微信授权信息',
        confirmText: '确定授权',
        cancelText: '取消',
      })
      if (!confirm) {
        Taro.showToast({ title: '需要授权才能预约', icon: 'none' })
        return
      }
      await userStore.login()
    }

    // 2. 检查重复预约
    try {
      const listRes = await reservationService.listReservations()
      if (listRes.code === 200 && listRes.data && listRes.data.length > 0) {
        const existing = listRes.data[0]
        Taro.showToast({ title: '您已预约', icon: 'none', duration: 1500 })
        setTimeout(() => {
          Taro.navigateTo({ url: buildSuccessUrl(existing, VIP_CONFIG) })
        }, 800)
        return
      }
    } catch {
      // 检查失败，继续提交流程
    }

    // 3. 表单验证
    if (!validate()) return

    // 4. 提交预约
    const fullName = formData.lastName + formData.firstName
    const selectedTimes = timeSlots
      .filter((s) => s.isSelected)
      .map((s) => s.time)

    try {
      const res = await reservationService.addReservation({
        name: fullName,
        phone: formData.phone,
        people: VIP_CONFIG.peopleOptions[formData.peopleIndex],
        date: formData.selectedTime,
        selectedTimes,
      })

      if (res.code === 200) {
        Taro.showToast({ title: '预约成功', icon: 'success', duration: 2000 })
        setTimeout(() => {
          Taro.navigateTo({ url: buildSuccessUrl(res.data, VIP_CONFIG) })
        }, 2000)
      } else {
        Taro.showToast({
          title: (res as any).message || '预约失败',
          icon: 'none',
        })
      }
    } catch {
      Taro.showToast({ title: '预约失败', icon: 'none' })
    }
  }

  return (
    <View className={styles.container}>
      <TopBarWithBack />
      <View style={{ marginTop: `${topOffset}px` }}>
        {/* 顶部横幅图片 */}
        <View className={styles.topImage}>
          <Image
            src={VIP_CONFIG.bannerImage}
            mode='aspectFill'
            style={{ width: '100%', height: '100%' }}
          />
        </View>

        {/* 发布会信息 */}
        <View className={styles.infoContainer}>
          <View className={styles.infoContainerLeft}>
            <View className={styles.infoTitle}>{VIP_CONFIG.title}</View>
            <View className={styles.infoAddress}>
              <View className={styles.infoIcon}>
                <Image src='/assets/icons/location.svg' mode='aspectFit' />
              </View>
              <Text>{VIP_CONFIG.address}</Text>
            </View>
            <View className={styles.infoTime}>
              <View className={styles.infoIcon}>
                <Image src='/assets/icons/time.svg' mode='aspectFit' />
              </View>
              <Text>{VIP_CONFIG.timeText}</Text>
            </View>
          </View>
          <View className={styles.infoContainerRight}>
            <View className={styles.infoShare}>
              <Button
                className={styles.shareBtn}
                openType='share'
                plain
              >
                <Image
                  className={styles.shareIcon}
                  src='/assets/icons/share.svg'
                  mode='aspectFit'
                />
              </Button>
            </View>
          </View>
        </View>

        {/* 填写信息 */}
        <View className={styles.enterInfoContainer}>
          <View className={styles.enterInfoTitle}>预约人信息</View>
          <View className={styles.requiredField}>*必填项</View>
          <View className={styles.enterInfoForm}>
            {/* 姓 */}
            <View className={styles.formItem}>
              <Input
                className={`${styles.inputContainer} ${errors.lastName ? styles.notCorrect : ''}`}
                type='text'
                placeholder='姓*'
                placeholderStyle='color: #999;'
                value={formData.lastName}
                onInput={(e) => setLastName(e.detail.value)}
                onFocus={() => setLastName(formData.lastName)}
              />
            </View>
            {/* 名 */}
            <View className={styles.formItem}>
              <Input
                className={`${styles.inputContainer} ${errors.firstName ? styles.notCorrect : ''}`}
                type='text'
                placeholder='名*'
                placeholderStyle='color: #999;'
                value={formData.firstName}
                onInput={(e) => setFirstName(e.detail.value)}
                onFocus={() => setFirstName(formData.firstName)}
              />
            </View>
            {/* 联系电话 */}
            <View className={styles.formItem}>
              <View
                className={`${styles.phoneInputWrapper} ${errors.phone ? styles.notCorrect : ''}`}
              >
                <Input
                  className={styles.phoneInput}
                  type='number'
                  placeholder='联系电话*'
                  placeholderStyle='color: #999;'
                  value={formData.phone}
                  onInput={(e) => handlePhoneInput(e.detail.value)}
                />
                <Button
                  className={styles.getPhoneBtn}
                  openType='getPhoneNumber'
                  onGetPhoneNumber={handleGetPhoneNumber}
                  size='mini'
                >
                  一键获取
                </Button>
              </View>
            </View>
            {/* 预约人数 */}
            <View className={styles.formItem}>
              <Picker
                className={`${styles.peoplePicker} ${errors.people ? styles.notCorrect : ''}`}
                mode='selector'
                range={VIP_CONFIG.peopleOptions}
                value={formData.peopleIndex}
                onChange={handlePeopleChange}
              >
                <View
                  className={`${styles.pickerView} ${errors.people ? styles.notCorrectPickerView : ''}`}
                >
                  {VIP_CONFIG.peopleOptions[formData.peopleIndex]}
                </View>
              </Picker>
            </View>
            {/* 预约时间触发按钮 */}
            <View
              className={`${styles.pickerBtn} ${errors.time ? styles.notCorrect : ''}`}
              onClick={openTimePicker}
            >
              <View
                className={`${styles.pickerBtnText} ${errors.time ? styles.notCorrectTime : ''}`}
              >
                {formData.selectedTime || '预约时间*'}
              </View>
            </View>
            {/* 授权 */}
            <View
              className={`${styles.auth} ${errors.auth ? styles.authError : ''}`}
              onClick={toggleAuth}
            >
              <View className={styles.authRadio}>
                {formData.auth ? (
                  <View className={`${styles.authCheckbox} ${styles.checked}`}>
                    ✓
                  </View>
                ) : (
                  <View
                    className={`${styles.authCheckbox} ${styles.unchecked}`}
                  >
                    ☐
                  </View>
                )}
              </View>
              <View className={styles.authText}>
                <Text>{AUTH_TEXT}</Text>
              </View>
            </View>
            {/* 提交按钮 */}
            <View className={styles.submitBtn}>
              <Button onClick={handleSubmit}>立即预约</Button>
            </View>
          </View>
        </View>

        {/* 时间选择弹窗 */}
        {isTimePickerShow && (
          <View className={styles.timePickerMask} onClick={closeTimePicker}>
            <View
              className={styles.timePickerDialog}
              onClick={(e) => e.stopPropagation()}
            >
              <View className={styles.dialogHeader}>
                <Text className={styles.dialogHeaderTitle}>选择预约时间</Text>
                <Text className={styles.dialogClose} onClick={closeTimePicker}>
                  ×
                </Text>
              </View>
              <View>
                <View className={styles.sectionTitle}>2025年10月</View>
                <View className={styles.weekbar}>
                  <Text>周六</Text>
                  <Text>周日</Text>
                  <Text>周一</Text>
                  <Text>周二</Text>
                  <Text>周三</Text>
                  <Text>周四</Text>
                  <Text>周五</Text>
                  <Text>周六</Text>
                </View>
                <View className={styles.dateList}>
                  {dateList.map((item, index) => (
                    <View
                      key={item.day}
                      className={`${styles.dateItem} ${item.isSelected ? styles.dateSelected : ''} ${!item.activity ? styles.dateDisabled : ''}`}
                      onClick={() => item.activity && selectDate(index)}
                    >
                      {item.day}
                    </View>
                  ))}
                </View>
              </View>
              <View className={styles.timeSection}>
                <View className={styles.timeList}>
                  {timeSlots.map((item, index) => (
                    <View
                      key={item.time}
                      className={`${styles.timeItem} ${item.isSelected ? styles.timeSelected : ''}`}
                      onClick={() => selectTimeSlot(index)}
                    >
                      {item.time}
                    </View>
                  ))}
                </View>
              </View>
              <View className={styles.confirmBtn} onClick={confirmTimePicker}>
                确认
              </View>
            </View>
          </View>
        )}

        <FloatBtn onPress={() => setIsPopupShow(true)} />
        <FloatPopup
          visible={isPopupShow}
          onClose={() => setIsPopupShow(false)}
        />
      </View>
    </View>
  )
}
