// 获取Vue方法
const { ElMessage } = ElementPlus;

// 首页组件
window.Home = {
  template: `
    <div class="home-container">
      <h1>Stable Diffusion 启动器</h1>
      
      <div class="quick-actions" v-if="sdPath !== ''">
        <el-button 
          type="danger"
          size="small"
          @click="handleStopService"
          :loading="isStoppingLoading"
          :disabled="!isRunning"
          class="stop-service-btn"
        >
          <el-icon><PowerOff /></el-icon> 关闭SD服务
        </el-button>
        <span class="service-status" v-if="isRunning">
          <el-tag type="success" size="small">服务运行中</el-tag>
        </span>
        <span class="service-status" v-else>
          <el-tag type="info" size="small">服务未运行</el-tag>
        </span>
      </div>
      
      <div class="status-card">
        <el-alert
          v-if="sdPath === ''"
          title="未配置Stable Diffusion路径"
          type="warning"
          description="请先在设置页面配置Stable Diffusion安装路径"
          show-icon
          :closable="false"
        />
        
        <div class="status-info" v-if="isRunning">
          <el-tag type="success" size="large">运行中</el-tag>
          <p>状态: 服务已启动</p>
          <p v-if="port">Web界面访问地址: <a @click="openBrowser">http://localhost:{{port}}</a></p>
        </div>
        <div class="status-info" v-else>
          <el-tag type="info" size="large">未运行</el-tag>
          <p>状态: 服务未启动</p>
        </div>
      </div>
      
      <div class="control-panel">
        <el-button 
          v-if="!isRunning"
          type="primary"
          size="large"
          :disabled="sdPath === ''"
          @click="handleLaunch"
          :loading="isLoading"
          class="launch-btn"
        >
          启动 Stable Diffusion
        </el-button>
        
        <el-button 
          v-else
          type="danger"
          size="large"
          @click="handleStop"
          :loading="isStoppingLoading"
          class="stop-btn"
        >
          停止服务
        </el-button>
      </div>
      
      <div class="settings-panel" v-if="!isRunning">
        <h3>启动设置</h3>
        <el-form label-position="left" label-width="120px">
          <el-form-item label="端口号">
            <el-input-number v-model="launchOptions.port" :min="1024" :max="65535" />
          </el-form-item>
          
          <el-form-item label="低VRAM模式">
            <el-switch v-model="launchOptions.lowVram" />
          </el-form-item>
          
          <el-form-item label="启用xFormers">
            <el-switch v-model="launchOptions.enableXformers" />
          </el-form-item>
          
          <el-form-item label="自动打开浏览器">
            <el-switch v-model="launchOptions.autoLaunchBrowser" />
          </el-form-item>
          
          <el-form-item label="离线模式">
            <el-switch v-model="launchOptions.offlineMode" />
            <div class="description-text">
              <small>离线模式不会尝试下载模型和更新Git仓库（解决网络连接问题）</small>
            </div>
          </el-form-item>
          
          <el-form-item label="跳过CUDA测试">
            <el-switch v-model="launchOptions.skipTorchCudaTest" />
          </el-form-item>
          
          <el-form-item label="跳过Python检查">
            <el-switch v-model="launchOptions.skipPythonCheck" />
          </el-form-item>
          
          <el-form-item label="不下载模型">
            <el-switch v-model="launchOptions.noDownloadModels" />
          </el-form-item>
          
          <el-form-item>
            <el-button type="success" @click="saveSettings">保存设置</el-button>
          </el-form-item>
        </el-form>
      </div>
      
      <div class="log-panel" v-if="isRunning">
        <h3>日志输出</h3>
        <div class="log-tabs">
          <el-radio-group v-model="activeLogTab" size="small">
            <el-radio-button label="normal">标准日志</el-radio-button>
            <el-radio-button label="error">错误日志</el-radio-button>
          </el-radio-group>
          <el-button 
            v-if="activeLogTab === 'error' && errorLogs" 
            size="small" 
            type="danger" 
            @click="clearErrorLogs"
            style="margin-left: 10px;"
          >
            清除错误日志
          </el-button>
        </div>
        <el-input
          v-if="activeLogTab === 'normal'"
          type="textarea"
          v-model="logs"
          autosize
          readonly
          class="log-area"
          ref="logAreaRef"
        />
        <el-input
          v-else
          type="textarea"
          v-model="errorLogs"
          autosize
          readonly
          class="log-area error-log-area"
          ref="errorLogAreaRef"
        />
      </div>
    </div>
  `,
  setup() {
    const isLoading = window.Vue.ref(false);
    const isStoppingLoading = window.Vue.ref(false);
    const isRunning = window.Vue.ref(false);
    const sdPath = window.Vue.ref('');
    const logs = window.Vue.ref('');
    const errorLogs = window.Vue.ref('');
    const port = window.Vue.ref(7860);
    const activeLogTab = window.Vue.ref('normal');
    const logAreaRef = window.Vue.ref(null);
    const errorLogAreaRef = window.Vue.ref(null);
    
    // 启动选项
    const launchOptions = window.Vue.reactive({
      port: 7860,
      lowVram: false,
      enableXformers: true,
      autoLaunchBrowser: true,
      customArgs: '--medvram', // 更改为更通用的默认参数
      model: '',
      offlineMode: true,
      skipTorchCudaTest: true,
      skipPythonCheck: true,
      noDownloadModels: true
    });

    // 防抖函数
    const debounce = (fn, delay) => {
      let timer = null;
      return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    };

    // 滚动到底部的函数
    const scrollToBottom = debounce((element) => {
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    }, 100);

    // 加载配置
    const loadConfig = async () => {
      try {
        sdPath.value = await window.electron.config.get('sdPath') || '';
        
        const savedParams = await window.electron.config.get('launchParams');
        if (savedParams) {
          Object.assign(launchOptions, savedParams);
          port.value = launchOptions.port;
        }
        
        const status = await window.electron.sdLauncher.getStatus();
        isRunning.value = status.isRunning;
      } catch (error) {
        console.error('加载配置失败:', error);
        ElMessage.error('加载配置失败，请检查配置文件');
      }
    };
    
    // 保存设置
    const saveSettings = async () => {
      try {
        const settingsToSave = {
          ...launchOptions,
          port: port.value
        };
        await window.electron.config.set('launchParams', settingsToSave);
        ElMessage.success('设置已保存');
      } catch (error) {
        console.error('保存设置失败:', error);
        ElMessage.error('保存设置失败');
      }
    };

    // 错误分类处理
    const handleError = (error) => {
      try {
        const timestamp = new Date().toLocaleTimeString();
        let errorMessage = '';
        
        // 处理不同类型的错误输入
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          // 尝试处理可能的编码问题
          try {
            errorMessage = Buffer.from(error, 'binary').toString('utf8');
          } catch (e) {
            errorMessage = error;
          }
        } else if (error && typeof error === 'object') {
          errorMessage = error.message || error.error || JSON.stringify(error);
        } else {
          errorMessage = String(error);
        }
        
        // 记录错误日志
        errorLogs.value += `[${timestamp}] [错误] ${errorMessage}\n`;
        
        // 根据错误类型提供建议
        if (errorMessage.includes('CUDA') || errorMessage.includes('显存')) {
          ElMessage.warning('提示: 尝试启用"低VRAM模式"可能会解决显存不足问题');
        } else if (error.code === 'ENOENT') {
          ElMessage.error('文件不存在，请检查路径');
        } else if (errorMessage.includes('Python')) {
          ElMessage.warning('提示: 检查Python路径是否正确，或在设置中指定Python解释器路径');
          // 尝试获取Python版本信息
          try {
            const pythonPath = `${sdPath.value}/python/python.exe`;
            window.electron.ipcRenderer.invoke('get-python-version', pythonPath)
              .then(version => {
                if (version) {
                  ElMessage.info(`当前Python版本: ${version}`);
                }
              })
              .catch(e => console.error('获取Python版本失败:', e));
          } catch (e) {
            console.error('获取Python版本失败:', e);
          }
        } else if (errorMessage.includes('找不到') || errorMessage.includes('无效') || errorMessage.includes('不存在')) {
          ElMessage.warning('提示: 请检查SD安装路径是否正确');
          // 尝试列出目录内容
          try {
            window.electron.ipcRenderer.invoke('list-directory', sdPath.value)
              .then(contents => {
                if (contents) {
                  console.log('目录内容:', contents);
                  ElMessage.info('已记录目录内容到控制台');
                }
              })
              .catch(e => console.error('列出目录内容失败:', e));
          } catch (e) {
            console.error('列出目录内容失败:', e);
          }
        } else if (errorMessage.includes('乱码') || errorMessage.includes('编码') || errorMessage.includes('锟')) {
          ElMessage.warning('提示: 存在字符编码问题，请检查：\n1. 路径中是否包含中文或特殊字符\n2. 系统环境变量是否正确设置\n3. Python环境是否正确配置');
          // 获取系统编码信息
          try {
            const encoding = process.env.LANG || process.env.LC_ALL || '未设置';
            console.log('系统编码设置:', encoding);
            ElMessage.info(`当前系统编码设置: ${encoding}`);
          } catch (e) {
            console.error('获取系统编码信息失败:', e);
          }
        } else if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
          ElMessage.warning('提示: 启动超时可能是系统资源不足，尝试关闭其他程序后重试');
        } else if (errorMessage.includes('命令未找到') || errorMessage.includes('不是内部或外部命令')) {
          ElMessage.error('提示: 命令执行失败，请检查：\n1. Python环境是否正确安装\n2. 系统环境变量是否正确配置\n3. 启动脚本是否存在');
        } else {
          // 未知错误类型
          console.error('未知错误类型:', error);
          ElMessage.error('发生未知错误，请查看错误日志了解详情');
        }
        
        // 自动切换到错误日志标签页
        activeLogTab.value = 'error';
        
        // 滚动错误日志到底部
        setTimeout(() => {
          const errorElement = errorLogAreaRef.value?.$el?.querySelector('textarea');
          scrollToBottom(errorElement);
        }, 100);
      } catch (e) {
        console.error('错误处理过程中发生异常:', e);
        // 确保至少记录原始错误
        const timestamp = new Date().toLocaleTimeString();
        errorLogs.value += `[${timestamp}] [错误] 错误处理失败: ${e.message}\n`;
        errorLogs.value += `[${timestamp}] [错误] 原始错误: ${String(error)}\n`;
      }
    };

    // 清除错误日志
    const clearErrorLogs = () => {
      errorLogs.value = '';
      window.Vue.nextTick(() => {
        const errorElement = errorLogAreaRef.value?.$el?.querySelector('textarea');
        scrollToBottom(errorElement);
      });
      ElMessage.success('错误日志已清除');
    };

    // 设置事件监听器
    const setupListeners = () => {
      const onLogHandler = (log) => {
        if (log) {
          const timestamp = new Date().toLocaleTimeString();
          // 尝试处理可能的编码问题
          let processedLog = log;
          try {
            // 如果是 Buffer，转换为字符串
            if (Buffer.isBuffer(log)) {
              processedLog = log.toString('utf8');
            }
            // 如果是其他类型，转换为字符串
            else if (typeof log !== 'string') {
              processedLog = String(log);
            }
          } catch (e) {
            console.error('日志处理错误:', e);
            processedLog = '日志处理失败';
          }
          
          logs.value += `[${timestamp}] ${processedLog}\n`;
          const logElement = logAreaRef.value?.$el?.querySelector('textarea');
          scrollToBottom(logElement);
        }
      };

      const onStartedHandler = (status) => {
        isRunning.value = true;
        isLoading.value = false;
        ElMessage.success('Stable Diffusion服务已成功启动');
      };

      const onErrorHandler = (error) => {
        // 尝试处理可能的编码问题
        let processedError = error;
        try {
          if (Buffer.isBuffer(error)) {
            processedError = error.toString('utf8');
          } else if (typeof error !== 'string') {
            processedError = String(error);
          }
        } catch (e) {
          console.error('错误处理错误:', e);
          processedError = '错误处理失败';
        }
        
        handleError(processedError);
        if (isLoading.value) {
          isLoading.value = false;
        }
      };

      const onStatusChangeHandler = (status) => {
        const statusObj = typeof status === 'object' ? status : { isRunning: false };
        isRunning.value = statusObj.isRunning;
        
        if (!statusObj.isRunning) {
          isStoppingLoading.value = false;
          ElMessage.info('Stable Diffusion服务已停止');
        }
      };

      window.electron.sdLauncher.onLog(onLogHandler);
      window.electron.sdLauncher.onStarted(onStartedHandler);
      window.electron.sdLauncher.onError(onErrorHandler);
      window.electron.sdLauncher.onStatusChange(onStatusChangeHandler);

      // 保存处理器引用以便后续移除
      return {
        onLogHandler,
        onStartedHandler,
        onErrorHandler,
        onStatusChangeHandler
      };
    };

    // 组件挂载时
    window.Vue.onMounted(() => {
      loadConfig();
      const handlers = setupListeners();

      // 创建全局启动函数
      if (!window.launchSdService) {
        window.launchSdService = async (sdPath, options, callbacks = {}) => {
          const { onLoading, onSuccess, onClearLogs } = callbacks;
          
          if (!sdPath) {
            console.error('[SD GUI] 错误: SD路径未设置');
            ElMessage.warning('请先配置Stable Diffusion路径');
            return { success: false, error: '未配置Stable Diffusion路径' };
          }
          
          // 检查路径有效性
          try {
            // 规范化路径
            const normalizedPath = sdPath.replace(/\\/g, '/');
            
            const pathExists = await window.electron.ipcRenderer.invoke('path-exists', normalizedPath);
            if (!pathExists) {
              throw new Error('SD路径不存在');
            }

            // 检查启动脚本
            const launchFileExists = await window.electron.ipcRenderer.invoke('path-exists', `${normalizedPath}/launch.py`) ||
              await window.electron.ipcRenderer.invoke('path-exists', `${normalizedPath}/webui.py`);

            if (!launchFileExists) {
              throw new Error('启动脚本不存在');
            }

            // 检查Python环境
            const pythonPath = `${normalizedPath}/python/python.exe`;
            const pythonExists = await window.electron.ipcRenderer.invoke('path-exists', pythonPath);
            if (!pythonExists) {
              throw new Error('Python环境不存在');
            }
          } catch (error) {
            console.error('[SD GUI] 路径检查错误:', error);
            ElMessage.error(`路径检查失败: ${error.message}`);
            return { success: false, error: error.message };
          }

          if (onLoading) onLoading(true);
          if (onClearLogs) onClearLogs();

          try {
            // 验证SD路径
            const pathCheckResult = await window.electron.config.setSdPath(sdPath);
            if (!pathCheckResult.success) {
              throw new Error(pathCheckResult.error || '路径验证失败');
            }

            // 准备启动参数
            const cleanOptions = {
              sdPath: sdPath.replace(/\\/g, '/'), // 统一使用正斜杠
              port: options.port || 7860,
              lowVram: !!options.lowVram,
              enableXformers: options.enableXformers !== false,
              autoLaunchBrowser: options.autoLaunchBrowser !== false,
              customArgs: options.customArgs || '',
              model: options.model || '',
              offlineMode: options.offlineMode !== false,
              skipTorchCudaTest: options.skipTorchCudaTest !== false,
              skipPythonCheck: options.skipPythonCheck !== false,
              noDownloadModels: options.noDownloadModels !== false,
              encoding: 'utf-8',
              // 添加Python相关路径
              pythonPath: `${sdPath}/python/python.exe`,
              launchScript: `${sdPath}/launch.py`,
              // 添加环境变量设置
              env: {
                PYTHONIOENCODING: 'utf-8',
                PYTHONUTF8: '1',
                LANG: 'zh_CN.UTF-8',
                LC_ALL: 'zh_CN.UTF-8'
              }
            };

            // 构建启动命令
            const args = [
              '--port', cleanOptions.port.toString(),
              cleanOptions.lowVram ? '--lowvram' : '',
              cleanOptions.enableXformers ? '--xformers' : '',
              cleanOptions.autoLaunchBrowser ? '--autolaunch' : '',
              cleanOptions.offlineMode ? '--offline' : '',
              cleanOptions.skipTorchCudaTest ? '--skip-torch-cuda-test' : '',
              cleanOptions.skipPythonCheck ? '--skip-python-version-check' : '',
              cleanOptions.noDownloadModels ? '--no-download-models' : '',
              cleanOptions.customArgs
            ].filter(Boolean).join(' ');

            // 启动服务
            const result = await window.electron.sdLauncher.launch({
              ...cleanOptions,
              command: `cd "${cleanOptions.sdPath}" && "${cleanOptions.pythonPath}" "${cleanOptions.launchScript}" ${args}`,
              // 添加编码设置
              encoding: 'utf-8',
              // 添加shell选项
              shell: true,
              // 添加工作目录
              cwd: cleanOptions.sdPath
            });
            
            if (result && result.success) {
              ElMessage.success('正在启动Stable Diffusion服务');
              if (onSuccess) onSuccess(cleanOptions.port);
              return { success: true };
            } else {
              throw new Error(result?.error || '启动失败');
            }
          } catch (error) {
            handleError(error);
            return { success: false, error: error.message };
          } finally {
            if (onLoading) onLoading(false);
          }
        };
      }

      // 组件卸载时移除事件监听
      window.Vue.onBeforeUnmount(() => {
        if (window.electron?.sdLauncher) {
          window.electron.sdLauncher.removeListener('log', handlers.onLogHandler);
          window.electron.sdLauncher.removeListener('started', handlers.onStartedHandler);
          window.electron.sdLauncher.removeListener('error', handlers.onErrorHandler);
          window.electron.sdLauncher.removeListener('statusChange', handlers.onStatusChangeHandler);
        }
      });
    });

    // 启动SD - 现在更加清晰的启动函数，可以被其他页面重用
    const handleLaunch = async () => {
      // 调用共享的启动函数
      await window.launchSdService(sdPath.value, launchOptions, {
        onLoading: (isLoading) => {
          isLoading.value = isLoading;
        },
        onSuccess: (port) => {
          isRunning.value = true;
          port.value = port;
        },
        onClearLogs: () => {
          logs.value = '';
          errorLogs.value += '\n------------- 新启动会话 --------------\n\n';
        }
      });
    };
    
    // 停止SD
    const handleStop = async () => {
      isStoppingLoading.value = true;
      
      try {
        const result = await window.electron.sdLauncher.stop();
        
        if (result.success) {
          ElMessage.success('停止服务命令已发送');
        } else {
          ElMessage.error(`停止失败: ${result.error}`);
        }
      } catch (error) {
        console.error('停止失败:', error);
        ElMessage.error(`停止失败: ${error.message}`);
      } finally {
        isStoppingLoading.value = false;
      }
    };
    
    // 快速停止SD服务
    const handleStopService = async () => {
      if (!isRunning.value) {
        ElMessage.info('服务未在运行');
        return;
      }
      
      isStoppingLoading.value = true;
      
      try {
        const result = await window.electron.sdLauncher.stop();
        
        if (result.success) {
          ElMessage.success('停止服务命令已发送');
        } else {
          ElMessage.error(`停止失败: ${result.error}`);
        }
      } catch (error) {
        console.error('停止失败:', error);
        ElMessage.error(`停止失败: ${error.message}`);
      } finally {
        isStoppingLoading.value = false;
      }
    };
    
    // 打开浏览器
    const openBrowser = () => {
      if (window.isElectron) {
        window.open(`http://localhost:${port.value}`);
      }
    };
    
    return {
      sdPath,
      isRunning,
      isLoading,
      isStoppingLoading,
      logs,
      errorLogs,
      port,
      launchOptions,
      handleLaunch,
      handleStop,
      handleStopService,
      saveSettings,
      openBrowser,
      activeLogTab,
      clearErrorLogs,
      logAreaRef,
      errorLogAreaRef
    };
  }
};

// 添加组件样式
const style = document.createElement('style');
style.textContent = `
  .home-container {
    padding: 20px;
  }
  
  .quick-actions {
    display: flex;
    align-items: center;
    margin: 10px 0;
    padding: 8px;
    border-radius: 4px;
    background-color: #f0f9eb;
    border-left: 4px solid #67c23a;
  }
  
  .service-status {
    margin-left: 10px;
  }
  
  .stop-service-btn {
    display: flex;
    align-items: center;
  }
  
  .status-card {
    margin: 20px 0;
    padding: 15px;
    border-radius: 8px;
    background-color: #f7f9fc;
    box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  }
  
  .status-info {
    margin: 10px 0;
  }
  
  .control-panel {
    margin: 20px 0;
    display: flex;
    justify-content: center;
  }
  
  .launch-btn, .stop-btn {
    min-width: 200px;
  }
  
  .settings-panel {
    margin: 20px 0;
    padding: 15px;
    border-radius: 8px;
    background-color: #f7f9fc;
    box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  }
  
  .log-panel {
    margin: 20px 0;
  }
  
  .log-tabs {
    margin-bottom: 10px;
  }
  
  .log-area {
    font-family: monospace;
    background-color: #000;
    color: #e0e0e0;
    border-radius: 4px;
    height: 300px;
    overflow-y: auto;
  }
  
  .error-log-area textarea {
    background-color: #1a0000;
    color: #ff9999;
  }
`;
document.head.appendChild(style); 