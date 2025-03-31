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
              
              <el-divider content-position="left">网络设置</el-divider>
              
              <el-form-item label="Hugging Face镜像">
                <el-switch v-model="torchConfig.useHfMirror" active-text="使用镜像" inactive-text="官方源" />
                <div class="setting-help-text">
                  使用 hf-mirror.com 镜像源以解决国内访问 Hugging Face 慢或无法访问的问题
                </div>
                
                <div class="model-download-actions mt-8" v-if="torchConfig.useHfMirror">
                  <el-button 
                    size="small" 
                    type="primary" 
                    @click="downloadClipModel"
                    :disabled="!pythonValid || downloadingClip">
                    {{ downloadingClip ? '下载中...' : '下载CLIP模型' }}
                  </el-button>
                  <div class="setting-help-text">
                    预先下载CLIP模型到本地，解决模型加载失败问题
                  </div>
                </div>
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
      
      <!-- 故障排除指南 -->
      <el-row :gutter="16" class="mt-16">
        <el-col :span="24">
          <el-card class="setting-card" shadow="hover">
            <template #header>
              <div class="card-header">
                <h3>常见问题排除</h3>
              </div>
            </template>
            
            <el-collapse accordion>
              <el-collapse-item title="SSL连接问题" name="ssl-issues">
                <div class="troubleshoot-content">
                  <p><strong>症状：</strong>出现 <code>SSLError</code> 或 <code>SSL: UNEXPECTED_EOF_WHILE_READING</code> 错误</p>
                  <p><strong>解决方案：</strong></p>
                  <ol>
                    <li>启用<strong>Hugging Face镜像源</strong>，使用国内镜像替代官方源</li>
                    <li>检查系统时间是否正确，不正确的系统时间会导致SSL证书验证失败</li>
                    <li>尝试在系统环境变量中添加：
                      <pre>CURL_CA_BUNDLE=""
SSL_CERT_FILE=""
REQUESTS_CA_BUNDLE=""</pre>
                    </li>
                  </ol>
                </div>
              </el-collapse-item>
              
              <el-collapse-item title="模型下载问题" name="model-download">
                <div class="troubleshoot-content">
                  <p><strong>症状：</strong>模型下载失败或速度极慢</p>
                  <p><strong>解决方案：</strong></p>
                  <ol>
                    <li>启用<strong>Hugging Face镜像源</strong>，使用国内镜像加速下载</li>
                    <li>使用<strong>下载CLIP模型</strong>按钮预先下载基础模型</li>
                    <li>下载完成后重启SD服务</li>
                  </ol>
                </div>
              </el-collapse-item>
              
              <el-collapse-item title="CLIP模型加载失败" name="clip-model-error">
                <div class="troubleshoot-content">
                  <p><strong>症状：</strong>出现 <code>Can't load tokenizer for 'openai/clip-vit-large-patch14'</code> 错误</p>
                  <p><strong>解决方案：</strong></p>
                  <ol>
                    <li>启用<strong>Hugging Face镜像源</strong></li>
                    <li>点击<strong>下载CLIP模型</strong>按钮预先下载基础模型</li>
                    <li>确保网络连接正常或使用代理</li>
                    <li>如果仍然失败，可能需要手动下载模型文件并放入正确位置</li>
                  </ol>
                </div>
              </el-collapse-item>
            </el-collapse>
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
    const downloadingClip = window.Vue.ref(false);
    
    const torchConfig = window.Vue.reactive({
      cuda: 'cuda118',
      useHfMirror: false
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
          console.log('已加载torchConfig设置:', savedTorchConfig);
          Object.assign(torchConfig, savedTorchConfig);
        } else {
          // 如果没有保存过配置，立即保存默认配置
          console.log('未找到torchConfig设置，保存默认配置');
          await window.electron.config.set('torchConfig', { ...torchConfig });
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
          ElementPlus.ElMessage.success('虚拟环境已激活');
          pythonPath.value = result.pythonPath;
          pythonValid.value = true;
          pythonVersion.value = result.version || '';
          
          // 将激活的虚拟环境Python路径保存为environmentPythonPath配置项
          await window.electron.config.set('environmentPythonPath', result.pythonPath);
          
          loadVenvList();
          checkInstalledPackages();
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
      let loadingInstance = null;
      try {
        // 显示加载中
        loadingInstance = ElementPlus.ElLoading.service({
          lock: true,
          text: '验证Python路径中...',
          background: 'rgba(0, 0, 0, 0.7)'
        });
        
        console.log('开始选择Python路径...');
        const result = await window.electron.pythonEnv.selectPythonPath();
        console.log('选择Python路径结果:', result);
        
        if (result && result.success) {
          pythonPath.value = result.path;
          await checkPythonVersion();
          
          // 将验证通过的路径保存为environmentPythonPath配置项
          if (pythonValid.value) {
            await window.electron.config.set('environmentPythonPath', pythonPath.value);
          }
        } else if (result && !result.success) {
          if (result.canceled) {
            // 用户取消了选择，不显示错误
            return;
          }
          pythonVersion.value = '';
          pythonValid.value = false;
          ElementPlus.ElMessage.error(result.error || '路径无效');
        }
      } catch (error) {
        console.error('设置Python路径失败:', error);
        ElementPlus.ElMessage.error('设置Python路径失败');
      } finally {
        // 确保加载实例关闭
        if (loadingInstance) {
          loadingInstance.close();
        }
      }
    };

    // 检查Python版本
    const checkPythonVersion = async () => {
      if (!pythonPath.value) {
        ElementPlus.ElMessage.warning('请先选择Python路径');
        return;
      }
      
      let loadingInstance = null;
      try {
        // 显示加载中
        loadingInstance = ElementPlus.ElLoading.service({
          lock: true,
          text: '检查Python版本中...',
          background: 'rgba(0, 0, 0, 0.7)'
        });
        
        const result = await window.electron.pythonEnv.checkPythonVersion(pythonPath.value);
        
        if (result && result.success) {
          pythonValid.value = true;
          pythonVersion.value = result.version;
          ElementPlus.ElMessage.success(`检测到Python ${result.version}`);
          
          // 将验证通过的路径保存为environmentPythonPath配置项
          await window.electron.config.set('environmentPythonPath', pythonPath.value);
          
          // 检查已安装的包
          checkInstalledPackages();
        } else {
          pythonValid.value = false;
          pythonVersion.value = '';
          ElementPlus.ElMessage.error(result.error || '无效的Python路径');
        }
      } catch (error) {
        console.error('检查Python版本失败:', error);
        pythonValid.value = false;
        pythonVersion.value = '';
        ElementPlus.ElMessage.error('检查Python版本失败');
      } finally {
        // 确保加载实例关闭
        if (loadingInstance) {
          loadingInstance.close();
        }
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

    // 下载CLIP模型
    const downloadClipModel = async () => {
      if (!pythonValid.value || downloadingClip.value) return;
      
      downloadingClip.value = true;
      try {
        ElementPlus.ElMessage.info('开始下载CLIP模型，这可能需要几分钟时间...');
        
        const result = await window.electron.pythonEnv.runPythonScript(pythonPath.value, `
import os
import sys
import huggingface_hub
import json
import shutil
from pathlib import Path

# 设置环境变量
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
os.environ["TRANSFORMERS_BASE_URL"] = "https://hf-mirror.com"
os.environ["CURL_CA_BUNDLE"] = ""
os.environ["SSL_CERT_FILE"] = ""
os.environ["REQUESTS_CA_BUNDLE"] = ""

try:
    print("开始下载CLIP模型...")
    
    # 确保需要的软件包已安装
    try:
        from transformers import CLIPTokenizer, CLIPTextModel
    except ImportError:
        print("安装必要的软件包...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "transformers", "torch", "huggingface_hub"])
        from transformers import CLIPTokenizer, CLIPTextModel
    
    # 先下载分词器
    print("下载分词器...")
    tokenizer = CLIPTokenizer.from_pretrained("openai/clip-vit-large-patch14")
    
    print("下载文本模型...")
    text_encoder = CLIPTextModel.from_pretrained("openai/clip-vit-large-patch14")
    
    # 获取缓存目录
    cache_dir = huggingface_hub.constants.HF_HUB_CACHE
    print(f"模型保存在: {cache_dir}")
    
    # 查找已下载的模型目录
    model_dir = None
    for dir_path in Path(cache_dir).glob("models--openai--clip-vit-large-patch14*"):
        if dir_path.is_dir():
            model_dir = dir_path
            break
    
    if model_dir is None:
        print("未找到下载的模型目录!")
        sys.exit(1)
    
    print(f"找到模型目录: {model_dir}")
    
    # 创建一个config.json文件，SD Web UI可能会查找它
    config_path = os.path.join(model_dir, "config.json")
    if not os.path.exists(config_path):
        basic_config = {
            "architectures": ["CLIPTextModel"],
            "model_type": "clip",
            "projection_dim": 768,
            "text_config": {
                "hidden_size": 768,
                "intermediate_size": 3072,
                "num_attention_heads": 12,
                "num_hidden_layers": 12
            }
        }
        with open(config_path, "w") as f:
            json.dump(basic_config, f, indent=2)
        print(f"创建了config.json: {config_path}")
    
    print("模型下载完成！")
    sys.exit(0)
except Exception as e:
    print(f"下载失败: {str(e)}")
    sys.exit(1)
        `);
        
        if (result.exitCode === 0) {
          ElementPlus.ElMessage.success('CLIP模型下载成功');
        } else {
          ElementPlus.ElMessage.error(`CLIP模型下载失败: ${result.stderr}`);
        }
      } catch (error) {
        console.error('下载CLIP模型失败:', error);
        ElementPlus.ElMessage.error('下载CLIP模型失败');
      } finally {
        downloadingClip.value = false;
      }
    };
    
    // 组件挂载时
    window.Vue.onMounted(() => {
      loadSettings();
    });
    
    // 监听离线模式变化
    window.Vue.watch(offlineMode, async (newValue) => {
      try {
        await window.electron.config.set('offlineMode', newValue);
      } catch (error) {
        console.error('保存离线模式设置失败:', error);
      }
    });
    
    // 监听torchConfig中的useHfMirror变化
    window.Vue.watch(() => torchConfig.useHfMirror, async (newValue) => {
      try {
        console.log('保存 Hugging Face 镜像设置:', newValue);
        await window.electron.config.set('torchConfig', { ...torchConfig });
      } catch (error) {
        console.error('保存 Hugging Face 镜像设置失败:', error);
      }
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
      downloadingClip,
      selectPythonPath,
      checkPythonVersion,
      installPackage,
      installRequiredPackages,
      installPytorch,
      createVenv,
      activateVenv,
      deleteVenv,
      downloadClipModel
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
  
  .troubleshoot-content {
    font-size: 14px;
    line-height: 1.6;
  }
  
  .troubleshoot-content p {
    margin: 8px 0;
  }
  
  .troubleshoot-content code {
    background-color: #f5f7fa;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: monospace;
  }
  
  .troubleshoot-content pre {
    background-color: #f5f7fa;
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
    font-family: monospace;
    margin: 8px 0;
  }
  
  .troubleshoot-content ol, .troubleshoot-content ul {
    padding-left: 20px;
  }
  
  .setting-help-text {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
    line-height: 1.4;
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
