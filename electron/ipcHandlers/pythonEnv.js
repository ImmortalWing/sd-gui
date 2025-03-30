const { app, ipcMain, dialog } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const { promisify } = require('util');

// 将exec转换为Promise
const execPromise = promisify(exec);

// 配置存储
const config = new Store({
  name: 'sd-launcher-config'
});

// 选择Python路径
async function selectPythonPath() {
  try {
    let dialogOptions = {
      title: '选择Python解释器',
      properties: ['openFile']
    };
    
    // 在Windows系统上，添加文件过滤器
    if (process.platform === 'win32') {
      dialogOptions.filters = [
        { name: 'Python解释器', extensions: ['exe'] },
        { name: '所有文件', extensions: ['*'] }
      ];
    }
    
    const { canceled, filePaths } = await dialog.showOpenDialog(dialogOptions);
    
    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    
    // 使用用户选择的路径
    const pythonPath = filePaths[0];
    
    // 验证Python路径
    if (!fs.existsSync(pythonPath)) {
      return { success: false, error: '路径不存在' };
    }
    
    // 保存到配置
    config.set('pythonPath', pythonPath);
    
    return {
      success: true,
      path: pythonPath
    };
  } catch (error) {
    console.error('选择Python路径失败:', error);
    return { success: false, error: error.message };
  }
}

// 检查Python版本
async function checkPythonVersion(pythonPath) {
  if (!pythonPath || !fs.existsSync(pythonPath)) {
    return { success: false, error: 'Python路径无效' };
  }
  
  try {
    const { stdout } = await execPromise(`"${pythonPath}" --version`);
    const versionMatch = stdout.match(/Python\s+(\d+\.\d+\.\d+)/i);
    
    if (versionMatch) {
      return { 
        success: true, 
        version: versionMatch[1]
      };
    }
    
    return { success: false, error: '无法获取Python版本' };
  } catch (error) {
    console.error('检查Python版本失败:', error);
    return { success: false, error: error.message };
  }
}

// 列出已安装的包
async function listPackages(pythonPath) {
  if (!pythonPath || !fs.existsSync(pythonPath)) {
    return { success: false, error: 'Python路径无效', packages: [] };
  }
  
  try {
    const { stdout } = await execPromise(`"${pythonPath}" -m pip list --format=json`);
    const packages = JSON.parse(stdout);
    
    return { 
      success: true, 
      packages: packages.map(pkg => ({
        name: pkg.name,
        version: pkg.version
      }))
    };
  } catch (error) {
    console.error('列出已安装包失败:', error);
    return { success: false, error: error.message, packages: [] };
  }
}

// 安装包
async function installPackage(params) {
  const { pythonPath, pkgName, pkgVersion } = params;
  
  if (!pythonPath || !fs.existsSync(pythonPath)) {
    return { success: false, error: 'Python路径无效' };
  }
  
  const packageSpec = pkgVersion ? `${pkgName}${pkgVersion}` : pkgName;
  
  try {
    const { stdout, stderr } = await execPromise(`"${pythonPath}" -m pip install ${packageSpec}`);
    
    // 安装后验证
    const listResult = await listPackages(pythonPath);
    if (listResult.success) {
      const pkg = listResult.packages.find(p => p.name.toLowerCase() === pkgName.toLowerCase());
      if (pkg) {
        return { success: true, version: pkg.version };
      }
    }
    
    return { success: false, error: '安装后无法验证包' };
  } catch (error) {
    console.error(`安装包 ${packageSpec} 失败:`, error);
    return { success: false, error: error.message };
  }
}

// 安装PyTorch
async function installPytorch(params) {
  const { pythonPath, cudaVersion } = params;
  
  if (!pythonPath || !fs.existsSync(pythonPath)) {
    return { success: false, error: 'Python路径无效' };
  }
  
  try {
    let torchCommand;
    
    // 根据CUDA版本选择安装命令
    switch (cudaVersion) {
      case 'cuda118':
        torchCommand = `"${pythonPath}" -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118`;
        break;
      case 'cuda121':
        torchCommand = `"${pythonPath}" -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121`;
        break;
      case 'cpu':
      default:
        torchCommand = `"${pythonPath}" -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu`;
    }
    
    const { stdout, stderr } = await execPromise(torchCommand);
    
    // 安装后验证
    const listResult = await listPackages(pythonPath);
    if (listResult.success) {
      const torch = listResult.packages.find(p => p.name === 'torch');
      if (torch) {
        return { success: true, version: torch.version };
      }
    }
    
    return { success: false, error: '安装后无法验证PyTorch' };
  } catch (error) {
    console.error('安装PyTorch失败:', error);
    return { success: false, error: error.message };
  }
}

// 获取虚拟环境列表
async function getVenvList() {
  const venvs = [];
  
  try {
    const pythonPath = config.get('pythonPath');
    if (!pythonPath) {
      return { success: true, venvs: [] };
    }
    
    // 当前暂不实现虚拟环境扫描
    // 可以在这里添加扫描虚拟环境的逻辑
    
    return { success: true, venvs };
  } catch (error) {
    console.error('获取虚拟环境列表失败:', error);
    return { success: false, error: error.message, venvs: [] };
  }
}

// 创建虚拟环境
async function createVenv(pythonPath) {
  if (!pythonPath || !fs.existsSync(pythonPath)) {
    return { success: false, error: 'Python路径无效' };
  }
  
  try {
    // 虚拟环境创建功能将在后续版本实现
    return { success: false, error: '此功能尚未实现' };
  } catch (error) {
    console.error('创建虚拟环境失败:', error);
    return { success: false, error: error.message };
  }
}

// 激活虚拟环境
async function activateVenv(venvPath) {
  try {
    // 虚拟环境激活功能将在后续版本实现
    return { success: false, error: '此功能尚未实现' };
  } catch (error) {
    console.error('激活虚拟环境失败:', error);
    return { success: false, error: error.message };
  }
}

// 删除虚拟环境
async function deleteVenv(venvPath) {
  try {
    // 虚拟环境删除功能将在后续版本实现
    return { success: false, error: '此功能尚未实现' };
  } catch (error) {
    console.error('删除虚拟环境失败:', error);
    return { success: false, error: error.message };
  }
}

// 设置IPC处理器
function setupIpcHandlers() {
  // Python路径相关
  ipcMain.handle('pythonEnv:selectPath', async () => {
    return await selectPythonPath();
  });
  
  ipcMain.handle('pythonEnv:checkVersion', async (event, pythonPath) => {
    return await checkPythonVersion(pythonPath);
  });
  
  // 包管理相关
  ipcMain.handle('pythonEnv:listPackages', async (event, pythonPath) => {
    return await listPackages(pythonPath);
  });
  
  ipcMain.handle('pythonEnv:installPackage', async (event, params) => {
    return await installPackage(params);
  });
  
  ipcMain.handle('pythonEnv:installPytorch', async (event, params) => {
    return await installPytorch(params);
  });
  
  // 虚拟环境相关
  ipcMain.handle('pythonEnv:getVenvList', async () => {
    return await getVenvList();
  });
  
  ipcMain.handle('pythonEnv:createVenv', async (event, pythonPath) => {
    return await createVenv(pythonPath);
  });
  
  ipcMain.handle('pythonEnv:activateVenv', async (event, venvPath) => {
    return await activateVenv(venvPath);
  });
  
  ipcMain.handle('pythonEnv:deleteVenv', async (event, venvPath) => {
    return await deleteVenv(venvPath);
  });
}

// 导出模块
module.exports = {
  setupIpcHandlers,
  selectPythonPath,
  checkPythonVersion,
  listPackages,
  installPackage,
  installPytorch,
  getVenvList,
  createVenv,
  activateVenv,
  deleteVenv
}; 