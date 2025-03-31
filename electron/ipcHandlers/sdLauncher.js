const { app, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { config } = require('../config');
const { execPromise } = require('../utils');

// 全局变量
let sdProcess = null;
let mainWindow = null;
let isRunning = false;
let logBuffer = [];
let sdApiUrl = null;
let processStartTime = null;
let lastHeartbeat = null;
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 3;
const HEARTBEAT_INTERVAL = 30000; // 30秒

// 初始化
function initialize(win) {
  mainWindow = win;
  
  // 窗口关闭时确保SD进程被终止
  mainWindow.on('closed', () => {
    stopStableDiffusion();
  });
  
  app.on('before-quit', () => {
    stopStableDiffusion();
  });
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

// 设置IPC处理程序
function setupIpcHandlers() {
  // 启动Stable Diffusion
  ipcMain.handle('sd:launch', launchStableDiffusion);
  
  // 停止Stable Diffusion
  ipcMain.handle('sd:stop', stopStableDiffusion);
  
  // 获取SD状态
  ipcMain.handle('sd:status', getSDStatus);
}

// 启动SD函数
async function launchStableDiffusion(options = {}) {
  try {
    // 如果已经在运行，直接返回
    if (isRunning) {
      console.log('[SD] SD已在运行中');
      return { success: false, error: '已在运行中' };
    }
    
    // 获取配置
    const sdPath = options.sdPath || config.get('sdPath');
    const pythonPath = options.pythonPath || config.get('pythonPath');
    const port = options.port || config.get('port') || 7860;
    const lowVram = options.lowVram !== undefined ? options.lowVram : config.get('lowVram');
    const enableXformers = options.enableXformers !== undefined ? options.enableXformers : config.get('enableXformers');
    
    // 验证SD路径
    if (!sdPath || !fs.existsSync(sdPath)) {
      console.error('[SD] 无效的SD路径:', sdPath);
      return { success: false, error: '无效的SD路径' };
    }
    
    // 验证启动脚本
    const launchScript = fs.existsSync(path.join(sdPath, 'launch.py')) ? 'launch.py' : 'webui.py';
    const launchScriptPath = path.join(sdPath, launchScript);
    
    if (!fs.existsSync(launchScriptPath)) {
      console.error('[SD] 启动脚本不存在:', launchScriptPath);
      return { success: false, error: '启动脚本不存在' };
    }
    
    // 验证Python路径
    let pythonCommand = 'python';
    if (pythonPath && fs.existsSync(pythonPath)) {
      pythonCommand = pythonPath;
      console.log('[SD] 使用自定义Python路径:', pythonPath);
    } else if (fs.existsSync(path.join(sdPath, 'venv', 'Scripts', 'python.exe'))) {
      pythonCommand = path.join(sdPath, 'venv', 'Scripts', 'python.exe');
      console.log('[SD] 使用SD内置venv环境');
    } else {
      console.log('[SD] 使用系统默认Python');
    }
    
    // 验证Python命令
    try {
      const { stdout } = await execPromise(`"${pythonCommand}" --version`);
      console.log('[SD] Python版本:', stdout.trim());
    } catch (error) {
      console.error('[SD] Python版本检查失败:', error);
      return { success: false, error: 'Python解释器无效' };
    }
    
    // 构建启动命令
    const command = buildLaunchCommand(options);
    console.log('[SD] 启动命令:', command);
    
    // 设置环境变量
    const env = {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUNBUFFERED: '1',
      PYTHONLEGACYWINDOWSSTDIO: '1', // 解决Windows下Python的stdout编码问题
      LANG: 'zh_CN.UTF-8',
      LC_ALL: 'zh_CN.UTF-8'
    };
    
    // 启动进程
    console.log('[SD] 正在启动进程...');
    console.log('[SD] 工作目录:', sdPath);
    console.log('[SD] 环境变量:', env);
    
    // 解决路径中文问题
    let escSdPath = sdPath;
    // 如果路径中包含中文，使用短路径名
    if (/[\u4e00-\u9fa5]/.test(sdPath) && process.platform === 'win32') {
      try {
        const { stdout } = await execPromise(`for %I in ("${sdPath}") do @echo %~sI`);
        if (stdout && stdout.trim()) {
          escSdPath = stdout.trim();
          console.log('[SD] 使用短路径:', escSdPath);
        }
      } catch (error) {
        console.error('[SD] 获取短路径失败:', error);
      }
    }
    
    if (process.platform === 'win32') {
      // Windows使用cmd.exe，先设置代码页为UTF-8
      try {
        // 创建bat文件来执行命令，避免命令行长度和编码问题
        const tmpDir = path.join(app.getPath('temp'), 'sd-gui');
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
        
        const batPath = path.join(tmpDir, 'run_sd.bat');
        const batContent = `@echo off
chcp 65001 >nul
cd /d "${escSdPath}"
${command}
`;
        
        fs.writeFileSync(batPath, batContent);
        
        // 使用bat文件启动进程
        sdProcess = spawn('cmd.exe', ['/c', batPath], {
          env: env,
          windowsHide: false
        });
      } catch (error) {
        console.error('[SD] 创建启动脚本失败:', error);
        throw error;
      }
    } else {
      // Linux/Mac直接执行命令
      sdProcess = spawn(command, [], {
        cwd: sdPath,
        env: env,
        shell: true
      });
    }
    
    if (!sdProcess) {
      throw new Error('进程创建失败');
    }
    
    // 设置编码
    sdProcess.stdout.setEncoding('utf8');
    sdProcess.stderr.setEncoding('utf8');
    
    // 监听输出
    sdProcess.stdout.on('data', (data) => {
      // 确保数据是UTF-8编码的字符串
      const text = Buffer.isBuffer(data) ? Buffer.from(data).toString('utf8') : data.toString();
      console.log('[SD] 输出:', text.trim());
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sd:output', text.trim());
      }
    });
    
    sdProcess.stderr.on('data', (data) => {
      // 确保数据是UTF-8编码的字符串
      const text = Buffer.isBuffer(data) ? Buffer.from(data).toString('utf8') : data.toString();
      console.error('[SD] 错误:', text.trim());
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sd:error', text.trim());
      }
    });
    
    // 监听进程退出
    sdProcess.on('close', (code) => {
      console.log(`[SD] 进程退出，退出码: ${code}`);
      isRunning = false;
      sdProcess = null;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sd:status', {
          status: 'stopped',
          code: code
        });
      }
    });
    
    // 监听进程错误
    sdProcess.on('error', (error) => {
      console.error('[SD] 进程错误:', error);
      isRunning = false;
      sdProcess = null;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sd:error', `进程错误: ${error.message}`);
      }
    });
    
    // 设置运行状态
    isRunning = true;
    
    // 启动进程监控
    startProcessMonitoring();
    
    // 设置启动超时
    setTimeout(() => {
      if (isRunning && !lastHeartbeat) {
        console.error('[SD] 启动超时');
        handleProcessFailure('启动超时');
      }
    }, 30000); // 30秒超时
    
    return { success: true };
  } catch (error) {
    console.error('[SD] 启动失败:', error);
    isRunning = false;
    sdProcess = null;
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sd:error', `启动失败: ${error.message}`);
    }
    
    return { success: false, error: error.message };
  }
}

// 停止SD函数
async function stopStableDiffusion() {
  // 如果没有在运行，直接返回
  if (!isRunning || !sdProcess) {
    console.log('没有运行中的SD进程');
    return { success: true, message: '没有运行中的进程' };
  }
  
  try {
    console.log('正在停止SD进程...');
    
    // 在Windows上
    if (process.platform === 'win32') {
      // 尝试正常关闭进程树
      const { exec } = require('child_process');
      exec(`taskkill /pid ${sdProcess.pid} /t /f`, (error) => {
        if (error) {
          console.error('停止进程树时发生错误:', error);
        }
      });
    } else {
      // 在非Windows系统上使用kill信号
      sdProcess.kill('SIGTERM');
      
      // 如果5秒后仍在运行，强制终止
      setTimeout(() => {
        if (sdProcess) {
          sdProcess.kill('SIGKILL');
        }
      }, 5000);
    }
    
    // 重置状态
    isRunning = false;
    sdApiUrl = null;
    
    return { success: true, message: '已发送停止指令' };
  } catch (error) {
    console.error('停止SD时发生异常:', error);
    return { success: false, error: error.message };
  }
}

// 获取SD状态
function getSDStatus() {
  return {
    isRunning,
    logBuffer: logBuffer.join('\n'),
    apiUrl: sdApiUrl
  };
}

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
  
  // 低显存模式
  if (options.lowVram) {
    addArg('--lowvram');
  }
  
  // 由于默认已添加xformers，只检查是否明确禁用
  if (options.enableXformers === false) {
    uniqueArgsSet.delete('--xformers');
  }
  
  // 使用特定模型
  if (options.model) {
    addArg(`--ckpt=${options.model}`);
  }
  
  // 自动启动浏览器
  if (options.autoLaunchBrowser === false) {
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
    addArg('--no-half-vae');
    addArg('--no-download');
    addArg('--no-hashing');
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
  
  // 其他自定义参数
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
      pythonExe = `"${customPythonPath}"`;
      console.log('[SD] 使用自定义Python路径:', customPythonPath);
    } else if (fs.existsSync(path.join(sdPath, 'venv', 'Scripts', 'python.exe'))) {
      pythonExe = `"${path.join(sdPath, 'venv', 'Scripts', 'python.exe')}"`;
      console.log('[SD] 使用SD内置venv环境');
    } else {
      pythonExe = 'python';
      console.log('[SD] 使用系统默认Python');
    }
    
    // 构建命令 - 修改引号处理方式
    command = `${pythonExe} "${path.join(sdPath, scriptName)}" ${launchArgs.join(' ')}`;
  } else {
    // Linux/Mac使用自定义Python路径或默认的python3
    let pythonExe;
    
    if (customPythonPath && fs.existsSync(customPythonPath)) {
      pythonExe = `"${customPythonPath}"`;
    } else {
      pythonExe = 'python3';
    }
    
    command = `cd "${sdPath}" && ${pythonExe} "${path.join(sdPath, scriptName)}" ${launchArgs.join(' ')}`;
  }
  
  console.log('[SD] 启动命令:', command);
  return command;
}

// 导出模块
module.exports = {
  initialize,
  setupIpcHandlers,
  launchStableDiffusion,
  stopStableDiffusion,
  getSDStatus
}; 