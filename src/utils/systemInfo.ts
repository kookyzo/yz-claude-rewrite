import Taro from '@tarojs/taro'

export interface MenuButtonRect {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export interface NormalizedSafeArea {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export interface NormalizedSystemInfo {
  statusBarHeight: number
  screenWidth: number
  screenHeight: number
  safeArea: NormalizedSafeArea
  pixelRatio: number
  platform: string
}

export const DEFAULT_MENU_BUTTON_RECT: MenuButtonRect = {
  top: 26,
  bottom: 58,
  left: 278,
  right: 365,
  width: 87,
  height: 32,
}

const DEFAULT_SYSTEM_INFO: NormalizedSystemInfo = {
  statusBarHeight: 20,
  screenWidth: 375,
  screenHeight: 667,
  safeArea: {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
  },
  pixelRatio: 2,
  platform: 'unknown',
}

type TaroSystemApi = {
  getWindowInfo?: () => any
  getDeviceInfo?: () => any
  getSystemInfoSync?: () => any
}

function getLegacySystemInfo(
  api: TaroSystemApi,
  needsLegacyFallback: boolean,
): any | null {
  if (!needsLegacyFallback || !api.getSystemInfoSync) return null

  try {
    return api.getSystemInfoSync()
  } catch {
    return null
  }
}

export function getNormalizedSystemInfo(): NormalizedSystemInfo {
  const api = Taro as unknown as TaroSystemApi

  let windowInfo: any = {}
  let deviceInfo: any = {}

  try {
    windowInfo = api.getWindowInfo?.() ?? {}
  } catch {
    windowInfo = {}
  }

  try {
    deviceInfo = api.getDeviceInfo?.() ?? {}
  } catch {
    deviceInfo = {}
  }

  const needsLegacyFallback = !api.getWindowInfo || !api.getDeviceInfo
  const legacyInfo = getLegacySystemInfo(api, needsLegacyFallback)

  const safeArea = windowInfo.safeArea ?? legacyInfo?.safeArea ?? {}

  return {
    statusBarHeight:
      windowInfo.statusBarHeight ??
      legacyInfo?.statusBarHeight ??
      DEFAULT_SYSTEM_INFO.statusBarHeight,
    screenWidth:
      windowInfo.screenWidth ??
      legacyInfo?.screenWidth ??
      DEFAULT_SYSTEM_INFO.screenWidth,
    screenHeight:
      windowInfo.screenHeight ??
      legacyInfo?.screenHeight ??
      DEFAULT_SYSTEM_INFO.screenHeight,
    safeArea: {
      top: safeArea.top ?? DEFAULT_SYSTEM_INFO.safeArea.top,
      bottom: safeArea.bottom ?? DEFAULT_SYSTEM_INFO.safeArea.bottom,
      left: safeArea.left ?? DEFAULT_SYSTEM_INFO.safeArea.left,
      right: safeArea.right ?? DEFAULT_SYSTEM_INFO.safeArea.right,
      width: safeArea.width ?? DEFAULT_SYSTEM_INFO.safeArea.width,
      height: safeArea.height ?? DEFAULT_SYSTEM_INFO.safeArea.height,
    },
    pixelRatio:
      windowInfo.pixelRatio ??
      legacyInfo?.pixelRatio ??
      DEFAULT_SYSTEM_INFO.pixelRatio,
    platform:
      deviceInfo.platform ??
      legacyInfo?.platform ??
      DEFAULT_SYSTEM_INFO.platform,
  }
}

export function getMenuButtonInfo(): {
  menuButtonRect: MenuButtonRect
  hasValidRect: boolean
} {
  const menuRect = Taro.getMenuButtonBoundingClientRect?.()

  const hasValidRect =
    !!menuRect &&
    menuRect.width > 0 &&
    menuRect.height > 0 &&
    menuRect.top >= 0 &&
    menuRect.bottom > menuRect.top

  if (!hasValidRect) {
    return {
      menuButtonRect: DEFAULT_MENU_BUTTON_RECT,
      hasValidRect: false,
    }
  }

  return {
    menuButtonRect: {
      top: menuRect.top,
      bottom: menuRect.bottom,
      left: menuRect.left,
      right: menuRect.right,
      width: menuRect.width,
      height: menuRect.height,
    },
    hasValidRect: true,
  }
}
