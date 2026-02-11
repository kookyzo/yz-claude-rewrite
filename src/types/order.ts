export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'shipping'
  | 'signed'
  | 'completed'
  | 'cancelled'
  | 'payment_failed'
  | 'refunding'
  | 'refunded';

export interface OrderItem {
  skuId: string;
  spuId: string;
  quantity: number;
  unitPrice: number;
  skuNameCN: string;
  skuNameEN: string;
  skuImage: string[];
  materialName?: string;
}

export interface Order {
  _id: string;
  orderNo: string;
  userId: string;
  addressId: string;
  totalAmount: number;
  status: OrderStatus;
  payMethod?: string;
  transactionId?: string;
  items: OrderItem[];
  createdAt: number;
  logisticsNo?: string;
}
