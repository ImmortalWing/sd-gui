// 获取Vue方法
const { createApp, ref } = window.Vue;

// 导航组件
const elementNav = {
  template: `
    <el-menu
      :default-active="activeIndex"
      class="nav-menu"
      @select="handleSelect"
    >
      <el-menu-item index="/">
        <el-icon><HomeFilled /></el-icon>
        <span>首页</span>
      </el-menu-item>
      
      <el-sub-menu index="generation">
        <template #title>
          <el-icon><Picture /></el-icon>
          <span>图像生成</span>
        </template>
        
        <el-menu-item index="/txt2img">
          <el-icon><Edit /></el-icon>
          <span>文生图</span>
        </el-menu-item>
        
        <el-menu-item index="/img2img">
          <el-icon><PictureFilled /></el-icon>
          <span>图生图</span>
        </el-menu-item>
      </el-sub-menu>
      
      <el-menu-item index="/models">
        <el-icon><Files /></el-icon>
        <span>模型管理</span>
      </el-menu-item>
    </el-menu>
    
    <el-menu
      :default-active="activeIndex"
      class="nav-menu bottom-menu"
      @select="handleSelect"
    >
      <el-menu-item index="/environment">
        <el-icon><Monitor /></el-icon>
        <span>环境配置</span>
      </el-menu-item>
      
      <el-menu-item index="/settings">
        <el-icon><Setting /></el-icon>
        <span>设置</span>
      </el-menu-item>
    </el-menu>
  `,
  
  setup() {
    const activeIndex = ref('/');
    
    // 处理菜单选择
    const handleSelect = (index) => {
      window.appRouter.push(index);
    };
    
    // 监听路由变化
    window.appRouter.afterEach((to) => {
      activeIndex.value = to.path;
    });
    
    return {
      activeIndex,
      handleSelect
    };
  }
};

// 注册组件
const app = createApp(elementNav);
app.use(ElementPlus);

// 注册所有图标
try {
  if (window.ElementPlusIconsVue) {
    // 注册所有图标组件
    for (const [key, component] of Object.entries(window.ElementPlusIconsVue)) {
      app.component(key, component);
    }
  } else {
    console.warn('未找到ElementPlusIconsVue对象');
  }
} catch (err) {
  console.error('注册图标时出错:', err);
}

// 挂载到导航容器
try {
  app.mount('#nav');
  console.log('导航组件已挂载');
} catch (err) {
  console.error('挂载导航组件失败:', err);
}