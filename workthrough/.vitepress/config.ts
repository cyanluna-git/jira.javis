import { defineConfig } from 'vitepress'

export default defineConfig({
  ignoreDeadLinks: true,
  title: 'Javis Workthrough',
  description: '개발 작업 기록',
  lang: 'ko-KR',
  themeConfig: {
    nav: [
      { text: '홈', link: '/' },
    ],
    sidebar: [
      {
        text: '2026년 1월',
        items: [
          { text: 'Sprint Board 구현', link: '/2026-01-27_16_45_sprint-board-implementation' },
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com' }
    ]
  }
})
