import { useState, useEffect } from 'react'
import { View, Text, Image, Input, Button, Picker } from '@tarojs/components'
import Taro, { useShareAppMessage, useRouter } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import FloatBtn from '@/components/FloatBtn'
import FloatPopup from '@/components/FloatPopup'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import {
  useReservationForm,
  type ActivityConfig,
} from '@/hooks/useReservationForm'
import * as reservationService from '@/services/reservation.service'
import * as userService from '@/services/user.service'
import styles from './index.module.scss'

const AUTH_TEXT =
  '*我希望收到有关作品或服务的商业信息。可能会经电邮、短信、电话向您发送这些信息，也可能在社交媒体或其他数字平台向您发送个性化信息。'

const CHANGE_CONFIG: ActivityConfig = {
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

function buildSuccessUrl(data: any, config: ActivityConfig): string {
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

export default function ReservationChange() {
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const topOffset = statusBarHeight + navBarHeight
  const router = useRouter()

  const {
    formData,
    setFormData,
    errors,
    dateList,
    timeSlots,
    setTimeSlots,
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
  } = useReservationForm(CHANGE_CONFIG)

  const [isPopupShow, setIsPopupShow] = useState(false)
  const [reservationId, setReservationId] = useState('')
  const [modificationCount, setModificationCount] = useState(0)
  const [dataLoaded, setDataLoaded] = useState(false)

  useShareAppMessage(() => ({
    title: 'YZHENG品牌线下发布会',
    path: '/pages-sub/reservation/index',
  }))

  useEffect(() => {
    const id = router.params.reservationId
    if (!id) {
      Taro.showToast({ title: '缺少预约信息', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1500)
      return
    }
    setReservationId(id)
    loadExistingReservation(id)
  }, [])

  async function loadExistingReservation(id: string) {
    Taro.showLoading({ title: '加载中...' })
    try {
      const res = await reservationService.getReservation(id)
      if (res.code !== 200 || !res.data) {
        Taro.showToast({ title: '获取预约信息失败', icon: 'none' })
        Taro.navigateBack()
        return
      }
      const data = res.data
      const lastName = data.name ? data.name.charAt(0) : ''
      const firstName = data.name ? data.name.substring(1) : ''

      let peopleIndex = 0
      for (let i = 1; i < CHANGE_CONFIG.peopleOptions.length; i++) {
        if (CHANGE_CONFIG.peopleOptions[i] === data.people) {
          peopleIndex = i
          break
        }
      }

      setFormData((prev) => ({
        ...prev,
        lastName,
        firstName,
        phone: data.phone || '',
        peopleIndex,
        selectedTime: data.date || '',
        auth: true,
      }))

      setTimeSlots((prev) =>
        prev.map((slot) => ({
          ...slot,
          isSelected: data.selectedTimes?.includes(slot.time) ?? false,
        })),
      )

      setModificationCount(data.submissionCount || 0)
      setDataLoaded(true)
    } catch {
      Taro.showToast({ title: '获取预约信息失败', icon: 'none' })
      Taro.navigateBack()
    } finally {
      Taro.hideLoading()
    }
  }

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
    // 1. 弹出确认对话框
    const { confirm } = await Taro.showModal({
      title: '确认修改',
      content: `预约信息只可以修改两次，您已修改${modificationCount}次，是否确认修改？`,
      confirmText: '确认修改',
      cancelText: '取消',
    })
    if (!confirm) return

    // 2. 检查登录
    const loginRes = await userService.checkLogin()
    if (loginRes.code !== 200) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    // 3. 表单验证
    if (!validate()) return

    // 4. 提交修改
    const fullName = formData.lastName + formData.firstName
    const selectedTimes = timeSlots
      .filter((s) => s.isSelected)
      .map((s) => s.time)

    try {
      const res = await reservationService.updateReservation({
        reservationId,
        name: fullName,
        phone: formData.phone,
        people: CHANGE_CONFIG.peopleOptions[formData.peopleIndex],
        date: formData.selectedTime,
        selectedTimes,
      })

      if (res.code === 200) {
        setModificationCount((prev) => prev + 1)
        Taro.showToast({ title: '修改成功', icon: 'success', duration: 2000 })
        setTimeout(() => {
          Taro.navigateTo({ url: buildSuccessUrl(res.data, CHANGE_CONFIG) })
        }, 2000)
      } else if (res.code === 403) {
        Taro.showToast({
          title: '您已修改预约信息2次，无法再次修改',
          icon: 'none',
          duration: 3000,
        })
      } else {
        Taro.showToast({
          title: (res as any).message || '修改失败',
          icon: 'none',
        })
      }
    } catch {
      Taro.showToast({ title: '修改失败', icon: 'none' })
    }
  }

  return (
    <View className={styles.container}>
      <TopBarWithBack />
      <View style={{ marginTop: `${topOffset}px` }}>
        {/* 顶部横幅图片 */}
        <View className={styles.topImage}>
          <Image
            src={CHANGE_CONFIG.bannerImage}
            mode='aspectFill'
            style={{ width: '100%', height: '100%' }}
          />
        </View>

        {/* 发布会信息 */}
        <View className={styles.infoContainer}>
          <View className={styles.infoContainerLeft}>
            <View className={styles.infoTitle}>{CHANGE_CONFIG.title}</View>
            <View className={styles.infoAddress}>
              <View className={styles.infoIcon}>
                <Image src='/assets/icons/location.svg' mode='aspectFit' />
              </View>
              <Text>{CHANGE_CONFIG.address}</Text>
            </View>
            <View className={styles.infoTime}>
              <View className={styles.infoIcon}>
                <Image src='/assets/icons/time.svg' mode='aspectFit' />
              </View>
              <Text>{CHANGE_CONFIG.timeText}</Text>
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
                range={CHANGE_CONFIG.peopleOptions}
                value={formData.peopleIndex}
                onChange={handlePeopleChange}
              >
                <View
                  className={`${styles.pickerView} ${errors.people ? styles.notCorrectPickerView : ''}`}
                >
                  {CHANGE_CONFIG.peopleOptions[formData.peopleIndex]}
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
              <Button onClick={handleSubmit}>修改预约</Button>
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
