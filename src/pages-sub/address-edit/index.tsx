import { useState } from 'react'
import { View, Text, Input, Picker, Image } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import FloatPopup from '@/components/FloatPopup'
import FloatBtn from '@/components/FloatBtn'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import { useAuth } from '@/hooks/useAuth'
import * as addressService from '@/services/address.service'
import * as userService from '@/services/user.service'
import { isNotEmpty } from '@/utils/validate'
import styles from './index.module.scss'

const SELECTED_IMAGE = '/assets/icons/selected.png'
const NOT_SELECTED_IMAGE = '/assets/icons/not_selected.png'

function parseAddress(addr: string): { region: string[]; detail: string } | null {
  const provinceMatch = addr.match(/^(.+?省|.+?自治区|.+?市)/)
  const cityMatch = addr.match(/(省|自治区)(.+?市|.+?自治州|.+?地区|.+?盟)/)
  const districtMatch = addr.match(/(市|自治州|地区|盟)(.+?区|.+?县|.+?市|.+?旗)/)

  if (provinceMatch && cityMatch && districtMatch) {
    const province = provinceMatch[1]
    const city = cityMatch[2]
    const district = districtMatch[2]
    const detail = addr.replace(province, '').replace(city, '').replace(district, '')
    return { region: [province, city, district], detail }
  }
  return null
}

export default function AddressEdit() {
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const { ensureLogin } = useAuth()
  const topOffset = statusBarHeight + navBarHeight

  const [addressId, setAddressId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState<string[]>(['请', '选择', '地区'])
  const [regionFontSize, setRegionFontSize] = useState(28)
  const [address, setAddress] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showFloatPopup, setShowFloatPopup] = useState(false)

  const [errors, setErrors] = useState({ name: false, phone: false, address: false })
  const [namePlaceholder, setNamePlaceholder] = useState('收件人*')
  const [phonePlaceholder, setPhonePlaceholder] = useState('联系电话*')
  const [addressPlaceholder, setAddressPlaceholder] = useState('详细地址*')
  const [namePlaceholderStyle, setNamePlaceholderStyle] = useState('color: #999;')
  const [phonePlaceholderStyle, setPhonePlaceholderStyle] = useState('color: #999;')
  const [addressPlaceholderStyle, setAddressPlaceholderStyle] = useState('color: #999;')

  const adjustRegionFontSize = (r: string[]) => {
    const text = `${r[0]} - ${r[1]} - ${r[2]}`
    const estimatedWidth = text.length * 28
    const availableWidth = 500
    if (estimatedWidth > availableWidth) {
      setRegionFontSize(Math.max(20, Math.floor((availableWidth / estimatedWidth) * 28)))
    } else {
      setRegionFontSize(28)
    }
  }

  useLoad((params) => {
    ensureLogin().then(async () => {
      if (!params?.id) return

      setAddressId(params.id)
      try {
        const userRes = await userService.getUserInfo()
        if (userRes.code !== 200 || !userRes.data) return

        const res = await addressService.listAddresses(userRes.data._id)
        if (res.code === 200 && res.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data as any).items || []
          const detail = list.find((a) => String(a._id) === String(params.id))
          if (detail) {
            setName(detail.receiver || '')
            setPhone(detail.phone || '')
            setAddress(detail.detailAddress || '')
            setIsDefault(!!detail.isDefault)

            if (detail.provinceCity) {
              const parts = detail.provinceCity.split('-')
              const newRegion = parts.length >= 3
                ? parts.slice(0, 3)
                : parts.length === 2
                  ? [parts[0], parts[1], '']
                  : [parts[0], '', '']
              setRegion(newRegion)
              adjustRegionFontSize(newRegion)
            }
          }
        }
      } catch {
        Taro.showToast({ title: '获取地址失败', icon: 'none' })
      }
    })
  })

  const handleNameInput = (e) => {
    setName(e.detail.value)
  }

  const handleNameFocus = () => {
    setErrors((prev) => ({ ...prev, name: false }))
    setNamePlaceholder('收件人*')
    setNamePlaceholderStyle('color: #999;')
  }

  const handlePhoneInput = (e) => {
    const value = (e.detail.value || '').replace(/\D/g, '').slice(0, 11)
    setPhone(value)
    return value
  }

  const handlePhoneFocus = () => {
    setErrors((prev) => ({ ...prev, phone: false }))
    setPhonePlaceholder('联系电话*')
    setPhonePlaceholderStyle('color: #999;')
  }

  const handleAddressInput = (e) => {
    setAddress(e.detail.value)
  }

  const handleAddressFocus = () => {
    setErrors((prev) => ({ ...prev, address: false }))
    setAddressPlaceholder('详细地址*')
    setAddressPlaceholderStyle('color: #999;')
  }

  const handleRegionChange = (e) => {
    const newRegion = e.detail.value as string[]
    setRegion(newRegion)
    adjustRegionFontSize(newRegion)
  }

  const handleGetLocation = async () => {
    try {
      const res = await Taro.chooseLocation({})
      if (res.address) {
        const parsed = parseAddress(res.address)
        if (parsed) {
          setRegion(parsed.region)
          adjustRegionFontSize(parsed.region)
          setAddress(parsed.detail || res.name || '')
        } else {
          Taro.showToast({ title: '无法解析地址，请手动选择地区', icon: 'none' })
        }
      }
    } catch (err: any) {
      if (err?.errMsg?.includes('auth deny') || err?.errMsg?.includes('permission')) {
        Taro.showModal({
          title: '需要位置权限',
          content: '请在设置中开启位置权限',
          confirmText: '去设置',
          success: (modalRes) => {
            if (modalRes.confirm) Taro.openSetting({})
          },
        })
      } else if (!err?.errMsg?.includes('cancel')) {
        Taro.showToast({ title: '定位失败，请手动选择', icon: 'none' })
      }
    }
  }

  const handleSubmit = async () => {
    if (submitting) return

    const phoneReg = /^1\d{10}$/
    const notName = !isNotEmpty(name)
    const notPhone = !phoneReg.test(phone)
    const notAddr = !isNotEmpty(address)

    setErrors({ name: notName, phone: notPhone, address: notAddr })

    if (notName || notPhone || notAddr) {
      if (notName) {
        setNamePlaceholder('请输入正确的称谓*')
        setNamePlaceholderStyle('color:#CE1616;')
      }
      if (notPhone) {
        setPhonePlaceholder('请输入正确的电话号码*')
        setPhonePlaceholderStyle('color:#CE1616;')
      }
      if (notAddr) {
        setAddressPlaceholder('请输入详细地址*')
        setAddressPlaceholderStyle('color:#CE1616;')
      }
      return
    }

    setSubmitting(true)
    try {
      const provinceCity = region.filter(Boolean).join('-')
      const userRes = await userService.getUserInfo()
      if (userRes.code !== 200 || !userRes.data) {
        Taro.showToast({ title: '用户信息获取失败', icon: 'none' })
        return
      }

      const payload = {
        receiver: name,
        phone,
        provinceCity,
        detailAddress: address,
      }

      if (addressId) {
        // Edit mode
        await addressService.editAddress(addressId, {
          ...payload,
          isDefault,
        })
      } else {
        // Add mode
        const addRes = await addressService.addAddress(userRes.data._id, payload)
        // If set as default and add succeeded, call setDefaultAddress
        if (isDefault && addRes.code === 200 && addRes.data) {
          const newId = (addRes.data as any)._id || (addRes.data as any).id
          if (newId) {
            await addressService.setDefaultAddress(newId)
          }
        }
      }

      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 300)
    } catch {
      Taro.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className={styles.container}>
      <TopBarWithBack />
      <View style={{ marginTop: `${topOffset}px` }}>
        <View className={styles.enterInfoContainer}>
          <Text className={styles.requiredField}>*必填项</Text>

          <View className={styles.enterInfoForm}>
            {/* 收件人 */}
            <View className={styles.formItem}>
              <Input
                className={`${styles.inputContainer} ${errors.name ? styles.notCorrect : ''}`}
                type='text'
                placeholder={namePlaceholder}
                placeholderStyle={namePlaceholderStyle}
                value={name}
                onInput={handleNameInput}
                onFocus={handleNameFocus}
              />
            </View>

            {/* 联系电话 */}
            <View className={styles.formItem}>
              <Input
                className={`${styles.inputContainer} ${errors.phone ? styles.notCorrect : ''}`}
                type='number'
                placeholder={phonePlaceholder}
                placeholderStyle={phonePlaceholderStyle}
                value={phone}
                onInput={handlePhoneInput}
                onFocus={handlePhoneFocus}
              />
            </View>

            {/* 地区 */}
            <View className={styles.formItem}>
              <View className={styles.regionContainer}>
                <Picker
                  mode='region'
                  value={region}
                  onChange={handleRegionChange}
                  className={`${styles.inputContainer} ${styles.regionPicker}`}
                >
                  <View
                    className={styles.pickerView}
                    style={{ fontSize: `${regionFontSize}rpx` }}
                  >
                    {region[0]} - {region[1]} - {region[2]}
                  </View>
                </Picker>
                <View className={styles.locationBtn} onClick={handleGetLocation}>
                  一键定位
                </View>
              </View>
            </View>

            {/* 详细地址 */}
            <View className={styles.formItem}>
              <Input
                className={`${styles.inputContainer} ${errors.address ? styles.notCorrect : ''}`}
                type='text'
                placeholder={addressPlaceholder}
                placeholderStyle={addressPlaceholderStyle}
                value={address}
                onInput={handleAddressInput}
                onFocus={handleAddressFocus}
              />
            </View>
          </View>

          {/* 设为默认 + 保存 */}
          <View className={styles.setDefaultBtn}>
            <View className={styles.setDefault} onClick={() => setIsDefault(!isDefault)}>
              <View className={styles.setDefaultCheckBox}>
                <Image
                  className={styles.checkBoxImage}
                  src={isDefault ? SELECTED_IMAGE : NOT_SELECTED_IMAGE}
                />
              </View>
              <Text className={styles.otherText}>设为默认地址</Text>
            </View>
            <View className={styles.saveBtn} onClick={handleSubmit}>
              保存
            </View>
          </View>
        </View>
      </View>

      <FloatBtn onPress={() => setShowFloatPopup(true)} />
      <FloatPopup
        visible={showFloatPopup}
        onClose={() => setShowFloatPopup(false)}
      />
    </View>
  )
}
