# MesaNet中文译本说明

论文：*MesaNet: Sequence Modeling by Locally Optimal Test-Time Training*，arXiv:2506.05233v2。

官方页面：https://arxiv.org/abs/2506.05233v2
官方源码：https://arxiv.org/src/2506.05233v2
官方PDF：https://arxiv.org/pdf/2506.05233v2

本地原始源码包为`_source.tar.gz`，SHA-256：

```
1b4ddd9ebd2e664510839abbbd0282e3ea832472e3baa749b71e78cd8677933c
```

`_original/`保留未修改源码。译文覆盖正文、附录、章节标题、图表caption、脚注及面向读者的算法解释。英文原文53页；中文译本46页。

图像本体、图中文字、表格表头及单元格保持原文；引用条目、作者姓名、路径、宏名、代码标识符保持原样。MesaNet、Mesa layer、attention、key/query/value、token、loss、gate等技术术语保留英文。数学内容保持原样，包括公式中的英文；仅将数学分隔符统一为行内`\(...\)`及块级`\[...\]`，原有公式环境保留。

使用XeLaTeX编译，需要安装`ctex`及源模板依赖。完整源码目录下运行：

```sh
latexmk -xelatex -interaction=nonstopmode -halt-on-error main.tex
```

`preservation-audit.json`记录数学片段、引用、表格及资源保留检查；`settings-audit.json`和`extended-audit.json`记录对应分段检查。数学检查按内容及出现次数比较，允许中文语序引起的引用或行内公式顺序调整。检查通过不代表对原论文数学结论进行了独立证明。46页均已渲染并逐页视觉验收；修复一处浮动图越界、一处长公式排版及末页孤立标题。数学审计仅忽略空白、对齐标记与换行。原稿重复图标签的第二处改为独立标签，原正文引用仍指向第一处图。

## 原文疑点

以下按原文保留，未擅自修改公式、数据或作者科学判断。

- 超参数段写140M/440M/940M，其他段落使用145M/400M/1B。50B训练学习率候选中的`0.0085`与邻近候选数量级不同。
- CG求解器精度段出现`FB16`，疑为`BF16`笔误。
- 遗忘系数被描述为上界0.9975，但给出的、依赖写入强度的缩放表达式并不直接保证这一固定上界。
- 正则化讨论中的“Figure”引用指向内部分析的章节标签，而非图标签。
- 递归最小二乘附录将平方误差写为\(l_t^\text{sq-err}=\|v_t^2-\Phi k_t\|^2\)，其中\(v_t^2\)疑为笔误。二阶更新末行的Hessian逆左乘矩阵梯度，与前一行右乘\(H_t^{-1}\)之间缺少明确的向量化或算子约定。
- 大正则化状态跟踪讨论在“近似GLA”与“精确等价”之间措辞不够严格，未补充原文没有给出的保证。
- 逐位置NLL文字称只对长度至少为\(k\)的序列求和，公式分母仍为\(|S|\)，未明确该集合是否相应改变。随后一段描述NLL差值，却将记号写为\(\texttt{NLL}_k^\text{model}\)，缺少\(\Delta\)。
- 2048长度PPL正文称“五个数据集”，对应表实际列出六个数据集。
- 单词重排表caption称“50-shot”，对应正文与表头使用100-shot。
- CG训练步数消融正文称training loss，对应图caption称validation loss。
- 贪心匹配评估先定义目标\(y\)，随后写检查\(t\)是否匹配。

- chunkwise GLA公式的跨chunk遗忘项、K矩阵列数与范围、CG正文和算法的初始化状态、value投影及部分backward转置存在记号疑点，按原文保留。
- Mamba2在一处称forget-gated，在另一处称non-gated。
- 单词重排任务按官方lm-evaluation-harness的anagrams2定义译为首尾各两个字符不变。

## 源码包

`package_source.py`默认仅列出待打包文件。显式传入`--write`才创建ZIP，并拒绝覆盖已有同名文件。包中包含重编译所需TeX、BibTeX、模板、图片及说明和审计，不包含原始备份、过程分段、渲染图和LaTeX中间文件。源码包须在独立目录解包重编译验证。
