---
title: '从Linear Attention出发，理解最近这波大模型内生记忆论文'
description: '最近读了一些类似Metis、TTT的paper，做了一些小小的思考，内生记忆和linear attention其实有很多相似之处。'
pubDate: 'Aug 31 2026'
---

最近读了一些类似Metis、TTT的paper（本人读的paper不多见谅），做了一些小小的思考，内生记忆和linear attention其实有很多相似之处。

memory 实际上是 predict 未来某一个 token predict 所需要的信息，attention同理（记得这篇 Understanding Transformer from the Perspective of Associative Memory (arXiv:2505.19488) 提出了类似的思想，非常棒的一个paper，很有深度）。

带着这个视角我们来看linear attention。linear attention 本质是维护了一个固定大小的状态来存储seq的信息，显然，随着seq len的增长，必然出现状态读出的信息模糊的现象，于是出现了DeltaNet。DeltaNet引入了delta rule（更新的时候根据 state 里关于当前 key 已经存了什么，算一个残差，只把差值写回去），状态有了改写的能力。在这之后出现了两条路：一条是让改动更加精细（比如GDN，Kimi Linear），一条是让存储更具表达力（比如TTT系列工作），事实上很多工作直接就是用GDN实现的。

可以看出，linear attention 的 state 本身就是一个固定大小、可读可写、信息会被覆盖和遗忘的压缩表示，这恰好就是一个 memory 该有的样子。从这个角度出发再看现在的paper其实很清晰了，技术实现上，他们把linear attention的state持久化存储了下来，让它具有跨会话的生命周期。

顺着这个角度往下想，linear attention 踩过的坑其实直接指向了 memory 的下一步。linear attention 的核心矛盾是固定大小的 state 装不下无限长的历史，信息必然被压缩和覆盖，这也正是当前内生记忆面临的天花板。

个人认为 memory 下一步要解决的是上下文窗口无限外推的问题，同时保证所有 raw 信息在需要的时候都可以被召回。前者技术上实现不难，一个直接的方向是砍掉位置编码。后者可以参考稀疏注意力的思路，不是把所有信息都压进一个固定大小的 state 里，而是让 state 作为索引或路由，指向可以按需取回的完整信息。
