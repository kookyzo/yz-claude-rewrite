# Phase 01: 项目初始化

## 目标

创建 Taro 4.x + React + TypeScript 项目骨架，配置云开发环境，复制云函数，确保项目能在微信开发者工具中正常编译运行。

## 前置依赖

- Node.js >= 18
- npm
- 微信开发者工具（最新稳定版）
- Taro CLI：`npm install -g @tarojs/cli`

## 当前状态

Taro 项目已通过 `npx @tarojs/cli init yz` 手动初始化，模板为 react-NutUI + TypeScript + Sass + Vite。生成的 `yz/` 目录中的文件需要移动到项目根目录。已安装的关键依赖：
- `@tarojs/taro: 4.1.10`
- `@tarojs/vite-runner: 4.1.10`（Vite 构建）
- `@nutui/nutui-react-taro: ^2.6.14`（NutUI 组件库）
- `react: ^18.0.0`、`typescript: ^5.1.0`、`sass: ^1.60.0`

尚未安装：Zustand

## 旧代码摘要

### app.js（入口）

```javascript
// 云开发初始化
wx.cloud.init({
  env: 'cloud1-9glm8muj52815539',
  traceUser: true
});
```

- `globalData.userInfo = null`
- `onLaunch` 中调用 `wx.login()` 获取 code（但未发送到后端）
- 本地存储 logs 数组用于调试

### app.json（路由配置）

- 33 个页面路由（含测试页）
- 自定义 TabBar：`"custom": true`
- 4 个 Tab：home、Category、Shopping_Cart、My
- 全局组件引用：FloatPopup、TopBar、TopBarWithBack
- 窗口配置：`navigationStyle: "custom"`（全局自定义导航栏）

### project.config.json

- AppID: `wxfe20c0865a438545`
- 云函数目录: `cloudfunctions/`
- 编译类型: `miniprogram`

## 产出文件清单

```
yz-claude-rewrite/
├── config/
│   ├── index.ts              # Taro 构建主配置
│   ├── dev.ts                # 开发环境配置
│   └── prod.ts               # 生产环境配置
├── src/
│   ├── app.ts                # 入口文件（云开发初始化）
│   ├── app.config.ts         # 页面路由 & TabBar 配置
│   ├── app.scss              # 全局样式
│   └── pages/
│       └── home/
│           ├── index.tsx      # 占位首页
│           ├── index.config.ts
│           └── index.module.scss
├── cloudfunctions/            # 从旧项目复制的云函数（28 个）
├── project.config.json        # 微信项目配置
├── tsconfig.json
├── package.json
├── .eslintrc
└── .prettierrc
```

## 实现要求

### Step 1: 移动 yz/ 目录内容到项目根目录

Taro 项目已在 `yz/` 子目录中初始化完成（Vite + NutUI 模板）。需要将其内容移动到项目根目录：

```bash
# 移动 yz/ 中的所有文件和目录到根目录（注意不要覆盖 SPEC.md、specs/、legacy_ro/ 等已有文件）
cp -r yz/config yz/src yz/babel.config.js yz/tsconfig.json yz/project.config.json yz/.eslintrc yz/.editorconfig ./
cp yz/package.json ./package.json
cp -r yz/node_modules ./node_modules
# 移动完成后删除 yz/ 目录
rm -rf yz/
```

### Step 2: 安装额外依赖

```bash
# 状态管理（含持久化中间件）
npm install zustand
```

### Step 3: 配置 `project.config.json`

```json
{
  "miniprogramRoot": "dist/",
  "projectname": "yzheng-taro",
  "description": "YZHENG 珠宝电商小程序（Taro React 重构）",
  "appid": "wxfe20c0865a438545",
  "setting": {
    "urlCheck": false,
    "es6": false,
    "enhance": true,
    "compileHotReLoad": true,
    "postcss": false,
    "minified": false,
    "babelSetting": {
      "ignore": [],
      "disablePlugins": [],
      "outputPath": ""
    }
  },
  "compileType": "miniprogram",
  "cloudfunctionRoot": "cloudfunctions/",
  "condition": {}
}
```

### Step 4: 配置 `src/app.ts`（云开发初始化）

```typescript
import Taro from '@tarojs/taro'
import { PropsWithChildren } from 'react'
import './app.scss'

function App({ children }: PropsWithChildren) {
  Taro.cloud.init({
    env: 'cloud1-9glm8muj52815539',
    traceUser: true,
  })
  return children
}

export default App
```

### Step 5: 配置 `src/app.config.ts`（初始路由）

```typescript
export default defineAppConfig({
  pages: [
    'pages/splash/index',
    'pages/home/index',
    'pages/category/index',
    'pages/cart/index',
    'pages/my/index',
    'pages/product-detail/index',
  ],
  subPackages: [
    {
      root: 'pages-sub',
      pages: [
        'series-detail/index',
        'series-promotion/index',
        'payment/index',
        'payment-failed/index',
        'payment-select-address/index',
        'register/index',
        'edit-info/index',
        'address-list/index',
        'address-edit/index',
        'order-list/index',
        'after-sales/index',
        'after-sales-detail/index',
        'refund/index',
        'return-exchange-detail/index',
        'reservation/index',
        'reservation-normal/index',
        'reservation-change/index',
        'reservation-success/index',
        'reservation-easy/index',
        'wishlist/index',
        'consultation/index',
        'privacy-policy/index',
        'user-agreement/index',
        'product-cms/index',
      ],
    },
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'YZHENG',
    navigationBarTextStyle: 'black',
    navigationStyle: 'custom',
  },
  tabBar: {
    custom: true,
    color: '#999999',
    selectedColor: '#000000',
    backgroundColor: '#ffffff',
    list: [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/category/index', text: '分类' },
      { pagePath: 'pages/cart/index', text: '购物车' },
      { pagePath: 'pages/my/index', text: '我的' },
    ],
  },
})
```

### Step 6: 配置 Taro 构建 `config/index.ts`

在 plugins 数组中确认云开发插件（Taro 4.x 内置支持微信云开发，无需额外插件）。关键配置项：

```typescript
// config/index.ts
const config = {
  projectName: 'yzheng-taro',
  date: '2025-01-01',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {},
  },
  framework: 'react',
  compiler: 'vite',
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: {
        enable: true,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
  },
}
```

### Step 7: 复制云函数

从旧项目复制 28 个云函数到新项目 `cloudfunctions/` 目录，排除备份/副本：

```bash
# 需要复制的云函数列表（28 个）
auto-cancel-orders
bindPhoneNumber
generate-qrcode
get-banners
get-product
getProduct
getUserInfo
login
login-easy
manage-address
manage-banner
manage-cart
manage-category
manage-material
manage-order
manage-order-easy
manage-recommendations
manage-reservation
manage-series
manage-size
manage-subseries
manage-user
manage-wish
refund
reservation-change
reservation-easy
sign_up
update-product
updateUserInfo
wxpayFunctions
```

**排除：**
- `bindPhoneNumber - 副本`
- `get-product备份`
- `manage-cart - 副本`
- `manage-activity`（未使用）

### Step 8: 创建目录骨架

```bash
mkdir -p src/types src/services src/stores src/hooks src/utils src/constants
mkdir -p src/components src/assets/icons src/assets/images
mkdir -p src/custom-tab-bar src/pages-sub
```

### Step 9: 配置 `tsconfig.json`

确保开启 strict mode，并配置路径别名：

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/", "types/"],
  "compileOnSave": false
}
```

### Step 10: 全局样式 `src/app.scss`

```scss
// 全局字体
page {
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 28px;
  color: #333;
  background-color: #f5f5f5;
}

// 隐藏滚动条
::-webkit-scrollbar {
  display: none;
}
```

## 验收标准

1. `npm run build:weapp` 编译成功，无报错
2. 微信开发者工具中能打开项目，显示占位首页
3. 控制台无云开发初始化错误
4. `cloudfunctions/` 目录包含 28 个云函数（可在开发者工具云开发面板中确认）
5. 目录骨架完整：types/、services/、stores/、hooks/、utils/、constants/、components/、pages-sub/ 均已创建
6. TypeScript strict mode 生效（故意写类型错误能报错）
7. SCSS Modules 生效（`.module.scss` 文件能正常导入）
8. Vite 构建正常工作（`config/index.ts` 中 `compiler: 'vite'`）
9. NutUI 组件可正常导入使用
