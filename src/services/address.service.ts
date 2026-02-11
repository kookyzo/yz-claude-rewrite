import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse } from '@/types/api'
import type { Address } from '@/types/user'

/** 新增地址 */
export function addAddress(
  userId: string,
  data: Omit<Address, '_id' | 'userId' | 'isDefault'>
): Promise<CloudResponse> {
  return callCloudFunction('manage-address', {
    action: 'add',
    _userId: userId,
    addressData: data,
  })
}

/** 编辑地址 */
export function editAddress(
  addressId: string,
  data: Partial<Omit<Address, '_id' | 'userId'>>
): Promise<CloudResponse> {
  return callCloudFunction('manage-address', {
    action: 'edit',
    _addressId: addressId,
    addressData: data,
  })
}

/** 删除地址 */
export function deleteAddress(addressId: string): Promise<CloudResponse> {
  return callCloudFunction('manage-address', {
    action: 'delete',
    _addressId: addressId,
  })
}

/** 获取地址列表 */
export function listAddresses(userId: string): Promise<CloudResponse<Address[]>> {
  return callCloudFunction<Address[]>('manage-address', {
    action: 'list',
    _userId: userId,
  })
}

/** 设置默认地址 */
export function setDefaultAddress(addressId: string): Promise<CloudResponse> {
  return callCloudFunction('manage-address', {
    action: 'setDefault',
    _addressId: addressId,
  })
}

/** 获取默认地址 */
export function getDefaultAddress(userId: string): Promise<CloudResponse<Address>> {
  return callCloudFunction<Address>('manage-address', {
    action: 'getDefault',
    _userId: userId,
  })
}
