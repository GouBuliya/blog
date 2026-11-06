# 煦风的博客

个人技术博客，主要写机器学习（线性注意力、记忆机制、持续学习等）的研究笔记与推导。

**在线地址**：<https://goubuliya.github.io/blog/>

## 技术栈

- [Astro](https://astro.build) 7 + Content Collections（Markdown/MDX）
- KaTeX 数学公式（remark-math + rehype-katex）
- GitHub Pages 托管，GitHub Actions 自动部署

## 特性

- **数学公式**：行内 `$...$`、独立 `$$...$$` 全局支持；另附自定义插件 `src/plugins/remark-latex-delimiters.mjs`，在 frontmatter 中声明 `mathDelimiters: 'latex'` 后可识别 `\[...\]` / `\(...\)` 分隔符
- **文末引用块**：`src/components/PostCitation.astro`，frontmatter 声明 `citationAuthor` 后自动生成文本引用 + BibTeX（支持一键复制）
- SEO 友好（canonical URL、Open Graph）、Sitemap、RSS 订阅

## 项目结构

```text
├── public/                  # 静态资源
├── src/
│   ├── components/          # Astro 组件（含 PostCitation 引用块）
│   ├── content/blog/        # 博客文章（.md / .mdx）
│   ├── layouts/             # 页面布局
│   ├── pages/               # 路由页面
│   ├── plugins/             # 自定义 remark 插件
│   ├── consts.ts            # 站点标题、描述
│   └── content.config.ts    # 内容集合与 frontmatter 校验
├── astro.config.mjs
└── .github/workflows/       # GitHub Pages 部署
```

## 写作

在 `src/content/blog/` 下新建 Markdown 文件，frontmatter 字段：

| 字段 | 必填 | 说明 |
| :--- | :--- | :--- |
| `title` | 是 | 文章标题 |
| `description` | 是 | 摘要（用于列表页与 SEO） |
| `pubDate` | 是 | 发布日期，如 `'Nov 07 2026'` |
| `updatedDate` | 否 | 更新日期 |
| `mathDelimiters` | 否 | 填 `'latex'` 启用 `\[...\]` / `\(...\)` 公式分隔符 |
| `citationAuthor` | 否 | 填写后文末显示"引用本文"块 |
| `heroImage` | 否 | 头图 |

> 注意：`src/content/blog/` 下的所有 Markdown 都会参与构建，缺 frontmatter 的草稿会导致构建失败。

## 常用命令

| 命令 | 作用 |
| :--- | :--- |
| `npm install` | 安装依赖（Node ≥ 22.12） |
| `npm run dev` | 本地开发，<http://localhost:4321> |
| `npm run build` | 构建到 `dist/` |
| `npm run preview` | 本地预览构建产物 |

## 部署

推送到 `main` 分支即触发 GitHub Actions（`.github/workflows/deploy.yml`）自动构建并发布到 GitHub Pages，无需手动操作。

## 许可

代码基于 Astro Blog 模板（MIT）；文章内容版权所有，转载请附原文链接（每篇文章末尾提供引用格式）。
