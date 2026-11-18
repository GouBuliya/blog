# MoM：基于混合记忆的线性序列建模（中文译稿）

原论文：MoM: Linear Sequence Modeling with Mixture-of-Memories
版本：https://arxiv.org/abs/2502.13685v4
源码下载：https://arxiv.org/e-print/2502.13685v4
译稿生成：2026-10-13

## 覆盖范围

全文翻译标题、摘要、引言、方法、实验、结论、伦理声明及附录A—I，包含正文脚注及图表题注。翻译2个含正文的TeX文件；math_commands.tex仅含宏，原样保留。主文件为iclr2026_conference.tex，另一正文文件为introduction.tex。

参考文献、作者和机构、原图内文字、表格本体（含表头、模型名、指标名、数值）按原文保留；未呈现的源码注释也保留英文。译文保留作者论断，不把翻译改成论文评述。

## 编译与排版

使用XeLaTeX和原ICLR模板，加入ctex的plain模式及Fandol字体。最终PDF为17页。行内公式使用\(...\)，无编号块公式使用\[...\]，带编号的equation环境保留，以保持公式编号和交叉引用。

编译命令（在本目录执行）：

```sh
/usr/bin/perl "$(command -v latexmk)" -xelatex -interaction=nonstopmode -file-line-error iclr2026_conference.tex
```

中文重排导致原来的绕排表越过页底，因此将两处wraptable改为普通浮动表，对表格增加最大行宽限制。图表本体未修改。

最终编译无错误、无缺字、无未解析引用、无Overfull警告。仍有Fandol中文小型大写字形不存在时回退到常规字形的提示，以及Underfull hbox/vbox排版松散提示。已渲染并查看最终全部17页，图表完整，未见裁切或重叠。

## 保留校验

preservation-audit.json记录了对去除注释后的原稿与译稿进行的校验：163处数学内容、13个顶层tabular、25个label、24次ref、63次cite/citep/citet、9次图片引用均保留；数学比较忽略空白与分隔符差异。15个非TeX原始资产哈希一致。_original/与_source.tar.gz保留原始来源。

漏译脚本报告的候选项已检查：可见章节标题和caption无英文漏译；英文候选来自未呈现的注释、作者机构、宏配置与保留原样的表格。

## 原文疑点

实验的记忆负载均衡段将图balance与balance_no_aux都描述为使用辅助损失，而后者题注写明不使用辅助损失，译文按原文保留这一不一致。方法的硬件实现小节使用左乘投影的写法，与前文行向量记号的方向不同；公式亦照原稿保留。附录中的0.25M预热token等设置未擅自修订。

## 浏览器打开状态

尝试在当前Chrome中打开生成的file://本地PDF时，被浏览器URL安全策略拒绝（仅允许http/https）。未绕过该限制；PDF本身已成功生成并经过本地渲染检查，可从交付链接手动打开。
