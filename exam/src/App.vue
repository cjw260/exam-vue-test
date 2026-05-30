<script setup>
import { onMounted, ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quizStore'
import { useUiStore } from '@/stores/uiStore'

const router = useRouter()
const quizStore = useQuizStore()
const uiStore = useUiStore()

const showBackToTop = ref(false)

const handleScroll = () => {
  showBackToTop.value = window.scrollY > 400
}

const scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const goBack = () => {
  router.push(uiStore.backRoute)
}

// 全局重置当前题库进度逻辑（由子组件监听或通过状态清理）
const resetProgress = () => {
  // 通过派发自定义事件给具体的 ReviewView 去处理，因为需要上下文
  window.dispatchEvent(new CustomEvent('reset-progress'))
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll)
  
  try {
    await quizStore.initDB()
    await quizStore.loadTests()
  } catch (error) {
    console.error("数据库初始化失败", error)
    alert("无法连接到本地数据库，请检查浏览器无痕模式设置。")
  } finally {
    uiStore.hideLoading()
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="text-[#333]">
    <!-- 顶部导航栏 -->
    <div class="top-nav h-12 w-full flex items-center justify-between px-3 md:px-4 text-white text-sm fixed top-0 z-50 shadow-md">
      <!-- 左侧返回按钮 -->
      <div 
        v-if="uiStore.showBack" 
        @click="goBack"
        class="flex items-center space-x-1 md:space-x-2 opacity-80 hover:opacity-100 cursor-pointer transition-opacity"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        <span class="hidden sm:inline">{{ uiStore.backText }}</span>
      </div>
      <div v-else class="w-16"></div> <!-- 占位 -->
      
      <!-- 居中标题 -->
      <div class="absolute left-1/2 transform -translate-x-1/2 text-sm md:text-base font-medium truncate max-w-[50%] md:max-w-[40%] text-center">
        {{ uiStore.navTitle }}
      </div>
      
      <!-- 右侧统计与操作 -->
      <div v-if="uiStore.showStats" class="flex items-center space-x-4">
        <div class="mobile-hide font-bold text-[#1dc385] bg-white/10 px-3 py-1 rounded-full transition-all">
          正确率: {{ uiStore.stats.accuracy }}% ({{ uiStore.stats.correct }}/{{ uiStore.stats.total }})
        </div>
        <button @click="resetProgress" class="flex items-center space-x-1 opacity-80 hover:opacity-100 text-red-200 hover:text-red-100 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          <span class="hidden sm:inline">重置进度</span>
        </button>
      </div>
      <div v-else class="w-16"></div> <!-- 占位 -->
    </div>

    <!-- 路由视图 -->
    <div class="pt-[48px]">
      <router-view />
    </div>

    <!-- 加载遮罩 -->
    <div 
      v-show="uiStore.isLoading" 
      class="fixed inset-0 bg-white/80 z-[60] flex flex-col items-center justify-center transition-opacity duration-200"
    >
      <svg class="animate-spin -ml-1 mr-3 h-10 w-10 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      <span class="text-gray-600 font-medium">{{ uiStore.loadingText }}</span>
    </div>

    <!-- 返回顶部按钮 -->
    <button 
      v-show="showBackToTop" 
      @click="scrollToTop"
      class="fixed bottom-6 right-6 p-3 bg-blue-600/90 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all z-40"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path></svg>
    </button>
  </div>
</template>

<style>
html {
  scroll-behavior: smooth;
  scroll-padding-top: 80px; 
  -webkit-tap-highlight-color: transparent;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background-color: #f2f4f7;
}
.top-nav { background-color: #3b4b6b; }
.text-success { color: #1dc385; }

/* 隐藏滚动条但保留滚动功能 */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 3px;
}
#nav-sidebar::-webkit-scrollbar { width: 8px; }
#nav-sidebar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
#nav-sidebar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
#nav-sidebar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

.option-locked { pointer-events: none; }

@media (max-width: 640px) {
  .mobile-hide { display: none !important; }
}
</style>