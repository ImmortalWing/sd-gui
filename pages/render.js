// 渲染脚本
console.log('渲染脚本已加载');

// 初始化Vue应用
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM已完全加载，初始化Vue应用');
    
    // 创建Vue根实例
    const app = Vue.createApp({
        template: '<router-view></router-view>'
    });

    // 使用Element Plus组件库
    app.use(ElementPlus);
    
    // 使用路由
    app.use(router);
    
    // 挂载到#app元素
    app.mount('#app');
    
    console.log('Vue应用初始化完成');
});
