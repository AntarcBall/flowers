import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        space: fileURLToPath(new URL('./index.html', import.meta.url)),
        garden: fileURLToPath(new URL('./garden.html', import.meta.url)),
      },
    },
  },
})
