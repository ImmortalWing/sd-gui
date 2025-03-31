const Store = require('electron-store');

// 创建配置存储实例
const config = new Store({
  name: 'sd-launcher-config',
  defaults: {
    sdPath: '',
    pythonPath: '',
    port: 7860,
    lowVram: false,
    enableXformers: true,
    autoLaunchBrowser: true,
    offlineMode: false,
    skipTorchCudaTest: false,
    skipPythonCheck: false,
    noDownloadModels: false,
    customArgs: ''
  }
});

module.exports = {
  config
}; 