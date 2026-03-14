const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cloudvoyager', {
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (data) => ipcRenderer.invoke('config:save', data),
    loadKey: (key) => ipcRenderer.invoke('config:load-key', key),
    saveKey: (key, value) => ipcRenderer.invoke('config:save-key', key, value)
  },
  cli: {
    run: (command, args) => ipcRenderer.invoke('cli:run', command, args),
    cancel: () => ipcRenderer.invoke('cli:cancel'),
    onLog: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('cli:log', handler);
      return () => ipcRenderer.removeListener('cli:log', handler);
    },
    onExit: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('cli:exit', handler);
      return () => ipcRenderer.removeListener('cli:exit', handler);
    }
  },
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
    selectFile: () => ipcRenderer.invoke('dialog:select-file')
  },
  reports: {
    openFolder: (dirPath) => ipcRenderer.invoke('reports:open-folder', dirPath),
    list: (dirPath) => ipcRenderer.invoke('reports:list', dirPath)
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getResourcesPath: () => ipcRenderer.invoke('app:get-resources-path'),
    getDefaultReportsDir: () => ipcRenderer.invoke('app:get-default-reports-dir')
  }
});
