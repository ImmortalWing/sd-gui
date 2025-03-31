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

// 删除配置备份
function deleteConfigBackup(timestamp) {
  const backupKey = `backup_${timestamp}`;
  if (!backupConfig.has(backupKey)) {
    throw new Error('找不到指定的配置备份');
  }
  
  backupConfig.delete(backupKey);
  return true;
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
  
  // 使用Set来防止参数重复
  const uniqueArgsSet = new Set();
  
  // 添加参数到集合中，确保不重复
  const addArg = (arg) => {
    if (!uniqueArgsSet.has(arg)) {
      uniqueArgsSet.add(arg);
    }
  };
  
  // 新的默认启动参数，根据用户需求
  addArg('--medvram-sdxl'); // 为SDXL优化内存
  addArg('--xformers');     // 默认启用xFormers
  addArg('--api');          // 启用API
  addArg('--autolaunch');   // 自动启动浏览器
  addArg('--skip-python-version-check'); // 跳过Python版本检查
  
  // 添加SSL问题解决参数
  addArg('--enable-insecure-extension-access');
  
  // 添加API监听参数，允许外部访问
  addArg('--listen');
  
  // 添加no-half参数，解决某些模型加载问题
  addArg('--no-half');
  
  // 添加加速优化参数
  addArg('--precision');
  addArg('full');
  addArg('--no-half-vae');
  
  // 内存优化参数（缓解模型加载问题）
  addArg('--opt-split-attention');
  addArg('--opt-channelslast');
  
  // 添加端口参数
  if (options.port) {
    addArg(`--port=${options.port}`);
  }
  
  // 低显存模式 - 不再添加默认的--medvram，因为我们已经添加了--medvram-sdxl
  if (options.lowVram) {
    addArg('--lowvram');
  }
  
  // 由于默认已添加xformers，只检查是否明确禁用
  if (options.enableXformers === false) {
    // 从参数集合中移除xformers选项
    uniqueArgsSet.delete('--xformers');
  }
  
  // 使用特定模型
  if (options.model) {
    addArg(`--ckpt=${options.model}`);
  }
  
  // 自动启动浏览器 - 由于默认已添加autolaunch，只在明确禁用时添加nowebui
  if (options.autoLaunchBrowser === false) {
    // 从参数集合中移除autolaunch选项
    uniqueArgsSet.delete('--autolaunch');
    addArg('--nowebui');
  }
  
  // 离线模式
  if (options.offlineMode) {
    addArg('--skip-torch-cuda-test');
    addArg('--disable-safe-unpickle');
    addArg('--skip-python-version-check');
    addArg('--no-download-sd-model');
    addArg('--skip-version-check');
    // 增加额外的离线参数
    addArg('--no-half-vae');
    addArg('--no-download');
    addArg('--no-hashing');
    // 添加解决CLIP tokenizer问题的参数
    addArg('--use-cpu');
    addArg('all');
    addArg('--disable-nan-check');
    addArg('--opt-sub-quad-attention');
    addArg('--no-verify-input');
  }
  
  // 单独的离线选项
  if (options.skipTorchCudaTest) {
    addArg('--skip-torch-cuda-test');
  }
  
  if (options.skipPythonCheck) {
    addArg('--skip-python-version-check');
  }
  
  if (options.noDownloadModels) {
    addArg('--no-download-sd-model');
  }
  
  // 其他自定义参数，先进行拆分，再逐个添加，防止重复
  if (options.customArgs) {
    const customArgsList = options.customArgs.split(' ').filter(arg => arg.trim() !== '');
    customArgsList.forEach(arg => addArg(arg));
  }
  
  // 转换Set为数组
  const launchArgs = Array.from(uniqueArgsSet);
  
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
    
    // 检查Python路径是否有效
    if (customPythonPath && !fs.existsSync(customPythonPath)) {
      console.warn(`[SD] 警告: 自定义Python路径 "${customPythonPath}" 不存在，将使用系统默认Python`);
      pythonExe = 'python';
    }
    
    // 验证SD目录是否存在
    try {
      if (!fs.existsSync(sdPath)) {
        throw new Error(`SD路径 "${sdPath}" 不存在`);
      }
      
      const launchPyPath = path.join(sdPath, scriptName);
      if (!fs.existsSync(launchPyPath)) {
        throw new Error(`启动脚本 "${launchPyPath}" 不存在`);
      }
    } catch (pathError) {
      console.error('[SD] 路径验证失败:', pathError);
      throw pathError;
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
  try {
    if (isRunning) {
      throw new Error('Stable Diffusion已在运行中');
    }
    
    // 重置启动尝试计数
    restartAttempts = 0;
    
    // 设置进程开始时间
    processStartTime = Date.now();
    lastHeartbeat = Date.now();
    
    // 确保配置项中包含sdPath
    if (!options.sdPath) {
      // 尝试从配置中获取sdPath
      const storedSdPath = config.get('sdPath');
      if (!storedSdPath) {
        throw new Error('SD安装路径未设置，请在设置中配置SD路径');
      }
      options.sdPath = storedSdPath;
    }
    
    console.log('[SD] 启动选项:', JSON.stringify(options));
    
    // 清理选项，只保留需要的参数
    const cleanOptions = {
      sdPath: options.sdPath,
      pythonPath: options.pythonPath || config.get('pythonPath'),
      port: options.port || 7860,
      lowVram: !!options.lowVram,
      enableXformers: options.enableXformers !== false, // 默认启用xFormers，除非明确禁用
      model: options.model,
      autoLaunchBrowser: options.autoLaunchBrowser !== false, // 默认启用，除非明确禁用
      customArgs: options.customArgs || '--medvram-sdxl', // 默认使用SDXL优化
      offlineMode: options.offlineMode !== false, // 默认启用
      skipTorchCudaTest: options.skipTorchCudaTest !== false, // 默认启用
      skipPythonCheck: options.skipPythonCheck !== false, // 默认启用
      noDownloadModels: options.noDownloadModels !== false // 默认启用
    };
    
    console.log('[SD] 清理后的选项:', JSON.stringify(cleanOptions));
    
    // 合并默认配置与传入的参数
    const defaultOptions = config.get('launchParams') || {};
    const launchOptions = { ...defaultOptions, ...cleanOptions };
    
    console.log('[SD] 最终启动选项:', JSON.stringify(launchOptions));
    
    // 验证配置
    const validation = validateConfig(launchOptions);
    if (!validation.isValid) {
      console.error('[SD] 配置验证失败:', validation.errors);
      throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
    }
    
    // 检查SD路径的有效性
    if (!fs.existsSync(launchOptions.sdPath)) {
      console.error('[SD] SD路径不存在:', launchOptions.sdPath);
      throw new Error(`SD安装路径不存在: ${launchOptions.sdPath}`);
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
    try {
      // 将命令分解为可执行文件和参数
      let execPath, execArgs;
      
      if (process.platform === 'win32') {
        execPath = 'cmd.exe';
        execArgs = ['/c', command];
      } else {
        execPath = '/bin/bash';
        execArgs = ['-c', command];
      }
      
      console.log(`[SD] 使用 ${execPath} 执行命令`);
      
      sdProcess = spawn(execPath, execArgs, { 
        shell: false,  // 直接使用指定的shell
        windowsHide: false,
        env: Object.assign({}, process.env, { 
          PYTHONIOENCODING: 'utf-8',
          PYTHONUNBUFFERED: '1',  // 禁用Python输出缓冲
          LANG: 'zh_CN.UTF-8',    // 添加中文支持
          LC_ALL: 'zh_CN.UTF-8'   // 添加中文支持
        })
      });
    } catch (spawnError) {
      console.error('[SD] 创建进程时出错:', spawnError);
      throw new Error(`创建进程失败: ${spawnError.message}`);
    }
    
    if (!sdProcess || !sdProcess.pid) {
      console.error('[SD] 进程创建失败');
      throw new Error('无法启动SD进程');
    }
    
    console.log('[SD] 进程已启动，PID:', sdProcess.pid);
    
    isRunning = true;
    
    // 启动进程监控
    startProcessMonitoring();
    
    // 设置一个超时，如果太长时间没有收到启动成功的信息
    const launchTimeout = setTimeout(() => {
      if (isRunning && sdProcess) {
        console.warn('[SD] 启动超时，但进程仍在运行。可能需要检查日志。');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sd:log', '启动超时，但进程仍在运行。请检查输出日志。');
        }
      }
    }, 60000); // 60秒超时
    
    // 创建一个Promise在进程启动成功时返回
    const launchPromise = new Promise((resolve, reject) => {
      // 监听进程输出以确定是否启动成功
      let stdoutBuffer = '';
      let stderrBuffer = '';
      let hasStarted = false;
      
      // 成功启动的标志
      const successMarkers = [
        'Running on local URL',
        'To create a public link',
        'Running on'
      ];
      
      // 错误标志
      const errorMarkers = [
        'CUDA out of memory',
        'RuntimeError',
        'ImportError',
        'failed to load',
        'Error:',
        'Exception:',
        'Failed to'
      ];
      
      // 处理标准输出
      sdProcess.stdout.on('data', (data) => {
        const output = data.toString('utf8');
        stdoutBuffer += output;
        
        // 记录日志
        console.log('[SD]', output);
        
        // 更新心跳时间
        lastHeartbeat = Date.now();
        
        // 发送日志到渲染进程
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sd:log', output);
        }
        
        // 检查是否包含成功启动的标记
        for (const marker of successMarkers) {
          if (output.includes(marker) && !hasStarted) {
            hasStarted = true;
            clearTimeout(launchTimeout);
            console.log('[SD] 检测到启动成功标记:', marker);
            
            // 发送已启动事件
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('sd:started', true);
            }
            
            resolve({ success: true, message: '服务已成功启动' });
            break;
          }
        }
        
        // 检查是否包含错误标记
        for (const marker of errorMarkers) {
          if (output.includes(marker)) {
            console.error('[SD] 检测到错误标记:', marker);
            // 不要立即拒绝，因为这可能只是一个警告
            break;
          }
        }
      });
      
      // 处理错误输出
      sdProcess.stderr.on('data', (data) => {
        const error = data.toString('utf8');
        stderrBuffer += error;
        
        // 记录错误
        console.error('[SD Error]', error);
        
        // 更新心跳时间
        lastHeartbeat = Date.now();
        
        // 标记为错误输出
        const formattedError = `[STDERR] ${error.trim()}`;
        
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sd:error', formattedError);
        }
        
        // 检查是否包含严重错误
        let hasFatalError = false;
        for (const marker of errorMarkers) {
          if (error.includes(marker)) {
            console.error('[SD] 在stderr中检测到错误:', marker);
            hasFatalError = true;
            break;
          }
        }
        
        // 如果包含严重错误，拒绝Promise
        if (hasFatalError && !hasStarted) {
          clearTimeout(launchTimeout);
          const errorMessage = `启动失败: ${error.trim()}`;
          reject(new Error(errorMessage));
        }
      });
      
      // 处理Promise内的进程关闭事件
      sdProcess.once('close', (code) => {
        clearTimeout(launchTimeout);
        if (code !== 0 && !hasStarted) {
          const errorMsg = `进程异常退出，退出码: ${code}\n标准输出: ${stdoutBuffer}\n错误输出: ${stderrBuffer}`;
          console.error('[SD] 进程异常退出:', errorMsg);
          reject(new Error(errorMsg));
        }
      });
      
      // 处理Promise内的进程错误
      sdProcess.once('error', (err) => {
        clearTimeout(launchTimeout);
        if (!hasStarted) {
          console.error('[SD] 进程启动错误:', err);
          reject(err);
        }
      });
    });
    
    // 等待启动结果，设置10秒超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        if (sdProcess && isRunning) {
          // 进程依然在运行，可能已经启动成功但没有检测到
          return { success: true, message: '服务已启动，但没有收到确认信号' };
        } else {
          reject(new Error('启动超时'));
        }
      }, 10000);
    });
    
    // 添加全局事件处理程序
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
    
    // 返回第一个完成的Promise结果
    try {
      const result = await Promise.race([launchPromise, timeoutPromise]);
      return result;
    } catch (error) {
      console.error('[SD] 启动错误:', error.message);
      // 如果失败了，尝试关闭进程
      if (sdProcess) {
        try {
          stopStableDiffusion();
        } catch (stopError) {
          console.error('[SD] 停止失败的进程时出错:', stopError);
        }
      }
      return { success: false, error: error.message };
    }
    
  } catch (error) {
    console.error('[SD] 启动失败:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sd:error', `启动失败: ${error.message}`);
    }
    return { success: false, error: error.message };
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
  
  ipcMain.handle('deleteConfigBackup', async (event, timestamp) => {
    return deleteConfigBackup(timestamp);
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