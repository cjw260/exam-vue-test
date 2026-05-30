<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quizStore'
import { useUiStore } from '@/stores/uiStore'

const router = useRouter()
const quizStore = useQuizStore()
const uiStore = useUiStore()

// 控制弹出框显示的变量
const showNotice = ref(false)

onMounted(() => {
  uiStore.setNav({ title: '我的复习题库', showBack: false })
  
  // 检查 localStorage，如果用户没有点击过"不再提醒"，则显示提示框
  if (localStorage.getItem('hideImportNotice') !== 'true') {
    showNotice.value = true
  }
})

const getStats = (test) => {
  const total = test.questions.length
  const answers = test.answers || {}
  let answeredCount = 0
  let correctCount = 0

  test.questions.forEach(q => {
    if (answers[q.id]) {
      answeredCount++
      if (q.answer.includes(answers[q.id]) && q.answer.length === 1) {
        correctCount++
      }
    }
  })
  const accuracy = answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100)
  return { total, answeredCount, correctCount, accuracy }
}

const formatDate = (ts) => new Date(ts).toLocaleDateString()

const deleteTest = async (test) => {
  if (confirm(`确定要删除题库「${test.name}」吗？\n对应的错题和收藏也会一并删除！`)) {
    uiStore.showLoading("正在删除...")
    await quizStore.deleteTest(test.id)
    uiStore.hideLoading()
  }
}

// 点击“我知道了”，本次关闭，刷新后仍可能显示（除非加了 sessionStorage 限制，这里按常规仅做本地关闭）
const closeNotice = () => {
  showNotice.value = false
}

// 点击“不再提醒”，写入 localStorage 永久关闭
const neverShowNotice = () => {
  localStorage.setItem('hideImportNotice', 'true')
  showNotice.value = false
}
</script>

<template>
  <div class="max-w-5xl mx-auto mt-6 p-4 md:p-8">
    <!-- 错题本与收藏夹入口 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-10">
      <div @click="router.push('/collection/wrong')" class="bg-red-50 border border-red-100 p-5 md:p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center">
        <div class="p-3 md:p-4 bg-red-100 rounded-full mr-4 md:mr-5 text-red-600 shrink-0">
          <svg class="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
        </div>
        <div>
          <h3 class="text-lg md:text-xl font-bold text-red-700 flex items-center flex-wrap gap-2">
            全局错题本
            <span class="text-xs bg-red-200 text-red-700 px-2 py-0.5 rounded-full">自动收录</span>
          </h3>
          <p class="text-xs md:text-sm text-red-500 mt-1">待复习: {{ quizStore.totalWrongs }} 题</p>
        </div>
      </div>

      <div @click="router.push('/collection/favorite')" class="bg-yellow-50 border border-yellow-100 p-5 md:p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center">
        <div class="p-3 md:p-4 bg-yellow-100 rounded-full mr-4 md:mr-5 text-yellow-600 shrink-0">
          <svg class="w-7 h-7 md:w-8 md:h-8 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg>
        </div>
        <div>
          <h3 class="text-lg md:text-xl font-bold text-yellow-700">我的收藏夹</h3>
          <p class="text-xs md:text-sm text-yellow-600 mt-1">已收藏: {{ quizStore.totalFavs }} 题</p>
        </div>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-t border-gray-200 pt-6 md:pt-8 gap-4">
      <h2 class="text-xl md:text-2xl font-bold text-gray-800 flex items-center">
        所有题库 <span class="text-xs text-blue-500 font-normal ml-2 bg-blue-50 px-2 py-1 rounded">本地存储</span>
      </h2>
      <button @click="router.push('/import')" class="w-full sm:w-auto flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition shadow-sm">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        导入新题库
      </button>
    </div>
    
    <!-- 题库列表网格 -->
    <div v-if="quizStore.testsData.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      <div 
        v-for="test in quizStore.testsData" :key="test.id"
        @click="router.push(`/review/${test.id}?filter=all`)"
        class="bg-white p-5 md:p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group cursor-pointer flex flex-col h-full"
      >
        <div class="flex justify-between items-start mb-3 md:mb-4">
          <h3 class="text-base md:text-lg font-bold text-gray-800 line-clamp-2 pr-6 leading-snug">{{ test.name }}</h3>
        </div>
        <div class="text-xs md:text-sm text-gray-500 mb-5 md:mb-6 flex-grow flex items-center space-x-3 md:space-x-4">
          <span>共 {{ test.questions.length }} 题</span>
          <span v-if="test.wrongIds?.length" class="text-red-500 flex items-center">
            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 11H9v-2h2v2zm0-4H9V5h2v4z"/></svg>
            {{ test.wrongIds.length }} 错题
          </span>
          <span v-if="test.favoriteIds?.length" class="text-yellow-500 flex items-center">
            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg>
            {{ test.favoriteIds.length }}
          </span>
        </div>
        <div class="border-t border-gray-50 pt-3 md:pt-4 flex justify-between items-center mt-auto">
          <div class="text-[11px] md:text-xs text-gray-400">{{ formatDate(test.createdAt) }}</div>
          <div class="flex space-x-2 md:space-x-3 text-xs md:text-sm">
            <span class="text-gray-600">进度: <span class="font-medium text-blue-600">{{ getStats(test).answeredCount }}/{{ getStats(test).total }}</span></span>
            <span class="text-gray-600 mobile-hide">正确率: <span class="font-bold text-[#1dc385]">{{ getStats(test).accuracy }}%</span></span>
          </div>
        </div>
        <button 
          @click.stop="deleteTest(test)" 
          class="absolute top-3 md:top-4 right-3 md:right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 md:p-0" title="删除题库"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    </div>
    
    <div v-else class="flex flex-col items-center justify-center py-10 md:py-20 text-gray-400 text-center">
      <svg class="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      <p class="text-sm md:text-base">暂无保存的题库，点击按钮导入新题库吧！</p>
    </div>
  </div>

  <!-- 更新提示弹出框 -->
  <div v-if="showNotice" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 transition-opacity">
    <div class="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 transform transition-all">
      <div class="flex items-center justify-center w-12 h-12 mx-auto bg-blue-100 rounded-full mb-4">
        <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      </div>
      <h3 class="text-lg font-bold text-center text-gray-900 mb-2">更新提示</h3>
      <p class="text-sm text-gray-600 text-center mb-6 leading-relaxed">
        现在支持从学习通直接复制粘贴导入题目，支持多选题、判断题和填空题的导入！
      </p>
      <div class="flex flex-col sm:flex-row gap-3">
        <button @click="neverShowNotice" class="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
          不再提醒
        </button>
        <button @click="closeNotice" class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
          我知道了
        </button>
      </div>
    </div>
  </div>
</template>