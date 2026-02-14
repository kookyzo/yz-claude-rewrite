import type { UserConfigExport } from "@tarojs/cli";

export default {
  mini: {
    postcss: {
      cssModules: {
        enable: true,
        config: {
          namingPattern: 'module',
          generateScopedName: '[hash:base64:6]',
        },
      },
    },
    miniCssExtractPluginOption: {
      ignoreOrder: true,
    },
  },
  h5: {},
} satisfies UserConfigExport<'vite'>
