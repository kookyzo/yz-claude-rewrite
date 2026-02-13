import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse } from '@/types/api'
import type { Reservation } from '@/types/reservation'

/** 新增预约 */
export function addReservation(data: {
  name: string
  phone: string
  people: string
  date: string
  selectedTimes: string[]
}): Promise<CloudResponse> {
  return callCloudFunction('reservation-easy', {
    action: 'add',
    name: data.name,
    phone: data.phone,
    people: data.people,
    date: data.date,
    selectedTimes: data.selectedTimes,
    submissionCount: 0,
  })
}

/** 获取预约列表 */
export function listReservations(): Promise<CloudResponse<Reservation[]>> {
  return callCloudFunction<Reservation[]>('reservation-easy', {
    action: 'list',
  })
}

/** 获取预约详情 */
export function getReservation(id: string): Promise<CloudResponse<Reservation>> {
  return callCloudFunction<Reservation>('reservation-change', {
    action: 'get',
    reservationId: id,
  })
}

/** 更新预约 */
export function updateReservation(data: {
  reservationId: string
  name: string
  phone: string
  people: string
  date: string
  selectedTimes: string[]
}): Promise<CloudResponse> {
  return callCloudFunction('reservation-change', {
    action: 'update',
    ...data,
  })
}

/** 生成预约二维码 */
export function generateQRCode(
  content: string,
  type: string,
): Promise<CloudResponse<{ fileId?: string; qrCodeUrl?: string }>> {
  return callCloudFunction<{ fileId?: string; qrCodeUrl?: string }>(
    'generate-qrcode',
    { content, type },
  )
}
