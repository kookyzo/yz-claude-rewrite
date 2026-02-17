import { useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import FloatPopup from '@/components/FloatPopup'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import { callCloudFunction } from '@/services/cloud'
import * as userService from '@/services/user.service'
import { isValidPhone, isNotEmpty } from '@/utils/validate'
import styles from './index.module.scss'

export default function Refund() {
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const topOffset = statusBarHeight + navBarHeight

  const [orderId, setOrderId] = useState('')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isPopupShow, setIsPopupShow] = useState(false)

  useLoad((params) => {
    const oid = params?.orderId ? String(params.orderId) : ''
    setOrderId(oid)
  })

  const handlePhoneInput = (e) => {
    const val = e.detail.value.replace(/\D/g, '').slice(0, 11)
    setPhone(val)
  }

  const handleDescInput = (e) => {
    setDescription(e.detail.value || '')
  }

  const handleSubmit = async () => {
    if (!isNotEmpty(orderId)) {
      Taro.showToast({ title: '订单编号不能为空', icon: 'none' })
      return
    }
    if (!isNotEmpty(description)) {
      Taro.showToast({ title: '请填写问题描述', icon: 'none' })
      return
    }
    if (!isNotEmpty(phone)) {
      Taro.showToast({ title: '请填写联系方式', icon: 'none' })
      return
    }
    if (!isValidPhone(phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    try {
      setSubmitting(true)

      const userRes = await userService.getUserInfo()
      if (userRes.code !== 200 || !userRes.data?._id) {
        Taro.showToast({ title: '用户信息获取失败', icon: 'none' })
        return
      }

      const res = await callCloudFunction('refund', {
        action: 'create',
        data: {
          _userId: userRes.data._id,
          orderId: orderId.trim(),
          description: description.trim(),
          phone: phone.trim(),
          createTime: Date.now(),
        },
      })

      if (res.code === 200) {
        Taro.showToast({ title: '退款申请已提交', icon: 'success', duration: 2000 })
        setTimeout(() => {
          Taro.navigateBack()
        }, 2000)
      } else {
        Taro.showToast({ title: res.message || '提交失败，请重试', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '提交失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className={styles.page}>
      <TopBarWithBack />

      <View className={styles.container} style={{ marginTop: `${topOffset}px` }}>
        {/* 订单信息 */}
        <View className={styles.orderInfo}>
          <Text className={styles.orderTitle}>订单信息</Text>
          <View className={styles.orderInputSection}>
            <Text className={styles.inputLabel}>订单编号</Text>
            <Input
              className={styles.orderInput}
              type='text'
              value={orderId}
              disabled
              placeholder='订单编号'
            />
          </View>
        </View>

        {/* 问题描述 */}
        <View className={styles.descriptionSection}>
          <Text className={styles.descTitle}>问题描述</Text>
          <Textarea
            className={styles.descInput}
            placeholder='请详细描述退款原因，以便我们更好地为您处理'
            value={description}
            onInput={handleDescInput}
            maxlength={500}
          />
          <Text className={styles.charCount}>{description.length}/500</Text>
        </View>

        {/* 联系方式 */}
        <View className={styles.contactSection}>
          <Text className={styles.contactTitle}>联系方式</Text>
          <View className={styles.contactItem}>
            <Text className={styles.contactLabel}>手机号</Text>
            <Input
              className={styles.contactInput}
              type='number'
              value={phone}
              onInput={handlePhoneInput}
              placeholder='请输入手机号'
            />
          </View>
        </View>

        {/* 提交按钮 */}
        <View className={styles.submitSection}>
          <View
            className={`${styles.submitBtn} ${submitting ? styles.submitBtnDisabled : ''}`}
            onClick={submitting ? undefined : handleSubmit}
          >
            <Text>{submitting ? '提交中...' : '提交退款申请'}</Text>
          </View>
        </View>
      </View>

      <FloatPopup visible={isPopupShow} onClose={() => setIsPopupShow(false)} />
    </View>
  )
}
