---
title: Markdown 写作小贴士
date: 2026-10-18
tags:
  - Markdown
  - 写作
  - 工具
description: 一些在博客中常用的 Markdown 语法与排版建议。
---

# Markdown 写作小贴士

Markdown 让写作回归内容本身,这里整理一些在博客中常用的小技巧。

## 标题层级

```markdown
# 一级标题
## 二级标题
### 三级标题
```

建议一篇文章只使用一个一级标题(在 frontmatter 中已指定 `title`),正文从二级标题开始。

## 代码块

支持语法高亮:

```ts
function greet(name: string): string {
  return `Hello, ${name}!`
}

console.log(greet('VitePress'))
```

## 表格

| 语法 | 用途 |
|------|------|
| `#` | 一级标题 |
| `##` | 二级标题 |
| `-` | 无序列表 |

## 提示框

VitePress 支持以下信息框:

::: info 提示
这是一条信息提示。
:::

::: tip 小技巧
写作时保持简洁,优先用列表表达要点。
:::

::: warning 注意
发布前请检查 frontmatter 是否完整。
:::

::: danger 警告
请勿在博客中泄露敏感信息。
:::

## 链接与图片

- 链接:[VitePress](https://vitepress.dev/)
- 图片:`![alt](url)`

## 任务列表

- [x] 学习 Markdown 基础语法
- [x] 配置 VitePress
- [ ] 添加评论系统
- [ ] 接入统计分析

## 小结

Markdown 学会后,剩下的就是保持写作习惯,慢慢积累就好。