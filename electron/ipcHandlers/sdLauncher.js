const { app, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

// 配置存储
const config = new Store({
  name: 'sd-launcher-config'
});

// 配置备份存储
const backupConfig = new Store({
  name: 'sd-launcher-config-backup'
});

// 配置验证规则
const configValidationRules = {
  sdPath: {
    required: true,
    validate: (value) => {
      if (!value || !fs.existsSync(value)) return false;
      return fs.existsSync(path.join(value, 'webui.py')) || 
             fs.existsSync(path.join(value, 'launch.py'));
    },
    error: '无效的Stable Diffusion安装路径'
  },
  pythonPath: {
    required: false,
    validate: (value) => {
      if (!value) return true; // 可选配置
      return fs.existsSync(value);
    },
    error: '无效的Python解释器路径'
  },
  port: {
    required: false,
    validate: (value) => {
      if (!value) return true;
      const port = parseInt(value);
      return !isNaN(port) && port > 0 && port < 65536;
    },
    error: '无效的端口号'
  }
};

// 验证配置
function validateConfig(config) {
  const errors = [];
  
  for (const [key, rule] of Object.entries(configValidationRules)) {
    const value = config[key];
    
    if (rule.required && !value) {
      errors.push(`${key} 是必需的配置项`);
      continue;
    }
    
    if (value && !rule.validate(value)) {
      errors.push(rule.error);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// 备份配置
function backupConfigData() {
  const currentConfig = config.store;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  backupConfig.set(`backup_${timestamp}`, currentConfig);
  
  // 保留最近的5个备份
  const backups = Object.keys(backupConfig.store)
    .filter(key => key.startsWith('backup_'))
    .sort()
    .reverse();
    
  if (backups.length > 5) {
    backups.slice(5).forEach(key => {
      backupConfig.delete(key);
    });
  }
}

// 恢复配置
function restoreConfig(timestamp) {
  const backupKey = `backup_${timestamp}`;
  const backupData = backupConfig.get(backupKey);
  
  if (!backupData) {
    throw new Error('找不到指定的配置备份');
  }
  
  // 验证备份的配置
  const validation = validateConfig(backupData);
  if (!validation.isValid) {
    throw new Error(`配置备份无效: ${validation.errors.join(', ')}`);
  }
  
  // 应用备份的配置
  Object.entries(backupData).forEach(([key, value]) => {
    config.set(key, value);
  });
  
  return true;
}

// 获取配置备份列表
function getConfigBackups() {
  return Object.keys(backupConfig.store)
    .filter(key => key.startsWith('backup_'))
    .map(key => ({
      timestamp: key.replace('backup_', ''),
      config: backupConfig.get(key)
    }))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// 全局变量，存储SD进程
let sdProcess = null;
let isRunning = false;
let mainWindow = null;

// 添加进程状态监控
let processStartTime = null;
let lastHeartbeat = null;
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 3;
const HEARTBEAT_INTERVAL = 30000; // 30秒

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

// 监控进程状态
function startProcessMonitoring() {
  processStartTime = Date.now();
  lastHeartbeat = Date.now();
  
  const monitorInterval = setInterval(() => {
    if (!isRunning || !sdProcess) {
      clearInterval(monitorInterval);
      return;
    }
    
    const now = Date.now();
    if (now - lastHeartbeat > HEARTBEAT_INTERVAL * 2) {
      console.warn('[SD] 进程可能已卡死，尝试重启...');
      handleProcessFailure('进程心跳超时');
    }
  }, HEARTBEAT_INTERVAL);
}

// 处理进程失败
async function handleProcessFailure(reason) {
  console.error(`[SD] 进程失败: ${reason}`);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sd:error', `进程失败: ${reason}`);
  }
  
  // 停止当前进程
  await stopStableDiffusion();
  
  // 检查是否需要重启
  if (restartAttempts < MAX_RESTART_ATTEMPTS) {
    restartAttempts++;
    console.log(`[SD] 尝试重启 (${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
    
    // 延迟5秒后重启
    setTimeout(async () => {
      try {
        await launchStableDiffusion();
        restartAttempts = 0; // 重置重启计数
      } catch (error) {
        console.error('[SD] 重启失败:', error);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sd:error', `重启失败: ${error.message}`);
        }
      }
    }, 5000);
  } else {
    console.error('[SD] 达到最大重启次数，停止尝试');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sd:error', '达到最大重启次数，请手动检查问题');
    }
  }
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
    
    // 验证配置
    const validation = validateConfig(launchOptions);
    if (!validation.isValid) {
      throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
    }
    
    // 备份当前配置
    backupConfigData();
    
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
    
    // 启动进程监控
    startProcessMonitoring();
    
    // 处理标准输出
    sdProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[SD]', output);
      
      // 更新心跳时间
      lastHeartbeat = Date.now();
      
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
      
      // 检测常见错误
      if (output.includes('CUDA out of memory') || 
          output.includes('RuntimeError') ||
          output.includes('ImportError')) {
        handleProcessFailure(output.trim());
      }
    });
    
    // 处理错误输出
    sdProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('[SD Error]', error);
      
      // 更新心跳时间
      lastHeartbeat = Date.now();
      
      // 标记为错误输出
      const formattedError = `[STDERR] ${error.trim()}`;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sd:error', formattedError);
      }
      
      // 检测严重错误
      if (error.includes('Fatal error') || 
          error.includes('Critical error') ||
          error.includes('Failed to initialize')) {
        handleProcessFailure(error.trim());
      }
    });
    
    // 进程结束处理
    sdProcess.on('close', (code) => {
      console.log(`[SD] 进程已退出，代码: ${code}`);
      sdProcess = null;
      isRunning = false;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sd:stopped', { 
          isRunning: false,
          exitCode: code,
          uptime: processStartTime ? Date.now() - processStartTime : 0
        });
      }
      
      // 非正常退出时尝试重启
      if (code !== 0) {
        handleProcessFailure(`进程异常退出，退出码: ${code}`);
      }
    });
    
    // 进程错误处理
    sdProcess.on('error', (err) => {
      console.error('[SD] 启动错误:', err);
      const errorMessage = `启动进程错误: ${err.message}`;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sd:error', errorMessage);
      }
      
      handleProcessFailure(errorMessage);
    });
    
    return true;
  } catch (error) {
    console.error('[SD] 启动失败:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sd:error', `启动失败: ${error.message}`);
    }
    throw error;
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
  
  // 添加配置相关的IPC处理器
  ipcMain.handle('validateConfig', async (event, config) => {
    return validateConfig(config);
  });
  
  ipcMain.handle('backupConfig', async () => {
    backupConfigData();
    return true;
  });
  
  ipcMain.handle('restoreConfig', async (event, timestamp) => {
    return restoreConfig(timestamp);
  });
  
  ipcMain.handle('getConfigBackups', async () => {
    return getConfigBackups();
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