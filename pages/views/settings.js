// 设置页面组件
window.Settings = {
  template: `
    <div class="settings-container">
      <el-row :gutter="16">
        <!-- 左侧：基本设置 -->
        <el-col :xs="24" :sm="12">
          <el-card class="setting-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <h3>基本设置</h3>
              </div>
            </template>
            
            <el-form label-position="top" size="small" class="setting-form">
              <el-form-item label="SD安装路径">
                <div class="path-selector">
                  <el-input v-model="sdPath" placeholder="请选择SD安装目录" readonly />
                  <el-button type="primary" @click="selectSdPath">选择目录</el-button>
                </div>
                <div v-if="sdPath" class="path-info">
                  <el-tag type="success" v-if="sdPathValid" size="small">路径有效</el-tag>
                  <el-tag type="danger" v-else size="small">路径无效</el-tag>
                  <span v-if="sdPathError" class="error-msg">{{ sdPathError }}</span>
                </div>
              </el-form-item>

              <el-form-item label="模型存储目录">
                <div class="path-selector">
                  <el-input v-model="modelsPath" placeholder="请选择模型存储目录" readonly />
                  <el-button type="primary" @click="selectModelsPath">选择目录</el-button>
                </div>
                <div v-if="modelsPath" class="path-info">
                  <el-tag type="success" size="small">已设置</el-tag>
                  <el-button type="text" size="small" @click="openModelsFolder">打开目录</el-button>
                </div>
              </el-form-item>

              <el-form-item label="Python解释器路径">
                <div class="path-selector">
                  <el-input v-model="pythonPath" placeholder="请选择Python解释器（可选）" readonly />
                  <el-button type="primary" @click="selectPythonPath">选择Python</el-button>
                </div>
                <div v-if="pythonPath" class="path-info">
                  <el-tag type="success" v-if="pythonPathValid && !pythonPathWarning" size="small">有效</el-tag>
                  <el-tag type="warning" v-if="pythonPathValid && pythonPathWarning" size="small">已设置(有警告)</el-tag>
                  <el-tag type="danger" v-else-if="!pythonPathValid" size="small">无效</el-tag>
                  <span v-if="pythonPathError" class="error-msg">{{ pythonPathError }}</span>
                </div>
                <div class="path-tip">
                  <small>如果您的SD版本没有自带Python环境或需要使用特定版本的Python，请配置此项</small>
                </div>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>

        <!-- 右侧：界面设置 -->
        <el-col :xs="24" :sm="12">
          <el-card class="setting-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <h3>界面设置</h3>
              </div>
            </template>
            
            <el-form label-position="top" size="small" class="setting-form">
              <el-form-item label="主题">
                <el-radio-group v-model="uiSettings.theme">
                  <el-radio label="light">浅色</el-radio>
                  <el-radio label="dark">深色</el-radio>
                </el-radio-group>
              </el-form-item>
              
              <el-form-item label="开机自启动">
                <el-switch v-model="uiSettings.autoStart" />
              </el-form-item>
              
              <el-form-item>
                <el-button type="primary" @click="saveUiSettings" size="small">保存界面设置</el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="16" class="mt-16">
        <!-- 左侧：关于信息 -->
        <el-col :xs="24" :sm="12">
          <el-card class="setting-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <h3>关于</h3>
              </div>
            </template>
            
            <div class="about-info">
              <p><strong>SD Launcher</strong> - Stable Diffusion启动与管理工具</p>
              <p>版本: 1.0.0</p>
              <p>使用Electron + Vue 3 + Element Plus构建</p>
            </div>
          </el-card>
        </el-col>

        <!-- 右侧：系统信息 -->
        <el-col :xs="24" :sm="12">
          <el-card class="setting-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <h3>系统信息</h3>
              </div>
            </template>
            
            <div class="system-info">
              <p><strong>操作系统：</strong>{{ systemInfo.os }}</p>
              <p><strong>系统版本：</strong>{{ systemInfo.version }}</p>
              <p><strong>CPU：</strong>{{ systemInfo.cpu }}</p>
              <p><strong>内存：</strong>{{ systemInfo.memory }}</p>
              <p><strong>显卡：</strong>{{ systemInfo.gpu }}</p>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 配置备份和恢复 -->
      <el-row :gutter="16" class="mt-16">
        <el-col :span="24">
          <el-card class="setting-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <h3>配置备份与恢复</h3>
                <el-button type="primary" size="small" @click="backupConfig">创建备份</el-button>
              </div>
            </template>
            
            <div class="backup-list">
              <el-table :data="configBackups" style="width: 100%" size="small">
                <el-table-column prop="timestamp" label="备份时间" width="180">
                  <template #default="scope">
                    {{ formatTimestamp(scope.row.timestamp) }}
                  </template>
                </el-table-column>
                <el-table-column prop="config.sdPath" label="SD路径" />
                <el-table-column prop="config.pythonPath" label="Python路径" />
                <el-table-column label="操作" width="150">
                  <template #default="scope">
                    <el-button type="primary" size="small" @click="restoreConfig(scope.row.timestamp)">
                      恢复
                    </el-button>
                    <el-button type="danger" size="small" @click="deleteBackup(scope.row.timestamp)">
                      删除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  `,
  
  setup() {
    const sdPath = window.Vue.ref('');
    const sdPathValid = window.Vue.ref(false);
    const sdPathError = window.Vue.ref('');
    const modelsPath = window.Vue.ref('');
    const pythonPath = window.Vue.ref('');
    const pythonPathValid = window.Vue.ref(false);
    const pythonPathError = window.Vue.ref('');
    const pythonPathWarning = window.Vue.ref(false);
    const uiSettings = window.Vue.reactive({
      theme: 'light',
      autoStart: false
    });
    
    const systemInfo = window.Vue.reactive({
      os: '未知',
      version: '未知',
      cpu: '未知',
      memory: '未知',
      gpu: '未知'
    });
    
    // 配置备份相关
    const configBackups = window.Vue.ref([]);
    
    // 加载设置
    const loadSettings = async () => {
      try {
        // 加载SD路径
        const savedSdPath = await window.electron.config.get('sdPath');
        if (savedSdPath) {
          sdPath.value = savedSdPath;
          await validateSdPath();
        }
        
        // 加载模型路径
        const savedModelsPath = await window.electron.config.get('modelsPath');
        if (savedModelsPath) {
          modelsPath.value = savedModelsPath;
        }
        
        // 加载Python路径
        const savedPythonPath = await window.electron.config.get('pythonPath');
        if (savedPythonPath) {
          pythonPath.value = savedPythonPath;
          await validatePythonPath();
        }
        
        // 加载UI设置
        const savedUiSettings = await window.electron.config.get('uiSettings');
        if (savedUiSettings) {
          Object.assign(uiSettings, savedUiSettings);
          // 应用当前主题
          applyTheme(uiSettings.theme);
        }

        // 加载系统信息
        loadSystemInfo();
      } catch (error) {
        console.error('加载设置失败:', error);
        ElementPlus.ElMessage.error('加载设置失败');
      }
    };
    
    // 加载系统信息
    const loadSystemInfo = () => {
      try {
        const info = window.electron.system.getInfo();
        Object.assign(systemInfo, info);
        
        // 格式化操作系统名称
        switch(systemInfo.os) {
          case 'win32':
            systemInfo.os = 'Windows';
            break;
          case 'darwin':
            systemInfo.os = 'macOS';
            break;
          case 'linux':
            systemInfo.os = 'Linux';
            break;
        }
      } catch (error) {
        console.warn('获取系统信息失败:', error);
      }
    };
    
    // 选择SD路径
    const selectSdPath = async () => {
      let loadingInstance = null;
      try {
        // 显示加载中
        loadingInstance = ElementPlus.ElLoading.service({
          lock: true,
          text: '验证路径中...',
          background: 'rgba(0, 0, 0, 0.7)'
        });
        
        const result = await window.electron.config.setSdPath();
        
        if (result && result.success) {
          sdPath.value = result.path;
          sdPathValid.value = true;
          sdPathError.value = '';
          ElementPlus.ElMessage.success('SD路径设置成功');
        } else if (result && !result.success) {
          if (result.canceled) {
            // 用户取消了选择，不显示错误
            return;
          }
          sdPathValid.value = false;
          sdPathError.value = result.error || '路径无效';
          ElementPlus.ElMessage.error(result.error || '路径无效');
        }
      } catch (error) {
        console.error('设置SD路径失败:', error);
        ElementPlus.ElMessage.error('设置SD路径失败');
      } finally {
        // 确保加载实例关闭
        if (loadingInstance) {
          loadingInstance.close();
        }
      }
    };
    
    // 验证SD路径
    const validateSdPath = async () => {
      if (!sdPath.value) {
        sdPathValid.value = false;
        sdPathError.value = '路径不能为空';
        return;
      }
      
      let loadingInstance = null;
      try {
        // 显示加载中
        loadingInstance = ElementPlus.ElLoading.service({
          lock: true,
          text: '验证SD路径中...',
          background: 'rgba(0, 0, 0, 0.7)'
        });
        
        const result = await window.electron.config.setSdPath(sdPath.value);
        
        sdPathValid.value = result.success;
        
        if (result.success) {
          sdPathError.value = '';
        } else {
          sdPathError.value = result.error || '路径无效';
        }
      } catch (error) {
        console.error('验证SD路径失败:', error);
        sdPathValid.value = false;
        sdPathError.value = '验证失败: ' + error.message;
      } finally {
        // 确保加载实例关闭
        if (loadingInstance) {
          loadingInstance.close();
        }
      }
    };
    
    // 选择模型目录
    const selectModelsPath = async () => {
      let loadingInstance = null;
      try {
        // 显示加载中
        loadingInstance = ElementPlus.ElLoading.service({
          lock: true,
          text: '设置路径中...',
          background: 'rgba(0, 0, 0, 0.7)'
        });
        
        const result = await window.electron.modelManager.configDir();
        
        if (result && result.success) {
          modelsPath.value = result.path;
          ElementPlus.ElMessage.success('模型路径设置成功');
        } else if (result && !result.success) {
          if (result.canceled) {
            // 用户取消了选择，不显示错误
            return;
          }
          ElementPlus.ElMessage.error(result.error || '设置模型路径失败');
        }
      } catch (error) {
        console.error('设置模型路径失败:', error);
        ElementPlus.ElMessage.error('设置模型路径失败');
      } finally {
        // 确保加载实例关闭
        if (loadingInstance) {
          loadingInstance.close();
        }
      }
    };
    
    // 打开模型文件夹
    const openModelsFolder = async () => {
      if (!modelsPath.value) {
        ElementPlus.ElMessage.warning('请先设置模型目录');
        return;
      }
      
      try {
        await window.electron.ipcRenderer.invoke('open-directory', modelsPath.value);
      } catch (error) {
        console.error('打开模型目录失败:', error);
        ElementPlus.ElMessage.error('打开模型目录失败');
      }
    };
    
    // 选择Python路径
    const selectPythonPath = async () => {
      let loadingInstance = null;
      try {
        // 显示加载中
        loadingInstance = ElementPlus.ElLoading.service({
          lock: true,
          text: '验证Python路径中...',
          background: 'rgba(0, 0, 0, 0.7)'
        });
        
        console.log('开始选择Python路径...');
        const result = await window.electron.config.setPythonPath();
        console.log('选择Python路径结果:', result);
        
        if (result && result.success) {
          pythonPath.value = result.path;
          pythonPathValid.value = true;
          pythonPathError.value = '';
          pythonPathWarning.value = result.warning || false;
          
          if (result.warning) {
            ElementPlus.ElMessage.warning('Python路径已设置，但有警告');
          } else {
            ElementPlus.ElMessage.success('Python路径设置成功');
          }
        } else if (result && !result.success) {
          if (result.canceled) {
            // 用户取消了选择，不显示错误
            return;
          }
          pythonPathValid.value = false;
          pythonPathError.value = result.error || '路径无效';
          pythonPathWarning.value = false;
          ElementPlus.ElMessage.error(result.error || '路径无效');
        }
      } catch (error) {
        console.error('设置Python路径失败:', error);
        ElementPlus.ElMessage.error('设置Python路径失败: ' + error.message);
      } finally {
        // 确保加载实例关闭
        if (loadingInstance) {
          loadingInstance.close();
        }
      }
    };
    
    // 验证Python路径
    const validatePythonPath = async () => {
      if (!pythonPath.value) {
        pythonPathValid.value = false;
        pythonPathError.value = '路径不能为空';
        pythonPathWarning.value = false;
        return;
      }
      
      let loadingInstance = null;
      try {
        // 显示加载中
        loadingInstance = ElementPlus.ElLoading.service({
          lock: true,
          text: '验证Python路径中...',
          background: 'rgba(0, 0, 0, 0.7)'
        });
        
        console.log('开始验证Python路径:', pythonPath.value);
        const result = await window.electron.config.setPythonPath(pythonPath.value);
        console.log('验证Python路径结果:', result);
        
        pythonPathValid.value = result.success;
        
        if (result.success) {
          pythonPathError.value = '';
          pythonPathWarning.value = result.warning || false;
          
          if (result.warning) {
            ElementPlus.ElMessage.warning('Python路径已验证，但有警告');
          }
        } else {
          pythonPathError.value = result.error || '路径无效';
          pythonPathWarning.value = false;
        }
      } catch (error) {
        console.error('验证Python路径失败:', error);
        pythonPathValid.value = false;
        pythonPathError.value = '验证失败: ' + error.message;
        pythonPathWarning.value = false;
      } finally {
        // 确保加载实例关闭
        if (loadingInstance) {
          loadingInstance.close();
        }
      }
    };
    
    // 保存UI设置
    const saveUiSettings = async () => {
      try {
        await window.electron.config.set('uiSettings', { ...uiSettings });
        ElementPlus.ElMessage.success('界面设置已保存');
        
        // 如果主题改变，应用新主题
        applyTheme(uiSettings.theme);
      } catch (error) {
        console.error('保存界面设置失败:', error);
        ElementPlus.ElMessage.error('保存界面设置失败');
      }
    };
    
    // 应用主题
    const applyTheme = (theme) => {
      document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    };
    
    // 加载配置备份列表
    const loadConfigBackups = async () => {
      try {
        const backups = await window.electron.config.getBackups();
        configBackups.value = backups;
      } catch (error) {
        console.error('加载配置备份失败:', error);
        ElementPlus.ElMessage.error('加载配置备份失败');
      }
    };
    
    // 创建配置备份
    const backupConfig = async () => {
      let loadingInstance = null;
      try {
        loadingInstance = ElementPlus.ElLoading.service({
          lock: true,
          text: '正在创建备份...',
          background: 'rgba(0, 0, 0, 0.7)'
        });
        
        await window.electron.config.backup();
        
        // 重新加载备份列表
        await loadConfigBackups();
        
        ElementPlus.ElMessage.success('配置备份创建成功');
      } catch (error) {
        console.error('创建配置备份失败:', error);
        ElementPlus.ElMessage.error('创建配置备份失败');
      } finally {
        // 确保加载实例关闭
        if (loadingInstance) {
          loadingInstance.close();
        }
      }
    };
    
    // 恢复配置备份
    const restoreConfig = async (timestamp) => {
      try {
        const { value: confirmed } = await ElementPlus.ElMessageBox.confirm(
          '恢复此配置备份将覆盖当前的所有设置，确定要继续吗？',
          '确认恢复',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        );
        
        if (!confirmed) return;
        
        let loadingInstance = null;
        try {
          loadingInstance = ElementPlus.ElLoading.service({
            lock: true,
            text: '正在恢复配置...',
            background: 'rgba(0, 0, 0, 0.7)'
          });
          
          await window.electron.config.restore(timestamp);
          
          // 重新加载所有设置
          await loadSettings();
          
          ElementPlus.ElMessage.success('配置恢复成功');
        } finally {
          // 确保加载实例关闭
          if (loadingInstance) {
            loadingInstance.close();
          }
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('恢复配置备份失败:', error);
          ElementPlus.ElMessage.error('恢复配置备份失败');
        }
      }
    };
    
    // 删除配置备份
    const deleteBackup = async (timestamp) => {
      try {
        const { value: confirmed } = await ElementPlus.ElMessageBox.confirm(
          '确定要删除此配置备份吗？此操作不可恢复。',
          '确认删除',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        );
        
        if (!confirmed) return;
        
        let loadingInstance = null;
        try {
          loadingInstance = ElementPlus.ElLoading.service({
            lock: true,
            text: '正在删除备份...',
            background: 'rgba(0, 0, 0, 0.7)'
          });
          
          await window.electron.config.deleteBackup(timestamp);
          
          // 重新加载备份列表
          await loadConfigBackups();
          
          ElementPlus.ElMessage.success('配置备份删除成功');
        } finally {
          // 确保加载实例关闭
          if (loadingInstance) {
            loadingInstance.close();
          }
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除配置备份失败:', error);
          ElementPlus.ElMessage.error('删除配置备份失败');
        }
      }
    };
    
    // 格式化时间戳
    const formatTimestamp = (timestamp) => {
      try {
        const date = new Date(timestamp);
        return date.toLocaleString();
      } catch (error) {
        return timestamp;
      }
    };
    
    // 组件挂载时
    window.Vue.onMounted(() => {
      loadSettings();
      loadConfigBackups();
    });
    
    return {
      sdPath,
      sdPathValid,
      sdPathError,
      modelsPath,
      pythonPath,
      pythonPathValid,
      pythonPathError,
      pythonPathWarning,
      uiSettings,
      systemInfo,
      configBackups,
      backupConfig,
      restoreConfig,
      deleteBackup,
      formatTimestamp,
      selectSdPath,
      selectModelsPath,
      openModelsFolder,
      selectPythonPath,
      saveUiSettings
    };
  }
};

// 添加组件样式
const settingsStyle = document.createElement('style');
settingsStyle.textContent = `
  .settings-container {
    padding: 16px;
  }
  
  .setting-card {
    margin-bottom: 16px;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .card-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }
  
  .setting-form {
    max-width: 100%;
  }
  
  .path-selector {
    display: flex;
    gap: 8px;
  }
  
  .path-info {
    margin-top: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .error-msg {
    color: #f56c6c;
    font-size: 12px;
    margin-left: 8px;
  }
  
  .about-info, .system-info {
    font-size: 14px;
    line-height: 1.6;
  }
  
  .about-info p, .system-info p {
    margin: 8px 0;
  }
  
  .mt-16 {
    margin-top: 16px;
  }
  
  .path-tip {
    margin-top: 8px;
    font-size: 12px;
    color: #909399;
  }
  
  @media (max-width: 768px) {
    .settings-container {
      padding: 8px;
    }
    
    .setting-card {
      margin-bottom: 12px;
    }
    
    .path-selector {
      flex-direction: column;
    }
    
    .path-selector .el-button {
      width: 100%;
    }
  }
`;
document.head.appendChild(settingsStyle);

// 导出组件 - 修复了Settings重复赋值问题
// window.Settings = Settings; // 不需要这行，已经在上面定义了window.Settings
