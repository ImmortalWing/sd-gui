const { exec } = require('child_process');
const iconv = require('iconv-lite');

// Promise化的exec函数
function execPromise(command) {
  return new Promise((resolve, reject) => {
    // 在Windows平台上，先设置控制台代码页为UTF-8
    if (process.platform === 'win32') {
      command = 'chcp 65001 >nul && ' + command;
    }
    
    exec(command, { 
      encoding: 'buffer',
      maxBuffer: 1024 * 1024 * 10  // 增加缓冲区大小到10MB
    }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      
      // 使用iconv-lite解码，处理中文字符
      const stdoutStr = iconv.decode(stdout, 'utf8');
      const stderrStr = iconv.decode(stderr, 'utf8');
      
      resolve({ 
        stdout: stdoutStr, 
        stderr: stderrStr 
      });
    });
  });
}

module.exports = {
  execPromise
};