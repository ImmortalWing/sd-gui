// 预加载脚本
// 检查是否在Electron环境中
let isElectron = false;
let contextBridge, ipcRenderer;

try {
  // 检查window.electron是否已存在
  if (window && window.electron) {
    isElectron = true;
    console.log('通过window.electron检测到Electron环境');
  } else {
    // 尝试require electron
    const electron = require('electron');
    if (electron) {
      isElectron = true;
      contextBridge = electron.contextBridge;
      ipcRenderer = electron.ipcRenderer;
      console.log('通过require检测到Electron环境');
    }
  }
} catch (e) {
  console.log('不在Electron环境中运行，无法require electron模块');
}

if (isElectron && contextBridge && ipcRenderer) {
  // 设置暴露给渲染进程的API
  contextBridge.exposeInMainWorld('electron', {
    // IPC通信相关API
    ipcRenderer: {
      invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
      on: (channel, listener) => {
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
      },
      once: (channel, listener) => ipcRenderer.once(channel, listener),
      removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
      removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
    },

    // SD启动器相关API
    sdLauncher: {
      launch: (options) => ipcRenderer.invoke('sd:launch', options),
      stop: () => ipcRenderer.invoke('sd:stop'),
      getStatus: () => ipcRenderer.invoke('sd:status'),
      onLog: (callback) => {
        const subscription = (event, log) => callback(log);
        ipcRenderer.on('sd:log', subscription);
        return () => ipcRenderer.removeListener('sd:log', subscription);
      },
      onStatusChange: (callback) => {
        const subscription = (event, status) => callback(status);
        ipcRenderer.on('sd:stopped', subscription);
        return () => ipcRenderer.removeListener('sd:stopped', subscription);
      },
      onStarted: (callback) => {
        const subscription = (event, status) => callback(status);
        ipcRenderer.on('sd:started', subscription);
        return () => ipcRenderer.removeListener('sd:started', subscription);
      },
      onError: (callback) => {
        const subscription = (event, error) => callback(error);
        ipcRenderer.on('sd:error', subscription);
        return () => ipcRenderer.removeListener('sd:error', subscription);
      },
      removeAllListeners: () => {
        ipcRenderer.removeAllListeners('sd:log');
        ipcRenderer.removeAllListeners('sd:stopped');
        ipcRenderer.removeAllListeners('sd:started');
        ipcRenderer.removeAllListeners('sd:error');
      }
    },

    // 配置相关API
    config: {
      get: (key) => ipcRenderer.invoke('getConfig', key),
      set: (key, value) => ipcRenderer.invoke('setConfig', key, value),
      setSdPath: (path) => ipcRenderer.invoke('configSdPath', path),
      setPythonPath: (path) => ipcRenderer.invoke('configPythonPath', path),
      validate: (config) => ipcRenderer.invoke('validateConfig', config),
      backup: () => ipcRenderer.invoke('backupConfig'),
      restore: (timestamp) => ipcRenderer.invoke('restoreConfig', timestamp),
      getBackups: () => ipcRenderer.invoke('getConfigBackups'),
      deleteBackup: (timestamp) => ipcRenderer.invoke('deleteConfigBackup', timestamp)
    },
    
    // 添加模型管理API
    modelManager: {
      list: () => ipcRenderer.invoke('models:list'),
      import: () => ipcRenderer.invoke('models:import'),
      delete: (modelName) => ipcRenderer.invoke('models:delete', modelName),
      setDefault: (modelName) => ipcRenderer.invoke('models:setDefault', modelName),
      configDir: () => ipcRenderer.invoke('models:configDir')
    },
    
    // 添加Python环境管理API
    pythonEnv: {
      selectPythonPath: () => ipcRenderer.invoke('pythonEnv:selectPath'),
      checkPythonVersion: (path) => ipcRenderer.invoke('pythonEnv:checkVersion', path),
      listPackages: (path) => ipcRenderer.invoke('pythonEnv:listPackages', path),
      installPackage: (pythonPath, pkgName, pkgVersion) => 
        ipcRenderer.invoke('pythonEnv:installPackage', { pythonPath, pkgName, pkgVersion }),
      installPytorch: (pythonPath, cudaVersion) => 
        ipcRenderer.invoke('pythonEnv:installPytorch', { pythonPath, cudaVersion }),
      getVenvList: () => ipcRenderer.invoke('pythonEnv:getVenvList'),
      createVenv: (pythonPath) => ipcRenderer.invoke('pythonEnv:createVenv', pythonPath),
      activateVenv: (venvPath) => ipcRenderer.invoke('pythonEnv:activateVenv', venvPath),
      deleteVenv: (venvPath) => ipcRenderer.invoke('pythonEnv:deleteVenv', venvPath)
    },
    
    // 系统信息API
    system: {
      getInfo: () => ({
        os: process.platform,
        version: os.release(),
        cpu: os.cpus()[0].model,
        memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))}GB`,
        gpu: 'N/A' // 需要额外的模块来获取GPU信息
      })
    }
  });

  // 设置Electron标识
  window.isElectron = true;
  console.log('在Electron环境中运行，已设置API');
} else {
  console.log('不在Electron环境中运行');
  
  // 为非Electron环境提供mock API，避免报错
  window.electron = {
    ipcRenderer: {
      invoke: (channel, ...args) => {
        console.log(`Mock ipcRenderer.invoke 被调用: ${channel}`, args);
        
        // 为getSDStatus提供特殊的mock实现
        if (channel === 'getSDStatus') {
          return Promise.resolve({ isRunning: false });
        }
        
        return Promise.resolve(null);
      },
      on: () => () => {},
      once: () => {},
      removeListener: () => {},
      removeAllListeners: () => {}
    },
    sdLauncher: {
      launch: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      stop: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      getStatus: () => Promise.resolve({ isRunning: false }),
      onLog: () => () => {},
      onStatusChange: () => () => {},
      onStarted: () => () => {},
      onError: () => () => {},
      removeAllListeners: () => {}
    },
    config: {
      get: (key) => {
        console.log(`Mock config.get 被调用: ${key}`);
        // 为常用配置项返回默认值
        if (key === 'sdPath') return Promise.resolve('');
        if (key === 'modelsPath') return Promise.resolve('');
        if (key === 'launchParams') return Promise.resolve({
          port: 7860,
          lowVram: false,
          enableXformers: true,
          autoLaunchBrowser: true
        });
        if (key === 'uiSettings') return Promise.resolve({
          theme: 'light',
          autoStart: false
        });
        return Promise.resolve(null);
      },
      set: () => Promise.resolve(true),
      setSdPath: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      setPythonPath: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      validate: () => Promise.resolve({ isValid: true, errors: [] }),
      backup: () => Promise.resolve(true),
      restore: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      getBackups: () => Promise.resolve([]),
      deleteBackup: () => Promise.resolve({ success: false, error: '非Electron环境' })
    },
    
    // 添加模型管理模拟API
    modelManager: {
      list: () => Promise.resolve([]),
      import: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      delete: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      setDefault: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      configDir: () => Promise.resolve({ success: false, error: '非Electron环境' })
    },
    
    // 添加Python环境管理模拟API
    pythonEnv: {
      selectPythonPath: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      checkPythonVersion: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      listPackages: () => Promise.resolve({ success: false, packages: [], error: '非Electron环境' }),
      installPackage: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      installPytorch: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      getVenvList: () => Promise.resolve({ success: false, venvs: [], error: '非Electron环境' }),
      createVenv: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      activateVenv: () => Promise.resolve({ success: false, error: '非Electron环境' }),
      deleteVenv: () => Promise.resolve({ success: false, error: '非Electron环境' })
    },
    
    // 系统信息模拟API
    system: {
      getInfo: () => ({
        os: '未知',
        version: '未知',
        cpu: '未知',
        memory: '未知',
        gpu: '未知'
      })
    }
  };
  
  window.isElectron = false;
}

console.log('预加载脚本已加载');

// 如果在Electron环境中，可以在这里设置与主进程的通信
if (window.isElectron) {
    console.log('在Electron环境中运行');
} 