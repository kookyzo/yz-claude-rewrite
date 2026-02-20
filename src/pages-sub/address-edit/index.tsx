import { useState } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import FloatPopup from '@/components/FloatPopup'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import { useAuth } from '@/hooks/useAuth'
import * as addressService from '@/services/address.service'
import * as userService from '@/services/user.service'
import { isNotEmpty } from '@/utils/validate'
import styles from './index.module.scss'

const DEFAULT_REGION = ['请', '选择', '地区']
const DIRECT_CITIES = ['北京市', '天津市', '上海市', '重庆市']

function parseAddress(addr: string): { region: string[]; detail: string } | null {
  const rawAddress = (addr || '').replace(/\s/g, '')
  if (!rawAddress) return null

  const provinceMatch = rawAddress.match(
    /^(北京市|天津市|上海市|重庆市|香港特别行政区|澳门特别行政区|内蒙古自治区|广西壮族自治区|宁夏回族自治区|新疆维吾尔自治区|西藏自治区|.+?省|.+?自治区)/
  )
  if (!provinceMatch) return null

  const province = provinceMatch[1]
  let remain = rawAddress.slice(province.length)

  let city = ''
  if (DIRECT_CITIES.includes(province)) {
    city = province
  } else if (province === '香港特别行政区' || province === '澳门特别行政区') {
    city = province
  } else {
    const cityMatch = remain.match(/^(.+?市|.+?自治州|.+?地区|.+?盟)/)
    if (cityMatch) {
      city = cityMatch[1]
      remain = remain.slice(city.length)
    }
  }

  const districtMatch = remain.match(/^(.+?(区|县|市|旗))/)
  const district = districtMatch ? districtMatch[1] : ''
  if (district) {
    remain = remain.slice(district.length)
  }

  if (province && city && district) {
    return { region: [province, city, district], detail: remain }
  }

  return null
}

const isRegionSelected = (region: string[]) => {
  return (
    region.length === 3 &&
    region.every((item) => !!item) &&
    region.join('-') !== DEFAULT_REGION.join('-')
  )
}

export default function AddressEdit() {
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const { ensureLogin } = useAuth()
  const topOffset = statusBarHeight + navBarHeight

  const [addressId, setAddressId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState<string[]>([...DEFAULT_REGION])
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

  const ensureLocationPermission = async () => {
    const settingRes = await Taro.getSetting()
    const authState = settingRes.authSetting?.['scope.userLocation']

    if (authState === true) return true

    if (authState === false) {
      Taro.showModal({
        title: '需要位置权限',
        content: '请在设置中开启位置权限',
        confirmText: '去设置',
        success: (modalRes) => {
          if (modalRes.confirm) Taro.openSetting({})
        },
      })
      return false
    }

    try {
      await Taro.authorize({ scope: 'scope.userLocation' })
      return true
    } catch {
      Taro.showModal({
        title: '需要位置权限',
        content: '请在设置中开启位置权限',
        confirmText: '去设置',
        success: (modalRes) => {
          if (modalRes.confirm) Taro.openSetting({})
        },
      })
      return false
    }
  }

  const fillAddressFromLocation = (locationRes: any) => {
    const combined = `${locationRes?.address || ''}${locationRes?.name || ''}`
    if (!combined) {
      Taro.showToast({ title: '定位失败，请手动选择', icon: 'none' })
      return
    }

    const parsed = parseAddress(combined)
    if (parsed) {
      setRegion(parsed.region)
      adjustRegionFontSize(parsed.region)
      setAddress(parsed.detail || locationRes?.name || '')
      setErrors((prev) => ({ ...prev, address: false }))
      return
    }

    if (locationRes?.name) {
      setAddress(locationRes.name)
      setErrors((prev) => ({ ...prev, address: false }))
      Taro.showToast({ title: '已填充详细地址，请手动选择地区', icon: 'none' })
      return
    }

    Taro.showToast({ title: '定位失败，请手动选择', icon: 'none' })
  }

  useLoad((params) => {
    ensureLogin().then(async () => {
      const editingId = params?.id || params?.addressId
      if (!editingId) return

      setAddressId(editingId)
      try {
        const userRes = await userService.getUserInfo()
        if (userRes.code !== 200 || !userRes.data) return

        const res = await addressService.listAddresses(userRes.data._id)
        if (res.code === 200 && res.data) {
          const list = Array.isArray(res.data) ? res.data : (res.data as any).items || []
          const detail = list.find((a) => String(a._id) === String(editingId))
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
    const value = e.detail.value || ''
    setName(value)
    return value
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
    const value = e.detail.value || ''
    setAddress(value)
    return value
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
    const hasPermission = await ensureLocationPermission()
    if (!hasPermission) return

    try {
      let chooseParams: { latitude?: number; longitude?: number } = {}
      try {
        const location = await Taro.getLocation({ type: 'gcj02' })
        chooseParams = {
          latitude: location.latitude,
          longitude: location.longitude,
        }
      } catch {
        // getLocation 失败时仍尝试拉起地图选点，避免直接失败
      }

      const res = await Taro.chooseLocation(chooseParams)
      fillAddressFromLocation(res)
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
    const notRegion = !isRegionSelected(region)

    setErrors({ name: notName, phone: notPhone, address: notAddr })

    if (notName || notPhone || notAddr || notRegion) {
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
      if (notRegion) {
        Taro.showToast({ title: '请选择所在地区', icon: 'none' })
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
        isDefault,
      }

      if (addressId) {
        // Edit mode
        const editRes = await addressService.editAddress(addressId, payload)
        if (editRes.code !== 200) {
          throw new Error(editRes.message || '地址更新失败')
        }
      } else {
        // Add mode
        const addRes = await addressService.addAddress(userRes.data._id, payload)
        if (addRes.code !== 200) {
          throw new Error(addRes.message || '地址新增失败')
        }
      }

      Taro.showToast({ title: '保存成功', icon: 'success' })
      Taro.eventCenter.trigger('address:changed')
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '保存失败，请稍后重试', icon: 'none' })
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
              <View className={`${styles.inputContainer} ${errors.name ? styles.notCorrect : ''}`}>
                <Input
                  className={styles.inputField}
                  type='text'
                  placeholder={namePlaceholder}
                  placeholderStyle={namePlaceholderStyle}
                  value={name}
                  onInput={handleNameInput}
                  onFocus={handleNameFocus}
                />
              </View>
            </View>

            {/* 联系电话 */}
            <View className={styles.formItem}>
              <View className={`${styles.inputContainer} ${errors.phone ? styles.notCorrect : ''}`}>
                <Input
                  className={styles.inputField}
                  type='number'
                  placeholder={phonePlaceholder}
                  placeholderStyle={phonePlaceholderStyle}
                  value={phone}
                  onInput={handlePhoneInput}
                  onFocus={handlePhoneFocus}
                />
              </View>
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
              <View className={`${styles.inputContainer} ${errors.address ? styles.notCorrect : ''}`}>
                <Input
                  className={styles.inputField}
                  type='text'
                  placeholder={addressPlaceholder}
                  placeholderStyle={addressPlaceholderStyle}
                  value={address}
                  onInput={handleAddressInput}
                  onFocus={handleAddressFocus}
                />
              </View>
            </View>
          </View>

          {/* 设为默认 + 保存 */}
          <View className={styles.setDefaultBtn}>
            <View className={styles.setDefault} onClick={() => setIsDefault(!isDefault)}>
              <View className={`${styles.setDefaultCheckBox} ${isDefault ? styles.setDefaultCheckBoxChecked : ''}`} />
              <Text className={styles.otherText}>设为默认地址</Text>
            </View>
            <View className={styles.saveBtn} onClick={handleSubmit}>
              保存
            </View>
          </View>
        </View>
      </View>

      <FloatPopup
        visible={showFloatPopup}
        onClose={() => setShowFloatPopup(false)}
      />
    </View>
  )
}
