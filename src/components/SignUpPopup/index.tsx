import { useState } from 'react'
import { View, Text, Input, Picker, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Popup } from '@nutui/nutui-react-taro'
import { isValidPhone, isValidEmail, isNotEmpty } from '@/utils/validate'
import * as userService from '@/services/user.service'
import styles from './index.module.scss'

interface SignUpFormData {
  gender: string
  title: string
  nickname: string
  birthday?: string
  phone: string
  mail?: string
  region?: string[]
}

interface SignUpPopupProps {
  visible: boolean
  onSubmit: (data: { userId: string; userInfo: SignUpFormData }) => void
  onClose: () => void
}

const TITLE_OPTIONS = ['女士', '先生', '小姐', '太太']

const initialForm: SignUpFormData = {
  gender: 'female',
  title: '',
  nickname: '',
  birthday: undefined,
  phone: '',
  mail: undefined,
  region: undefined,
}

export default function SignUpPopup({ visible, onSubmit, onClose }: SignUpPopupProps) {
  const [formData, setFormData] = useState<SignUpFormData>({ ...initialForm })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [privacyAgreed, setPrivacyAgreed] = useState(false)

  const updateField = <K extends keyof SignUpFormData>(key: K, value: SignUpFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    // 清除该字段的错误
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title) {
      newErrors.title = '请选择称谓'
    }
    if (!isNotEmpty(formData.nickname)) {
      newErrors.nickname = '请输入正确的昵称'
    }
    if (!isValidPhone(formData.phone)) {
      newErrors.phone = '请输入正确的手机号'
    }
    if (formData.mail && !isValidEmail(formData.mail)) {
      newErrors.mail = '请输入正确的邮箱'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!privacyAgreed) {
      Taro.showToast({ title: '请先同意隐私协议', icon: 'none' })
      return
    }
    if (!validate()) return

    try {
      const res = await userService.register(formData)
      if (res.code === 200) {
        onSubmit({ userId: res.data?._id || '', userInfo: formData })
        setTimeout(() => {
          onClose()
          setFormData({ ...initialForm })
          setErrors({})
          setPrivacyAgreed(false)
        }, 500)
      } else {
        Taro.showToast({ title: res.message || '注册失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '注册失败', icon: 'none' })
    }
  }

  const handleGetPhoneNumber = (e: any) => {
    if (e.detail.code) {
      userService.bindPhone(e.detail.code).then((res) => {
        if (res.code === 200 && res.data?.phone) {
          updateField('phone', res.data.phone)
        }
      })
    }
  }

  return (
    <Popup
      visible={visible}
      position='center'
      closeable
      closeOnOverlayClick
      onClose={onClose}
      style={{
        width: '90%',
        maxWidth: '650rpx',
        maxHeight: '85vh',
        borderRadius: '20rpx',
        overflow: 'hidden',
      }}
    >
      <View className={styles.container}>
        <Text className={styles.formTitle}>注册</Text>

        {/* 性别 */}
        <View className={styles.fieldGroup}>
          <Text className={styles.label}>性别</Text>
          <View className={styles.genderRow}>
            <View
              className={`${styles.genderOption} ${formData.gender === 'female' ? styles.genderActive : ''}`}
              onClick={() => updateField('gender', 'female')}
            >
              <View className={`${styles.radio} ${formData.gender === 'female' ? styles.radioActive : ''}`} />
              <Text className={styles.genderText}>女</Text>
            </View>
            <View
              className={`${styles.genderOption} ${formData.gender === 'male' ? styles.genderActive : ''}`}
              onClick={() => updateField('gender', 'male')}
            >
              <View className={`${styles.radio} ${formData.gender === 'male' ? styles.radioActive : ''}`} />
              <Text className={styles.genderText}>男</Text>
            </View>
          </View>
        </View>

        {/* 称谓 */}
        <View className={styles.fieldGroup}>
          <Text className={styles.label}>称谓 *</Text>
          <Picker
            mode='selector'
            range={TITLE_OPTIONS}
            onChange={(e) => updateField('title', TITLE_OPTIONS[e.detail.value as number])}
          >
            <View className={`${styles.pickerDisplay} ${errors.title ? styles.inputError : ''}`}>
              <Text className={formData.title ? styles.pickerValue : (errors.title ? styles.placeholderError : styles.placeholder)}>
                {formData.title || (errors.title || '请选择称谓')}
              </Text>
            </View>
          </Picker>
        </View>

        {/* 昵称 */}
        <View className={styles.fieldGroup}>
          <Text className={styles.label}>昵称 *</Text>
          <Input
            className={`${styles.input} ${errors.nickname ? styles.inputError : ''}`}
            value={formData.nickname}
            placeholder={errors.nickname || '请输入昵称'}
            placeholderClass={errors.nickname ? styles.placeholderError : ''}
            onInput={(e) => updateField('nickname', e.detail.value)}
          />
        </View>

        {/* 生日 */}
        <View className={styles.fieldGroup}>
          <Text className={styles.label}>生日</Text>
          <Picker
            mode='date'
            value={formData.birthday || ''}
            onChange={(e) => updateField('birthday', e.detail.value as string)}
          >
            <View className={styles.pickerDisplay}>
              <Text className={formData.birthday ? styles.pickerValue : styles.placeholder}>
                {formData.birthday || '请选择生日'}
              </Text>
            </View>
          </Picker>
        </View>

        {/* 电话 */}
        <View className={styles.fieldGroup}>
          <Text className={styles.label}>电话 *</Text>
          <View className={styles.phoneRow}>
            <Input
              className={`${styles.input} ${styles.phoneInput} ${errors.phone ? styles.inputError : ''}`}
              type='number'
              value={formData.phone}
              placeholder={errors.phone || '请输入手机号'}
              placeholderClass={errors.phone ? styles.placeholderError : ''}
              onInput={(e) => updateField('phone', e.detail.value)}
            />
            <Button
              className={styles.getPhoneBtn}
              openType='getPhoneNumber'
              onGetPhoneNumber={handleGetPhoneNumber}
            >
              一键获取
            </Button>
          </View>
        </View>

        {/* 邮箱 */}
        <View className={styles.fieldGroup}>
          <Text className={styles.label}>邮箱</Text>
          <Input
            className={`${styles.input} ${errors.mail ? styles.inputError : ''}`}
            value={formData.mail || ''}
            placeholder={errors.mail || '请输入邮箱'}
            placeholderClass={errors.mail ? styles.placeholderError : ''}
            onInput={(e) => updateField('mail', e.detail.value)}
          />
        </View>

        {/* 地区 */}
        <View className={styles.fieldGroup}>
          <Text className={styles.label}>地区</Text>
          <Picker
            mode='region'
            value={formData.region || []}
            onChange={(e) => updateField('region', e.detail.value as string[])}
          >
            <View className={styles.pickerDisplay}>
              <Text className={formData.region ? styles.pickerValue : styles.placeholder}>
                {formData.region?.join(' ') || '请选择地区'}
              </Text>
            </View>
          </Picker>
        </View>

        {/* 隐私协议 */}
        <View className={styles.privacyRow}>
          <View
            className={`${styles.checkbox} ${privacyAgreed ? styles.checkboxActive : ''}`}
            onClick={() => setPrivacyAgreed(!privacyAgreed)}
          />
          <Text className={styles.privacyText}>
            我已阅读并同意
            <Text
              className={styles.privacyLink}
              onClick={() => Taro.navigateTo({ url: '/pages-sub/privacy-policy/index' })}
            >
              《隐私政策》
            </Text>
            和
            <Text
              className={styles.privacyLink}
              onClick={() => Taro.navigateTo({ url: '/pages-sub/user-agreement/index' })}
            >
              《用户协议》
            </Text>
          </Text>
        </View>

        {/* 提交按钮 */}
        <View className={styles.submitBtn} onClick={handleSubmit}>
          <Text className={styles.submitBtnText}>注册</Text>
        </View>
      </View>
    </Popup>
  )
}
