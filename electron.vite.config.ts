import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const root = __dirname;

const sharedAlias = {
  '@shared': resolve(root, 'src/shared'),
  '@core': resolve(root, 'src/core'),
  '@conversion': resolve(root, 'src/conversion'),
  '@platform': resolve(root, 'src/platform'),
  '@main': resolve(root, 'src/main'),
  '@preload': resolve(root, 'src/preload'),
  '@renderer': resolve(root, 'src/renderer'),
};

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      sourcemap: true,
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: sharedAlias },
    build: {
      sourcemap: true,
    },
  },
  renderer: {
    plugins: [vue(), tailwindcss()],
    resolve: { alias: sharedAlias },
  },
});
