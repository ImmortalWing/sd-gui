// 避免重复声明Vue方法，直接使用window.Vue
window.ModelManagement = {
  template: `
    <div class="model-management-container">
      <h1>模型管理</h1>
      
      <div class="action-bar">
        <el-button type="primary" @click="importModel" :loading="isImporting">
          <el-icon><Plus /></el-icon> 导入模型
        </el-button>
        
        <el-button type="primary" @click="refreshModels">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </div>
      
      <el-alert
        v-if="models.length === 0 && !isLoading"
        title="没有找到文件"
        type="info"
        description="模型目录为空"
        show-icon
        :closable="false"
        class="models-empty-alert"
      />
      
      <div v-loading="isLoading" class="model-list">
        <el-table
          :data="models"
          style="width: 100%"
          v-if="models.length > 0"
          border
        >
          <el-table-column
            label="名称"
            prop="name"
            min-width="250"
          />
          <el-table-column
            label="类型"
            width="120"
            align="center"
          >
            <template #default="scope">
              <el-tag
                :type="getTypeTagType(scope.row)"
                effect="plain"
              >
                {{ scope.row.extension || '未知' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="大小"
            prop="sizeFormatted"
            width="120"
            align="center"
          />
          <el-table-column
            label="修改时间"
            width="180"
            align="center"
          >
            <template #default="scope">
              {{ formatDate(scope.row.lastModified) }}
            </template>
          </el-table-column>
          <el-table-column
            label="状态"
            width="120"
            align="center"
          >
            <template #default="scope">
              <el-tag type="success" v-if="scope.row.isDefault">默认</el-tag>
              <el-tag type="info" v-if="scope.row.isModel && !scope.row.isDefault">模型</el-tag>
            </template>
          </el-table-column>
          <el-table-column
            label="操作"
            width="250"
            align="center"
          >
            <template #default="scope">
              <el-button
                size="small"
                type="success"
                @click="setAsDefault(scope.row)"
                :disabled="scope.row.isDefault || !scope.row.isModel"
                v-if="scope.row.isModel"
              >
                设为默认
              </el-button>
              <el-button
                size="small"
                type="danger"
                @click="confirmDelete(scope.row)"
                :disabled="isDeleting"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      
      <el-dialog
        title="确认删除"
        v-model="deleteDialogVisible"
        width="30%"
      >
        <p>确定要删除文件 <strong>{{ modelToDelete ? modelToDelete.name : '' }}</strong> 吗？</p>
        <p class="warning-text">此操作不可恢复！</p>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="deleteDialogVisible = false">取消</el-button>
            <el-button type="danger" @click="deleteModel" :loading="isDeleting">确认删除</el-button>
          </span>
        </template>
      </el-dialog>
    </div>
  `,
  
  setup() {
    const models = window.Vue.ref([]);
    const isLoading = window.Vue.ref(false);
    const isImporting = window.Vue.ref(false);
    const isDeleting = window.Vue.ref(false);
    const deleteDialogVisible = window.Vue.ref(false);
    const modelToDelete = window.Vue.ref(null);
    
    // 加载模型列表
    const loadModels = async () => {
      isLoading.value = true;
      
      try {
        const modelsList = await window.electron.modelManager.list();
        models.value = modelsList;
      } catch (error) {
        console.error('加载模型失败:', error);
        ElementPlus.ElMessage.error('加载模型列表失败');
      } finally {
        isLoading.value = false;
      }
    };
    
    // 获取文件类型标签样式
    const getTypeTagType = (file) => {
      if (file.isModel) {
        return 'success';
      }
      
      // 根据扩展名设置不同的标签类型
      const extType = {
        'txt': 'info',
        'json': 'warning',
        'yaml': 'warning',
        'yml': 'warning',
        'py': 'primary',
        'js': 'primary'
      };
      
      return extType[file.extension] || 'info';
    };
    
    // 刷新模型列表
    const refreshModels = () => {
      loadModels();
    };
    
    // 导入模型
    const importModel = async () => {
      isImporting.value = true;
      
      try {
        const result = await window.electron.modelManager.import();
        
        if (result.success) {
          ElementPlus.ElMessage.success('模型导入成功');
          await loadModels(); // 重新加载模型列表
        } else if (!result.canceled) {
          ElementPlus.ElMessage.error(`导入失败: ${result.error}`);
        }
      } catch (error) {
        console.error('导入模型失败:', error);
        ElementPlus.ElMessage.error('导入模型失败');
      } finally {
        isImporting.value = false;
      }
    };
    
    // 设置默认模型
    const setAsDefault = async (model) => {
      try {
        const result = await window.electron.modelManager.setDefault(model.name);
        
        if (result.success) {
          ElementPlus.ElMessage.success(`已将 ${model.name} 设为默认模型`);
          
          // 更新本地列表
          models.value = models.value.map(m => ({
            ...m,
            isDefault: m.name === model.name
          }));
        } else {
          ElementPlus.ElMessage.error(`设置默认模型失败: ${result.error}`);
        }
      } catch (error) {
        console.error('设置默认模型失败:', error);
        ElementPlus.ElMessage.error('设置默认模型失败');
      }
    };
    
    // 确认删除对话框
    const confirmDelete = (model) => {
      modelToDelete.value = model;
      deleteDialogVisible.value = true;
    };
    
    // 删除模型
    const deleteModel = async () => {
      if (!modelToDelete.value) return;
      
      isDeleting.value = true;
      
      try {
        const result = await window.electron.modelManager.delete(modelToDelete.value.name);
        
        if (result.success) {
          ElementPlus.ElMessage.success('文件已删除');
          
          // 更新本地列表
          models.value = models.value.filter(m => m.name !== modelToDelete.value.name);
          
          // 关闭对话框
          deleteDialogVisible.value = false;
          modelToDelete.value = null;
        } else {
          ElementPlus.ElMessage.error(`删除失败: ${result.error}`);
        }
      } catch (error) {
        console.error('删除文件失败:', error);
        ElementPlus.ElMessage.error('删除文件失败');
      } finally {
        isDeleting.value = false;
      }
    };
    
    // 格式化日期
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleString();
    };
    
    // 组件挂载时
    window.Vue.onMounted(() => {
      loadModels();
    });
    
    return {
      models,
      isLoading,
      isImporting,
      isDeleting,
      deleteDialogVisible,
      modelToDelete,
      loadModels,
      refreshModels,
      importModel,
      setAsDefault,
      confirmDelete,
      deleteModel,
      formatDate,
      getTypeTagType
    };
  }
};

// 添加组件样式
const modelMgmtStyle = document.createElement('style');
modelMgmtStyle.textContent = `
  .model-management-container {
    padding: 20px;
  }
  
  .action-bar {
    margin: 20px 0;
    display: flex;
    gap: 10px;
  }
  
  .models-empty-alert {
    margin: 20px 0;
  }
  
  .model-list {
    margin-top: 20px;
  }
  
  .warning-text {
    color: #f56c6c;
    font-weight: bold;
  }
`;
document.head.appendChild(modelMgmtStyle);