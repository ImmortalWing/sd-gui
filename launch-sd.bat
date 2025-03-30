@echo off

echo 正在启动Stable Diffusion...

:: 先运行git安全目录配置
call fix-git.bat

:: 切换到SD目录
cd /d F:\stable-diffusion-webui

:: 使用SD的venv中的Python
call .\venv\Scripts\python.exe launch.py --xformers --medvram --api --listen --port=7860

echo 启动完成！
pause 