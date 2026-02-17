export interface User {
  _id: string;
  openId: string;
  userId: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  phone?: string;
  birthday?: string;
  gender?: string;
  title?: string;
  mail?: string;
  region?: string[] | string;
}

export interface Address {
  _id: string;
  userId: string;
  receiver: string;
  phone: string;
  provinceCity: string;
  detailAddress: string;
  isDefault: boolean;
}
