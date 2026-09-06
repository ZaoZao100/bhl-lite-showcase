# 字体资源

中文字体顺序为 PingFang SC（仅使用设备已安装字体）、Noto Sans SC、Microsoft YaHei UI、系统无衬线字体。英文优先 Inter。

- InterVariable.woff2：来自 https://rsms.me/inter/font-files/InterVariable.woff2，许可见 Inter-LICENSE.txt。
- noto-*.woff2：Noto Sans SC 可变字体的 Unicode 分段，来自 Google Fonts 的 Noto Sans SC 分发。许可见 NotoSansSC-OFL.txt。
- src/fonts.css 定义分段范围，浏览器按页面需要加载相应文件。
- 不包含或分发 Apple 字体文件。

所有网页字体均从本站加载，CSS 使用 font-display: swap。
