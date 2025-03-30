// 环境配置页面组件
window.Environment = {
  template: `
    <div class="settings-container">
      <!-- Python环境设置 -->
      <el-row :gutter="16">
        <el-col :span="24">
          <el-card class="setting-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <h3>Python环境设置</h3>
              </div>
            </template>
            
            <el-form label-position="top" size="small" class="setting-form">
              <el-form-item label="Python路径">
                <div class="path-selector">
                  <el-input v-model="pythonPath" placeholder="请选择Python可执行文件路径" readonly />
                  <el-button type="primary" @click="selectPythonPath">选择Python</el-button>
                  <el-button type="success" @click="checkPythonVersion" :disabled="!pythonPath">检查版本</el-button>
                </div>
                <div v-if="pythonPath" class="path-info">
                  <el-tag type="success" v-if="pythonValid" size="small">Python {{ pythonVersion }}</el-tag>
                  <el-tag type="danger" v-else size="small">路径无效</el-tag>
                </div>
              </el-form-item>

              <el-divider content-position="left">依赖包管理</el-divider>
              
              <div class="package-manager">
                <div class="package-header">
                  <h4>必要依赖</h4>
                  <el-button type="primary" size="small" @click="installRequiredPackages" :disabled="!pythonValid">一键安装</el-button>
                </div>
                
                <el-table :data="requiredPackages" style="width: 100%" size="small">
                  <el-table-column prop="name" label="包名称" />
                  <el-table-column prop="version" label="所需版本" width="100" />
                  <el-table-column prop="installedVersion" label="已安装版本" width="100">
                    <template #default="scope">
                      <span v-if="scope.row.installedVersion">{{ scope.row.installedVersion }}</span>
                      <el-tag type="danger" size="small" v-else>未安装</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="100">
                    <template #default="scope">
                      <el-button 
                        size="small" 
                        type="primary" 
                        @click="installPackage(scope.row)" 
                        :disabled="!pythonValid || scope.row.installing">
                        {{ scope.row.installing ? '安装中...' : '安装' }}
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>

              <el-divider content-position="left">PyTorch配置</el-divider>
              
              <el-form-item label="CUDA版本">
                <el-select v-model="torchConfig.cuda" placeholder="选择CUDA版本" style="width: 100%">
                  <el-option label="无 (CPU Only)" value="cpu" />
                  <el-option label="CUDA 11.8" value="cuda118" />
                  <el-option label="CUDA 12.1" value="cuda121" />
                </el-select>
              </el-form-item>
              
              <el-form-item>
                <el-button type="primary" @click="installPytorch" :disabled="!pythonValid || installingPytorch">
                  {{ installingPytorch ? '安装中...' : '安装PyTorch' }}
                </el-button>
                <span v-if="torchStatus" class="ml-8">
                  <el-tag :type="torchStatus.type">{{ torchStatus.message }}</el-tag>
                </span>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="16" class="mt-16">
        <!-- 左侧：系统信息 -->
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

        <!-- 右侧：虚拟环境管理 -->
        <el-col :xs="24" :sm="12">
          <el-card class="setting-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <h3>虚拟环境</h3>
                <el-button size="small" type="success" @click="createVenv" :disabled="!pythonValid">
                  创建虚拟环境
                </el-button>
              </div>
            </template>
            
            <div v-if="venvLoading" class="venv-loading">
              <el-skeleton :rows="3" animated />
            </div>
            <div v-else-if="venvList.length === 0" class="venv-empty">
              <el-empty description="暂无虚拟环境" />
            </div>
            <div v-else class="venv-list">
              <el-table :data="venvList" style="width: 100%" size="small">
                <el-table-column prop="name" label="名称" />
                <el-table-column prop="path" label="路径" show-overflow-tooltip />
                <el-table-column label="状态" width="100">
                  <template #default="scope">
                    <el-tag :type="scope.row.active ? 'success' : 'info'" size="small">
                      {{ scope.row.active ? '激活' : '未激活' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="150">
                  <template #default="scope">
                    <el-button 
                      size="small" 
                      type="primary" 
                      @click="activateVenv(scope.row)" 
                      :disabled="scope.row.active">
                      使用
                    </el-button>
                    <el-button 
                      size="small" 
                      type="danger" 
                      @click="deleteVenv(scope.row)">
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
    const pythonPath = window.Vue.ref('');
    const pythonValid = window.Vue.ref(false);
    const pythonVersion = window.Vue.ref('');
    const installingPytorch = window.Vue.ref(false);
    const torchStatus = window.Vue.ref(null);
    const venvLoading = window.Vue.ref(true);
    const venvList = window.Vue.ref([]);
    
    const torchConfig = window.Vue.reactive({
      cuda: 'cuda118'
    });

    const systemInfo = window.Vue.reactive({
      os: '未知',
      version: '未知',
      cpu: '未知',
      memory: '未知',
      gpu: '未知'
    });

    const requiredPackages = window.Vue.reactive([
      { name: 'numpy', version: '>=1.24.0', installedVersion: '', installing: false },
      { name: 'pillow', version: '>=10.0.0', installedVersion: '', installing: false },
      { name: 'transformers', version: '>=4.30.0', installedVersion: '', installing: false },
      { name: 'opencv-python', version: '>=4.8.0', installedVersion: '', installing: false },
      { name: 'tqdm', version: '>=4.65.0', installedVersion: '', installing: false }
    ]);
    
    // 加载设置
    const loadSettings = async () => {
      try {
        // 加载Python设置
        const savedPythonPath = await window.electron.config.get('pythonPath');
        if (savedPythonPath) {
          pythonPath.value = savedPythonPath;
          checkPythonVersion();
        }

        const savedTorchConfig = await window.electron.config.get('torchConfig');
        if (savedTorchConfig) {
          Object.assign(torchConfig, savedTorchConfig);
        }

        // 加载系统信息
        try {
          const info = window.electron.system.getInfo();
          Object.assign(systemInfo, info);
        } catch (error) {
          console.warn('获取系统信息失败:', error);
        }

        // 加载虚拟环境列表
        loadVenvList();
      } catch (error) {
        console.error('加载设置失败:', error);
        ElementPlus.ElMessage.error('加载设置失败');
      }
    };

    // 加载虚拟环境列表
    const loadVenvList = async () => {
      venvLoading.value = true;
      try {
        const result = await window.electron.pythonEnv.getVenvList();
        if (result && result.success) {
          venvList.value = result.venvs || [];
        } else {
          venvList.value = [];
        }
      } catch (error) {
        console.error('加载虚拟环境列表失败:', error);
        venvList.value = [];
      } finally {
        venvLoading.value = false;
      }
    };

    // 创建虚拟环境
    const createVenv = async () => {
      if (!pythonValid.value) return;

      try {
        const result = await window.electron.pythonEnv.createVenv(pythonPath.value);
        if (result && result.success) {
          ElementPlus.ElMessage.success('虚拟环境创建成功');
          loadVenvList();
        } else {
          ElementPlus.ElMessage.error('创建虚拟环境失败');
        }
      } catch (error) {
        console.error('创建虚拟环境失败:', error);
        ElementPlus.ElMessage.error('创建虚拟环境失败');
      }
    };

    // 激活虚拟环境
    const activateVenv = async (venv) => {
      try {
        const result = await window.electron.pythonEnv.activateVenv(venv.path);
        if (result && result.success) {
          ElementPlus.ElMessage.success(`已激活 ${venv.name}`);
          loadVenvList();
        } else {
          ElementPlus.ElMessage.error('激活虚拟环境失败');
        }
      } catch (error) {
        console.error('激活虚拟环境失败:', error);
        ElementPlus.ElMessage.error('激活虚拟环境失败');
      }
    };

    // 删除虚拟环境
    const deleteVenv = async (venv) => {
      try {
        const confirmed = await ElementPlus.ElMessageBox.confirm(
          `确定要删除虚拟环境 ${venv.name} 吗？此操作不可撤销。`,
          '警告',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        );
        
        if (confirmed === 'confirm') {
          const result = await window.electron.pythonEnv.deleteVenv(venv.path);
          if (result && result.success) {
            ElementPlus.ElMessage.success('虚拟环境已删除');
            loadVenvList();
          } else {
            ElementPlus.ElMessage.error('删除虚拟环境失败');
          }
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('删除虚拟环境失败:', error);
          ElementPlus.ElMessage.error('删除虚拟环境失败');
        }
      }
    };

    // 选择Python路径
    const selectPythonPath = async () => {
      try {
        const result = await window.electron.pythonEnv.selectPythonPath();
        
        if (result && result.success) {
          pythonPath.value = result.path;
          await window.electron.config.set('pythonPath', pythonPath.value);
          await checkPythonVersion();
        }
      } catch (error) {
        console.error('选择Python路径失败:', error);
        ElementPlus.ElMessage.error('选择Python路径失败');
      }
    };

    // 检查Python版本
    const checkPythonVersion = async () => {
      if (!pythonPath.value) {
        pythonValid.value = false;
        return;
      }

      try {
        const result = await window.electron.pythonEnv.checkPythonVersion(pythonPath.value);
        
        if (result && result.success) {
          pythonValid.value = true;
          pythonVersion.value = result.version;
          ElementPlus.ElMessage.success(`检测到Python ${result.version}`);
          
          // 检查已安装包
          checkInstalledPackages();
        } else {
          pythonValid.value = false;
          pythonVersion.value = '';
          ElementPlus.ElMessage.error('Python路径无效');
        }
      } catch (error) {
        console.error('检查Python版本失败:', error);
        pythonValid.value = false;
        pythonVersion.value = '';
        ElementPlus.ElMessage.error('检查Python版本失败');
      }
    };

    // 检查已安装的包
    const checkInstalledPackages = async () => {
      if (!pythonValid.value) return;

      try {
        const result = await window.electron.pythonEnv.listPackages(pythonPath.value);
        
        if (result && result.success) {
          for (const pkg of requiredPackages) {
            const installedPkg = result.packages.find(p => p.name.toLowerCase() === pkg.name.toLowerCase());
            pkg.installedVersion = installedPkg ? installedPkg.version : '';
          }
          
          // 检查PyTorch
          const torch = result.packages.find(p => p.name === 'torch');
          if (torch) {
            torchStatus.value = {
              type: 'success',
              message: `已安装 PyTorch ${torch.version}`
            };
          } else {
            torchStatus.value = {
              type: 'warning',
              message: '未安装 PyTorch'
            };
          }
        }
      } catch (error) {
        console.error('获取已安装包列表失败:', error);
      }
    };

    // 安装单个包
    const installPackage = async (pkg) => {
      if (!pythonValid.value || pkg.installing) return;

      pkg.installing = true;
      try {
        const result = await window.electron.pythonEnv.installPackage(pythonPath.value, pkg.name, pkg.version);
        
        if (result && result.success) {
          pkg.installedVersion = result.version;
          ElementPlus.ElMessage.success(`${pkg.name} 安装成功`);
        } else {
          ElementPlus.ElMessage.error(`${pkg.name} 安装失败`);
        }
      } catch (error) {
        console.error(`安装 ${pkg.name} 失败:`, error);
        ElementPlus.ElMessage.error(`安装 ${pkg.name} 失败`);
      } finally {
        pkg.installing = false;
      }
    };

    // 安装所有必要依赖
    const installRequiredPackages = async () => {
      if (!pythonValid.value) return;
      
      const packages = requiredPackages.map(pkg => `${pkg.name}${pkg.version}`);
      
      try {
        ElementPlus.ElMessage.info('开始安装必要依赖，这可能需要几分钟时间');
        
        for (const pkg of requiredPackages) {
          if (!pkg.installedVersion) {
            pkg.installing = true;
            await installPackage(pkg);
          }
        }
        
        checkInstalledPackages();
        ElementPlus.ElMessage.success('所有必要依赖安装完成');
      } catch (error) {
        console.error('安装必要依赖失败:', error);
        ElementPlus.ElMessage.error('安装必要依赖失败');
      }
    };

    // 安装PyTorch
    const installPytorch = async () => {
      if (!pythonValid.value || installingPytorch.value) return;

      installingPytorch.value = true;
      torchStatus.value = {
        type: 'info',
        message: '正在安装 PyTorch...'
      };

      try {
        await window.electron.config.set('torchConfig', { ...torchConfig });
        
        const result = await window.electron.pythonEnv.installPytorch(pythonPath.value, torchConfig.cuda);
        
        if (result && result.success) {
          torchStatus.value = {
            type: 'success',
            message: `已安装 PyTorch ${result.version}`
          };
          ElementPlus.ElMessage.success('PyTorch 安装成功');
        } else {
          torchStatus.value = {
            type: 'error',
            message: 'PyTorch 安装失败'
          };
          ElementPlus.ElMessage.error('PyTorch 安装失败');
        }
      } catch (error) {
        console.error('安装 PyTorch 失败:', error);
        torchStatus.value = {
          type: 'error',
          message: 'PyTorch 安装失败'
        };
        ElementPlus.ElMessage.error('安装 PyTorch 失败');
      } finally {
        installingPytorch.value = false;
      }
    };
    
    // 组件挂载时
    window.Vue.onMounted(() => {
      loadSettings();
    });
    
    return {
      pythonPath,
      pythonValid,
      pythonVersion,
      requiredPackages,
      torchConfig,
      installingPytorch,
      torchStatus,
      systemInfo,
      venvList,
      venvLoading,
      selectPythonPath,
      checkPythonVersion,
      installPackage,
      installRequiredPackages,
      installPytorch,
      createVenv,
      activateVenv,
      deleteVenv
    };
  }
};

// 添加组件样式
const environmentStyle = document.createElement('style');
environmentStyle.textContent = `
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
  
  .ml-8 {
    margin-left: 8px;
  }
  
  .package-manager {
    margin-bottom: 16px;
  }
  
  .package-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  
  .package-header h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
  }
  
  .venv-loading, .venv-empty, .venv-list {
    min-height: 150px;
  }
  
  .venv-empty {
    display: flex;
    justify-content: center;
    align-items: center;
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
document.head.appendChild(environmentStyle);
