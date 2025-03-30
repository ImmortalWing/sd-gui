const { app, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

// 配置存储
const config = new Store({
  name: 'sd-launcher-config'
});

// 全局变量，存储SD进程
let sdProcess = null;
let isRunning = false;
let mainWindow = null;

// 初始化并设置主窗口引用
function initialize(window) {
  mainWindow = window;
}

// 构建启动命令
function buildLaunchCommand(options) {
  const sdPath = options.sdPath || config.get('sdPath');
  
  if (!sdPath || !fs.existsSync(sdPath)) {
    throw new Error('Stable Diffusion路径未设置或无效');
  }
  
  // 检查路径是否合法
  if (!fs.existsSync(path.join(sdPath, 'webui.py')) && 
      !fs.existsSync(path.join(sdPath, 'launch.py'))) {
    throw new Error('无效的Stable Diffusion安装路径');
  }
  
  // 确定启动脚本
  let scriptName = 'webui.py';
  if (fs.existsSync(path.join(sdPath, 'launch.py'))) {
    scriptName = 'launch.py';
  }
  
  // 构建启动参数
  const launchArgs = [];
  
  // 添加SSL问题解决参数
  launchArgs.push('--enable-insecure-extension-access');
  
  // 添加API参数
  launchArgs.push('--api');
  
  // 添加API监听参数，允许外部访问
  launchArgs.push('--listen');
  
  // 添加no-half参数，解决某些模型加载问题
  launchArgs.push('--no-half');
  
  // 添加加速优化参数
  launchArgs.push('--precision', 'full');
  launchArgs.push('--no-half-vae');
  
  // 添加端口参数
  if (options.port) {
    launchArgs.push(`--port=${options.port}`);
  }
  
  // 低显存模式
  if (options.lowVram) {
    launchArgs.push('--lowvram');
  }
  
  // 启用xFormers
  if (options.enableXformers) {
    launchArgs.push('--xformers');
  }
  
  // 使用特定模型
  if (options.model) {
    launchArgs.push(`--ckpt=${options.model}`);
  }
  
  // 自动启动浏览器
  if (options.autoLaunchBrowser === false) {
    launchArgs.push('--nowebui');
  }
  
  // 离线模式
  if (options.offlineMode) {
    launchArgs.push('--skip-torch-cuda-test');
    launchArgs.push('--disable-safe-unpickle');
    launchArgs.push('--skip-python-version-check');
    launchArgs.push('--no-download-sd-model');
    launchArgs.push('--skip-version-check');
    // 增加额外的离线参数
    launchArgs.push('--no-half-vae');
    launchArgs.push('--no-download');
    launchArgs.push('--no-hashing');
    // 添加解决CLIP tokenizer问题的参数
    launchArgs.push('--use-cpu all');
    launchArgs.push('--disable-nan-check');
    launchArgs.push('--opt-sub-quad-attention');
    launchArgs.push('--opt-channelslast');
    launchArgs.push('--no-verify-input');
  }
  
  // 单独的离线选项
  if (options.skipTorchCudaTest) {
    launchArgs.push('--skip-torch-cuda-test');
  }
  
  if (options.skipPythonCheck) {
    launchArgs.push('--skip-python-version-check');
  }
  
  if (options.noDownloadModels) {
    launchArgs.push('--no-download-sd-model');
  }
  
  // 其他自定义参数
  if (options.customArgs) {
    launchArgs.push(...options.customArgs.split(' '));
  }
  
  // 获取自定义Python路径
  const customPythonPath = config.get('pythonPath');
  
  // 根据操作系统构建完整命令
  let command;
  if (process.platform === 'win32') {
    // Windows使用自定义Python路径或默认的venv/Scripts/python.exe
    let pythonExe;
    
    if (customPythonPath && fs.existsSync(customPythonPath)) {
      // 使用自定义路径
      pythonExe = `"${customPythonPath}"`;
    } else if (fs.existsSync(path.join(sdPath, 'venv', 'Scripts', 'python.exe'))) {
      // 使用SD内置的venv环境
      pythonExe = `"${path.join(sdPath, 'venv', 'Scripts', 'python.exe')}"`;
    } else {
      // 使用系统默认的python命令
      pythonExe = 'python';
    }
    
    command = `cd "${sdPath}" && ${pythonExe} "${path.join(sdPath, scriptName)}" ${launchArgs.join(' ')}`;
  } else {
    // Linux/Mac使用自定义Python路径或默认的python3
    let pythonExe;
    
    if (customPythonPath && fs.existsSync(customPythonPath)) {
      // 使用自定义路径
      pythonExe = `"${customPythonPath}"`;
    } else {
      // 使用系统默认的python3命令
      pythonExe = 'python3';
    }
    
    command = `cd "${sdPath}" && ${pythonExe} "${path.join(sdPath, scriptName)}" ${launchArgs.join(' ')}`;
  }
  
  return command;
}

// 启动SD服务
async function launchStableDiffusion(options = {}) {
  if (isRunning) {
    throw new Error('Stable Diffusion已在运行中');
  }
  
  try {
    // 确保传入的是简单对象
    const cleanOptions = {
      port: options.port || 7860,
      lowVram: !!options.lowVram,
      enableXformers: options.enableXformers !== false,
      autoLaunchBrowser: options.autoLaunchBrowser !== false,
      customArgs: typeof options.customArgs === 'string' ? options.customArgs : '',
      model: typeof options.model === 'string' ? options.model : '',
      offlineMode: !!options.offlineMode,
      skipTorchCudaTest: !!options.skipTorchCudaTest,
      skipPythonCheck: !!options.skipPythonCheck,
      noDownloadModels: !!options.noDownloadModels
    };
    
    // 合并默认配置与传入的参数
    const defaultOptions = config.get('launchParams') || {};
    const launchOptions = { ...defaultOptions, ...cleanOptions };
    
    // 构建启动命令
    const command = buildLaunchCommand(launchOptions);
    console.log('[SD] 启动命令:', command);
    
    // 通知用户启动命令
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sd:log', `正在执行启动命令: ${command}`);
    }
    
    // 使用子进程执行命令
    sdProcess = spawn(command, [], { 
      shell: true,
      windowsHide: false
    });
    
    isRunning = true;
    
    // 处理标准输出
    sdProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[SD]', output);
      
      // 发送日志到渲染进程
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sd:log', output);
      }
      
      // 检测服务器是否已启动
      if (output.includes('Running on local URL:') || output.includes('To create a public link')) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sd:started', true);
        }
      }
    });
    
    // 处理错误输出
    sdProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('[SD Error]', error);
      
      // 标记为错误输出
      const formattedError = `[STDERR] ${error.trim()}`;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sd:error', formattedError);
      }
    });
    
    // 进程结束处理
    sdProcess.on('close', (code) => {
      console.log(`[SD] 进程已退出，代码: ${code}`);
      sdProcess = null;
      isRunning = false;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sd:stopped', { isRunning: false });
      }
    });
    
    // 进程错误处理
    sdProcess.on('error', (err) => {
      console.error('[SD] 启动错误:', err);
      const errorMessage = `启动进程错误: ${err.message}`;
      
      sdProcess = null;
      isRunning = false;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sd:error', errorMessage);
        mainWindow.webContents.send('sd:stopped', { isRunning: false, error: errorMessage });
      }
    });
    
    return { success: true, message: '启动命令已执行' };
  } catch (error) {
    console.error('启动SD失败:', error);
    const errorMessage = `启动失败: ${error.message}`;
    
    // 发送错误到渲染进程
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sd:error', errorMessage);
    }
    
    return { success: false, error: errorMessage };
  }
}

// 停止SD服务
function stopStableDiffusion() {
  if (!isRunning || !sdProcess) {
    return { success: false, error: 'Stable Diffusion未在运行' };
  }
  
  try {
    // 在Windows上使用taskkill确保子进程也被终止
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', sdProcess.pid, '/f', '/t']);
    } else {
      // 在Linux/Mac上使用kill
      process.kill(-sdProcess.pid);
    }
    
    sdProcess = null;
    isRunning = false;
    return { success: true, message: '停止命令已执行' };
  } catch (error) {
    console.error('停止SD失败:', error);
    return { success: false, error: error.message };
  }
}

// 获取SD状态
function getStatus() {
  return {
    isRunning,
    pid: sdProcess ? sdProcess.pid : null
  };
}

// 设置IPC处理器
function setupIpcHandlers() {
  // 启动SD
  ipcMain.handle('sd:launch', async (event, options) => {
    return await launchStableDiffusion(options);
  });
  
  // 停止SD
  ipcMain.handle('sd:stop', async () => {
    return stopStableDiffusion();
  });
  
  // 获取状态
  ipcMain.handle('sd:status', () => {
    return getStatus();
  });
}

// 导出模块
module.exports = {
  initialize,
  setupIpcHandlers,
  launchStableDiffusion,
  stopStableDiffusion,
  getStatus
}; 