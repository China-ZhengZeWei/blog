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

写完博客要手动 FTP 上传、登服务器刷新,太繁琐。这篇文章用 **GitHub Actions + SSH + rsync** 把这条链路简化成 `git push` 一行命令。

## 整体流程

```
本地 edit + commit
   ↓ git push
GitHub 触发 workflow
   ↓
Runner · 云端 CI 虚拟机
   ↓ checkout + npm ci + docs:build
   ↓ SSH + rsync
服务器 · Nginx 提供访问
```

整条链路 30~60 秒。

## 一、准备工作

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

## 二、workflow 文件

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

## 三、几个常见坑

### Secret 名称不能有空格

只允许字母/数字/下绕线,且以字母或下绕线开头。

### 在 bash 里一定要用 `secrets.X` 语法

GitHub Actions **不会**把 secrets 自动注入 bash 环境。在 bash 里直接写裸变量名变成空串,必须用 GitHub Actions 的 <code v-pre>${{ '{{' }} secrets.X }}</code> 语法(在 bash 执行前就被替换好)。

### 宝塔保护文件

宝塔在网站目录放 `.user.ini` 和 `.htaccess`,加了 `chattr +i` 不可删。rsync 的 `--delete` 会卡住。用 `P`(protect)过滤:

```bash
rsync --delete --filter='P .user.ini' --filter='P .htaccess' ...
```

### git push 超时

```powershell
git config --global http.proxy http://127.0.0.1:7890
git push origin main
git config --global --unset http.proxy
```
