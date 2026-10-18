---
title: 用 GitHub Actions 自动化部署 VitePress 博客
date: 2026-10-18
tags:
  - GitHub Actions
  - CI/CD
  - 部署
  - SSH
  - 宝塔
description: 从一次 git push 到博客上线的完整链路解析,以及踩过的几个坑。
---

# 用 GitHub Actions 自动化部署 VitePress 博客

每次写完博客都要手动 FTP 上传、登录服务器刷新,既繁琐又容易出错。这篇文章记录如何用 **GitHub Actions + SSH + rsync** 把这套流程变成 `git push` 一行命令完成。

## 整体架构

```mermaid
flowchart LR
  subgraph local[你的电脑]
    A[编辑 Markdown] --> B[git commit + push]
  end

  subgraph github[GitHub 平台]
    B --> C[检测到 main 分支更新]
    C --> D[启动云端 Runner]
    D --> E1[Checkout 代码]
    E1 --> E2[安装 Node 依赖]
    E2 --> E3[构建静态文件]
    E3 --> E4[读取 SSH 私钥 Secret]
    E4 --> E5[测试 SSH 连通]
    E5 --> E6[rsync 同步到服务器]
  end

  subgraph server[目标服务器]
    E6 -->|SSH 加密通道| F[写入网站目录]
    F --> G[Nginx 提供访问]
    G --> H[浏览器打开博客]
  end
```

六个步骤,平均耗时 30-60 秒。

## 一、触发机制

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
  workflow_dispatch:
```

**原理**:当 `main` 分支收到新 commit,GitHub 会自动启动一个**临时 Linux 虚拟机**(叫 runner)来跑这个 workflow。`workflow_dispatch` 则允许你在网页上点按钮手动触发。

runner 是 GitHub 免费提供的(公开仓库不限时长,私有仓库每月 2000 分钟),与你的服务器/电脑完全独立。

## 二、构建静态文件

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 20
- run: npm ci
- run: npm run docs:build
```

VitePress 是 **SSG(Static Site Generator)**,`npm run docs:build` 会把 `docs/*.md` 全部编译成纯 HTML + CSS + JS,输出到 `docs/.vitepress/dist/`。

::: tip 关键点
VitePress 产物是**纯静态文件**,不依赖 Node/数据库,任何 Nginx/Apache 都能直接服务。这是用本方案部署的前提。
:::

## 三、SSH 密钥认证

```yaml
- name: Setup SSH key
  run: |
    mkdir -p ~/.ssh
    printf '%s\n' "$SSH_PRIVATE_KEY" > ~/.ssh/id_ed25519
    chmod 600 ~/.ssh/id_ed25519
  env:
    SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
```

**认证流程**:

1. 客户端(Runner)持有**私钥** `id_ed25519`
2. 服务器(`~/.ssh/authorized_keys`)存有对应的**公钥**
3. SSH 握手时,服务器生成随机数让客户端用私钥签名
4. 验证通过 → 建立加密通道

**为什么选 ED25519**?比 RSA 短(64 字节 vs 几百字节)、签名快、抗量子计算更强。

**为什么不能省掉私钥写入文件这一步**?OpenSSH 客户端只从文件读密钥,不支持从 stdin 读。

## 四、rsync 增量同步

```yaml
- name: Deploy via rsync
  run: |
    rsync -avz --delete --ignore-errors \
      --filter='P .user.ini' \
      --filter='P .htaccess' \
      -e "ssh -p ${{ secrets.SSH_PORT }} -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no" \
      docs/.vitepress/dist/ \
      ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:${{ secrets.DEPLOY_PATH }}
```

**为什么不用 scp**?scp 每次都全量传,博客改一行要重传整个 dist(几 MB)。rsync 用 **rolling checksum** 算法分块对比,只传有变化的块,通常几十 KB 就够。

**关键参数**:
- `--delete`:目标端有但源端没有的文件**删掉**,保证严格一致
- `--ignore-errors`:个别文件失败不中断
- `--filter='P <FILE>'`:保护文件,不被 `--delete` 删
- `-e "ssh ..."`:走 SSH 通道(默认 rsync 协议要额外开 873 端口)

## 五、五个 Secret 的设计

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 里配置:

| Secret 名 | 作用 |
|----------|------|
| `SSH_PRIVATE_KEY` | 客户端私钥,用于身份认证 |
| `SSH_HOST` | 服务器 IP 或域名 |
| `SSH_USER` | 登录用户名 |
| `SSH_PORT` | SSH 端口(默认 22) |
| `DEPLOY_PATH` | 网站根目录绝对路径 |

**为什么不直接写在 workflow 文件里**?因为 workflow 文件是公开的(如果你用了公开仓库),任何人 pull 都能看到。

**Secret 的安全保证**:
- GitHub 用 KMS 加密存储
- 在日志中自动 mask(显示为 `***`)
- 只有 workflow 运行时才解密注入

## 六、踩过的坑(血泪史)

### 坑 1:Secret 名称规则

::: warning
Secret 名称只能包含字母、数字、下划线,**不能有空格**,必须以字母或下划线开头。
:::

提交时如果用了 `SSH HOST`(带空格)会直接报错。

### 坑 2:`${X}` vs `${{ secrets.X }}` 的区别

最初我写的 workflow 长这样:

```yaml
- run: |
    ssh -i ~/.ssh/id_ed25519 \
        -p ${SSH_PORT:-22} \
        ${SSH_USER}@${SSH_HOST} \
        "echo SSH_OK"
```

**结果**:`Test SSH connection` 步骤退出码 255,SSH 打印 usage 帮助信息。

**原因**:`${SSH_USER}` 这种语法是 **bash 变量展开**,但 GitHub Actions 不会自动把 secrets 注入到 bash 环境。在 bash 看来,`${SSH_USER}` 是**空字符串**,所以最终命令变成:

```bash
ssh -i ~/.ssh/id_ed25519 -p 22 @ "echo SSH_OK"
```

`@` 前面没有用户名 → SSH 不知道连哪 → 打印 usage → 退出 255。

**修复**:用 GitHub Actions 原生语法 `${{ secrets.SSH_USER }}`,这个在 bash 执行前就会被替换好。

### 坑 3:网络不稳

GitHub 直连国内经常超时,`git push` 失败。临时方案:

```powershell
# 配代理
git config --global http.proxy http://127.0.0.1:7890

# 推送
git push origin main

# 取消代理
git config --global --unset http.proxy
```

### 坑 4:BaoTa 保护文件

rsync 跑完报 exit code 23,日志里看到:

```
rsync: [generator] delete-file: unlink(.user.ini) failed: Operation not permitted (1)
deleting .htaccess
```

**原因**:宝塔面板会在网站根目录放 `.user.ini`(PHP 配置)和 `.htaccess`(Apache 配置),这两个文件有 `chattr +i` 不可删除属性,rsync 的 `--delete` 想删它们,失败。

**不影响实际部署**(其他文件都传成功了),但 CI 显示红 X。修复:

```bash
rsync -avz --delete --ignore-errors \
  --filter='P .user.ini' \
  --filter='P .htaccess' \
  ...
```

`P` 是 rsync 的 "protect" 规则,告诉 `--delete` 跳过这两个文件。

## 七、Nginx 侧关键配置

宝塔自动生成的站点配置基础上,加几行优化:

```nginx
server {
  listen 80;
  server_name <YOUR_DOMAIN_OR_IP>;
  root /www/wwwroot/blog;
  index index.html;

  # SPA 路由支持:所有路径都回退到 index.html
  location / {
    try_files $uri $uri/ /index.html;
  }

  # 静态资源长期缓存(VitePress 输出的 hash 文件名)
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # gzip 压缩
  gzip on;
  gzip_types text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;

  access_log /www/wwwlogs/blog.access.log;
  error_log /www/wwwlogs/blog.error.log;
}
```

::: info 为什么 `try_files` 重要
VitePress 内部用 SPA 路由,直接访问 `/posts/article-slug` 时 Nginx 默认会返回 404。加 `try_files $uri $uri/ /index.html;` 让所有路径都走 index.html,由前端路由处理。
:::

## 八、SSH 服务端配置(参考)

```bash
# 1. 生成密钥对(在服务器上执行)
ssh-keygen -t ed25519 -f ~/.ssh/github_actions -C "github-actions-deploy"

# 2. 把公钥加入授权
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# 3. 把私钥复制出来,填到 GitHub Secret
cat ~/.ssh/github_actions
```

**重要**:私钥复制时**整段都要**,包括首尾的 `-----BEGIN OPENSSH PRIVATE KEY-----` 和 `-----END OPENSSH PRIVATE KEY-----`。

## 九、整体时序

```
14:30:00  你修改了 docs/posts/xxx.md
14:30:05  git add . && git commit -m "..." && git push
14:30:08  GitHub 检测到 main 分支更新
14:30:10  Runner 启动,开始执行 workflow
14:30:15  Checkout 代码完成
14:30:25  npm ci 安装依赖完成
14:30:35  npm run docs:build 构建完成(dist 约 1 MB)
14:30:40  Setup SSH key 完成
14:30:45  Test SSH connection 成功
14:30:55  rsync 同步完成(增量约 10 KB)
14:30:56  Workflow 显示绿色对勾
14:30:57  浏览器访问博客,看到新文章
```

## 十、安全建议(进阶)

::: danger 生产环境必看
教程里用了 `root` 用户 SSH 登录,这只是方便,**生产环境应该用专门的 `deployer` 用户**,只给网站目录的写权限。
:::

更安全的做法:

```bash
# 服务器上创建受限用户
useradd -m -s /bin/bash deployer

# 让 deployer 拥有网站目录
chown -R deployer:deployer /www/wwwroot/blog

# 把公钥加到 deployer 的 authorized_keys
cp ~/.ssh/github_actions.pub /home/deployer/.ssh/authorized_keys
chown -R deployer:deployer /home/deployer/.ssh
chmod 700 /home/deployer/.ssh
chmod 600 /home/deployer/.ssh/authorized_keys
```

然后把 GitHub Secret 里的 `SSH_USER` 从 `root` 改成 `deployer`。这样即使密钥泄露,攻击者也只能改网站文件,碰不到系统配置。

## 十一、后续可优化

| 优化项 | 价值 | 难度 |
|--------|------|------|
| HTTPS(Let's Encrypt) | 浏览器地址栏锁头,SEO 友好 | 低,宝塔一键申请 |
| 自定义域名 | 易记、品牌感 | 低,改 DNS + Nginx |
| 部署通知(飞书/Slack) | 失败时立刻知道 | 低,加一个 step |
| 回滚机制 | 部署出错秒回上一版 | 中,保留最近 3 个 dist |
| 缓存依赖 | 第二次构建从 30s 缩到 10s | 低,加 `cache: 'npm'` |
| PR Preview | 每个 PR 一个临时域名预览 | 中,需要 Vercel/Netlify 风格的路由 |

## 小结

整套方案的核心是**把"构建"和"部署"解耦**:

- **构建**在 GitHub 的云端 runner 上做,不消耗服务器资源
- **部署**用 SSH 推到你自己的服务器,数据完全可控
- **触发**靠 git push,日常工作流不变
- **凭据**用 Secrets 管理,私钥不上传到任何地方

这样一套基础设施搭好之后,以后写博客就是纯粹的写作:打开编辑器,写完 `git push`,1 分钟后全网可见。

---

**相关文章**:
- [你好,VitePress](/posts/2026-10-18-hello-vitepress) —— 博客搭建过程
- [Markdown 写作小贴士](/posts/2026-10-18-markdown-tips) —— 写作工具
