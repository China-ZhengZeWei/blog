import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  // GitHub Pages 项目页路径:`https://<username>.github.io/<repo-name>/`
  // 个人页路径使用 `/`
  base: '/',

  lang: 'zh-CN',
  title: "我的博客",
  description: '记录学习、思考与生活的个人博客',

  themeConfig: {
    // 导航栏左侧站点标题(留空则使用 title)
    siteTitle: '我的博客',

    nav: [
      { text: '首页', link: '/' },
      { text: '博客', link: '/posts/' },
      { text: '归档', link: '/archives' },
      { text: '关于', link: '/about' },
    ],

    // 社交链接(根据实际情况填写)
    socialLinks: [
      { icon: 'github', link: 'https://github.com/' },
    ],

    // 侧边栏 - 博客文章侧边栏
    sidebar: {
      '/posts/': [
        {
          text: '所有文章',
          items: [
            { text: '首页', link: '/posts/' },
          ],
        },
      ],
    },

    // 本地搜索配置
    search: {
      provider: 'local',
      options: {
        miniSearch: {
          searchOptions: {
            boost: { title: 4, text: 2, tags: 3 },
            prefix: true,
            fuzzy: 0.2,
          },
        },
      },
    },

    // 显示最后更新时间
    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'long',
        timeStyle: 'short',
      },
    },

    // 页脚
    footer: {
      message: '基于 VitePress 构建',
      copyright: 'Copyright © 2026-present',
    },

    // 文档版权信息(可选)
    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },

    outline: {
      level: [2, 3],
      label: '本页目录',
    },
  },
})