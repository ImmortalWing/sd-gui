# SD-GUI 方案设计

## 1. 项目概述

SD-GUI是一个基于Electron、Vue 3和Element Plus的桌面应用程序，直接与Stable Diffusion的API进行通信，提供直观的图像生成界面。该应用将替代传统的WebUI，为用户提供更便捷的图像生成体验。

### 1.1 项目目标

- 提供直观的图像生成界面
- 支持文生图和图生图功能
- 集成提示词管理和风格预设
- 支持批量生成和高级参数调整
- 提供图像历史记录和管理功能

## 2. 技术架构

### 2.1 技术栈

- **前端**：Vue 3 + Element Plus
- **桌面框架**：Electron
- **构建工具**：Node.js、npm
- **API通信**：Axios

### 2.2 架构设计

应用采用Electron的主进程-渲染进程架构：

- **主进程(Main Process)**：
  - 负责应用生命周期管理
  - 与Stable Diffusion API通信
  - 文件系统操作
  - 系统API调用（剪贴板、文件保存等）

- **渲染进程(Renderer Process)**：
  - 基于Vue 3的用户界面
  - 使用Element Plus组件库
  - 通过IPC与主进程通信

### 2.3 目录结构

```
sd-gui/
├── electron/             # Electron主进程代码
│   ├── main.js           # 主进程入口
│   ├── preload.js        # 预加载脚本
│   └── apiHandler.js     # API处理模块
├── pages/                # 渲染进程代码
│   ├── index.html        # 主HTML页面
│   ├── router.js         # 路由配置
│   ├── element-nav.js    # 导航组件
│   └── views/            # 视图组件
│       ├── txt2img.js    # 文生图组件
│       ├── img2img.js    # 图生图组件
│       ├── history.js    # 历史记录组件
│       ├── prompts.js    # 提示词管理组件
│       └── settings.js   # 设置组件
├── assets/               # 静态资源
├── docs/                 # 文档
└── package.json          # 项目配置
```

## 3. 功能规划

### 3.1 核心功能

1. **文生图功能**
   - 提示词输入（正向/负向）
   - 图像尺寸设置
   - 采样参数调整
   - 模型选择
   - 随机种子控制

2. **图生图功能**
   - 图片上传和预览
   - 去噪强度控制
   - 提示词输入
   - 采样参数调整

3. **提示词管理**
   - 提示词库创建和管理
   - 提示词分类
   - 提示词导入导出
   - 常用提示词收藏

4. **历史记录**
   - 生成历史查看
   - 参数记录
   - 图片预览和管理
   - 历史记录导出

### 3.2 高级功能

1. **批量生成**
   - 多张图片同时生成
   - 批量参数设置
   - 进度显示
   - 结果预览

2. **风格预设**
   - 预设参数组合
   - 预设管理
   - 快速应用

3. **图像处理**
   - 脸部修复
   - 高清修复
   - 图像编辑
   - 格式转换

4. **系统集成**
   - 开机自启动
   - 系统托盘
   - 快捷键支持
   - 多语言支持

## 4. 界面设计

### 4.1 主界面布局

应用采用左侧导航+主内容区的经典布局：

- **左侧导航栏**：包含主要功能模块入口
- **主内容区**：根据不同功能模块显示对应内容
- **状态栏**：显示应用状态信息

### 4.2 主要页面

1. **文生图页面**
   - 提示词输入区
   - 参数设置面板
   - 生成控制区
   - 结果预览区

2. **图生图页面**
   - 图片上传区
   - 参数设置面板
   - 生成控制区
   - 结果预览区

3. **提示词管理页面**
   - 提示词列表
   - 分类管理
   - 编辑界面
   - 导入导出功能

4. **历史记录页面**
   - 历史记录列表
   - 图片预览
   - 参数查看
   - 管理功能

5. **设置页面**
   - API配置
   - 界面设置
   - 系统设置
   - 高级选项

## 5. 实现细节

### 5.1 API通信

```javascript
// API配置
const API_CONFIG = {
  baseURL: 'http://127.0.0.1:7860/sdapi/v1',
  timeout: 30000
};

// API请求封装
const api = {
  // 文生图
  txt2img: async (params) => {
    try {
      const response = await axios.post(`${API_CONFIG.baseURL}/txt2img`, params);
      return {
        success: true,
        image: `data:image/png;base64,${response.data.images[0]}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // 图生图
  img2img: async (params) => {
    try {
      const response = await axios.post(`${API_CONFIG.baseURL}/img2img`, params);
      return {
        success: true,
        image: `data:image/png;base64,${response.data.images[0]}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  
  // 获取模型列表
  getModels: async () => {
    try {
      const response = await axios.get(`${API_CONFIG.baseURL}/sd-models`);
      return response.data;
    } catch (error) {
      return [];
    }
  }
};
```

### 5.2 数据存储

使用Electron Store进行配置和数据的持久化存储：

```javascript
const Store = require('electron-store');

const store = new Store({
  name: 'sd-gui-config',
  schema: {
    apiUrl: {
      type: 'string',
      default: 'http://127.0.0.1:7860/sdapi/v1'
    },
    prompts: {
      type: 'array',
      default: []
    },
    history: {
      type: 'array',
      default: []
    },
    settings: {
      type: 'object',
      default: {
        theme: 'light',
        language: 'zh-CN',
        autoStart: false
      }
    }
  }
});
```

### 5.3 图像处理

```javascript
// 图像处理工具
const imageUtils = {
  // 保存图像
  saveImage: async (imageData) => {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    const { filePath } = await dialog.showSaveDialog({
      title: '保存图像',
      defaultPath: path.join(app.getPath('pictures'), `sd_${Date.now()}.png`),
      filters: [{ name: '图像文件', extensions: ['png'] }]
    });
    
    if (filePath) {
      fs.writeFileSync(filePath, buffer);
      return { success: true, path: filePath };
    }
    return { success: false, canceled: true };
  },
  
  // 复制到剪贴板
  copyToClipboard: async (imageData) => {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const image = nativeImage.createFromBuffer(buffer);
    clipboard.writeImage(image);
    return { success: true };
  }
};
```

## 6. 后续开发计划

### 6.1 阶段一：基础功能实现

- 完成基本UI界面
- 实现文生图功能
- 实现图生图功能
- 基础设置功能

### 6.2 阶段二：功能完善

- 提示词管理系统
- 历史记录功能
- 批量生成功能
- 图像处理功能

### 6.3 阶段三：高级功能

- 风格预设系统
- 高级参数调整
- 性能优化
- 多语言支持

### 6.4 阶段四：优化和扩展

- 界面美化
- 用户体验优化
- 插件系统
- 社区功能

## 7. 开发和调试

### 7.1 开发环境设置

1. 安装依赖：
```bash
npm install
```

2. 启动开发模式：
```bash
npm run dev
```

### 7.2 构建应用

```bash
npm run build
```

### 7.3 打包分发

```bash
npm run package
```

## 8. 总结

SD-GUI项目将为Stable Diffusion用户提供一个直观、高效的图像生成工具，通过现代化的界面设计和丰富的功能，提升用户的使用体验。项目采用Electron、Vue 3和Element Plus的技术栈，确保跨平台兼容性和良好的性能表现。 