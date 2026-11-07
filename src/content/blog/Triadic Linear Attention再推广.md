---
title: 'TLA 再推广：按轴衰减与矩阵化擦除门'
description: '在 Triadic Linear Attention 把 key 从向量变成矩阵之后，把 per-channel decay 和擦除门沿 κ 的两个轴做 Kronecker 分解。'
pubDate: 'Nov 07 2026'
citationAuthor: 'yingliang li'
---

## 前言

最近看到了 MIT 的一个新工作：[Triadic Linear Attention](https://www.alphaxiv.org/pdf/2609.36529)。我们都知道 linear attention 因为恒定的记忆状态所以做到高效处理长上下文，但是世上没有免费的午餐，同样因为这一性质导致了 linear attention 在处理长上下文的时候会出现干扰，DeltaNet 通过引入 delta rule 来减少记忆干扰，GDN 通过引入 Mamba-2 的 data-dependent decay 进一步减少读出记忆的干扰，但是笔者认为仍然存在另外一种同样本质且有效的方式，也就是增加记忆状态的容量。

## Triadic Linear Attention 推导

我们使用最简单的 linear attention 形式：

$$
S_t = S_{t-1} + k_t v_t^{\top} \qquad (1)
$$

$$
o_t = S_t^{\top} q_t \qquad (2)
$$

我们将 $k_t$ 拓展为矩阵 $K_t = k_t k_t^{\prime\top}$（$k'_t \in \mathbb{R}^E$ 是第二个 key），展平后记为：

$$
\kappa_t= k_t \otimes k'_t \in \mathbb{R}^{dE} \qquad (3)
$$

那么

$$
S_t = S_{t-1} + \kappa_t v_t^{\top} = S_{t-1} + (k_t \otimes k'_t) v_t^{\top} \qquad (4)
$$

同样的，把 $S_t$ 看成 $d \times E \times d_v$ 的三阶张量时用 mode 积，展平成 $dE \times d_v$ 的矩阵时用 Kronecker 积，两种写法等价：

$$
o_t = S_t \times_1 q_t \times_2 q'_t = S_t^{\top} (q_t \otimes q'_t) \qquad (5)
$$

加入 delta rule，我们将上式带入 DeltaNet 的形式：

$$
S_t = \big(I - \beta_t \kappa_t \kappa_t^{\top}\big) S_{t-1} + \beta_t \kappa_t v_t^{\top}, \qquad o_t = S_t^{\top} \big(q_t \otimes q'_t\big) \qquad (6)
$$

加入 GDN 风格的 decay：

$$
S_t = \big(I - \beta_t \kappa_t \kappa_t^{\top}\big) D_t S_{t-1} + \beta_t \kappa_t v_t^{\top}, \qquad o_t = S_t^{\top} \big(q_t \otimes q'_t\big) \qquad (7)
$$

其中

$$
D_t = I_d \otimes \mathrm{Diag}(\alpha'_t), \qquad \alpha'_t \in (0,1]^E \qquad (8)
$$

表示对每一个切片做一次标量 decay。

到了这里我们就得出了论文中的 Triadic GDN 了。TLA 简单来说是通过引入一个 second key 将 key 从向量变成了矩阵，通过很少的参数量（只多了 $q'_t$、$k'_t$ 两个 proj）获得了 $E$ 倍的状态大小。到了这里，key 从向量变成了矩阵，对 key 的处理是不是也可以做类似的处理？

## 按轴衰减

我们知道将 GDN 的标量衰减推广成向量就变成了 per channel decay 的 KDA，我们能不能尝试将 per channel decay 加入到 TLA 中呢？(7) 的 decay 就是对每一个切片做标量 decay，一个自然的想法就是将标量变成向量来得到"Triadic KDA"。

我们先来看 KDA 的 decay 在干啥：

$$
S = \sum_s k_s v_s^{\top}, \qquad \mathrm{Diag}(\alpha) \, S = \sum_s \big(\mathrm{Diag}(\alpha) \, k_s\big) v_s^{\top} \qquad (9)
$$

也就是给每一条 key channel decay。我们将 key 换成 $K$：

$$
K_s \mapsto \mathrm{Diag}(\alpha) \, K_s \, \mathrm{Diag}(\alpha') = \big(\mathrm{Diag}(\alpha) \, k_s\big)\big(\mathrm{Diag}(\alpha') \, k'_s\big)^{\top}, \qquad \kappa_s \mapsto \big(\mathrm{Diag}(\alpha) \otimes \mathrm{Diag}(\alpha')\big) \, \kappa_s \qquad (10)
$$

带入得到

$$
S_t = \big(I - \beta_t \kappa_t \kappa_t^{\top}\big) D_t S_{t-1} + \beta_t \kappa_t v_t^{\top}, \qquad D_t = \mathrm{Diag}(\alpha_t) \otimes \mathrm{Diag}(\alpha'_t), \qquad o_t = S_t^{\top} (q_t \otimes q'_t) \qquad (11)
$$

按切片展开更直观。记第 $e$ 个切片为 $S_{t,e}$（$d \times d_v$ 的矩阵）：先对每个切片衰减，再用所有切片共同算一个残差 $\delta_t$，最后按 $k'_{t,e}$ 的比例写回各切片。

$$
\begin{aligned}
\bar{S}_{t,e} &= \alpha'_{t,e} \, \mathrm{Diag}(\alpha_t) \, S_{t-1,e} \\
\delta_t &= v_t - \sum_{e=1}^{E} k'_{t,e} \, \bar{S}_{t,e}^{\top} k_t \\
S_{t,e} &= \bar{S}_{t,e} + \beta_t \, k'_{t,e} \, k_t \delta_t^{\top}
\end{aligned} \qquad (12)
$$

其中 $\alpha_t = \mathbf{1}$ 时就是论文的按片衰减 (8)。

## 矩阵化擦除门

在这里我们的 decay 已经"矩阵化"了，对应的还有一个写入 $\beta$，自然会想到：能不能将写入也"矩阵化"呢？

这里我们使用 GDN-2 的读写分离形式，这样就可以将 key 侧与 $\kappa$ 对齐了：

$$
S_t = \big(I - k_t (b_t \odot k_t)^{\top}\big) D_t S_{t-1} + k_t (w_t \odot v_t)^{\top} \qquad (13)
$$

擦除门的推法和衰减一样，对 key 矩阵的行和列各乘一个对角阵：

$$
\mathrm{Diag}(b_t) \, K_t \, \mathrm{Diag}(b'_t) \ \xrightarrow{\text{展平}}\ \mathbf{B}_t \kappa_t = (b_t \odot k_t) \otimes (b'_t \odot k'_t), \qquad \mathbf{B}_t = \mathrm{Diag}(b_t) \otimes \mathrm{Diag}(b'_t) \qquad (14)
$$

我们带入得到：

$$
S_t = \big(I - \kappa_t (\mathbf{B}_t \kappa_t)^{\top}\big) D_t S_{t-1} + \kappa_t (w_t \odot v_t)^{\top} \qquad (15)
$$

为什么必须将 $\beta$ 读写分离之后才能对齐？

我们不妨将 (7) 写成残差形式，$\beta$ 的作用会更清楚：

$$
S_t = \bar{S}_t + \kappa_t \big(\beta_t v_t - \bar{S}_t^{\top} (\beta_t \kappa_t)\big)^{\top}, \qquad \bar{S}_t = D_t S_{t-1} \qquad (16)
$$

其中 $\beta_t$ 在这里出现了两次：一次对 $v_t$，一次对 $\kappa_t$，两处维度不一样（$d_v$ 和 $dE$），$\beta_t$ 是标量时可以广播，但要换成向量门就必须选位置，把它们分开会更合理一些：

$$
S_t = \bar{S}_t + \kappa_t \big(w_t \odot v_t - \bar{S}_t^{\top} \mathbf{B}_t \kappa_t\big)^{\top} \qquad (17)
$$

### 效率计算

每个 head、每个 token 新增的门值是 $\alpha_t$（$d$ 个）、$b_t$（$d$ 个）、$b'_t$（$E$ 个）和 $w_t$（$d_v$ 个），共 $2d + E + d_v$ 个；$d = d_v = 128$、$E = 8$ 时是 392 个。如果按 $D = 1024$、8 个 head、$E = 8$、24 层估算，全秩投影要多约 77M 参数，约是 400M 模型的五分之一，有点难以接受，所以我们的门都用秩 16 的低秩投影，新增约 1.6M；连同 TLA 本身的 $q'$、$k'$ 投影（约 3.1M），总共约 4.7M，约占 1.2%。

chunkwise 的主要代价则不变：块内交互仍然是 $C^2 (d + E)$，跨块状态更新仍然是 $C \cdot dE \cdot d_v$。新增的主要是擦除门带来的读、写两套 key 因子。论文报告 $E = 8$ 时 Triadic GDN 的训练开销比 GDN 高 28–30%；在此之上新增的开销如果用融合 kernel 实现应该不大（？）
### 文章小结

本文从如何解决 linear attention 的记忆干扰出发，推导出 TLA 的做法，通过洞察到引入 second key 使 key 从向量变成矩阵这一个点，自然推广出 KDA 风格的 per channel decay 和矩阵化擦除门。btw，经过@罗神的启发，打算试试推广到n维