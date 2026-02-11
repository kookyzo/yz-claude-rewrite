import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { CartItem } from '@/types/cart'
import * as cartService from '@/services/cart.service'
import { useUserStore } from '@/stores/useUserStore'

function computeDerived(items: CartItem[]) {
  const checkedItems = items.filter((item) => item.checked)
  return {
    totalPrice: checkedItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    ),
    selectedCount: checkedItems.length,
    isAllChecked: items.length > 0 && items.every((item) => item.checked),
  }
}

interface CartState {
  items: CartItem[]
  loading: boolean
  totalPrice: number
  selectedCount: number
  isAllChecked: boolean

  fetchCart: () => Promise<void>
  toggleItem: (cartItemId: string, checked: boolean) => Promise<void>
  toggleAll: (checked: boolean) => Promise<void>
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>
  removeItem: (cartItemId: string) => Promise<void>
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  loading: false,
  totalPrice: 0,
  selectedCount: 0,
  isAllChecked: false,

  fetchCart: async () => {
    const userId = useUserStore.getState().userId
    if (!userId) return

    set({ loading: true })
    try {
      const res = await cartService.getCartItems(userId)
      if (res.code === 200 && res.data) {
        const items = res.data
        set({ items, loading: false, ...computeDerived(items) })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },

  toggleItem: async (cartItemId, checked) => {
    const { items } = get()
    const oldItems = [...items]

    // 1. 乐观更新 UI
    const newItems = items.map((item) =>
      item._cartItemId === cartItemId ? { ...item, checked } : item,
    )
    set({ items: newItems, ...computeDerived(newItems) })

    // 2. 后台同步
    try {
      const res = await cartService.toggleItemSelected(cartItemId, checked)
      // 3. 失败回滚
      if (res.code !== 200) {
        set({ items: oldItems, ...computeDerived(oldItems) })
        Taro.showToast({ title: res.message || '操作失败', icon: 'none' })
      }
    } catch {
      set({ items: oldItems, ...computeDerived(oldItems) })
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
  },

  toggleAll: async (checked) => {
    const { items } = get()
    const oldItems = [...items]
    const userId = useUserStore.getState().userId
    if (!userId) return

    // 1. 乐观更新 UI
    const newItems = items.map((item) => ({ ...item, checked }))
    set({ items: newItems, ...computeDerived(newItems) })

    // 2. 后台同步
    try {
      const res = await cartService.toggleAllSelected(userId, checked)
      // 3. 失败回滚
      if (res.code !== 200) {
        set({ items: oldItems, ...computeDerived(oldItems) })
        Taro.showToast({ title: res.message || '操作失败', icon: 'none' })
      }
    } catch {
      set({ items: oldItems, ...computeDerived(oldItems) })
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
  },

  updateQuantity: async (cartItemId, quantity) => {
    const { items } = get()
    const oldItems = [...items]

    // 1. 乐观更新 UI
    const newItems = items.map((item) =>
      item._cartItemId === cartItemId ? { ...item, quantity } : item,
    )
    set({ items: newItems, ...computeDerived(newItems) })

    // 2. 后台同步
    try {
      const res = await cartService.updateCartItemQty(cartItemId, quantity)
      // 3. 失败回滚
      if (res.code !== 200) {
        set({ items: oldItems, ...computeDerived(oldItems) })
        Taro.showToast({ title: res.message || '操作失败', icon: 'none' })
      }
    } catch {
      set({ items: oldItems, ...computeDerived(oldItems) })
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
  },

  removeItem: async (cartItemId) => {
    try {
      const res = await cartService.removeCartItem(cartItemId)
      if (res.code === 200) {
        await get().fetchCart()
      } else {
        Taro.showToast({ title: res.message || '删除失败', icon: 'none' })
      }
    } catch {
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' })
    }
  },
}))
