const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')
const sdLauncher = require('./ipcHandlers/sdLauncher')
const modelManager = require('./ipcHandlers/modelManager')
const pythonEnv = require('./ipcHandlers/pythonEnv')
const { setupIpcHandlers } = require('./apiHandler')
const remoteMain = require('@electron/remote/main')

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

// 处理Python路径配置
ipcMain.handle('configPythonPath', async (event, pythonPath) => {
  // 如果没有提供路径，打开文件选择对话框
  if (!pythonPath) {
    const { filePaths } = await dialog.showOpenDialog({
      title: '选择Python解释器',
      properties: ['openFile'],
      filters: [
        { name: 'Python解释器', extensions: ['exe'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (filePaths && filePaths.length > 0) {
      pythonPath = filePaths[0];
    } else {
      return { success: false, error: '未选择Python解释器' };
    }
  }
  
  console.log('验证Python路径:', pythonPath);
  
  // 验证路径
  if (!fs.existsSync(pythonPath)) {
    console.log('Python路径不存在');
    return { success: false, error: '路径不存在' };
  }
  
  // 检查是否有效的Python解释器
  try {
    const { exec } = require('child_process');
    console.log('执行Python版本检查命令...');
    
    const version = await new Promise((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        reject(new Error('执行超时'));
      }, 5000);
      
      exec(`"${pythonPath}" --version`, (error, stdout, stderr) => {
        clearTimeout(timeout);
        
        if (error) {
          // 如果是Windows系统，可能是Python解释器需要管理员权限
          if (process.platform === 'win32') {
            console.warn('Python版本检查失败，但允许继续:', error);
            resolve('Python (权限验证失败)');
            return;
          }
          
          console.error('Python版本检查失败:', error);
          reject(error);
          return;
        }
        
        const output = stdout.trim() || stderr.trim();
        console.log('Python版本检查结果:', output);
        resolve(output);
      });
    });
    
    // 检查输出是否包含Python字样
    const isPython = version.toLowerCase().includes('python');
    
    if (!isPython) {
      // 如果是.exe文件但没找到Python字样，可能是权限问题或特殊版本
      if (process.platform === 'win32' && pythonPath.toLowerCase().endsWith('.exe')) {
        console.warn('可能是Python解释器但版本验证失败');
        
        // 确认用户是否要使用该路径
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          title: 'Python验证警告',
          message: '无法确认所选文件是否为Python解释器',
          detail: '您仍然可以使用此文件，但无法保证它能正常工作。是否继续使用？',
          buttons: ['继续使用', '取消'],
          defaultId: 1,
          cancelId: 1
        });
        
        if (response === 0) {
          // 用户选择继续使用
          config.set('pythonPath', pythonPath);
          return { success: true, path: pythonPath, warning: true };
        } else {
          // 用户取消
          return { success: false, error: '用户取消了验证' };
        }
      }
      
      console.log('不是有效的Python解释器');
      return { success: false, error: '不是有效的Python解释器' };
    }
    
    // 保存配置
    console.log('保存Python路径配置:', pythonPath);
    config.set('pythonPath', pythonPath);
    return { success: true, path: pythonPath, version };
  } catch (error) {
    console.error('验证Python解释器失败:', error);
    
    // 如果是Windows系统且是.exe文件，可能只是权限问题
    if (process.platform === 'win32' && pythonPath.toLowerCase().endsWith('.exe')) {
      // 确认用户是否要使用该路径
      try {
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          title: 'Python验证警告',
          message: '无法验证Python解释器',
          detail: `验证失败: ${error.message}\n\n如果您确定这是Python解释器，可以继续使用。`,
          buttons: ['继续使用', '取消'],
          defaultId: 1,
          cancelId: 1
        });
        
        if (response === 0) {
          // 用户选择继续使用
          config.set('pythonPath', pythonPath);
          return { success: true, path: pythonPath, warning: true };
        }
      } catch (dialogError) {
        console.error('显示确认对话框失败:', dialogError);
      }
    }
    
    return { success: false, error: '无法验证Python解释器: ' + error.message };
  }
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