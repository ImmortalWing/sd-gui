const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')
const sdLauncher = require('./ipcHandlers/sdLauncher')
const modelManager = require('./ipcHandlers/modelManager')
const pythonEnv = require('./ipcHandlers/pythonEnv')
const { setupIpcHandlers } = require('./apiHandler')
const remoteMain = require('@electron/remote/main')
const { exec } = require('child_process')

// 初始化remote模块
remoteMain.initialize()

// 初始化配置存储
const config = new Store({
  name: 'sd-launcher-config'
});

// 全局变量，存储主窗口引用
let mainWindow = null;

function createWindow() {
  // 创建主窗口
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Stable Diffusion Launcher',
    icon: path.join(__dirname, '../assets/icon.png'),
    frame: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: true,
      preload: path.join(__dirname, '../pages/preload.js')
    }
  })

  // 启用remote模块
  remoteMain.enable(mainWindow.webContents)

  // 初始化SD启动器
  sdLauncher.initialize(mainWindow);
  sdLauncher.setupIpcHandlers();
  
  // 初始化模型管理器
  modelManager.setupIpcHandlers();
  
  // 初始化Python环境管理器
  pythonEnv.setupIpcHandlers();
  
  // 处理窗口控制
  ipcMain.on('app:minimize', () => {
    mainWindow.minimize()
  })

  ipcMain.on('app:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.on('app:close', () => {
    mainWindow.close()
  })

  // 为渲染进程提供窗口控制API
  ipcMain.handle('minimizeWindow', () => {
    mainWindow.minimize();
    return true;
  });

  ipcMain.handle('maximizeWindow', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return true;
  });

  ipcMain.handle('closeWindow', () => {
    mainWindow.close();
    return true;
  });

  // 根据环境加载不同的页面
  const isDev = process.env.NODE_ENV === 'development'
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../pages/index.html'))
  }
}

// 获取配置
ipcMain.handle('getConfig', async (event, key) => {
  if (key) {
    return config.get(key);
  } else {
    return config.store;
  }
});

// 设置配置
ipcMain.handle('setConfig', async (event, key, value) => {
  config.set(key, value);
  return true;
});

// 配置SD路径
ipcMain.handle('configSdPath', async (event, sdPath) => {
  // 如果没有提供路径，打开选择目录对话框
  if (!sdPath) {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: '选择Stable Diffusion安装目录',
        properties: ['openDirectory']
      });
      
      if (canceled || filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      
      // 使用用户选择的路径
      sdPath = filePaths[0];
    } catch (error) {
      console.error('打开目录选择对话框失败:', error);
      return { success: false, error: '打开目录选择对话框失败: ' + error.message };
    }
  }
  
  // 验证路径
  if (!fs.existsSync(sdPath)) {
    return { success: false, error: '路径不存在' };
  }
  
  // 检查是否有效的SD安装
  if (!fs.existsSync(path.join(sdPath, 'webui.py')) && 
      !fs.existsSync(path.join(sdPath, 'launch.py'))) {
    return { success: false, error: '无效的Stable Diffusion安装路径' };
  }
  
  // 保存配置
  config.set('sdPath', sdPath);
  return { success: true, path: sdPath };
});

// 处理模型文件列表请求
ipcMain.handle('listModelFiles', async () => {
  try {
    const modelsDir = path.join(app.getPath('userData'), 'models');
    // 确保模型目录存在
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
    
    const files = fs.readdirSync(modelsDir);
    return files.map(fileName => {
      const filePath = path.join(modelsDir, fileName);
      const stats = fs.statSync(filePath);
      return {
        name: fileName,
        size: stats.size,
        mtime: stats.mtime
      };
    });
  } catch (error) {
    console.error('获取模型文件列表失败:', error);
    throw error;
  }
});

// 处理模型删除请求
ipcMain.handle('deleteModel', async (event, fileName) => {
  try {
    const modelsDir = path.join(app.getPath('userData'), 'models');
    const filePath = path.join(modelsDir, fileName);
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error('删除模型文件失败:', error);
    throw error;
  }
});

// 新增的IPC处理器
ipcMain.handle('path-exists', async (event, filePath) => {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    console.error('检查路径是否存在失败:', error);
    return false;
  }
});

ipcMain.handle('list-directory', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return { success: false, error: '目录不存在' };
    }
    
    const files = fs.readdirSync(dirPath);
    return { success: true, files };
  } catch (error) {
    console.error('列出目录内容失败:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-python-versions', async () => {
  try {
    const pythonCommands = ['python', 'python3', 'py'];
    const versions = [];
    
    for (const cmd of pythonCommands) {
      try {
        const { stdout } = await execPromise(`${cmd} --version`);
        if (stdout) {
          versions.push(stdout.trim());
        }
      } catch (err) {
        // 忽略失败的命令
      }
    }
    
    return versions;
  } catch (error) {
    console.error('获取Python版本失败:', error);
    return [];
  }
});

// 辅助函数：Promise化的exec
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

// 设置IPC处理器
setupIpcHandlers(ipcMain)

// 初始化应用
app.whenReady().then(() => {
  // 创建主窗口
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 应用退出前清理
app.on('before-quit', () => {
  // 确保SD进程被终止
  sdLauncher.stopStableDiffusion();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})