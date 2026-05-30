import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    isLoading: true,
    loadingText: '正在加载本地数据...',
    navTitle: '我的复习题库',
    showBack: false,
    backRoute: '/', 
    backText: '返回',
    showStats: false,
    stats: {
      accuracy: 0,
      correct: 0,
      total: 0
    }
  }),
  actions: {
    showLoading(text = '正在处理中...') {
      this.loadingText = text
      this.isLoading = true
    },
    hideLoading() {
      this.isLoading = false
    },
    setNav(options) {
      this.navTitle = options.title || '我的复习题库'
      this.showBack = options.showBack || false
      this.backRoute = options.backRoute || '/'
      this.backText = options.backText || '返回'
      this.showStats = options.showStats || false
    },
    updateStats(accuracy, correct, total) {
      this.stats = { accuracy, correct, total }
    }
  }
})