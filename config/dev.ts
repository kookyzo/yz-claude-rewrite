import type { UserConfigExport } from "@tarojs/cli";
export default {
  mini: {
    // Avoid dev-mode React alias rewriting `zustand/react` to `react`,
    // which breaks `import { create } from 'zustand'` at runtime.
    debugReact: true,
  },
  h5: {}
} satisfies UserConfigExport<'vite'>
