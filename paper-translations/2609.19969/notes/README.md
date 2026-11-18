# DeepSeek-V4.1-Flash 中文全文译本

原论文为 DeepSeek-AI 的 DeepSeek-V4.1-Flash: Pushing the Limits of KV Cache Compression，arXiv:2609.19969v1。

- 原文 https://arxiv.org/html/2609.19969v1
- 作者官方报告 https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf
- 官方仓库声明整个仓库与模型权重使用MIT许可，许可原文见 LICENSE。PDF末页保留该声明。

## 内容与编译

正文、章节标题、图表caption、脚注、算法说明与全部附录已翻译。作者姓名、参考文献条目、数学内部文字、原图与表格表体保留原文。翻译5个含可读正文的tex文件，另有1个共享命令文件。所有原始文件及下载包均保留在 _original 和 _source.tar.gz。

main.tex 为主文件，main.pdf 为已编译的43页中文译本，最后1页为译本与MIT许可说明。PDF采用嵌入TrueType中文字体，支持文字选择和搜索。

在macOS上安装完整TeX Live后运行 `./build.sh`。编译使用XeLaTeX，并读取macOS系统宋体 `/System/Library/Fonts/Supplemental/Songti.ttc`，字体文件未随源码分发。其他系统需在main.tex中将三个setCJK字体设置替换为本机可用中文字体。英文使用TeX Live附带的TeX Gyre字体。保留生成的main.bbl，构建脚本无需再次运行BibTeX。

## 核对记录

数学315个片段逐字一致，允许将公式定界符改为用户指定的\(...\)和\[...\]。引用与标签、表格数据及17个原始非tex文件保持一致。原版与中文版本均通过XeLaTeX编译，全部43页已渲染并人工查看，另用Poppler抽查首页、算法页与附录公式页。中文字体均已嵌入，带Unicode映射。交付目录独立重新编译后，43页渲染与交付PDF逐像素相同。已在macOS预览中打开并确认中文正常显示。无缺字、无未定义引用，无超出版心警告。

漏译检查仅剩未使用的共享宏内示例、作者名单、模型专名、LaTeX配置和MIT许可原文。模板仍报告inputenc/cmap/fixltx2e的XeLaTeX兼容提示、dramatist的命令覆盖提示及microtype的footnote补丁提示。少量Underfull hbox为行间伸展提示，渲染未见遮挡或裁切。

validation/ 中包含保存性检查脚本、检查结果、构建日志、漏译报告与字体清单。文中判断保留原作者表述。
