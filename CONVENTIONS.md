# YZHENG Taro React 重构 — 编码约定

> 每个实现会话必读此文件。精简版约定，完整设计见 SPEC.md。

## 核心原则

**查文档优先：遇到任何技术细节不确定的地方，必须先查官方文档确认，绝对不要凭经验猜测。** 这适用于所有技术栈，包括但不限于 Taro、微信云函数、Zustand、React、TypeScript、SCSS Modules 等。使用 context7 MCP 工具或 WebSearch/WebFetch 查询。

## 技术栈

- Taro 4.x + React 18 + TypeScript (strict) + Zustand + SCSS Modules
- 构建工具：Vite（`@tarojs/vite-runner`）
- 组件库：NutUI（`@nutui/nutui-react-taro`）— 优先使用 NutUI 提供的基础组件（Button、Popup、Dialog、Toast 等），自定义组件仅在 NutUI 无法满足时才手写
- 云函数调用：`Taro.cloud.callFunction()` 封装在 Service 层
- 包管理：npm

## Zustand 持久化

小程序环境无 `localStorage`，Zustand 持久化必须使用 Taro 存储 API：

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import Taro from '@tarojs/taro'

const taroStorage = {
  getItem: (name: string) => Taro.getStorageSync(name) || null,
  setItem: (name: string, value: string) => Taro.setStorageSync(name, value),
  removeItem: (name: string) => Taro.removeStorageSync(name),
}

export const useXxxStore = create(
  persist(
    (set, get) => ({ /* ... */ }),
    { name: 'xxx-storage', storage: createJSONStorage(() => taroStorage) }
  )
)
```

## 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| 页面目录 | kebab-case | `pages/product-detail/` |
| 组件目录 | PascalCase | `components/TopBar/` |
| Service | `xxx.service.ts` | `product.service.ts` |
| Store | `useXxxStore.ts` | `useCartStore.ts` |
| Hook | `useXxx.ts` | `useAuth.ts` |
| 接口/类型 | PascalCase | `interface CartItem {}` |
| CSS 类名 | camelCase | `styles.productCard` |
| 常量 | UPPER_SNAKE_CASE | `CLOUD_ENV_ID` |

## 文件结构模式

每个页面：`index.tsx` + `index.config.ts` + `index.module.scss`
每个组件：`index.tsx` + `index.module.scss`

## 页面模板

```tsx
import { View } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import styles from './index.module.scss'

export default function PageName() {
  useLoad(() => { /* 初始化 */ })
  return <View className={styles.container}>...</View>
}
```

## 组件模板

```tsx
import { View } from '@tarojs/components'
import styles from './index.module.scss'

interface XxxProps { /* ... */ }

export default function Xxx({ ...props }: XxxProps) {
  return <View className={styles.wrapper}>...</View>
}
```

## Service 调用模式

```tsx
import { callCloudFunction } from '@/services/cloud'
// 在 service 文件中：
export async function doSomething(params: Params) {
  return callCloudFunction<ResultType>('cloud-function-name', {
    action: 'actionName',
    data: params,
  })
}
```

## 路径别名

`@/` 指向 `src/`，如 `import { User } from '@/types/user'`

## 样式要点

- 使用 rpx 作为响应式单位
- SCSS Modules 自动作用域，用 `styles.className` 引用
- 全局样式仅在 `app.scss` 中定义
