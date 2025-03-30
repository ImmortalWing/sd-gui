// 预加载脚本 - 为渲染进程提供安全的API访问
const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electron', {
  // 系统信息
  system: {
    getInfo: () => ({
      os: process.platform,
      version: os.release(),
      cpu: os.cpus()[0].model,
      memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
      gpu: 'N/A' // 在Windows上需要额外的模块来获取GPU信息
    })
  },
  
  // IPC通信 - 窗口控制
  windowControl: {
    minimize: () => ipcRenderer.send('app:minimize'),
    maximize: () => ipcRenderer.send('app:maximize'),
    close: () => ipcRenderer.send('app:close')
  },
  
  // 配置管理
  config: {
    get: (key) => ipcRenderer.invoke('getConfig', key),
    set: (key, value) => ipcRenderer.invoke('setConfig', key, value),
    setSdPath: (path) => ipcRenderer.invoke('configSdPath', path),
    setPythonPath: (path) => ipcRenderer.invoke('configPythonPath', path)
  },
  
  // SD启动器功能
  sdLauncher: {
    launch: (options) => ipcRenderer.invoke('sd:launch', options),
    stop: () => ipcRenderer.invoke('sd:stop'),
    getStatus: () => ipcRenderer.invoke('sd:status'),
    onLog: (callback) => {
      const subscription = (event, log) => callback(log);
      ipcRenderer.on('sd:log', subscription);
      return () => ipcRenderer.removeListener('sd:log', subscription);
    },
    onError: (callback) => {
      const subscription = (event, error) => callback(error);
      ipcRenderer.on('sd:error', subscription);
      return () => ipcRenderer.removeListener('sd:error', subscription);
    },
    onStarted: (callback) => {
      const subscription = (event, status) => callback(status);
      ipcRenderer.on('sd:started', subscription);
      return () => ipcRenderer.removeListener('sd:started', subscription);
    },
    onStopped: (callback) => {
      const subscription = (event, code) => callback(code);
      ipcRenderer.on('sd:stopped', subscription);
      return () => ipcRenderer.removeListener('sd:stopped', subscription);
    }
  },
  
  // 模型管理
  modelManager: {
    list: () => ipcRenderer.invoke('models:list'),
    import: () => ipcRenderer.invoke('models:import'),
    delete: (modelName) => ipcRenderer.invoke('models:delete', modelName),
    setDefault: (modelName) => ipcRenderer.invoke('models:setDefault', modelName),
    configDir: () => ipcRenderer.invoke('models:configDir')
  },
  
  ipcRenderer: {
    invoke: (channel, ...args) => {
      // 白名单通道
      const validChannels = [
        'txt2img',
        'img2img',
        'get-models',
        'save-image',
        'copy-to-clipboard',
        'open-directory'
      ];

      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }

      throw new Error(`不允许的IPC通道: ${channel}`);
    }
  }
}); 