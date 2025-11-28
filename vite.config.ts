import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    build: {
      // 1. 调高警告阈值到 1000KB (可选)
      chunkSizeWarningLimit: 1000,
      
      // 2. 配置代码分割 (Manual Chunks)
      rollupOptions: {
        output: {
          manualChunks: {
            // 将 React 核心库单独打包
            'vendor-react': ['react', 'react-dom'],
            // 将 UI 组件库单独打包
            'vendor-ui': ['lucide-react', 'recharts'],
            // 将 Google AI SDK 单独打包 (这个包通常很大)
            'vendor-ai': ['@google/genai']
          }
        }
      }
    }
  };
});