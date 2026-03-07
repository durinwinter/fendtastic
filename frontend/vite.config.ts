import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@react-three/fiber')) return 'r3f'
          if (id.includes('@react-three/drei')) return 'drei'
          if (id.includes('/three/examples/')) return 'three-examples'
          if (id.includes('/three/')) return 'three-core'
          if (id.includes('@mui') || id.includes('@emotion')) return 'mui'
          if (id.includes('@oicl') || id.includes('@lit')) return 'openbridge'
          return undefined
        },
      },
    },
  },
})
