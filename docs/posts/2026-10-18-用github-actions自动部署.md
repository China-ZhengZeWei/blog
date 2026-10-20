---
title: 用 GitHub Actions 自动化部署 VitePress 博客
date: 2026-10-18
tags:
  - GitHub Actions
  - CI/CD
  - 部署
  - SSH
description: git push 一行命令,完成博客从构建到上线的全流程。
---

# 用 GitHub Actions 自动化部署 VitePress 博客

写完博客要手动 FTP 上传、登服务器刷新,链路长、容易断。这篇文章用 **GitHub Actions + SSH + rsync** 把这件事压成 `git push` 一行命令,端到端耗时 30~60 秒。

## 一、整体流程

动手前先把整条链路看清楚——后面所有配置都对得上这张图。

```
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ 1. 本地   │──▶│ 2. 推送   │──▶│ 3. GitHub │
   │ git commit│   │ git push │   │ 触发 workflow │
   └──────────┘   └──────────┘   └──────┬───┘
                                         ▼
                            ┌──────────────────────────┐
                            │ 4. Runner (ubuntu-latest) │
                            │                           │
                            │ checkout → npm ci → build │
                            │ → 写 SSH 私钥 → ssh test │
                            └────────────┬──────────────┘
                                         │
                          ┌──────────────┴──────────────┐
                          ▼ 失败                         ▼ 通过
                  ┌──────────────┐             ┌──────────────┐
                  │ 任务失败       │             │ 5. rsync 同步  │
                  │ 查看 Actions 日志│            │ dist/ → 服务器 │
                  └──────────────┘             └──────┬───────┘
                                                       ▼
                                              ┌──────────────────┐
                                              │ 6. Nginx 提供访问  │
                                              │ 博客上线          │
                                              └──────────────────┘
```

整条链路 6 个节点:本地提交 → 推送 → GitHub 触发 → Runner 构建 → rsync 同步 → Nginx 上线。

| 环节        | 耗时       | 关键命令                          |
| ----------- | ---------- | --------------------------------- |
| 触发 + 拉取 | 5~10 s     | `on: push: branches: [main]`      |
| 安装依赖    | 10~20 s    | `npm ci`(命中缓存更快)            |
| 静态构建    | 15~25 s    | `npm run docs:build`              |
| SSH + rsync | 5~15 s     | `rsync -avz --delete`             |

## 二、准备工作

**1. 在服务器生成密钥对**(目标服务器执行):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -C "github-actions"
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
```

**2. 在 GitHub 仓库配置 Secrets**

`Settings → Secrets and variables → Actions → New repository secret`:

| 名称              | 值                                  |
| ----------------- | ----------------------------------- |
| `SSH_PRIVATE_KEY` | 私钥全文(含 BEGIN/END)              |
| `SSH_HOST`        | 服务器 IP 或域名                    |
| `SSH_USER`        | 登录用户                            |
| `SSH_PORT`        | SSH 端口                            |
| `DEPLOY_PATH`     | 网站目录绝对路径                    |

## 三、workflow 文件

在仓库根目录创建 `.github/workflows/deploy.yml`:

<div v-pre>

```yaml
name: Deploy
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run docs:build

      - name: 写入 SSH 私钥
        run: |
          mkdir -p ~/.ssh
          printf '%s' "$SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}

      - name: 测试连通
        run: |
          ssh -i ~/.ssh/id_ed25519 -p ${{ secrets.SSH_PORT }} \
              -o StrictHostKeyChecking=no \
              ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} echo OK

      - name: rsync 部署
        run: |
          rsync -avz --delete --ignore-errors \
            --filter='P .user.ini' \
            --filter='P .htaccess' \
            -e "ssh -p ${{ secrets.SSH_PORT }} -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no" \
            docs/.vitepress/dist/ \
            ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:${{ secrets.DEPLOY_PATH }}
```

</div>

跑一次试试:`git push origin main`,打开仓库的 **Actions** 页签看每一步的执行日志。
