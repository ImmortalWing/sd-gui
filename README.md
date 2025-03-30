# SD-GUI

SD-GUI是一个基于Electron、Vue 3和Element Plus的桌面应用程序，用于与Stable Diffusion API进行交互，提供直观的图像生成界面。

## 功能特点

- 文生图：通过文本提示词生成图像
- 图生图：基于现有图像生成新的图像
- 模型管理：支持多个Stable Diffusion模型
- 参数调整：提供丰富的生成参数设置
- 图像保存：支持保存生成的图像
- 剪贴板集成：支持复制图像到剪贴板

## 系统要求

- Node.js 16.0.0或更高版本
- npm 7.0.0或更高版本
- Stable Diffusion WebUI（需要启用API）

## 安装

1. 克隆项目：
```bash
git clone https://github.com/yourusername/sd-gui.git
cd sd-gui
```

2. 安装依赖：
```bash
npm install
```

3. 启动开发模式：
```bash
npm run dev
```

4. 构建应用：
```bash
npm run build
```

## 使用方法

1. 确保Stable Diffusion WebUI已经启动并启用了API（默认地址：http://127.0.0.1:7860）

2. 启动SD-GUI应用

3. 在左侧导航栏选择功能：
   - 文生图：输入提示词生成图像
   - 图生图：上传图片并输入提示词生成新图像
   - 设置：配置API地址和其他选项

4. 调整生成参数：
   - 选择模型
   - 设置采样器
   - 调整图像尺寸
   - 设置采样步数
   - 调整CFG Scale
   - 设置随机种子

5. 点击"生成图像"按钮开始生成

6. 生成完成后可以：
   - 保存图像到本地
   - 复制图像到剪贴板
   - 继续生成新的图像

## 开发

### 项目结构

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
│       └── settings.js   # 设置组件
├── assets/               # 静态资源
└── package.json          # 项目配置
```

### 开发模式

```bash
npm run dev
```

### 构建应用

Windows:
```bash
npm run build
```

macOS:
```bash
npm run build:mac
```

Linux:
```bash
npm run build:linux
```

## 贡献

欢迎提交Issue和Pull Request！

## 许可证

MIT License 
