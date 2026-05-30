import { defineStore } from 'pinia'
import { toRaw } from 'vue'

export const useQuizStore = defineStore('quiz', {
  state: () => ({
    localDB: null,
    testsData: []
  }),
  getters: {
    totalWrongs: (state) => {
      return state.testsData.reduce((sum, test) => sum + (test.wrongIds?.length || 0), 0)
    },
    totalFavs: (state) => {
      return state.testsData.reduce((sum, test) => sum + (test.favoriteIds?.length || 0), 0)
    }
  },
  actions: {
    async initDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('QuizReviewDB', 2)
        request.onupgradeneeded = (event) => {
          const db = event.target.result
          if (!db.objectStoreNames.contains('tests')) {
            db.createObjectStore('tests', { keyPath: 'id' })
          }
        }
        request.onsuccess = (event) => {
          this.localDB = event.target.result
          resolve()
        }
        request.onerror = (event) => reject(event.target.error)
      })
    },
    async loadTests() {
      return new Promise((resolve, reject) => {
        if (!this.localDB) return resolve()
        const transaction = this.localDB.transaction(['tests'], 'readonly')
        const store = transaction.objectStore('tests')
        const request = store.getAll()
        
        request.onsuccess = () => {
          let data = request.result || []
          data = data.filter(t => t.id !== 'wrong_book')
          data.forEach(t => {
            if (!t.wrongIds) t.wrongIds = []
            if (!t.favoriteIds) t.favoriteIds = []
            if (!t.answers) t.answers = {}
          })
          data.sort((a, b) => b.createdAt - a.createdAt)
          this.testsData = data
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    },
    async saveTest(testObj) {
      return new Promise((resolve, reject) => {
        const transaction = this.localDB.transaction(['tests'], 'readwrite')
        const store = transaction.objectStore('tests')
        // 使用 toRaw 去除 Vue 的代理，防止 IndexedDB 报错
        const rawData = toRaw(testObj)
        const request = store.put(rawData)
        request.onsuccess = async () => {
          await this.loadTests() // 保存后刷新数据
          resolve(rawData.id)
        }
        request.onerror = () => reject(request.error)
      })
    },
    async deleteTest(testId) {
      return new Promise((resolve, reject) => {
        const transaction = this.localDB.transaction(['tests'], 'readwrite')
        const store = transaction.objectStore('tests')
        const request = store.delete(testId)
        request.onsuccess = async () => {
          await this.loadTests()
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    }
  }
})