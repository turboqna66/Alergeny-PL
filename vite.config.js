import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base MUSI dokładnie odpowiadać nazwie repozytorium na GitHub
// repo: Alergeny-PL -> https://twojlogin.github.io/Alergeny-PL/
export default defineConfig({
  plugins: [react()],
  base: '/Alergeny-PL/',
})
