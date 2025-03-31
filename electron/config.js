const Store = require('electron-store');

// 配置默认值
const defaultConfig = {
  sdPath: '',            // Stable Diffusion安装路径
  pythonPath: '',        // 自定义Python解释器路径
  port: 7860,            // Web UI端口
  lowVram: false,        // 低显存模式
  enableXformers: true,  // 启用xFormers加速
  autoLaunchBrowser: true, // 自动启动浏览器
  outputEncoding: 'utf8', // 默认输出编码
  useShiftJIS: false,      // 是否使用Shift-JIS编码 (用于特定日文环境)
  offlineMode: false,
  skipTorchCudaTest: false,
  skipPythonCheck: false,
  noDownloadModels: false,
  customArgs: ''
};

// 创建配置存储实例
const config = new Store({
  defaults: defaultConfig,
  clearInvalidConfig: true
});

module.exports = {
  config
}; 