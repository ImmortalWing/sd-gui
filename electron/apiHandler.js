const axios = require('axios');
const { app, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { dialog } = require('@electron/remote/main');

// API配置
const API_CONFIG = {
  baseURL: 'http://127.0.0.1:7860/sdapi/v1',
  timeout: 120000
};

// API实例
const api = axios.create(API_CONFIG);

// 检查SD服务状态
async function checkSDServiceStatus() {
  try {
    // 首先检查根路径是否可访问
    const response = await axios.get('http://127.0.0.1:7860/');
    
    // 再检查API是否可用
    try {
      await axios.get('http://127.0.0.1:7860/sdapi/v1/sd-models');
      console.log('SD API可用，服务运行正常');
      return { running: true, apiAvailable: true };
    } catch (apiError) {
      console.warn('SD WebUI运行中，但API不可用，可能需要启用API:', apiError.message);
      return { 
        running: true, 
        apiAvailable: false, 
        error: '找到SD WebUI服务但API不可用，请确保使用--api参数启动SD' 
      };
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('无法连接到SD服务:', error.message);
      return { 
        running: false, 
        apiAvailable: false,
        error: '无法连接到Stable Diffusion服务(127.0.0.1:7860)，请确保已启动SD WebUI' 
      };
    }
    console.error('检查SD状态时出错:', error.message);
    return { running: false, apiAvailable: false, error: error.message };
  }
}

// API方法
const apiMethods = {
  // 文生图
  txt2img: async (params) => {
    try {
      // 先检查服务状态
      const status = await checkSDServiceStatus();
      if (!status.running) {
        return {
          success: false,
          error: status.error
        };
      }
      
      if (!status.apiAvailable) {
        return {
          success: false,
          error: '找到SD WebUI服务但API不可用，请确保使用--api参数启动SD'
        };
      }

      // 从参数中提取模型信息
      const modelInfo = params.model;
      let apiParams = { ...params };
      
      // 删除模型属性，因为API需要的是模型名称
      delete apiParams.model;
      
      // 设置模型名称
      if (modelInfo) {
        console.log(`设置模型: ${modelInfo}`);
        apiParams.override_settings = {
          ...(apiParams.override_settings || {}),
          sd_model_checkpoint: modelInfo
        };
      }
      
      // 如果是safetensors模型，确保使用正确的采样器和设置
      if (modelInfo && modelInfo.endsWith('.safetensors')) {
        console.log('使用safetensors模型生图:', modelInfo);
      }
      
      console.log('发送txt2img请求:', JSON.stringify(apiParams));
      const response = await api.post('/txt2img', apiParams);
      console.log('txt2img响应状态:', response.status);
      
      if (!response.data || !response.data.images || response.data.images.length === 0) {
        console.error('服务器返回了空的图像结果');
        return {
          success: false,
          error: '服务器返回了空的图像结果'
        };
      }
      
      return {
        success: true,
        data: response.data.images[0]
      };
    } catch (error) {
      console.error('txt2img生成失败:', error);
      
      // 提供更详细的错误信息
      let errorMessage = error.message;
      if (error.response) {
        console.error('服务器响应:', error.response.status, error.response.data);
        errorMessage = `服务器返回 ${error.response.status} 错误: ${JSON.stringify(error.response.data)}`;
      } else if (error.request) {
        console.error('请求未收到响应');
        errorMessage = '请求未收到响应，请检查SD服务是否正常运行';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  },

  // 图生图
  img2img: async (params) => {
    try {
      // 先检查服务状态
      const status = await checkSDServiceStatus();
      if (!status.running) {
        return {
          success: false,
          error: status.error
        };
      }
      
      const response = await api.post('/img2img', params);
      return {
        success: true,
        data: response.data.images[0]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // 获取模型列表
  getModels: async () => {
    try {
      // 先检查服务状态
      const status = await checkSDServiceStatus();
      if (!status.running) {
        return {
          success: false,
          error: status.error
        };
      }
      
      const response = await api.get('/sd-models');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// 图像工具
const imageUtils = {
  // 保存图像
  saveImage: async (base64Image) => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        title: '保存图像',
        defaultPath: path.join(app.getPath('pictures'), 'sd-generated.png'),
        filters: [
          { name: 'PNG图像', extensions: ['png'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });

      if (!filePath) {
        return {
          success: false,
          error: '用户取消了保存'
        };
      }

      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);

      return {
        success: true,
        filePath
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // 复制到剪贴板
  copyToClipboard: async (base64Image) => {
    try {
      const image = await clipboard.writeImage(base64Image);
      return {
        success: true,
        data: image
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// 文件系统工具
const fsUtils = {
  // 打开目录
  openDirectory: async (dirPath) => {
    try {
      const { shell } = require('electron');
      await shell.openPath(dirPath);
      return { success: true };
    } catch (error) {
      console.error('打开目录失败:', error);
      return { success: false, error: error.message };
    }
  }
};

// 设置IPC处理器
function setupIpcHandlers(ipcMain) {
  // 文生图
  ipcMain.handle('txt2img', async (event, params) => {
    return await apiMethods.txt2img(params);
  });

  // 图生图
  ipcMain.handle('img2img', async (event, params) => {
    return await apiMethods.img2img(params);
  });

  // 获取模型列表
  ipcMain.handle('get-models', async () => {
    return await apiMethods.getModels();
  });

  // 保存图像
  ipcMain.handle('save-image', async (event, base64Image) => {
    return await imageUtils.saveImage(base64Image);
  });

  // 复制到剪贴板
  ipcMain.handle('copy-to-clipboard', async (event, base64Image) => {
    return await imageUtils.copyToClipboard(base64Image);
  });
  
  // 打开目录
  ipcMain.handle('open-directory', async (event, dirPath) => {
    return await fsUtils.openDirectory(dirPath);
  });
}

module.exports = {
  setupIpcHandlers
}; 