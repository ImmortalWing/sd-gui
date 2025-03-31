// 定义文生图组件
window.Txt2Img = {
  template: `
    <div class="txt2img-container">
      <el-row :gutter="20">
        <!-- 左侧：提示词和参数设置 -->
        <el-col :span="12">
          <el-card class="prompt-card">
            <template #header>
              <div class="card-header">
                <span>提示词设置</span>
                <el-tag :type="sdStatus.isRunning ? 'success' : 'danger'" size="small">
                  {{ sdStatus.isRunning ? 'SD服务运行中' : 'SD服务未运行' }}
                </el-tag>
              </div>
            </template>
            
            <!-- 正向提示词 -->
            <el-form-item label="正向提示词">
              <el-input
                v-model="prompt"
                type="textarea"
                :rows="4"
                placeholder="请输入正向提示词"
              />
            </el-form-item>
            
            <!-- 负向提示词 -->
            <el-form-item label="负向提示词">
              <el-input
                v-model="negativePrompt"
                type="textarea"
                :rows="4"
                placeholder="请输入负向提示词"
              />
            </el-form-item>
            
            <!-- 模型选择 -->
            <el-form-item label="模型">
              <el-select v-model="selectedModel" placeholder="选择模型">
                <el-option
                  v-for="model in models"
                  :key="model.title"
                  :label="model.model_name"
                  :value="model.title"
                >
                  <div class="model-option">
                    <span>{{ model.model_name }}</span>
                    <el-tag size="small" type="success" v-if="model.isSafetensors">Safetensors</el-tag>
                    <el-tag size="small" v-else>{{ model.extension }}</el-tag>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>
            
            <!-- 模型信息 -->
            <el-form-item v-if="selectedModelInfo" label="模型信息">
              <div class="model-info">
                <p><strong>文件名:</strong> {{ selectedModelInfo.name }}</p>
                <p><strong>大小:</strong> {{ selectedModelInfo.sizeFormatted }}</p>
                <p><strong>类型:</strong> {{ selectedModelInfo.isSafetensors ? 'Safetensors' : 'Checkpoint' }}</p>
              </div>
            </el-form-item>
            
            <!-- 采样器选择 -->
            <el-form-item label="采样器">
              <el-radio-group v-model="sampler">
                <el-radio v-for="item in samplers" :key="item.value" :label="item.value">
                  {{ item.label }}
                </el-radio>
              </el-radio-group>
            </el-form-item>
            
            <!-- 图像尺寸 -->
            <el-form-item label="图像尺寸">
              <el-row :gutter="10">
                <el-col :span="12">
                  <el-input-number
                    v-model="width"
                    :min="64"
                    :max="2048"
                    :step="64"
                    placeholder="宽度"
                  />
                </el-col>
                <el-col :span="12">
                  <el-input-number
                    v-model="height"
                    :min="64"
                    :max="2048"
                    :step="64"
                    placeholder="高度"
                  />
                </el-col>
              </el-row>
            </el-form-item>
            
            <!-- 采样步数 -->
            <el-form-item label="采样步数">
              <el-slider
                v-model="steps"
                :min="1"
                :max="150"
                :step="1"
                show-input
              />
            </el-form-item>
            
            <!-- CFG Scale -->
            <el-form-item label="CFG Scale">
              <el-slider
                v-model="cfgScale"
                :min="1"
                :max="30"
                :step="0.5"
                show-input
              />
            </el-form-item>
            
            <!-- 随机种子 -->
            <el-form-item label="随机种子">
              <el-row :gutter="10">
                <el-col :span="18">
                  <el-input-number
                    v-model="seed"
                    :min="-1"
                    :max="2147483647"
                    placeholder="随机种子"
                  />
                </el-col>
                <el-col :span="6">
                  <el-button @click="randomizeSeed">随机</el-button>
                </el-col>
              </el-row>
            </el-form-item>
            
            <!-- 生成按钮 -->
            <el-form-item>
              <el-row :gutter="10">
                <el-col :span="12">
                  <el-button
                    type="primary"
                    :loading="generating"
                    @click="generateImage"
                    :disabled="!sdStatus.isRunning"
                  >
                    生成图像
                  </el-button>
                </el-col>
                <el-col :span="12" v-if="!sdStatus.isRunning">
                  <el-button
                    type="warning"
                    @click="startSDService"
                  >
                    启动SD服务
                  </el-button>
                </el-col>
              </el-row>
            </el-form-item>
          </el-card>
        </el-col>
        
        <!-- 右侧：图像预览 -->
        <el-col :span="12">
          <el-card class="preview-card">
            <template #header>
              <div class="card-header">
                <span>图像预览</span>
                <div class="preview-actions" v-if="previewImage">
                  <el-button-group>
                    <el-button @click="saveImage">保存</el-button>
                    <el-button @click="copyToClipboard">复制</el-button>
                  </el-button-group>
                </div>
              </div>
            </template>
            
            <div class="preview-container">
              <div v-if="!previewImage" class="preview-placeholder">
                <el-icon><Picture /></el-icon>
                <span>生成的图像将显示在这里</span>
              </div>
              <img
                v-else
                :src="previewImage"
                class="preview-image"
                alt="生成的图像"
              />
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  `,
  
  setup() {
    // 状态变量
    const prompt = window.Vue.ref('');
    const negativePrompt = window.Vue.ref('');
    const selectedModel = window.Vue.ref('');
    const models = window.Vue.ref([]);
    const sampler = window.Vue.ref('Euler a');
    const width = window.Vue.ref(512);
    const height = window.Vue.ref(512);
    const steps = window.Vue.ref(20);
    const cfgScale = window.Vue.ref(7);
    const seed = window.Vue.ref(-1);
    const generating = window.Vue.ref(false);
    const previewImage = window.Vue.ref('');
    const sdStatus = window.Vue.ref({ isRunning: false });
    
    // 采样器选项
    const samplers = [
      { label: 'Euler a', value: 'Euler a' },
      { label: 'Euler', value: 'Euler' },
      { label: 'LMS', value: 'LMS' },
      { label: 'Heun', value: 'Heun' },
      { label: 'DPM2', value: 'DPM2' },
      { label: 'DPM2 Karras', value: 'DPM2 Karras' },
      { label: 'DPM++ 2S Karras', value: 'DPM++ 2S Karras' },
      { label: 'DPM++ 2M Karras', value: 'DPM++ 2M Karras' },
      { label: 'DDIM', value: 'DDIM' },
      { label: 'PLMS', value: 'PLMS' }
    ];
    
    // 计算属性：获取当前选中模型的详细信息
    const selectedModelInfo = window.Vue.computed(() => {
      if (!selectedModel.value || models.value.length === 0) return null;
      return models.value.find(model => model.title === selectedModel.value);
    });
    
    // 加载模型列表
    const loadModels = async () => {
      try {
        const result = await window.electron.ipcRenderer.invoke('get-models');
        if (result.success) {
          models.value = result.data;
        } else {
          // 如果API调用失败，尝试从本地获取模型列表
          const localModels = await window.electron.ipcRenderer.invoke('models:list');
          if (localModels && localModels.length > 0) {
            models.value = localModels;
          }
        }
        
        if (models.value.length > 0) {
          // 优先选择safetensors模型
          const safetensorsModel = models.value.find(model => model.isSafetensors);
          if (safetensorsModel) {
            selectedModel.value = safetensorsModel.title;
          } else {
            selectedModel.value = models.value[0].title;
          }
        }
      } catch (error) {
        ElementPlus.ElMessage.error('加载模型列表失败');
      }
    };
    
    // 生成随机种子
    const randomizeSeed = () => {
      seed.value = Math.floor(Math.random() * 2147483647);
    };
    
    // 生成图像
    const generateImage = async () => {
      if (!prompt.value) {
        ElementPlus.ElMessage.warning('请输入正向提示词');
        return;
      }
      
      if (!selectedModel.value) {
        ElementPlus.ElMessage.warning('请选择模型');
        return;
      }
      
      generating.value = true;
      previewImage.value = '';
      
      try {
        // 获取选中模型的详细信息
        const modelInfo = selectedModelInfo.value;
        const isSafetensors = modelInfo && modelInfo.isSafetensors;
        
        // 如果是safetensors模型，推荐使用DPM++ 2M Karras采样器
        let samplerToUse = sampler.value;
        if (isSafetensors && samplerToUse === 'Euler a') {
          ElementPlus.ElMessage.info('Safetensors模型推荐使用DPM++ 2M Karras采样器，已自动切换');
          samplerToUse = 'DPM++ 2M Karras';
        }
        
        const params = {
          prompt: prompt.value,
          negative_prompt: negativePrompt.value,
          model: selectedModel.value,
          sampler_name: samplerToUse,
          width: width.value,
          height: height.value,
          steps: steps.value,
          cfg_scale: cfgScale.value,
          seed: seed.value
        };
        
        // 对于safetensors模型，可能需要添加额外参数
        if (isSafetensors) {
          params.restore_faces = true;
          // 在safetensors模型上，通常增加步数会获得更好的结果
          if (params.steps < 30) {
            params.steps = 30;
          }
        }
        
        const result = await window.electron.ipcRenderer.invoke('txt2img', params);
        
        if (result.success) {
          previewImage.value = 'data:image/png;base64,' + result.data;
          ElementPlus.ElMessage.success('图像生成成功');
        } else {
          // 检查错误信息是否为连接错误
          if (result.error && result.error.includes('无法连接到Stable Diffusion服务')) {
            ElementPlus.ElMessageBox.confirm(
              '无法连接到Stable Diffusion服务，是否启动SD WebUI？',
              '连接错误',
              {
                confirmButtonText: '启动',
                cancelButtonText: '取消',
                type: 'warning'
              }
            ).then(() => {
              // 用户点击启动，尝试启动SD服务
              startSDService();
            }).catch(() => {
              // 用户取消启动
            });
          } else {
            ElementPlus.ElMessage.error('生成失败: ' + result.error);
          }
        }
      } catch (error) {
        console.error('生成图像失败:', error);
        ElementPlus.ElMessage.error('生成图像失败');
      } finally {
        generating.value = false;
      }
    };
    
    // 保存图像
    const saveImage = async () => {
      if (!previewImage.value) {
        ElementPlus.ElMessage.warning('没有可保存的图像');
        return;
      }
      
      try {
        const result = await window.electron.ipcRenderer.invoke('save-image', previewImage.value);
        
        if (result.success) {
          ElementPlus.ElMessage.success('图像已保存');
        } else {
          ElementPlus.ElMessage.error('保存失败: ' + result.error);
        }
      } catch (error) {
        console.error('保存图像失败:', error);
        ElementPlus.ElMessage.error('保存图像失败');
      }
    };
    
    // 复制到剪贴板
    const copyToClipboard = async () => {
      if (!previewImage.value) {
        ElementPlus.ElMessage.warning('没有可复制的图像');
        return;
      }
      
      try {
        const result = await window.electron.ipcRenderer.invoke('copy-to-clipboard', previewImage.value);
        
        if (result.success) {
          ElementPlus.ElMessage.success('图像已复制到剪贴板');
        } else {
          ElementPlus.ElMessage.error('复制失败: ' + result.error);
        }
      } catch (error) {
        console.error('复制图像失败:', error);
        ElementPlus.ElMessage.error('复制图像失败');
      }
    };
    
    // 设置SD状态变更监听
    const setupSDStatusListener = () => {
      // 监听SD服务状态变更
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.on('sd:started', () => {
          sdStatus.value.isRunning = true;
          ElementPlus.ElMessage.success('SD服务已启动，正在加载模型...');
          // 当SD服务启动后，延迟一些时间再加载模型列表
          setTimeout(() => {
            loadModels();
          }, 5000); // 延迟5秒，给SD服务足够时间加载
        });
        
        window.electron.ipcRenderer.on('sd:stopped', () => {
          sdStatus.value.isRunning = false;
          ElementPlus.ElMessage.warning('SD服务已停止');
        });
        
        // 获取当前状态
        window.electron.ipcRenderer.invoke('sd:status').then(status => {
          sdStatus.value = status;
        });
      }
    };
    
    // 启动SD服务
    const startSDService = async () => {
      try {
        // 获取当前SD路径
        const sdPath = await window.electron.config.get('sdPath');
        if (!sdPath) {
          ElementPlus.ElMessage.warning('请先在设置页面配置Stable Diffusion路径');
          return;
        }
        
        // 使用全局共享的启动函数
        if (window.launchSdService) {
          generating.value = true;
          const result = await window.launchSdService(sdPath, {
            // 可以传递特定的启动选项，但默认使用全局配置
            // 例如，如果想使用特定模型：
            model: selectedModel.value || ''
          }, {
            onLoading: (isLoading) => {
              generating.value = isLoading;
            }
          });
          
          if (!result.success) {
            generating.value = false;
          }
        } else {
          // 后备方案：直接调用API（但应该不会执行到这里）
          const result = await window.electron.ipcRenderer.invoke('sd:launch');
          
          if (result.success) {
            ElementPlus.ElMessage.success('正在启动SD服务，请稍候...');
          } else {
            ElementPlus.ElMessage.error('启动SD服务失败: ' + result.error);
          }
        }
      } catch (error) {
        console.error('启动SD服务失败:', error);
        ElementPlus.ElMessage.error('启动SD服务失败');
        generating.value = false;
      }
    };
    
    // 初始化
    loadModels();
    setupSDStatusListener();
    
    // 返回组件数据和方法
    return {
      prompt,
      negativePrompt,
      selectedModel,
      models,
      sampler,
      samplers,
      width,
      height,
      steps,
      cfgScale,
      seed,
      generating,
      previewImage,
      selectedModelInfo,
      sdStatus,
      loadModels,
      randomizeSeed,
      generateImage,
      saveImage,
      copyToClipboard,
      startSDService
    };
  }
};

// 添加组件样式
const txt2imgStyle = document.createElement('style');
txt2imgStyle.textContent = `
  .txt2img-container {
    padding: 20px;
  }
  
  .prompt-card, .preview-card {
    height: 100%;
    margin-bottom: 20px;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .preview-container {
    height: 500px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f5f5f5;
    border-radius: 4px;
  }
  
  .preview-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: #909399;
  }
  
  .preview-placeholder .el-icon {
    font-size: 48px;
    margin-bottom: 10px;
  }
  
  .preview-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  
  .preview-actions {
    display: flex;
    gap: 10px;
  }
  
  .el-radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .el-radio {
    margin-right: 0;
    margin-bottom: 8px;
  }
`;
document.head.appendChild(txt2imgStyle);

// 添加必要的样式
document.head.insertAdjacentHTML('beforeend', `
<style>
  .model-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
  
  .model-info {
    background-color: #f5f7fa;
    padding: 10px;
    border-radius: 4px;
    font-size: 0.9em;
  }
  
  .model-info p {
    margin: 5px 0;
  }
</style>
`);

// 将组件导出为全局变量 - 不再直接挂载
// const app = createApp(txt2img);
// app.use(ElementPlus);
// app.mount('#app'); 