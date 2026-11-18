# 中文译本与编译说明

本目录包含论文《注意力汇聚点与残差汇聚点的统一视角：离群值驱动的重缩放对Transformer训练至关重要》的完整中文LaTeX源码与16页PDF，覆盖正文和全部附录。原论文见 [arXiv 2601.22966](https://arxiv.org/abs/2601.22966)。

主文件为 `acl_latex.tex`，在本目录运行以下命令可编译。

```bash
latexmk -xelatex -interaction=nonstopmode acl_latex.tex
```

编译需要含ctex、XeLaTeX、latexmk及TeX Gyre Pagella字体的TeX发行版。构建元数据已指定XeLaTeX。正文采用与原稿Palatino对应的Pagella字体，中文由ctex排版。首页日期沿用原论文PDF的2026-02-02。

公式内容、引用键、表格内容、图像、作者机构名和参考文献沿用原稿。行内公式使用 `\(...\)`。两处环绕图改为普通浮动图以消除跨页裁切，附录图片与相应标题按顺序排版。

## 原稿中需要注意的数值与记号

以下问题按原稿保留在译文中。

- 第3.4节将3.7M新增参数写作2B模型参数量的约2%。按给定数字计算，\(3.7\mathrm{M}/2\mathrm{B}\approx0.185\%\)。
- 第3.4节将0.73描述为权重相对1的最大偏差，并与0.004和0.06比较，而前文将后两者描述为权重值。这里的参数值与偏差表述需要结合原论文核实。
- 附录A.1以 \(r=|\mathbf h_d|/\lVert\mathbf h\rVert_2\) 定义 \(r\)，又以 \(\mathbf u=\mathbf h/\lVert\mathbf h\rVert_{\mathrm{rms}}\) 定义 \(\mathbf u\)，随后写出 \(|\mathbf u_d|=r\) 与 \(\sum_{i\ne d}\mathbf u_i^2=1-r^2\)。这些等式与给出的RMS归一化定义不一致。译文沿用原公式与推导。

## 核验

150个数学片段、167个引用与路径命令、5个实际表体及1个表格宏、全部图像和参考文献通过保留核验。输出目录已独立编译，16页均已渲染检查，未见缺字、未解析引用、裁切或内容压叠。
