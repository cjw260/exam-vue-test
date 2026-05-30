<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useQuizStore } from '@/stores/quizStore'
import { useUiStore } from '@/stores/uiStore'

const router = useRouter()
const quizStore = useQuizStore()
const uiStore = useUiStore()

const testName = ref('')
const rawText = ref('')
const isSuccess = ref(false)

onMounted(() => {
  uiStore.setNav({ title: '导入题目', showBack: true, backRoute: '/' })
})

const handleDocxUpload = (e) => {
  const file = e.target.files[0]
  if (!file) return

  if (!testName.value.trim()) {
    testName.value = file.name.replace(/\.docx$/i, '')
  }

  uiStore.showLoading("正在解析 Word 文档...")
  isSuccess.value = false
  
  const reader = new FileReader()
  reader.onload = function(loadEvent) {
    const arrayBuffer = loadEvent.target.result
    window.mammoth.extractRawText({ arrayBuffer: arrayBuffer })
      .then((result) => {
        let text = result.value
        rawText.value = text.replace(/\n\s*\n\s*\n/g, '\n\n')
        isSuccess.value = true
        uiStore.hideLoading()
      })
      .catch((error) => {
        uiStore.hideLoading()
        console.error("Mammoth 解析错误:", error)
        alert("解析失败，请确保您上传的是现代的 Word 文档（.docx 格式）。")
      })
  }
  reader.readAsArrayBuffer(file)
  e.target.value = ''
}

const parseText = (text) => {
  const questions = []
  text = text.replace(/[\u00a0\t\f\v]/g, ' ')
  
  // 预处理：去除诸如 "一. 单选题（共11题，27.5分）" 的大题题干，防止干扰最后一道题的解析
  text = text.replace(/^\s*[一二三四五六七八九十]+[\.、]\s*(?:单选题|多选题|判断题|填空题).*$/gm, '')

  // 按照题号和题型正则进行安全分割，支持 "1. (单选题)", "1.(填空题)", "1.（判断题）"等格式
  const blocks = ('\n' + text).split(/\n(?=\s*\d+[\.、]\s*(?:\(|（)?(?:单选题|多选题|判断题|填空题))/).filter(b => b.trim())
  let globalIdCounter = 1

  blocks.forEach((block) => {
    block = block.trim()
    if (!/^\d+[\.、]/.test(block)) return

    // 仅通过块的第一行来判断题型，避免被后面的文本（如未清除干净的大题标题）干扰
    let qType = '单选题'
    const firstLine = block.split('\n')[0]
    if (firstLine.match(/多选题/)) qType = '多选题'
    else if (firstLine.match(/判断题/)) qType = '判断题'
    else if (firstLine.match(/填空题/)) qType = '填空题'

    let answer = ''
    let analysis = ''
    
    // 解析部分提取
    const analysisMatch = block.match(/(?:【解\s*析】|参考解析[：:]?|答案解析[：:]?|解析[：:]?)\s*([\s\S]*?)(?=AI讲解|\n\d+[\.、]|$)/i)
    if (analysisMatch) analysis = analysisMatch[1].trim()

    // 答案提取
    if (qType === '填空题') {
      const ansSection = block.match(/(?:正确答案|参考答案)[：:]?\s*\n?([\s\S]*?)(?:答案解析|AI讲解|$)/i)
      if (ansSection) {
        // 匹配 (1)xxx (2)xxx 格式
        const matches = [...ansSection[1].matchAll(/\(\d+\)\s*(.+)/g)]
        if (matches.length > 0) {
          answer = matches.map(m => m[1].trim()).join('|')
        } else {
          // Fallback 到提取第一行文本
          answer = ansSection[1].trim().split('\n')[0].trim()
        }
      }
    } else {
      const ansMatch = block.match(/(?:【答\s*案】|正确答案[：:]?|参考答案[：:]?|答案[：:]?)\s*([A-D√×对错]+)/i)
      if (ansMatch) answer = ansMatch[1].replace(/\s/g, '').toUpperCase()
    }

    // 清理题干文本，去除下方的答案及解析部分
    let cleanBlock = block.replace(/\n?\s*(?:我的答案|正确答案|【答\s*案】|参考答案|答案解析|AI讲解)[\s\S]*/i, '').trim()

    const options = []
    if (qType === '判断题') {
      // 强行赋予判断题标准 A/B 选项
      options.push('A. 对', 'B. 错')
      if (answer === '对' || answer === '√') answer = 'A'
      else if (answer === '错' || answer === '×') answer = 'B'

      // 去除判断题题干中自带的多余的 "A. 对 B. 错" 选项文本
      cleanBlock = cleanBlock.replace(/\s*[A-B][\.、]\s*(?:对|错)\s*/g, '')
    } else if (qType === '单选题' || qType === '多选题') {
      const optionRegex = /([A-D])[\.、]\s*(.*?)(?=\n\s*[A-D][\.、]|$)/gs
      let optMatch
      while ((optMatch = optionRegex.exec(cleanBlock)) !== null) {
        options.push(`${optMatch[1].toUpperCase()}. ${optMatch[2].trim()}`)
      }
    }

    let qText = cleanBlock
    if (options.length > 0 && qType !== '判断题') qText = cleanBlock.split(/\n\s*[A-D][\.、]/i)[0].trim()
    
    qText = qText.replace(/^\d+[\.、]\s*/, '').trim()
    // 只有在既没有答案也没有选项且不为填空题时跳过
    if (!answer && options.length === 0 && qType !== '填空题') return

    questions.push({
      id: globalIdCounter++, 
      type: qType,
      text: qText,
      options: options,
      answer: answer,
      analysis: analysis
    })
  })
  return questions
}

const generateTest = async () => {
  if (!testName.value.trim()) return alert("请输入或自动生成题库名称！")
  if (!rawText.value.trim()) return alert("题目内容不能为空，请粘贴或上传文档！")

  uiStore.showLoading("正在解析题目并构建题库...")
  
  setTimeout(async () => {
    const questions = parseText(rawText.value)
    if (questions.length === 0) {
      uiStore.hideLoading()
      alert("未能解析出任何题目！\n请确保每道题有明确的题号(如：1.)、选项(如：A.)、以及答案(如：答案：A)。")
      return
    }
    
    const testData = {
      id: 'test_' + Date.now(),
      name: testName.value,
      questions: questions,
      answers: {},
      wrongIds: [],
      favoriteIds: [],
      createdAt: Date.now()
    }

    const newId = await quizStore.saveTest(testData)
    uiStore.hideLoading()
    router.push(`/review/${newId}?filter=all`)
  }, 50)
}
</script>

<template>
  <div class="max-w-4xl mx-auto mt-6 p-4 md:p-8 bg-white rounded-lg shadow-sm">
    <div class="flex items-center mb-6">
      <button @click="router.push('/')" class="mr-3 md:mr-4 text-gray-500 hover:text-gray-800 transition-colors bg-gray-50 p-2 rounded-full">
        <svg class="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
      </button>
      <h2 class="text-xl md:text-2xl font-bold text-gray-800">导入题目</h2>
    </div>
    
    <div class="mb-5 md:mb-6">
      <label class="block text-sm font-bold text-gray-700 mb-2">题库名称 <span class="text-red-500">*</span></label>
      <input v-model="testName" type="text" placeholder="例如：软件工程期末复习 第1-3章" class="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm md:text-base">
    </div>

    <div class="mb-6">
      <label class="block text-sm font-bold text-gray-700 mb-2">方式一：上传 Word 文档自动解析 (推荐)</label>
      <div class="p-6 border-2 border-dashed border-blue-200 bg-blue-50/50 hover:bg-blue-50 rounded-lg text-center cursor-pointer relative">
        <input @change="handleDocxUpload" type="file" accept=".docx" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
        <svg class="mx-auto h-8 w-8 text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        <p class="text-sm font-medium text-blue-700">点击选择或将 .docx 文件拖拽至此</p>
        <p class="text-xs text-blue-500/80 mt-1">系统将瞬间提取文档内容填充至下方文本框</p>
        <div v-if="isSuccess" class="text-green-600 text-sm mt-3 font-medium text-center">
          ✅ 提取成功！请核对下方文本无误后，点击底部按钮保存。
        </div>
      </div>
    </div>

    <label class="block text-sm font-bold text-gray-700 mb-2">方式二：直接粘贴文本</label>
    <p class="text-gray-500 mb-2 text-xs md:text-sm">确保题目包含了类似 "A. xx" 的选项以及 "答案：A" 字眼即可。</p>
    <textarea v-model="rawText" class="w-full h-[40vh] md:h-80 p-3 md:p-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans text-xs md:text-sm resize-none mb-5 md:mb-6" placeholder="请在此处粘贴包含选项和答案的题目内容..."></textarea>
    
    <button @click="generateTest" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition duration-200 shadow-sm text-base">
      解析并保存题库
    </button>
  </div>
</template>