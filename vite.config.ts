import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/views/entry/SidePanelView.tsx'),
      name: 'VulnerabilitiesEntry',
      fileName: 'vulnerabilities',
      formats: ['es']
    },
    outDir: 'assets/bundles',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      external: ['vscode'],
      output: {
        globals: {
          vscode: 'vscode'
        }
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  },
  esbuild: {
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment'
  }
});
