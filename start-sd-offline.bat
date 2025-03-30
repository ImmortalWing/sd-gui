@echo off

echo 正在以离线模式启动Stable Diffusion...

cd /d F:\stable-diffusion-webui

:: 使用venv中的Python而不是系统默认的Python
call .\venv\Scripts\python.exe launch.py --skip-torch-cuda-test --disable-safe-unpickle --skip-python-version-check --no-download-sd-model --xformers --skip-version-check --no-half-vae --medvram --opt-sub-quad-attention --disable-nan-check --port=7860 --api --listen

echo 启动完成！
pause 