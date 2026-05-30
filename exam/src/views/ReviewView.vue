<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useQuizStore } from '@/stores/quizStore'
import { useUiStore } from '@/stores/uiStore'

const route = useRoute()
const quizStore = useQuizStore()
const uiStore = useUiStore()

const testId = route.params.id
const currentFilter = ref(route.query.filter || 'all') // 'all', 'wrong', 'favorite'
const currentMode = ref('practice') // 'practice', 'recite'
const sidebarOpen = ref(false)

// 用于记录多选题的临时勾选项和填空题的临时输入值
const tempAnswers = ref({}) 

// Vue 的深拷贝解决直接修改 store 问题
const test = ref(null)

onMounted(async () => {
  uiStore.showLoading('正在加载题库...')
  // 从 Store 中获取数据拷贝
  const sourceTest = quizStore.testsData.find(t => t.id === testId)
  if (sourceTest) {
    test.value = JSON.parse(JSON.stringify(sourceTest))
  }
  
  updateNav()
  uiStore.hideLoading()

  window.addEventListener('reset-progress', resetProgress)
})

onUnmounted(() => {
  window.removeEventListener('reset-progress', resetProgress)
})

// 过滤后的显示题目
const displayQuestions = computed(() => {
  if (!test.value) return []
  if (currentFilter.value === 'wrong') return test.value.questions.filter(q => test.value.wrongIds.includes(q.id))
  if (currentFilter.value === 'favorite') return test.value.questions.filter(q => test.value.favoriteIds.includes(q.id))
  return test.value.questions
})

// 新增：将显示题目按题型分组，以便右侧答题卡渲染分类标题
const groupedQuestions = computed(() => {
  const groups = []
  let currentType = null
  let currentGroup = null
  const cnNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  let typeIndex = 0

  displayQuestions.value.forEach((q, index) => {
    // 遇到新的题型时，创建一个新的分组
    if (q.type !== currentType) {
      currentType = q.type
      currentGroup = {
        title: `${cnNumbers[typeIndex] || (typeIndex + 1)}. ${q.type}`,
        questions: []
      }
      groups.push(currentGroup)
      typeIndex++
    }
    // 将原题目的索引(index + 1)保存，确保序号是连续的
    currentGroup.questions.push({
      data: q,
      displayIndex: index + 1
    })
  })
  return groups
})

// 判断某一题是否做对 (适配单选、多选、判断、填空)
const isAnswerCorrect = (q, userAns) => {
  if (!userAns) return false
  if (q.type === '多选题' || q.type === '填空题') return userAns === q.answer
  return q.answer.includes(userAns) && q.answer.length === 1
}

// 格式化展示答案（例如多选项拼接，填空题用逗号分隔展示）
const formatDisplayAnswer = (ans) => {
  if (!ans) return ''
  return ans.replace(/\|/g, ', ')
}

// 计算并更新导航栏状态
const updateNav = () => {
  if (!test.value) return
  let backRoute = '/'
  let backText = '返回首页'
  if (currentFilter.value === 'wrong') { backRoute = '/collection/wrong'; backText = '错题分类' }
  else if (currentFilter.value === 'favorite') { backRoute = '/collection/favorite'; backText = '收藏分类' }

  const answeredCount = displayQuestions.value.filter(q => test.value.answers[q.id]).length
  const correctCount = displayQuestions.value.filter(q => isAnswerCorrect(q, test.value.answers[q.id])).length
  const accuracy = answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100)

  uiStore.setNav({
    title: test.value.name,
    showBack: true,
    backRoute,
    backText,
    showStats: currentMode.value === 'practice'
  })
  uiStore.updateStats(accuracy, correctCount, answeredCount)
}

// 监听数据变化进行自动保存和更新导航
watch(() => test.value, (newVal) => {
  if(newVal) {
    quizStore.saveTest(newVal)
    updateNav()
  }
}, { deep: true })

watch(currentMode, () => updateNav())

const formatDate = (ts) => ts ? new Date(ts).toLocaleDateString() : '今天'

// --- 选项交互与状态判定 ---
const getOptionClass = (q, optLetter) => {
  const isAlreadyAnswered = !!test.value.answers[q.id]
  const isCorrectOption = q.answer.includes(optLetter)
  const userAnswer = test.value.answers[q.id]

  let extraClasses = 'p-3 md:p-3.5 rounded-lg border border-gray-100 transition-colors leading-snug '

  if (currentMode.value === 'recite') {
    if (isCorrectOption) extraClasses += 'bg-green-50 text-green-600 font-medium border-green-200'
    else extraClasses += 'opacity-60 bg-gray-50'
  } else {
    if (isAlreadyAnswered) {
      const isUserSelected = userAnswer && userAnswer.includes(optLetter)
      if (isUserSelected) {
        extraClasses += isCorrectOption ? 'bg-green-50 border-green-300 text-green-700' : 'bg-red-50 border-red-300 text-red-600'
      } else if (isCorrectOption) {
        extraClasses += 'bg-green-50 border-green-300 text-green-700 opacity-80'
      } else {
        extraClasses += 'bg-gray-50 border-gray-100 opacity-60'
      }
    } else {
      const isTempSelected = tempAnswers.value[q.id] && tempAnswers.value[q.id].includes(optLetter)
      if (isTempSelected) {
        extraClasses += 'bg-blue-50 border-blue-300 text-blue-600 cursor-pointer shadow-sm'
      } else {
        extraClasses += 'cursor-pointer bg-white hover:bg-gray-50 hover:border-gray-300 shadow-sm'
      }
    }
  }
  return extraClasses
}

const handleOptionClick = (q, optLetter) => {
  if (currentMode.value !== 'practice') return
  if (test.value.answers[q.id]) return // 已答

  if (q.type === '多选题') {
    // 多选题不直接提交，记录到temp区做多选切换
    if (!tempAnswers.value[q.id]) tempAnswers.value[q.id] = []
    const idx = tempAnswers.value[q.id].indexOf(optLetter)
    if (idx > -1) tempAnswers.value[q.id].splice(idx, 1)
    else tempAnswers.value[q.id].push(optLetter)
    tempAnswers.value[q.id].sort()
  } else {
    // 单选和判断题一键出分
    submitAnswer(q.id, optLetter)
  }
}

// 提交多选题
const submitMultiChoice = (qId) => {
  const temp = tempAnswers.value[qId]
  if (!temp || temp.length === 0) return alert("请至少选择一个选项！")
  submitAnswer(qId, temp.join(''))
}

// 提交填空题
const submitFillBlank = (qId) => {
  const temp = tempAnswers.value[qId]
  // 拼接填写答案，如果没写则为空字符串
  const answerStr = (temp || []).map(x => (x || '').trim()).join('|')
  if (!answerStr.replace(/\|/g, '')) return alert("请填写答案！")
  submitAnswer(qId, answerStr)
}

// 核心提交与判错收录方法
const submitAnswer = (qId, answerStr) => {
  const q = test.value.questions.find(x => x.id === qId)
  test.value.answers[qId] = answerStr

  const isCorrect = isAnswerCorrect(q, answerStr)
  if (!isCorrect && !test.value.wrongIds.includes(qId)) {
    test.value.wrongIds.push(qId)
  }
  delete tempAnswers.value[qId]
}

const toggleFav = (qId) => {
  const idx = test.value.favoriteIds.indexOf(qId)
  if (idx > -1) test.value.favoriteIds.splice(idx, 1)
  else test.value.favoriteIds.push(qId)
}

const removeWrong = (qId) => {
  const wIdx = test.value.wrongIds.indexOf(qId)
  if (wIdx > -1) {
    test.value.wrongIds.splice(wIdx, 1)
    delete test.value.answers[qId]
  }
}

const getGridItemClass = (q) => {
  if (currentMode.value === 'recite') return 'bg-[#e8f1ff] text-[#3b82f6] border-[#b5ccf9]'
  const userAns = test.value.answers[q.id]
  if (!userAns) return 'bg-[#e8f1ff] text-[#3b82f6] border-[#b5ccf9] hover:bg-[#3b82f6] hover:text-white'
  
  return isAnswerCorrect(q, userAns) ? 'bg-[#1dc385] text-white border-[#1dc385]' : 'bg-[#ef4444] text-white border-[#ef4444]'
}

const scrollToQ = (id) => {
  const el = document.getElementById(`q-${id}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (window.innerWidth < 1024) sidebarOpen.value = false
  }
}

const resetProgress = () => {
  const scopeText = currentFilter.value === 'all' ? '全部题目' : (currentFilter.value === 'wrong' ? '错题本' : '收藏夹')
  if (!confirm(`确定要清空【${scopeText}】的做题记录吗？\n(收藏和错题记录本身不会被删除)`)) return
  
  uiStore.showLoading("正在重置...")
  setTimeout(() => {
    let targetIds = displayQuestions.value.map(q => q.id)
    targetIds.forEach(id => {
      delete test.value.answers[id]
    })
    uiStore.hideLoading()
  }, 300)
}
</script>

<template>
  <div v-if="test" class="relative">
    <!-- 移动端侧边栏展开按钮 -->
    <button 
      @click="sidebarOpen = true"
      v-show="!sidebarOpen"
      class="fixed right-0 top-1/2 transform -translate-y-1/2 bg-blue-600/90 text-white p-2.5 rounded-l-lg shadow-lg z-40 lg:hidden hover:bg-blue-700 transition-all flex flex-col items-center justify-center"
    >
      <svg class="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
      <span class="text-[12px] tracking-widest font-medium" style="writing-mode: vertical-rl;">答题卡</span>
    </button>

    <!-- 移动端侧边栏遮罩 -->
    <div 
      v-if="sidebarOpen"
      @click="sidebarOpen = false"
      class="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity duration-300"
    ></div>

    <div class="max-w-[1200px] mx-auto mt-4 md:mt-6 flex flex-col lg:flex-row items-start gap-4 pb-12 px-2 md:px-4">
      <!-- 左侧题目卡片 -->
      <div class="w-full lg:flex-1 bg-white rounded-md shadow-sm p-4 md:p-8 min-h-[70vh] relative">
        <div class="border-b border-gray-100 pb-5 md:pb-6 mb-6 md:mb-8 relative">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-3">
            <div>
              <h1 class="text-lg md:text-xl font-bold text-gray-800 pr-2">{{ test.name }}</h1>
              <div v-if="currentFilter !== 'all'" class="mt-2">
                <span v-if="currentFilter === 'wrong'" class="text-[11px] md:text-xs px-2 py-1 rounded bg-red-100 text-red-600 font-medium border border-red-200">正在复习：我的错题本</span>
                <span v-if="currentFilter === 'favorite'" class="text-[11px] md:text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700 font-medium border border-yellow-200">正在复习：我的收藏夹</span>
              </div>
            </div>
            
            <div class="flex items-center space-x-1 bg-gray-100 p-1 rounded-md shrink-0 border border-gray-200 self-start sm:self-auto w-full sm:w-auto">
              <button @click="currentMode = 'practice'" :class="currentMode === 'practice' ? 'bg-white shadow-sm font-bold text-blue-600' : 'font-medium text-gray-500 hover:text-gray-700'" class="flex-1 sm:flex-none px-4 md:px-5 py-2 md:py-1.5 text-sm rounded transition-all">刷题模式</button>
              <button @click="currentMode = 'recite'" :class="currentMode === 'recite' ? 'bg-white shadow-sm font-bold text-blue-600' : 'font-medium text-gray-500 hover:text-gray-700'" class="flex-1 sm:flex-none px-4 md:px-5 py-2 md:py-1.5 text-sm rounded transition-all">背题模式</button>
            </div>
          </div>

          <div class="flex flex-wrap items-center text-gray-400 text-xs md:text-sm gap-4 mt-4">
            <span>当前题量: <span class="font-bold text-gray-600">{{ displayQuestions.length }}</span></span>
            <div class="flex items-center text-blue-500 bg-blue-50 px-2 py-1 rounded border border-blue-100">
              <svg class="w-3 h-3 md:w-4 md:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span>{{ formatDate(test.createdAt) }}</span>
            </div>
          </div>
        </div>

        <div v-if="displayQuestions.length === 0" class="text-center py-20 text-gray-400">当前分类下没有题目哦！</div>
        
        <div v-else class="space-y-10 md:space-y-12">
          <div v-for="(q, i) in displayQuestions" :key="q.id" :id="`q-${q.id}`" class="relative group border border-transparent hover:border-gray-100 p-3 md:p-4 -mx-3 md:-mx-4 rounded-xl transition-colors">
            
            <div class="flex items-start justify-between relative">
              <div class="text-[14px] md:text-[15px] leading-relaxed break-words pr-2">
                <span class="text-blue-500 font-bold mr-1">{{ i + 1 }}. ({{ q.type }})</span>
                <span v-html="q.text.replace(/\n/g, '<br>')"></span>
              </div>
              
              <div class="flex items-center space-x-2 md:space-x-3 shrink-0 ml-3 md:ml-6">
                <!-- 收藏按钮 -->
                <button @click="toggleFav(q.id)" class="p-2 rounded-full hover:bg-yellow-50 transition-colors group" title="收藏本题">
                  <svg :class="test.favoriteIds.includes(q.id) ? 'text-yellow-500 fill-current' : 'text-gray-300 group-hover:text-yellow-400'" class="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" stroke="currentColor" :stroke-width="test.favoriteIds.includes(q.id) ? '0' : '2'" :fill="test.favoriteIds.includes(q.id) ? 'currentColor' : 'none'"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.898 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                </button>
                <!-- 移出错题本 -->
                <button v-if="currentFilter === 'wrong'" @click="removeWrong(q.id)" class="flex items-center space-x-1 text-[12px] md:text-[13px] text-red-500 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-full border border-red-200 transition-colors" title="熟练掌握，不再显示">
                  <svg class="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  <span class="hidden sm:inline">我会了</span>
                </button>
              </div>
            </div>

            <!-- 选项 -->
            <div v-if="q.options && q.options.length" :class="{'option-locked': test.answers[q.id] && currentMode === 'practice'}" class="mt-3 md:mt-4 space-y-2 md:space-y-3 text-[14px] md:text-[15px] text-gray-700 md:pl-4">
              <div 
                v-for="opt in q.options" :key="opt"
                @click="handleOptionClick(q, opt.charAt(0))"
                :class="getOptionClass(q, opt.charAt(0))"
              >
                {{ opt }}
              </div>
            </div>

            <!-- 多选题确认按钮 (练习模式下且未作答) -->
            <div v-if="q.type === '多选题' && currentMode === 'practice' && !test.answers[q.id]" class="mt-3 md:pl-4">
              <button @click="submitMultiChoice(q.id)" class="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-md text-sm hover:bg-blue-700 w-full sm:w-auto shadow-sm transition-colors">提交选择</button>
            </div>

            <!-- 填空题作答区 -->
            <div v-if="q.type === '填空题' && currentMode === 'practice'" class="mt-4 md:mt-5 md:pl-4">
              <template v-if="!test.answers[q.id]">
                <div class="space-y-3">
                  <div v-for="(blankAns, bIdx) in q.answer.split('|')" :key="bIdx" class="flex items-center space-x-3">
                    <span class="text-sm font-medium text-gray-600 whitespace-nowrap">第 {{ bIdx + 1 }} 空:</span>
                    <input type="text"
                      :value="(tempAnswers[q.id] && tempAnswers[q.id][bIdx]) || ''"
                      @input="e => { if(!tempAnswers[q.id]) tempAnswers[q.id]=[]; tempAnswers[q.id][bIdx] = e.target.value }"
                      placeholder="请输入答案..."
                      class="flex-1 px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>
                <button @click="submitFillBlank(q.id)" class="mt-4 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-md text-sm hover:bg-blue-700 w-full sm:w-auto shadow-sm transition-colors">提交答案</button>
              </template>
            </div>

            <!-- 结果栏 -->
            <div v-if="currentMode === 'recite'" class="mt-4 md:mt-5 bg-[#fafafa] border border-[#f0f0f0] rounded-md flex items-center min-h-[48px] md:min-h-[56px] px-4 md:px-6 shadow-sm">
              <div class="flex-1 flex items-center text-[13px] md:text-[14px]">
                <span class="text-gray-500 mr-2 shrink-0">标准答案:</span>
                <span class="text-green-600 font-bold text-base break-words">{{ formatDisplayAnswer(q.answer) }}</span>
              </div>
            </div>

            <div v-else-if="test.answers[q.id]" :class="isAnswerCorrect(q, test.answers[q.id]) ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'" class="mt-4 md:mt-5 border rounded-md items-center min-h-[48px] md:min-h-[56px] px-4 md:px-6 flex shadow-sm py-3 md:py-0">
              <div class="flex-1 flex flex-col md:flex-row md:items-center text-[13px] md:text-[14px] space-y-2 md:space-y-0">
                <div class="flex items-center md:mr-8">
                  <span class="text-gray-500 mr-2 shrink-0">我的答案:</span>
                  <span :class="isAnswerCorrect(q, test.answers[q.id]) ? 'text-green-600' : 'text-red-500'" class="font-bold text-sm md:text-base break-all">{{ formatDisplayAnswer(test.answers[q.id]) }}</span>
                </div>
                <div class="flex items-center">
                  <span class="text-gray-500 mr-2 shrink-0">正确答案:</span>
                  <span class="font-bold text-green-600 text-sm md:text-base break-all">{{ formatDisplayAnswer(q.answer) }}</span>
                </div>
              </div>
              <div class="flex items-center md:space-x-6 shrink-0 ml-4 border-l border-white/50 pl-4">
                <template v-if="isAnswerCorrect(q, test.answers[q.id])">
                  <svg class="w-5 h-5 md:w-6 md:h-6 text-green-600 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg> 
                  <span class="hidden md:inline text-[14px] text-gray-800 font-medium ml-1">正确</span>
                </template>
                <template v-else>
                  <svg class="w-5 h-5 md:w-6 md:h-6 text-red-500 stroke-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg> 
                  <span class="hidden md:inline text-[14px] text-gray-800 font-medium ml-1">错误</span>
                </template>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- 右侧答题卡 -->
      <div 
        id="nav-sidebar" 
        :class="sidebarOpen ? 'translate-x-0' : 'translate-x-full'"
        class="fixed inset-y-0 right-0 z-50 w-64 sm:w-80 bg-white shadow-2xl lg:shadow-sm p-4 lg:sticky lg:top-[68px] h-full lg:max-h-[calc(100vh-100px)] flex flex-col shrink-0 lg:translate-x-0 transition-transform duration-300 ease-in-out lg:rounded-md lg:w-[280px]"
      >
        <button @click="sidebarOpen = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-700 lg:hidden p-1">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <div class="text-sm md:text-base font-medium text-gray-700 mb-3 md:mb-4 bg-white pb-2 z-10 flex justify-between items-center shrink-0 border-b border-gray-50 lg:pr-0 pr-8 mt-1">
          <span class="flex items-center">
            <svg class="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
            答题卡导航
          </span>
          <span class="text-xs text-blue-500 font-bold bg-blue-50 px-2 py-1 rounded">
            {{ currentMode === 'practice' ? `${uiStore.stats.total}/${displayQuestions.length}` : `共 ${displayQuestions.length} 题` }}
          </span>
        </div>
        
        <!-- 分组渲染答题卡内容 -->
        <div class="flex-1 overflow-y-auto pb-4 pr-1 content-start space-y-6">
          <div v-for="(group, gIdx) in groupedQuestions" :key="gIdx">
            <div class="text-[13px] md:text-sm font-bold text-gray-800 mb-3 tracking-wide ml-1">
              {{ group.title }}
            </div>
            <div class="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2">
              <div 
                v-for="item in group.questions" :key="item.data.id"
                @click="scrollToQ(item.data.id)"
                :class="getGridItemClass(item.data)"
                class="w-full aspect-square flex items-center justify-center text-[12px] md:text-[13px] rounded-sm cursor-pointer shadow-sm font-medium transition-colors"
              >
                {{ item.displayIndex }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>