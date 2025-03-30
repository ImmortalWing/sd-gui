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
                </div>
              </el-form-item>

              <el-form-item label="模型存储目录">
                <div class="path-selector">
                  <el-input v-model="modelsPath" placeholder="请选择模型存储目录" readonly />
                  <el-button type="primary" @click="selectModelsPath">选择目录</el-button>
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
    </div>
  `,
  
  setup() {
    const sdPath = window.Vue.ref('');
    const sdPathValid = window.Vue.ref(false);
    const modelsPath = window.Vue.ref('');
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
    
    // 加载设置
    const loadSettings = async () => {
      try {
        // 加载SD路径
        const savedSdPath = await window.electron.config.get('sdPath');
        if (savedSdPath) {
          sdPath.value = savedSdPath;
          validateSdPath();
        }
        
        // 加载模型路径
        const savedModelsPath = await window.electron.config.get('modelsPath');
        if (savedModelsPath) {
          modelsPath.value = savedModelsPath;
        }
        
        // 加载UI设置
        const savedUiSettings = await window.electron.config.get('uiSettings');
        if (savedUiSettings) {
          Object.assign(uiSettings, savedUiSettings);
        }

        // 加载系统信息
        try {
          const info = window.electron.system.getInfo();
          Object.assign(systemInfo, info);
        } catch (error) {
          console.warn('获取系统信息失败:', error);
        }
      } catch (error) {
        console.error('加载设置失败:', error);
        ElementPlus.ElMessage.error('加载设置失败');
      }
    };
    
    // 选择SD路径
    const selectSdPath = async () => {
      try {
        const result = await window.electron.config.setSdPath();
        
        if (result && result.success) {
          sdPath.value = result.path || await window.electron.config.get('sdPath');
          sdPathValid.value = true;
          ElementPlus.ElMessage.success('SD路径设置成功');
        }
      } catch (error) {
        console.error('设置SD路径失败:', error);
        ElementPlus.ElMessage.error('设置SD路径失败');
      }
    };
    
    // 验证SD路径
    const validateSdPath = async () => {
      if (!sdPath.value) {
        sdPathValid.value = false;
        return;
      }
      
      try {
        const result = await window.electron.config.setSdPath(sdPath.value);
        sdPathValid.value = result.success;
      } catch (error) {
        console.error('验证SD路径失败:', error);
        sdPathValid.value = false;
      }
    };
    
    // 选择模型目录
    const selectModelsPath = async () => {
      try {
        const result = await window.electron.modelManager.configDir();
        
        if (result && result.success) {
          modelsPath.value = result.path;
          ElementPlus.ElMessage.success('模型路径设置成功');
        }
      } catch (error) {
        console.error('设置模型路径失败:', error);
        ElementPlus.ElMessage.error('设置模型路径失败');
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
    
    // 组件挂载时
    window.Vue.onMounted(() => {
      loadSettings();
    });
    
    return {
      sdPath,
      sdPathValid,
      modelsPath,
      uiSettings,
      systemInfo,
      selectSdPath,
      selectModelsPath,
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
