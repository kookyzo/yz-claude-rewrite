import Taro from '@tarojs/taro'

/** 导航到页面 */
export function navigateTo(url: string): void {
  Taro.navigateTo({ url })
}

/** 切换 Tab */
export function switchTab(url: string): void {
  Taro.switchTab({ url })
}

/** 返回上一页 */
export function navigateBack(delta = 1): void {
  Taro.navigateBack({ delta })
}

/** 重定向（替换当前页） */
export function redirectTo(url: string): void {
  Taro.redirectTo({ url })
}
