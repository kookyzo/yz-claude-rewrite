import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse } from '@/types/api'
import type { Address } from '@/types/user'

/** 新增地址 */
export function addAddress(
  userId: string,
  data: Pick<Address, 'receiver' | 'phone' | 'provinceCity' | 'detailAddress'> & {
    isDefault?: boolean
  }
): Promise<CloudResponse> {
  return callCloudFunction('manage-address', {
    action: 'add',
    data: {
      _userId: userId,
      addressData: data,
    },
  })
}

/** 编辑地址 */
export function editAddress(
  addressId: string,
  data: Partial<Omit<Address, '_id' | 'userId'>>
): Promise<CloudResponse> {
  return callCloudFunction('manage-address', {
    action: 'edit',
    data: {
      _addressId: addressId,
      addressData: data,
    },
  })
}

/** 删除地址 */
export function deleteAddress(addressId: string): Promise<CloudResponse> {
  return callCloudFunction('manage-address', {
    action: 'delete',
    data: {
      _addressId: addressId,
    },
  })
}

/** 获取地址列表 */
export function listAddresses(userId: string): Promise<CloudResponse<Address[]>> {
  return callCloudFunction<Address[]>('manage-address', {
    action: 'list',
    data: {
      _userId: userId,
    },
  })
}

/** 设置默认地址 */
export function setDefaultAddress(addressId: string): Promise<CloudResponse> {
  return callCloudFunction('manage-address', {
    action: 'setDefault',
    data: {
      _addressId: addressId,
    },
  })
}

/** 获取默认地址 */
export function getDefaultAddress(userId: string): Promise<CloudResponse<Address>> {
  return callCloudFunction<Address>('manage-address', {
    action: 'getDefault',
    data: {
      _userId: userId,
    },
  })
}
