/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

import type { RendererApi } from '@shared/ipc';

declare global {
  interface Window {
    api: RendererApi;
  }
}

export {};
