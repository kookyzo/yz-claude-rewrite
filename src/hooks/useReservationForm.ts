import { useState, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { isValidPhone, isNotEmpty } from '@/utils/validate'

/** 日期网格项 */
export interface DateItem {
  day: number
  activity: boolean
  isToday: boolean
  isSelected: boolean
}

/** 时间段项 */
export interface TimeSlot {
  time: string
  isSelected: boolean
}

/** 活动配置 */
export interface ActivityConfig {
  title: string
  address: string
  timeText: string
  bannerImage: string
  dateList: DateItem[]
  timeSlots: TimeSlot[]
  defaultSelectedTime: string
  peopleOptions: string[]
  sharePath: string
}

/** 表单数据 */
export interface ReservationFormData {
  lastName: string
  firstName: string
  phone: string
  peopleIndex: number
  selectedTime: string
  auth: boolean
}

/** 表单错误状态 */
export interface FormErrors {
  lastName: boolean
  firstName: boolean
  phone: boolean
  people: boolean
  time: boolean
  auth: boolean
}

const INITIAL_ERRORS: FormErrors = {
  lastName: false,
  firstName: false,
  phone: false,
  people: false,
  time: false,
  auth: false,
}

export function useReservationForm(config: ActivityConfig) {
  const [formData, setFormData] = useState<ReservationFormData>({
    lastName: '',
    firstName: '',
    phone: '',
    peopleIndex: 0,
    selectedTime: config.defaultSelectedTime,
    auth: false,
  })
  const [errors, setErrors] = useState<FormErrors>({ ...INITIAL_ERRORS })
  const [dateList, setDateList] = useState<DateItem[]>(
    config.dateList.map((d) => ({ ...d })),
  )
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(
    config.timeSlots.map((t) => ({ ...t })),
  )
  const [isTimePickerShow, setIsTimePickerShow] = useState(false)

  const setLastName = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, lastName: value }))
    setErrors((prev) => ({ ...prev, lastName: false }))
  }, [])

  const setFirstName = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, firstName: value }))
    setErrors((prev) => ({ ...prev, firstName: false }))
  }, [])

  const handlePhoneInput = useCallback((value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 11)
    setFormData((prev) => ({ ...prev, phone: cleaned }))
    setErrors((prev) => ({ ...prev, phone: false }))
  }, [])

  const setPhone = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, phone: value }))
    setErrors((prev) => ({ ...prev, phone: false }))
  }, [])

  const setPeopleIndex = useCallback((index: number) => {
    setFormData((prev) => ({ ...prev, peopleIndex: index }))
    setErrors((prev) => ({ ...prev, people: false }))
  }, [])

  const selectDate = useCallback((index: number) => {
    setDateList((prev) =>
      prev.map((item, i) => ({ ...item, isSelected: i === index })),
    )
  }, [])

  const selectTimeSlot = useCallback((index: number) => {
    setTimeSlots((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, isSelected: !item.isSelected } : item,
      ),
    )
  }, [])

  const toggleAuth = useCallback(() => {
    setFormData((prev) => ({ ...prev, auth: !prev.auth }))
    setErrors((prev) => ({ ...prev, auth: false }))
  }, [])

  const openTimePicker = useCallback(() => {
    setErrors((prev) => ({ ...prev, time: false }))
    setIsTimePickerShow(true)
  }, [])

  const closeTimePicker = useCallback(() => {
    setIsTimePickerShow(false)
  }, [])

  const confirmTimePicker = useCallback(() => {
    const selectedDate = dateList.find((item) => item.isSelected)?.day
    const selectedTimes = timeSlots
      .filter((item) => item.isSelected)
      .map((item) => item.time)

    if (selectedDate && selectedTimes.length > 0) {
      const timeString = selectedTimes.join('、')
      setFormData((prev) => ({
        ...prev,
        selectedTime: `10月${selectedDate}日 ${timeString}`,
      }))
      setErrors((prev) => ({ ...prev, time: false }))
      setIsTimePickerShow(false)
    } else {
      Taro.showToast({ title: '请选择日期和至少一个时间段', icon: 'none' })
    }
  }, [dateList, timeSlots])

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = { ...INITIAL_ERRORS }
    let hasError = false
    let errorMessage = ''

    if (!isNotEmpty(formData.lastName)) {
      newErrors.lastName = true
      hasError = true
      errorMessage = '请填写姓'
    }
    if (!isNotEmpty(formData.firstName)) {
      newErrors.firstName = true
      hasError = true
      errorMessage = errorMessage || '请填写名'
    }
    if (!formData.phone.trim()) {
      newErrors.phone = true
      hasError = true
      errorMessage = errorMessage || '请填写联系电话'
    } else if (!isValidPhone(formData.phone)) {
      newErrors.phone = true
      hasError = true
      errorMessage = errorMessage || '请输入正确的手机号码'
    }
    if (formData.peopleIndex === 0) {
      newErrors.people = true
      hasError = true
      errorMessage = errorMessage || '请选择预约人数'
    }
    if (!formData.selectedTime || formData.selectedTime === '预约时间*') {
      newErrors.time = true
      hasError = true
      errorMessage = errorMessage || '请选择预约时间'
    }
    if (!formData.auth) {
      newErrors.auth = true
      hasError = true
      errorMessage = errorMessage || '请勾选同意条款'
    }

    setErrors(newErrors)

    if (hasError) {
      Taro.showToast({ title: errorMessage, icon: 'none', duration: 2000 })
      return false
    }
    return true
  }, [formData])

  return {
    formData,
    setFormData,
    errors,
    setErrors,
    dateList,
    setDateList,
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
  }
}
