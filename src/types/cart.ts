export interface CartItem {
  _cartItemId: string;
  skuId: string;
  spuId: string;
  quantity: number;
  checked: boolean;
  name: string;
  nameEN: string;
  price: number;
  image: string;
  material: string;
  size?: string;
}
