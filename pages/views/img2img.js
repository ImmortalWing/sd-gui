// 定义图生图组件
window.Img2Img = {
  template: `
    <div class="img2img-container">
      <el-row :gutter="20">
        <!-- 左侧：图片上传和参数设置 -->
        <el-col :span="12">
          <el-card class="upload-card">
            <template #header>
              <div class="card-header">
                <span>图片上传</span>
              </div>
            </template>
            
            <!-- 图片上传 -->
            <el-upload
              class="image-uploader"
              :show-file-list="false"
              :before-upload="beforeUpload"
              :http-request="handleUpload"
            >
              <img v-if="sourceImage" :src="sourceImage" class="uploaded-image" />
              <el-icon v-else class="image-uploader-icon"><Plus /></el-icon>
            </el-upload>
            
            <!-- 提示词设置 -->
            <el-form-item label="正向提示词">
              <el-input
                v-model="prompt"
                type="textarea"
                :rows="4"
                placeholder="请输入正向提示词"
              />
            </el-form-item>
            
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
                />
              </el-select>
            </el-form-item>
            
            <!-- 采样器选择 -->
            <el-form-item label="采样器">
              <el-radio-group v-model="sampler">
                <el-radio v-for="item in samplers" :key="item.value" :label="item.value">
                  {{ item.label }}
                </el-radio>
              </el-radio-group>
            </el-form-item>
            
            <!-- 去噪强度 -->
            <el-form-item label="去噪强度">
              <el-slider
                v-model="denoisingStrength"
                :min="0"
                :max="1"
                :step="0.01"
                show-input
              />
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
              <el-button
                type="primary"
                :loading="generating"
                :disabled="!sourceImage"
                @click="generateImage"
              >
                生成图像
              </el-button>
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
    const sourceImage = window.Vue.ref('');
    const prompt = window.Vue.ref('');
    const negativePrompt = window.Vue.ref('');
    const selectedModel = window.Vue.ref('');
    const models = window.Vue.ref([]);
    const sampler = window.Vue.ref('Euler a');
    const denoisingStrength = window.Vue.ref(0.75);
    const steps = window.Vue.ref(20);
    const cfgScale = window.Vue.ref(7);
    const seed = window.Vue.ref(-1);
    const generating = window.Vue.ref(false);
    const previewImage = window.Vue.ref('');
    
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
    
    // 加载模型列表
    const loadModels = async () => {
      try {
        const result = await window.electron.ipcRenderer.invoke('get-models');
        models.value = result;
        if (result.length > 0) {
          selectedModel.value = result[0].title;
        }
      } catch (error) {
        ElementPlus.ElMessage.error('加载模型列表失败');
      }
    };
    
    // 上传前验证
    const beforeUpload = (file) => {
      const isImage = file.type.startsWith('image/');
      const isLt2M = file.size / 1024 / 1024 < 2;
      
      if (!isImage) {
        ElementPlus.ElMessage.error('只能上传图片文件！');
        return false;
      }
      if (!isLt2M) {
        ElementPlus.ElMessage.error('图片大小不能超过 2MB！');
        return false;
      }
      return true;
    };
    
    // 处理上传
    const handleUpload = async (options) => {
      try {
        const file = options.file;
        const reader = new FileReader();
        
        reader.onload = (e) => {
          sourceImage.value = e.target.result;
        };
        
        reader.readAsDataURL(file);
      } catch (error) {
        ElementPlus.ElMessage.error('图片上传失败');
      }
    };
    
    // 生成随机种子
    const randomizeSeed = () => {
      seed.value = Math.floor(Math.random() * 2147483647);
    };
    
    // 生成图像
    const generateImage = async () => {
      if (!sourceImage.value) {
        ElementPlus.ElMessage.warning('请先上传源图片');
        return;
      }
      
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
        const params = {
          init_images: [sourceImage.value.split(',')[1]],
          prompt: prompt.value,
          negative_prompt: negativePrompt.value,
          model: selectedModel.value,
          sampler_name: sampler.value,
          denoising_strength: denoisingStrength.value,
          steps: steps.value,
          cfg_scale: cfgScale.value,
          seed: seed.value
        };
        
        const result = await window.electron.ipcRenderer.invoke('img2img', params);
        
        if (result.success) {
          previewImage.value = 'data:image/png;base64,' + result.data;
          ElementPlus.ElMessage.success('图像生成成功');
        } else {
          ElementPlus.ElMessage.error('生成失败: ' + result.error);
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
    
    // 初始化
    loadModels();
    
    return {
      sourceImage,
      prompt,
      negativePrompt,
      selectedModel,
      models,
      sampler,
      samplers,
      denoisingStrength,
      steps,
      cfgScale,
      seed,
      generating,
      previewImage,
      beforeUpload,
      handleUpload,
      randomizeSeed,
      generateImage,
      saveImage,
      copyToClipboard
    };
  }
};

// 添加组件样式
const img2imgStyle = document.createElement('style');
img2imgStyle.textContent = `
  .img2img-container {
    padding: 20px;
  }
  
  .upload-card, .preview-card {
    height: 100%;
    margin-bottom: 20px;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .image-uploader {
    width: 100%;
    height: 200px;
    border: 1px dashed #d9d9d9;
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }
  
  .image-uploader:hover {
    border-color: #409EFF;
  }
  
  .image-uploader-icon {
    font-size: 28px;
    color: #8c939d;
  }
  
  .uploaded-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
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
document.head.appendChild(img2imgStyle);

// 将组件导出为全局变量 - 不再直接挂载
// const app = createApp(img2img);
// app.use(ElementPlus);
// app.mount('#app'); 