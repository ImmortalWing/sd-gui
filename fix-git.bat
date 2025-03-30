@echo off

echo 正在配置Git安全目录...

git config --global --add safe.directory "F:/stable-diffusion-webui"
git config --global --add safe.directory "F:/stable-diffusion-webui/repositories/stable-diffusion-webui-assets"
git config --global --add safe.directory "F:/stable-diffusion-webui/repositories/stable-diffusion-stability-ai"
git config --global --add safe.directory "F:/stable-diffusion-webui/repositories/CodeFormer"
git config --global --add safe.directory "F:/stable-diffusion-webui/repositories/BLIP"
git config --global --add safe.directory "F:/stable-diffusion-webui/repositories/k-diffusion"
git config --global --add safe.directory "F:/stable-diffusion-webui/repositories/stable-diffusion"
git config --global --add safe.directory "F:/stable-diffusion-webui/repositories/generative-models"

echo 配置完成！
pause 