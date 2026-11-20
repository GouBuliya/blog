# Gated Attention 中文译本

原论文：Gated Attention for Large Language Models: Non-linearity, Sparsity, and Attention-Sink-Free（[arXiv:2505.06708v1](https://arxiv.org/abs/2505.06708v1)）。翻译日期：2026-11-20。译文15页，覆盖摘要、正文、图表说明、脚注和全部附录；原文PDF为17页。

保留Gated Attention、SDPA、attention sink、gating、head-specific/head-shared、elementwise/headwise、query/key/value、MoE等技术术语的英文。作者、机构、模型、数据集、表格本体与参考文献保留原稿。

## 编译与核验

本地源码包解压后，在主文件所在目录执行：

```sh
latexmk -xelatex -interaction=nonstopmode acl_latex.tex
```

需要ctex、XeLaTeX、latexmk与TeX Gyre Pagella字体。源码使用原始LaTeX，仅加入中文排版配置；行内公式采用 `\(...\)`，块级公式保留原数学环境或采用 `\[...\]`。日期沿用原论文首页的2025-06-11。

181个数学片段、179个引用/标签/路径命令、6个表体与1个表格宏通过对照审计，图像和参考文献源文件逐字节一致。最终15页均渲染检查。表3顶部原有负间距导致其标题与前表重叠，已去除该负间距。中英文各27项目录按各自实际页码和标题位置生成并核对。

源码保留于本地；网站提供PDF阅读。原模板有字体回退警告以及一处约4.6pt的轻微行宽溢出，最终检查未发现缺字、内容裁切或重叠。

## 原文表述说明

以下疑点沿用原文，未以译者判断替换作者结论：

- 第2节先给出QKV投影，随后multi-head定义中再次使用投影矩阵；gating位置枚举中的Q/K/V顺序与图1的G2/G3/G4顺序也不完全对应。
- 第4.1节脚注将各head分别经过输出投影后再“拼接”描述为等价操作；通常分块输出投影对应求和。
- 第4.2节将input-independent gating的改善解释为引入非线性，但文中所述该gate对输入而言是固定缩放。
- 附录SwitchHead讨论以第4、5行说明相同expert参数设置下的效果，但表中两行新增参数量分别为13M和25M。
