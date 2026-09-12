import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC, type RendererApi } from '@shared/ipc';

const api: RendererApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.AppInfo),
  openFiles: () => ipcRenderer.invoke(IPC.OpenFiles),
  inspectFiles: (paths: string[]) => ipcRenderer.invoke(IPC.InspectFiles, paths),
  estimateCompression: (request) => ipcRenderer.invoke(IPC.EstimateCompression, request),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  startConversion: (request) => ipcRenderer.invoke(IPC.StartConversion, request),
  cancelJob: (jobId: string) => ipcRenderer.invoke(IPC.CancelJob, jobId),
  cancelAll: () => ipcRenderer.invoke(IPC.CancelAll),
  clearCompleted: () => ipcRenderer.invoke(IPC.ClearCompleted),
  revealOutput: (jobId: string) => ipcRenderer.invoke(IPC.RevealOutput, jobId),
  onQueueUpdated: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: Parameters<typeof listener>[0]) =>
      listener(snapshot);
    ipcRenderer.on(IPC.QueueUpdated, handler);
    return () => ipcRenderer.removeListener(IPC.QueueUpdated, handler);
  },
};

contextBridge.exposeInMainWorld('api', api);
