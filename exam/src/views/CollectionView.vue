<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quizStore'
import { useUiStore } from '@/stores/uiStore'

const route = useRoute()
const router = useRouter()
const quizStore = useQuizStore()
const uiStore = useUiStore()

const type = computed(() => route.params.type)

onMounted(() => {
  uiStore.setNav({ title: '集合视图', showBack: true, backRoute: '/' })
})

const filteredTests = computed(() => {
  if (type.value === 'wrong') {
    return quizStore.testsData.filter(t => t.wrongIds && t.wrongIds.length > 0)
  }
  return quizStore.testsData.filter(t => t.favoriteIds && t.favoriteIds.length > 0)
})

const goReview = (id) => {
  router.push(`/review/${id}?filter=${type.value}`)
}
</script>

<template>
  <div class="max-w-5xl mx-auto mt-6 p-4 md:p-8">
    <div class="flex items-center mb-6 md:mb-8 pb-4 border-b border-gray-100">
      <button @click="router.push('/')" class="mr-3 md:mr-4 text-gray-500 hover:text-gray-800 transition-colors bg-gray-100 hover:bg-gray-200 p-2 rounded-full shrink-0">
        <svg class="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
      </button>
      <div>
        <h2 :class="type === 'wrong' ? 'text-red-600' : 'text-yellow-600'" class="text-xl md:text-2xl font-bold">
          {{ type === 'wrong' ? '我的错题本' : '我的收藏夹' }}
        </h2>
        <p class="text-xs md:text-sm text-gray-500 mt-1">分布在 {{ filteredTests.length }} 个题库中</p>
      </div>
    </div>

    <div v-if="filteredTests.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      <div 
        v-for="test in filteredTests" :key="test.id"
        @click="goReview(test.id)"
        :class="type === 'wrong' ? 'text-red-600 bg-red-50 border-red-100 hover:border-red-300' : 'text-yellow-600 bg-yellow-50 border-yellow-100 hover:border-yellow-300'"
        class="p-4 md:p-5 rounded-lg shadow-sm border cursor-pointer transition-colors flex items-center"
      >
        <svg v-if="type === 'wrong'" class="w-6 h-6 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <svg v-else class="w-6 h-6 mr-3 shrink-0 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg>
        
        <div class="flex-1 min-w-0 pr-2">
          <h3 class="text-sm md:text-base font-bold truncate text-gray-800">{{ test.name }}</h3>
          <p class="text-xs md:text-sm mt-1 opacity-80">{{ type === 'wrong' ? test.wrongIds.length : test.favoriteIds.length }} 道题目</p>
        </div>
        <svg class="w-5 h-5 opacity-50 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center py-20 text-gray-400">
      <p class="text-lg">这里空空如也~</p>
      <p class="text-sm mt-2">快去刷题积累数据吧！</p>
    </div>
  </div>
</template>