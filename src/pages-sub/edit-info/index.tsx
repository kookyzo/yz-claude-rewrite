import { useState } from 'react'
import { View, Text, Input, Image, Button, Picker } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useUserStore } from '@/stores/useUserStore'
import * as userService from '@/services/user.service'
import { isValidEmail, isNotEmpty } from '@/utils/validate'
import selectedIcon from '@/assets/icons/selected.png'
import notSelectedIcon from '@/assets/icons/not_selected.png'
import logoImg from '@/assets/icons/home_selected.png'
import styles from './index.module.scss'

const TITLE_LIST = ['称谓*', '女士', '小姐', '男士', '先生', '其他']

export default function EditInfo() {
  const [gender, setGender] = useState<'female' | 'male'>('female')
  const [titleIndex, setTitleIndex] = useState(1)
  const [nickname, setNickname] = useState('')
  const [birthday, setBirthday] = useState('')
  const [phone, setPhone] = useState('')
  const [mail, setMail] = useState('')
  const [region, setRegion] = useState<string[]>(['请', '选择', '地区'])
  const [auth, setAuth] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [errors, setErrors] = useState({
    title: false,
    nickname: false,
    phone: false,
    mail: false,
  })

  // Dynamic placeholders for error states
  const [nicknamePlaceholder, setNicknamePlaceholder] = useState('昵称*')
  const [phonePlaceholder, setPhonePlaceholder] = useState('联系电话*')
  const [mailPlaceholder, setMailPlaceholder] = useState('邮箱*')
  const [nicknamePlaceholderStyle, setNicknamePlaceholderStyle] = useState('color: #999;')
  const [phonePlaceholderStyle, setPhonePlaceholderStyle] = useState('color: #999;')
  const [mailPlaceholderStyle, setMailPlaceholderStyle] = useState('color: #999;')

  const fillFormFromProfile = (p: any) => {
    // title -> titleIndex
    const idx = TITLE_LIST.indexOf(p.title || '')
    setTitleIndex(idx > 0 ? idx : (p.title ? 0 : 1))

    // region: compatible with array and string
    if (Array.isArray(p.region) && p.region.length === 3) {
      setRegion(p.region)
    } else if (typeof p.region === 'string' && p.region) {
      const s = p.region.replace(/-|,|，/g, '/').split('/').map((x: string) => x.trim()).filter(Boolean)
      if (s.length >= 3) setRegion(s.slice(0, 3))
    }

    // gender
    if (p.gender === 'male' || p.gender === 'female') {
      setGender(p.gender)
    }

    if (p.nickname) setNickname(p.nickname)
    if (p.birthday) setBirthday(p.birthday)
    if (p.phone) setPhone(p.phone)
    // mail: compatible with email and mail keys
    const mailVal = p.email || p.mail || ''
    if (mailVal) setMail(mailVal)
  }

  useLoad(async () => {
    try {
      const res = await userService.getUserInfo()
      if (res.code === 200 && res.data) {
        fillFormFromProfile(res.data)
      } else {
        // Fallback to local cache
        try {
          const cached = Taro.getStorageSync('profile')
          if (cached && Object.keys(cached).length) fillFormFromProfile(cached)
        } catch {}
      }
    } catch {
      try {
        const cached = Taro.getStorageSync('profile')
        if (cached && Object.keys(cached).length) fillFormFromProfile(cached)
      } catch {}
    }
  })

  const handleTitleChange = (e) => {
    setTitleIndex(Number(e.detail.value))
    setErrors((prev) => ({ ...prev, title: false }))
  }

  const handleNicknameInput = (e) => {
    setNickname(e.detail.value)
    setErrors((prev) => ({ ...prev, nickname: false }))
    setNicknamePlaceholder('昵称*')
    setNicknamePlaceholderStyle('color: #999;')
  }

  const handlePhoneInput = (e) => {
    const value = (e.detail.value || '').replace(/\D/g, '').slice(0, 11)
    setPhone(value)
    setErrors((prev) => ({ ...prev, phone: false }))
    setPhonePlaceholder('联系电话*')
    setPhonePlaceholderStyle('color: #999;')
  }

  const handleMailInput = (e) => {
    setMail(e.detail.value)
    setErrors((prev) => ({ ...prev, mail: false }))
    setMailPlaceholder('邮箱*')
    setMailPlaceholderStyle('color: #999;')
  }

  const handleBirthdayChange = (e) => {
    setBirthday(e.detail.value)
  }

  const handleRegionChange = (e) => {
    setRegion(e.detail.value)
  }

  const handleClose = () => {
    Taro.navigateBack()
  }

  const handleEditAddress = () => {
    Taro.navigateTo({ url: '/pages-sub/address-list/index' })
  }

  const handleSubmit = async () => {
    if (submitting) return

    // Validate
    const title = TITLE_LIST[titleIndex] || ''
    const phoneReg = /^1\d{10}$/

    const notCorrectTitle = title === '称谓*' || title === '请输入正确的称谓*'
    const notCorrectNickname = !isNotEmpty(nickname)
    const notCorrectPhone = !phoneReg.test(phone || '')
    const notCorrectMail = (mail && mail.trim() !== '') ? !isValidEmail(mail) : false

    if (notCorrectTitle || notCorrectNickname || notCorrectPhone || notCorrectMail || !auth) {
      setErrors({
        title: notCorrectTitle,
        nickname: notCorrectNickname,
        phone: notCorrectPhone,
        mail: notCorrectMail,
      })

      if (!auth) {
        Taro.showToast({ title: '请勾选授权协议', icon: 'none' })
      }
      if (notCorrectNickname) {
        setNicknamePlaceholder('请输入昵称*')
        setNicknamePlaceholderStyle('color:#CE1616;')
      }
      if (notCorrectPhone) {
        setPhonePlaceholder('请输入正确的电话号码*')
        setPhonePlaceholderStyle('color:#CE1616;')
      }
      if (notCorrectMail) {
        setMailPlaceholder('请输入正确的邮箱*')
        setMailPlaceholderStyle('color:#CE1616;')
      }
      return
    }

    setSubmitting(true)
    try {
      await userService.updateUser({
        gender,
        title: TITLE_LIST[titleIndex],
        nickname,
        birthday,
        phone,
        mail: mail || '',
        region: Array.isArray(region) ? region : [],
      })

      await useUserStore.getState().fetchUserInfo()
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 400)
    } catch {
      Taro.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View>
      {/* 背景 */}
      <View className={styles.splashContainer}>
        <View
          className={styles.splashImage}
          style={{ backgroundColor: '#e8e8e8' }}
        />
      </View>

      {/* 遮罩 + 弹窗 */}
      <View className={styles.formPopupMask}>
        <View className={styles.formPopup}>
          {/* 关闭按钮 */}
          <View className={styles.closeBtn} onClick={handleClose}>×</View>

          {/* Logo */}
          <View className={styles.logo}>
            <Image className={styles.logoImage} src={logoImg} />
          </View>

          {/* 性别选择 */}
          <View className={styles.sexSelection}>
            <View className={`${styles.item} ${styles.leftItem}`}>
              <View className={styles.sex} onClick={() => setGender('female')}>
                <View className={styles.productCheckbox}>
                  <Image
                    className={styles.productCheckboxImage}
                    src={gender === 'female' ? selectedIcon : notSelectedIcon}
                  />
                </View>
                <Text className={styles.itemText}>女士</Text>
              </View>
            </View>

            <View className={`${styles.item} ${styles.rightItem}`}>
              <View className={styles.sex} onClick={() => setGender('male')}>
                <View className={styles.productCheckbox}>
                  <Image
                    className={styles.productCheckboxImage}
                    src={gender === 'male' ? selectedIcon : notSelectedIcon}
                  />
                </View>
                <Text className={styles.itemText}>男士</Text>
              </View>
            </View>
          </View>

          <Text className={styles.requiredField}>*必填项</Text>

          {/* 表单 */}
          {/* 称谓 */}
          <View className={styles.formItem}>
            <Picker
              mode='selector'
              range={TITLE_LIST}
              value={titleIndex}
              onChange={handleTitleChange}
            >
              <View className={`${styles.inputContainer} ${errors.title ? styles.notCorrect : ''}`}>
                <View className={styles.pickerView}>{TITLE_LIST[titleIndex]}</View>
              </View>
            </Picker>
          </View>

          {/* 昵称 */}
          <View className={styles.formItem}>
            <Input
              className={`${styles.inputContainer} ${errors.nickname ? styles.notCorrect : ''}`}
              type='text'
              placeholder={nicknamePlaceholder}
              placeholderStyle={nicknamePlaceholderStyle}
              value={nickname}
              onInput={handleNicknameInput}
            />
          </View>

          {/* 生日 */}
          <View className={styles.formItem}>
            <Picker
              mode='date'
              value={birthday}
              start='1900-01-01'
              end='2100-12-31'
              onChange={handleBirthdayChange}
            >
              <View className={styles.inputContainer}>
                <View className={styles.pickerView}>{birthday || '请选择生日'}</View>
              </View>
            </Picker>
          </View>

          {/* 电话 */}
          <View className={styles.formItem}>
            <Input
              className={`${styles.inputContainer} ${errors.phone ? styles.notCorrect : ''}`}
              type='number'
              placeholder={phonePlaceholder}
              placeholderStyle={phonePlaceholderStyle}
              value={phone}
              onInput={handlePhoneInput}
            />
          </View>

          {/* 邮箱 */}
          <View className={styles.formItem}>
            <Input
              className={`${styles.inputContainer} ${errors.mail ? styles.notCorrect : ''}`}
              type='text'
              placeholder={mailPlaceholder}
              placeholderStyle={mailPlaceholderStyle}
              value={mail}
              onInput={handleMailInput}
            />
          </View>

          {/* 地区 */}
          <View className={styles.formItem}>
            <Picker
              mode='region'
              value={region}
              onChange={handleRegionChange}
            >
              <View className={styles.inputContainer}>
                <View className={styles.pickerView}>
                  {region[0]} - {region[1]} - {region[2]}
                </View>
              </View>
            </Picker>
          </View>

          {/* 前往编辑地址信息 */}
          <View className={styles.formItem}>
            <View className={styles.formItemEditAddress} onClick={handleEditAddress}>
              前往编辑地址信息
            </View>
          </View>

          {/* 协议 & 提交 */}
          <View className={styles.authBtn}>
            <View className={styles.auth}>
              <View className={styles.authCheckBox} onClick={() => setAuth(!auth)}>
                <Image
                  className={styles.authCheckBoxImage}
                  src={auth ? selectedIcon : notSelectedIcon}
                />
              </View>
              <Text className={styles.otherText}>*请确认您已阅读并同意我们的</Text>
              <View className={styles.privacyPolicy}>
                <Text>隐私条例</Text>
              </View>
              <Text className={styles.otherText}>和</Text>
              <View className={styles.userAgreement}>
                <Text>用户协议</Text>
              </View>
            </View>

            <View className={styles.submitBtn}>
              <Button className={styles.submitBtnInner} onClick={handleSubmit}>
                立即注册
              </Button>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
