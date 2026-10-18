# 我的博客

基于 [VitePress](https://vitepress.dev/) 构建的个人博客,部署于 GitHub Pages。

## 技术栈

- VitePress 1.x
- Vue 3
- TypeScript(配置文件)
- GitHub Actions(自动部署)

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run docs:dev

# 构建静态文件
npm run docs:build

# 本地预览构建结果
npm run docs:preview
```

默认开发服务地址:`http://localhost:5173`

## 目录结构

```
blog/
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions 部署
├── docs/
│   ├── .vitepress/
│   │   └── config.mts       # 站点配置
│   ├── posts/               # 博客文章目录
│   │   ├── index.md         # 文章列表
│   │   └── *.md             # 博客文章
│   ├── index.md             # 首页
│   ├── archives.md          # 归档页
│   └── about.md             # 关于页
├── package.json
└── README.md
```

## 新增文章

在 `docs/posts/` 下新建 `yyyy-mm-dd-title.md`,文件模板:

```markdown
---
title: 文章标题
date: 2026-10-18
tags:
  - 标签1
  - 标签2
description: 文章描述,用于 SEO。
---

# 文章标题

正文...
```

## 部署

推送到 `main` 分支后,GitHub Actions 会自动构建并部署到 GitHub Pages。

部署前需要在 `docs/.vitepress/config.mts` 中根据仓库名调整 `base` 路径:

- 项目页(`username.github.io/repo-name`):`base: '/repo-name/'`
- 个人页(`username.github.io`):`base: '/'`

## 功能清单

- [x] 本地搜索(minisearch)
- [x] 响应式布局
- [x] 深色模式
- [x] 最后更新时间
- [x] 自动部署
- [ ] 评论系统
- [ ] RSS 订阅
- [ ] 访问统计