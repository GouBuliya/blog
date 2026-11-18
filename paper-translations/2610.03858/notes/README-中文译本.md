# 两篇论文的完整中文译本

两篇均由原始 LaTeX 源码翻译，包含正文、脚注、图表题、证明和附录；这是非官方中文译本。作者、机构、参考文献、原始图片、表格单元格、公式内部文字及语言模型实验中的原始英文文本均按原文保留。

## 先读哪篇

建议先读 `irie-2022-zh.pdf` 第 3 页、第 3 节中的两段注释：“没有任何东西被遗忘”和“无限记忆容量未必有用”。这是 2022 年论文提出改用更强检索核（包括 softmax）的直接位置。随后读 RCDL 的第 3 节，可以看到后者如何补上写入规则的推导。

## 版本与文件

| 论文 | 使用版本 | 中文 PDF | 主 LaTeX 文件 |
|---|---|---|---|
| The Dual Form of Neural Networks Revisited: Connecting Test Time Predictions to Training Patterns via Spotlights of Attention | arXiv:2202.05798v2，2022-06-17，ICML 2022 | `irie-2022-zh.pdf`，20 页 | `irie-dual-2022-zh/paper.tex` |
| Retrieval-Centric Deep Learning in Growing Nonparametric Neural Networks | arXiv:2610.03858v1，2026-10-02 | `rcdl-2026-zh.pdf`，43 页 | `rcdl-2026-zh/main.tex` |

原文：https://arxiv.org/abs/2202.05798v2 ；https://arxiv.org/abs/2610.03858v1 。
会议版入口：https://proceedings.mlr.press/v162/irie22a.html 。

`two-papers-zh-source.zip` 包含两份可编译的译文源码、图片、参考文献、原始源码归档及 `_original/` 对照副本。目录中的 `_original/` 未被修改。两篇合计翻译了 15 个含可见正文或表题的 `.tex` 文件；两份 `math_commands.tex` 为宏定义，保持原样。

## 编译

安装 XeLaTeX、latexmk、ctex/xeCJK 后，在本目录执行：

```sh
python3 compile_cn.py irie-dual-2022-zh/paper.tex
python3 compile_cn.py rcdl-2026-zh/main.tex
```

当前在 macOS 的 TeX Live 环境验证通过。2022 年译本显式使用系统字体 Songti SC；其他平台可将该字体设置替换为本机可用的中文字体。编译脚本包含本机 Homebrew Perl 不可用时的回退处理。

## 核对结果

- 数学内容、标签、交叉引用、引文键、图像路径和外部输入路径均与原始源码核对通过。
- 2022 年论文核对 131 个数学片段、7 个表格；RCDL 核对 1,171 个数学片段、18 个表格。数学片段按去除空白后的内容及出现次数比较，表格仅将数学分隔符统一后比较；未改动其数据。各段翻译另行检查了原公式文本。
- 行内公式分隔符统一为 `\(...\)`；原来的带编号 equation/align 等数学环境保持不变，以保留公式编号和交叉引用。
- 图片、参考文献源文件、会议样式及其他原始非 TeX 资源均保持原样。详细结果见各源码目录的 `preservation-audit.json`。
- 漏译检查的提示已人工核对：剩余提示为不参与排版的源注释、作者信息和专名；未发现活动正文中的整段英文遗漏。
- 已抽查渲染页：2022 年论文第 1、3、5、9、13、17、20 页；RCDL 第 1、4、8、14、23、32、41、42、43 页。未发现缺字、内容截断或未解析的 `??` 引用。

## 排版调整与保留的原文问题

两篇均保留原会议模板，只加入中文支持和中文显示标签。2022 年模板按拉丁字形设定的页眉高度阈值会错误拒绝单行中文标题，已在主文件中将阈值从 6.25pt 调为 10pt；同时为中文粗斜体设置合成字形，消除了字体替代警告。

原稿已有少量 Overfull/Underfull 排版警告及浮动体位置调整警告，译本保留；相关页面已检查，内容可见。2022 年原稿中 `sfig:mnist_layer2_top2` 与 `sfig:f_mnist_layer2_top2` 存在重复定义，译本保留这些标签，不擅自改变交叉引用结构。

2022 年原文把 28×28 图像大小写成 768，且个别位置出现 F-MINST 拼写；持续学习附录的 `fig:app_fmnist_seq_sum` 图注写作 joint training。译文忠实保留，未静默更正。RCDL 原文中的理论假设、实现调整及数值也原样保留。
