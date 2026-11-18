# 三元线性注意力：中文全文

原文：Oliver Sieberling等，*Triadic Linear Attention: Three-Dimensional Recurrent States for Long-Context Sequence Modeling*。
来源：[arXiv:2609.36529v1](https://arxiv.org/abs/2609.36529v1)，2026-09-29发布；2026-11-04核实仍为v1。
用户链接：https://www.alphaxiv.org/pdf/2609.36529

本次复用了此前译稿，本次下载的原始源码与此前原稿逐文件一致。对全文、全部附录、2个算法和4个表格caption重新完成了完整性、中文表达、科学限定三遍复核。修正了引言中“将键值头数翻倍”的基线描述，并恢复两处suggest的推断语气。

## 文件和编译

- `iclr2027_conference.pdf`：19页中文全文。
- `iclr2027_conference.tex`：主文件，包含正文和所有附录。
- `tables/`、`algorithms/`、`figures/`：表格、算法和原图。
- `_original/`和`_source.tar.gz`：未改动的原始源码及下载包。
- `validation/`：保留审计、漏译检查、编译日志与独立重编译结果。

在源码目录执行`sh build.sh`。依赖XeLaTeX、BibTeX、ctex、TeX Gyre字体及原模板依赖。提供生成的bbl方便编译，原始bib保持不变。

## 翻译与保留范围

标题、摘要、正文、脚注、图表caption、致谢、所有附录、算法说明及解释性注释均已翻译。按照translate-paper-latex技能约定，公式内部文字、图片内部文字、表格单元格、参考文献、姓名与机构名、代码标识符和技术名称保留原文。

正文行内公式使用`\(...\)`，无编号块级公式使用`\[...\]`；编号数学环境保持原样。8个TeX文件中，7个包含面向读者内容的文件已翻译；纯宏文件仅统一数学界定符。

## 验证

- 396个数学片段按逐文件多重集合核对，内容逐字一致。
- 引用、标签、图像路径及input参数一致；4个表格本体保持不变。
- 14个非TeX原始文件逐字节一致，包含图形、参考文献和模板。
- 编译得到19页、74条参考文献，无LaTeX错误、缺字、未解析引用或Overfull框。
- 漏译检查只标出Delta Rule技术名称与作者机构块，均属于保留范围。
- 全文逐页渲染并检查了首页、公式、实验图表和算法。

中文排版适配包括禁用pdfLaTeX专用的pdfoutput指令、末尾加载ctex、配置TeX Gyre字体、中文化可见模板标签、调整作者行以适应版心，以及去除作者排版中的多余空白。所有样式文件保持原样。

编译日志仍有6处Underfull松散排版提示，来自环绕图附近的短行和页面伸缩；已检查页面显示，无文字遮挡或裁切。浏览器安全策略不允许自动打开file地址，可直接打开交付的PDF。
