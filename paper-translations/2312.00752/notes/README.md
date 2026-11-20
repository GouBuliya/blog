# Mamba：利用Selective State Space实现线性时间序列建模

原文：Albert Gu、Tri Dao，*Mamba: Linear-Time Sequence Modeling with Selective State Spaces*，arXiv:2312.00752v2（2024-05-31）。本译本完成于2026-11-20。

## 范围与术语

翻译覆盖摘要、正文、实验、讨论、结论、致谢、全部附录及图表说明。保留Mamba、selective SSM、selection mechanism、scan、attention、Transformer、gating、kernel fusion、recomputation等技术词汇的英文。作者、机构、参考文献、公式内部文字、图像本体和表格内容保留原文。

LaTeX主文件为`main.tex`，正文在`src/`，原始源码保存在`_original/`。中文PDF为`main.pdf`，共33页，对应英文原版36页。博客的中英对照使用同一版本英文PDF，按章节匹配两种语言的位置。

## 重编译

需要XeLaTeX、latexmk、与biblatex版本兼容的Biber，以及ctex/xeCJK和Libertine、Biolinum、Inconsolata字体。本机验证使用biblatex 3.21与Biber 2.21。

```sh
latexmk -xelatex -interaction=nonstopmode -file-line-error main.tex
```

若系统latexmk的Perl环境异常，可改用`/usr/bin/perl`启动latexmk。源码包包括参考文献数据库、已生成的参考文献文件、全部图像及原始源码；不包含Biber可执行文件。

原模板的Libertine字体包与fontspec重复定义`liningnums`，译本在加载ctex前解除该旧定义，并显式指定原模板字体的OpenType版本。authblk的空参数判断会提前展开`\(...\)`，因此在本地preamble中修正该判断；作者与机构对应关系不变。图注中的空段落改为注释分隔，避免caption包报错。修正算法环境重复的超链接锚点，并为一处长公式调整换行。未删除正文来规避编译问题。

## 原稿中保留的问题

以下内容来自原稿，译文未擅自修改公式、数值或补写科学结论：

- 附录C的门控证明中，连续时间方程左侧写成`h(t)`，未写导数；它与正文的连续SSM定义不一致。
- 附录D的显存分析使用`O(BLN + DN)`，与前文张量维度及`O(BLD + DN)`的写法不一致。
- 附录E.2.2的“Scaling laws: extra ablations”图注包含未写完的“(Left) Instead of / (Right) Instead of”。译文保留为“（左）替代……（右）替代……”。
- 参数初始化表中，随机初始化写为正的`exp(N(0,1))`，与同表其余负值初始化不同；未补负号。
- SC09中心模块的整体排序“Mamba > S4+MLP > MHA+MLP”并不适用于NLL列：MHA+MLP为1.850，Mamba为1.852。
- Induction Heads曲线在源码中被设为`type=table`，因此按原稿保留其表格编号。

## 验证

`preservation-audit.json`记录逐文件保护检查。原始图像与参考文献数据库保持字节一致，公式、引用/标签/路径键和表格本体逐项比较。全文漏翻检查仅剩刻意保留的技术术语标题和LaTeX配置。

最终编译无未定义引用、缺字或重复锚点。60项保护检查通过，覆盖543个数学片段、426个引用/标签/路径键、16个表格本体及参考文献条目集合。33页已逐页渲染检查，文本边界检查未发现超出纸张的文本。部分长参考文献URL略超正文边界，但没有裁切。中英文各提供60项显式目录，覆盖摘要、各级章节、致谢、参考文献及附录。
