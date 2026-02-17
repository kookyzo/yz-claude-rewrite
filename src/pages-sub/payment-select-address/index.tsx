import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import TopBarWithBack from '@/components/TopBarWithBack'
import FloatPopup from '@/components/FloatPopup'
import { useAuth } from '@/hooks/useAuth'
import * as addressService from '@/services/address.service'
import { navigateTo } from '@/utils/navigation'
import type { Address } from '@/types/user'
import styles from './index.module.scss'

export default function PaymentSelectAddress() {
  const { userId } = useAuth()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [isEmpty, setIsEmpty] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [defaultId, setDefaultId] = useState('')
  const [showFloatPopup, setShowFloatPopup] = useState(false)

  /* ---------- 加载地址列表 ---------- */

  const loadAddresses = async () => {
    if (!userId) {
      setAddresses([])
      setIsEmpty(true)
      return
    }
    try {
      const res = await addressService.listAddresses(userId)
      if (res.code === 200 && res.data) {
        const list = Array.isArray(res.data) ? res.data : []
        const defId = list.find(a => a.isDefault)?._id || list[0]?._id || ''
        setAddresses(list)
        setIsEmpty(list.length === 0)
        setDefaultId(defId)
        // 初次进入默认选中默认地址
        setSelectedId(prev => prev || defId)
      } else {
        setAddresses([])
        setIsEmpty(true)
      }
    } catch {
      Taro.showToast({ title: '加载地址失败，请重试', icon: 'none' })
    }
  }

  // 每次页面显示都刷新（支持从新增/编辑地址页返回后更新）
  useDidShow(() => {
    loadAddresses()
  })

  /* ---------- 选择地址 ---------- */

  const handleSelect = (id: string) => {
    setSelectedId(id)
  }

  /* ---------- 确认选择 ---------- */

  const handleConfirm = () => {
    const addr = addresses.find(a => a._id === selectedId)
    if (!addr) {
      Taro.showToast({ title: '请先选择一个地址', icon: 'none' })
      return
    }
    Taro.eventCenter.trigger('selectAddress', addr)
    Taro.navigateBack()
  }

  /* ---------- 新增 / 编辑 ---------- */

  const handleAddNew = () => {
    navigateTo('/pages-sub/address-edit/index')
  }

  const handleEdit = (e, id: string) => {
    e.stopPropagation()
    navigateTo(`/pages-sub/address-edit/index?addressId=${id}`)
  }

  return (
    <View className={styles.container}>
      <TopBarWithBack />

      {/* 顶部标题 + 添加新地址 */}
      {!isEmpty && (
        <View className={styles.top}>
          <Text className={styles.topText}>选择一个收货地址</Text>
          <Text className={styles.littleAddNew} onClick={handleAddNew}>+ 添加新地址</Text>
        </View>
      )}

      {/* 空态 */}
      {isEmpty ? (
        <View className={styles.addNewAddress} onClick={handleAddNew}>
          <Text>新增地址</Text>
        </View>
      ) : (
        <View>
          {/* 地址列表 */}
          <ScrollView className={styles.scrollView} scrollY>
            {addresses.map(addr => (
              <View
                key={addr._id}
                onClick={() => handleSelect(addr._id)}
              >
                <View className={styles.addressItem}>
                  <View className={selectedId === addr._id ? styles.addressItemSelected : ''}>
                    {/* 选择/默认 标签 */}
                    <View className={styles.badgeRow}>
                      {selectedId === addr._id && (
                        <View className={styles.badge}><Text>选择</Text></View>
                      )}
                      {defaultId === addr._id && (
                        <View className={styles.badge}><Text>默认</Text></View>
                      )}
                    </View>

                    {/* 地址详情 + 编辑 */}
                    <View className={styles.addressDetailEdit}>
                      <View className={styles.addressInfo}>
                        <View className={styles.namePhone}>
                          <Text className={styles.name}>{addr.receiver}</Text>
                          <Text className={styles.phone}>{addr.phone}</Text>
                        </View>
                        <Text className={styles.residence}>
                          {addr.provinceCity} {addr.detailAddress}
                        </Text>
                      </View>
                      <View className={styles.edit} onClick={(e) => handleEdit(e, addr._id)}>
                        <Text>编辑</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* 确定按钮 */}
          <View className={styles.confirm} onClick={handleConfirm}>
            <Text>确定</Text>
          </View>
          <View className={styles.bottomSpacer} />
        </View>
      )}

      <FloatPopup visible={showFloatPopup} onClose={() => setShowFloatPopup(false)} />
    </View>
  )
}
