# hover-reader
vscode摸鱼助手，悬浮窗看小说

## 功能特点
- 📚 支持txt格式
- 🪟 悬浮窗阅读，随时切换
- 🔖 自动记忆阅读进度
- 🎨 支持自定义每页行数
- 📱 支持移动端vscode

## 安装
1. ~~VS Code 扩展商店搜索 "hover-reader"~~（未上架）
2. 打包安装
   ```bash
   # 1. 克隆仓库
   git clone https://github.com/yourusername/hover-reader.git
   cd hover-reader
   
   # 2. 安装依赖
   npm install
   
   # 3. 安装vsce
   npm install -g @vscode/vsce
   
   # 4. 打包
   vsce package   ```
   
   生成的 `hover-reader-0.0.1.vsix` 文件即为安装包
   
   在 VS Code 中按 `Ctrl+Shift+P`，输入 `Extensions: Install from VSIX` 选择生成的 vsix 文件安装

## 使用方法
1. 点击状态栏的 📖 图标开启阅读器
2. 选择你要阅读的txt文件
3. 将鼠标悬浮在任意位置开始阅读
4. 每次悬浮自动翻页

## 快捷键
- 切换阅读方向:
  - 向后翻页: `ctrl+alt+.`
  - 向前翻页: `ctrl+alt+,`
- 重置到第一页: `ctrl+alt+0`

## 设置
- 快捷键
- 每页显示行数
- 文本文件路径

## License
MIT

