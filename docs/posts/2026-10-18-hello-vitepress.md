---
title: 你好,VitePress
date: 2026-10-18
tags:
  - VitePress
  - 博客
  - 建站
description: 从零搭建一个基于 VitePress 的个人博客,记录搭建过程与心得。
---

# 你好,VitePress

这是博客的第一篇文章,主要用来记录使用 [VitePress](https://vitepress.dev/) 搭建个人博客的过程。

## 为什么选择 VitePress

VitePress 是一个由 Vite 驱动的静态站点生成器,具有以下优势:

- **基于 Vite**:开发体验极佳,启动和热更新都很快
- **Markdown 优先**:专注于内容,写作体验友好
- **Vue 3 支持**:需要时可以扩展自定义组件
- **默认主题美观**:开箱即用,无需复杂配置

## 技术栈

| 项目 | 技术 |
|------|------|
| 框架 | VitePress 1.x |
| 包管理 | npm |
| 部署 | GitHub Pages |
| CI/CD | GitHub Actions |

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器(默认 http://localhost:5173)
npm run docs:dev

# 构建生产版本
npm run docs:build

# 本地预览构建结果
npm run docs:preview
```

## 目录结构

```
docs/
├── .vitepress/
│   └── config.mts   # 站点配置
├── index.md         # 首页
├── posts/           # 博客文章
│   └── *.md
├── archives.md      # 归档
└── about.md         # 关于
```

## 后续计划

- [ ] 添加评论系统
- [ ] 接入访问统计
- [ ] 配置 RSS 订阅
- [ ] 完善标签与分类