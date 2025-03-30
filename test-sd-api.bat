@echo off

echo 测试Stable Diffusion API可用性...

cd /d D:\BaiduSyncdisk\sd-launcher

:: 使用curl检测API状态
echo 检查基础服务状态...
curl -s http://127.0.0.1:7860/
if %errorlevel% neq 0 (
    echo SD WebUI服务未启动，请先启动Stable Diffusion
    goto end
)

echo 服务基本可用，检查API...
curl -s http://127.0.0.1:7860/sdapi/v1/sd-models
if %errorlevel% neq 0 (
    echo API不可用！请确保使用--api参数启动SD
    goto end
)

echo API可用，检查可用模型...
curl -s http://127.0.0.1:7860/sdapi/v1/sd-models > models.json
echo 可用模型列表已保存到models.json

echo 测试生成图片...
curl -s -X POST "http://127.0.0.1:7860/sdapi/v1/txt2img" ^
  -H "Content-Type: application/json" ^
  -d "{\"prompt\":\"测试图片\",\"steps\":5,\"width\":512,\"height\":512}" ^
  > test_result.json

echo 测试结果已保存到test_result.json

:end
pause 