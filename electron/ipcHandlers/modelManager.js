const { app, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { createReadStream, createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');
const Store = require('electron-store');

// 初始化配置存储
const config = new Store({
  name: 'sd-launcher-config'
});

// 获取模型目录
function getModelsDir() {
  // 首先检查配置的模型目录
  const configuredDir = config.get('modelsPath');
  if (configuredDir && fs.existsSync(configuredDir)) {
    return configuredDir;
  }
  
  // 否则使用默认目录
  const defaultDir = path.join(app.getPath('userData'), 'models');
  // 确保目录存在
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  return defaultDir;
}

// 列出所有模型
async function listModels() {
  try {
    const modelsDir = getModelsDir();
    const files = await fs.promises.readdir(modelsDir);
    
    const models = await Promise.all(files.map(async file => {
      // 获取文件信息
      const filePath = path.join(modelsDir, file);
      const stats = await fs.promises.stat(filePath);
      
      // 检查是否是文件（而非目录）
      if (!stats.isFile()) {
        return null;
      }

      // 判断文件类型
      const extension = path.extname(file).slice(1);
      const isModel = extension === 'ckpt' || extension === 'safetensors';
      
      // 检查是否为safetensors模型
      const isSafetensors = extension === 'safetensors';
      
      return {
        name: file,
        path: filePath,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        lastModified: stats.mtime.toISOString(),
        isDefault: config.get('defaultModel') === file,
        isModel: isModel,
        isSafetensors: isSafetensors,
        extension: extension,
        model_name: path.basename(file, path.extname(file)),
        title: file
      };
    }));
    
    // 过滤掉非文件项目
    return models.filter(model => model !== null);
  } catch (error) {
    console.error('获取模型列表失败:', error);
    throw error;
  }
}

// 导入模型文件
async function importModel(sourcePath) {
  try {
    const modelsDir = getModelsDir();
    const fileName = path.basename(sourcePath);
    let targetPath = path.join(modelsDir, fileName);
    
    // 如果文件已存在，添加时间戳
    if (fs.existsSync(targetPath)) {
      const timestamp = new Date().getTime();
      const newFileName = `${path.parse(fileName).name}_${timestamp}${path.parse(fileName).ext}`;
      targetPath = path.join(modelsDir, newFileName);
    }
    
    // 复制文件
    await pipeline(
      createReadStream(sourcePath),
      createWriteStream(targetPath)
    );
    
    // 获取文件信息
    const stats = await fs.promises.stat(targetPath);
    
    return {
      success: true,
      model: {
        name: path.basename(targetPath),
        path: targetPath,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        lastModified: stats.mtime.toISOString()
      }
    };
  } catch (error) {
    console.error('导入模型失败:', error);
    return { success: false, error: error.message };
  }
}

// 删除模型
async function deleteModel(modelName) {
  try {
    const modelsDir = getModelsDir();
    const modelPath = path.join(modelsDir, modelName);
    
    // 检查文件是否存在
    if (!fs.existsSync(modelPath)) {
      return { success: false, error: '文件不存在' };
    }
    
    // 检查是否是文件（而非目录）
    const stats = await fs.promises.stat(modelPath);
    if (!stats.isFile()) {
      return { success: false, error: '只能删除文件，不能删除目录' };
    }
    
    // 如果是默认模型，清除默认设置
    if (config.get('defaultModel') === modelName) {
      config.delete('defaultModel');
    }
    
    // 删除文件
    await fs.promises.unlink(modelPath);
    
    return { success: true };
  } catch (error) {
    console.error('删除文件失败:', error);
    return { success: false, error: error.message };
  }
}

// 设置默认模型
function setDefaultModel(modelName) {
  try {
    const modelsDir = getModelsDir();
    const modelPath = path.join(modelsDir, modelName);
    
    // 检查文件是否存在
    if (!fs.existsSync(modelPath)) {
      return { success: false, error: '模型文件不存在' };
    }
    
    // 设置默认模型
    config.set('defaultModel', modelName);
    
    return { success: true };
  } catch (error) {
    console.error('设置默认模型失败:', error);
    return { success: false, error: error.message };
  }
}

// 辅助函数：格式化文件大小
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
  else return (bytes / 1073741824).toFixed(2) + ' GB';
}

// 设置IPC处理器
function setupIpcHandlers() {
  // 获取模型列表
  ipcMain.handle('models:list', async () => {
    return await listModels();
  });
  
  // 选择并导入模型
  ipcMain.handle('models:import', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择Stable Diffusion模型文件',
      filters: [
        { name: 'SD模型文件', extensions: ['ckpt', 'safetensors'] }
      ],
      properties: ['openFile']
    });
    
    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    
    return await importModel(filePaths[0]);
  });
  
  // 删除模型
  ipcMain.handle('models:delete', async (event, modelName) => {
    return await deleteModel(modelName);
  });
  
  // 设置默认模型
  ipcMain.handle('models:setDefault', async (event, modelName) => {
    return setDefaultModel(modelName);
  });
  
  // 配置模型目录
  ipcMain.handle('models:configDir', async (event) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择模型存储目录',
      properties: ['openDirectory']
    });
    
    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    
    // 保存配置
    config.set('modelsPath', filePaths[0]);
    return { success: true, path: filePaths[0] };
  });
}

// 导出模块
module.exports = {
  setupIpcHandlers,
  listModels,
  importModel,
  deleteModel,
  setDefaultModel,
  getModelsDir
}; 