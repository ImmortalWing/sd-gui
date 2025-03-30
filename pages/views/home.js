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
        />
        <el-input
          v-else
          type="textarea"
          v-model="errorLogs"
          autosize
          readonly
          class="log-area error-log-area"
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
    
    // 启动选项
    const launchOptions = window.Vue.reactive({
      port: 7860,
      lowVram: false,
      enableXformers: true,
      autoLaunchBrowser: true,
      customArgs: '--medvram --opt-split-attention',  // 添加medvram和优化参数
      model: '',
      offlineMode: true,  // 默认开启离线模式
      skipTorchCudaTest: true,  // 跳过CUDA测试
      skipPythonCheck: true,  // 跳过Python版本检查
      noDownloadModels: true  // 不下载模型
    });
    
    // 加载配置
    const loadConfig = async () => {
      try {
        // 加载SD路径
        sdPath.value = await window.electron.config.get('sdPath') || '';
        
        // 加载启动参数
        const savedParams = await window.electron.config.get('launchParams');
        if (savedParams) {
          Object.assign(launchOptions, savedParams);
          port.value = launchOptions.port;
        }
        
        // 获取运行状态
        const status = await window.electron.sdLauncher.getStatus();
        isRunning.value = status.isRunning;
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    };
    
    // 保存设置
    const saveSettings = async () => {
      try {
        await window.electron.config.set('launchParams', { ...launchOptions });
        ElMessage.success('设置已保存');
      } catch (error) {
        console.error('保存设置失败:', error);
        ElMessage.error('保存设置失败');
      }
    };
    
    // 启动SD
    const handleLaunch = async () => {
      if (sdPath.value === '') {
        ElMessage.warning('请先配置Stable Diffusion路径');
        return;
      }
      
      isLoading.value = true;
      logs.value = '';
      // 保留错误日志，只添加分隔线
      errorLogs.value += '\n------------- 新启动会话 --------------\n\n';
      
      try {
        // 先检查路径是否存在
        try {
          const pathCheckResult = await window.electron.config.setSdPath(sdPath.value);
          if (!pathCheckResult.success) {
            ElMessage.error(`SD路径无效: ${pathCheckResult.error || '请检查路径是否存在'}`);
            isLoading.value = false;
            return;
          }
        } catch (pathError) {
          console.error('检查SD路径失败:', pathError);
          ElMessage.error(`检查SD路径失败: ${pathError.message}`);
          isLoading.value = false;
          return;
        }
        
        // 创建一个简单的纯对象，避免传递复杂的响应式对象
        const options = {
          sdPath: sdPath.value, // 确保传递sdPath
          port: launchOptions.port,
          lowVram: launchOptions.lowVram,
          enableXformers: launchOptions.enableXformers,
          autoLaunchBrowser: launchOptions.autoLaunchBrowser,
          customArgs: launchOptions.customArgs || '',
          model: launchOptions.model || '',
          offlineMode: launchOptions.offlineMode,
          skipTorchCudaTest: launchOptions.skipTorchCudaTest,
          skipPythonCheck: launchOptions.skipPythonCheck,
          noDownloadModels: launchOptions.noDownloadModels
        };
        
        console.log('启动选项:', options);
        
        // 使用sdLauncher.launch发送纯对象
        const result = await window.electron.sdLauncher.launch(options);
        
        if (result && result.success) {
          ElMessage.success('正在启动Stable Diffusion服务');
          isRunning.value = true;
          port.value = launchOptions.port;
        } else {
          // 显示更详细的错误信息
          const errorMessage = result && result.error ? result.error : '未知错误';
          console.error('启动失败:', errorMessage);
          ElMessage.error(`启动失败: ${errorMessage}`);
          
          // 如果有特定的错误，给出建议
          if (errorMessage.includes('CUDA') || errorMessage.includes('显存')) {
            ElMessage.warning('提示: 尝试启用"低VRAM模式"可能会解决显存不足问题');
          } else if (errorMessage.includes('Python')) {
            ElMessage.warning('提示: 检查Python路径是否正确，或在设置中指定Python解释器路径');
          } else if (errorMessage.includes('找不到') || errorMessage.includes('无效')) {
            ElMessage.warning('提示: 请检查SD安装路径是否正确');
          }
        }
      } catch (error) {
        console.error('启动失败:', error);
        ElMessage.error(`启动失败: ${error.message}`);
        
        // 根据错误类型给出建议
        if (error.message.includes('timeout') || error.message.includes('超时')) {
          ElMessage.warning('提示: 启动超时可能是系统资源不足，尝试关闭其他程序后重试');
        }
      } finally {
        isLoading.value = false;
      }
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
    
    // 监听SD日志
    const setupListeners = () => {
      // 日志监听
      window.electron.sdLauncher.onLog((log) => {
        try {
          if (log) {
            const timestamp = new Date().toLocaleTimeString();
            logs.value += `[${timestamp}] ${log}\n`;
            // 保持滚动到底部
            const logElement = document.querySelector('.log-area textarea');
            if (logElement) {
              logElement.scrollTop = logElement.scrollHeight;
            }
          }
        } catch (error) {
          console.error('处理日志错误:', error);
        }
      });
      
      // 启动成功监听
      window.electron.sdLauncher.onStarted((status) => {
        isRunning.value = true;
        isLoading.value = false;
        ElMessage.success('Stable Diffusion服务已成功启动');
      });
      
      // 错误监听
      window.electron.sdLauncher.onError((error) => {
        if (error) {
          const timestamp = new Date().toLocaleTimeString();
          errorLogs.value += `[${timestamp}] [错误] ${error}\n`;
          ElMessage.error(`发生错误: ${error}`);
          
          // 自动切换到错误日志标签页以显示错误
          activeLogTab.value = 'error';
          
          // 如果在启动过程中发生错误，重置加载状态
          if (isLoading.value) {
            isLoading.value = false;
          }
          
          // 保持滚动到底部
          setTimeout(() => {
            const logElement = document.querySelector('.error-log-area textarea');
            if (logElement) {
              logElement.scrollTop = logElement.scrollHeight;
            }
          }, 100);
        }
      });
      
      // 状态监听
      window.electron.sdLauncher.onStatusChange((status) => {
        // 确保status是个对象，如果不是则使用默认值
        const statusObj = typeof status === 'object' ? status : { isRunning: false };
        isRunning.value = statusObj.isRunning;
        
        if (!statusObj.isRunning) {
          isStoppingLoading.value = false;
          ElMessage.info('Stable Diffusion服务已停止');
        }
      });
    };
    
    // 组件挂载时
    window.Vue.onMounted(() => {
      loadConfig();
      setupListeners();
    });
    
    // 组件卸载前
    window.Vue.onBeforeUnmount(() => {
      // 移除事件监听
      if (window.electron && window.electron.sdLauncher) {
        window.electron.sdLauncher.removeAllListeners();
      }
    });
    
    // 清除错误日志
    const clearErrorLogs = () => {
      errorLogs.value = '';
      ElMessage.success('错误日志已清除');
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
      clearErrorLogs
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