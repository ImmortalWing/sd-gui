// 获取Vue Router的createRouter和createWebHashHistory
const { createRouter, createWebHashHistory } = window.VueRouter;

// 路由配置
const routes = [
  {
    path: '/',
    name: 'home',
    component: function() {
      return new Promise(function(resolve, reject) {
        try {
          // 检查组件是否已加载
          if (window.Home) {
            resolve(window.Home);
            return;
          }
          
          // 等待组件加载完成
          const checkComponent = setInterval(() => {
            if (window.Home) {
              clearInterval(checkComponent);
              resolve(window.Home);
            }
          }, 100);
          
          // 设置超时
          setTimeout(() => {
            clearInterval(checkComponent);
            reject(new Error('Home组件加载超时'));
          }, 5000);
        } catch (err) {
          reject(err);
        }
      });
    }
  },
  {
    path: '/txt2img',
    name: 'txt2img',
    component: function() {
      return new Promise(function(resolve, reject) {
        try {
          // 检查组件是否已加载
          if (window.Txt2Img) {
            resolve(window.Txt2Img);
            return;
          }
          
          // 等待组件加载完成
          const checkComponent = setInterval(() => {
            if (window.Txt2Img) {
              clearInterval(checkComponent);
              resolve(window.Txt2Img);
            }
          }, 100);
          
          // 设置超时
          setTimeout(() => {
            clearInterval(checkComponent);
            reject(new Error('Txt2Img组件加载超时'));
          }, 5000);
        } catch (err) {
          reject(err);
        }
      });
    }
  },
  {
    path: '/img2img',
    name: 'img2img',
    component: function() {
      return new Promise(function(resolve, reject) {
        try {
          // 检查组件是否已加载
          if (window.Img2Img) {
            resolve(window.Img2Img);
            return;
          }
          
          // 等待组件加载完成
          const checkComponent = setInterval(() => {
            if (window.Img2Img) {
              clearInterval(checkComponent);
              resolve(window.Img2Img);
            }
          }, 100);
          
          // 设置超时
          setTimeout(() => {
            clearInterval(checkComponent);
            reject(new Error('Img2Img组件加载超时'));
          }, 5000);
        } catch (err) {
          reject(err);
        }
      });
    }
  },
  {
    path: '/settings',
    name: 'settings',
    component: function() {
      return new Promise(function(resolve, reject) {
        try {
          // 检查组件是否已加载
          if (window.Settings) {
            resolve(window.Settings);
            return;
          }
          
          // 等待组件加载完成
          const checkComponent = setInterval(() => {
            if (window.Settings) {
              clearInterval(checkComponent);
              resolve(window.Settings);
            }
          }, 100);
          
          // 设置超时
          setTimeout(() => {
            clearInterval(checkComponent);
            reject(new Error('Settings组件加载超时'));
          }, 5000);
        } catch (err) {
          reject(err);
        }
      });
    }
  },
  {
    path: '/environment',
    name: 'environment',
    component: function() {
      return new Promise(function(resolve, reject) {
        try {
          // 检查组件是否已加载
          if (window.Environment) {
            resolve(window.Environment);
            return;
          }
          
          // 等待组件加载完成
          const checkComponent = setInterval(() => {
            if (window.Environment) {
              clearInterval(checkComponent);
              resolve(window.Environment);
            }
          }, 100);
          
          // 设置超时
          setTimeout(() => {
            clearInterval(checkComponent);
            reject(new Error('Environment组件加载超时'));
          }, 5000);
        } catch (err) {
          reject(err);
        }
      });
    }
  },
  {
    path: '/models',
    name: 'model-management',
    component: function() {
      return new Promise(function(resolve, reject) {
        try {
          // 检查组件是否已加载
          if (window.ModelManagement) {
            resolve(window.ModelManagement);
            return;
          }
          
          // 等待组件加载完成
          const checkComponent = setInterval(() => {
            if (window.ModelManagement) {
              clearInterval(checkComponent);
              resolve(window.ModelManagement);
            }
          }, 100);
          
          // 设置超时
          setTimeout(() => {
            clearInterval(checkComponent);
            reject(new Error('ModelManagement组件加载超时'));
          }, 5000);
        } catch (err) {
          reject(err);
        }
      });
    }
  }
];

// 创建路由实例
const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// 设置为全局变量
window.appRouter = router;