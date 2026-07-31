import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import templateManifest from './scripts/template-manifest-plugin.js'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), templateManifest()],
})
