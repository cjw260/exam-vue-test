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
  
  // 🌟核心修复：放宽题目切分规则的同时，加入 (?!\d) 排除小数点干扰。
  // 意味着 "2." 后面不能紧跟数字，成功规避 "2.1分" 被切分成新题目的Bug！
  const blocks = ('\n' + text).split(/\n(?=\s*\d+[\.、．](?!\d))/).filter(b => b.trim())
  let globalIdCounter = 1

  blocks.forEach((block) => {
    block = block.trim()
    // 过滤掉类似 "一、选择题" 的大题标题块
    if (!/^\d+[\.、．](?!\d)/.test(block)) return

    // 1. 探测题干第一行的题型暗示 (Type Hinting)
    let typeHint = ''
    const firstLine = block.split('\n')[0]
    if (firstLine.match(/多选/)) typeHint = '多选题'
    else if (firstLine.match(/单选/)) typeHint = '单选题'
    else if (firstLine.match(/判断/)) typeHint = '判断题'
    else if (firstLine.match(/填空/)) typeHint = '填空题'

    // 2. 提取解析
    let analysis = ''
    const analysisMatch = block.match(/(?:【解\s*析】|参考解析[：:]?|答案解析[：:]?|解析[：:]?)\s*([\s\S]*?)(?=AI讲解|\n\d+[\.、．](?!\d)|$)/i)
    if (analysisMatch) analysis = analysisMatch[1].trim()

    // 3. 提取选择/判断题答案 (遍历匹配，精准避开“我的答案”)
    let ansMatchStr = '';
    const ansRegex = /(?:我的答案|正确答案|标准答案|参考答案|【答\s*案】|答案)\s*[：:]?\s*([A-F√×对错]+)/ig;
    let m;
    while ((m = ansRegex.exec(block)) !== null) {
      if (!m[0].includes('我的答案')) {
        ansMatchStr = m[1];
        break; 
      }
    }

    // 4. 提取填空题答案
    let fbAnswer = '';
    const fbRegex = /(?:我的答案|正确答案|标准答案|参考答案|【答\s*案】|答案)\s*[：:]?\s*\n?([\s\S]*?)(?=(?:我的答案|正确答案|标准答案|参考答案|【答\s*案】|答案)\s*[：:]|【解\s*析】|参考解析|答案解析|解析[：:]?|AI讲解|$)/ig;
    let fm;
    while ((fm = fbRegex.exec(block)) !== null) {
      if (!fm[0].includes('我的答案')) {
        fbAnswer = fm[1];
        break;
      }
    }

    // 5. 截断答案、解析等无用尾部，获取干净的题干+选项区
    const cleanBlock = block.split(/\n?\s*(?:我的答案|正确答案|标准答案|【答\s*案】|参考答案|答案\s*[：:]|答案解析|【解\s*析】|参考解析|解析\s*[：:]|AI讲解)[\s\S]*/i)[0].trim()

    // 6. 提取选项 (支持空格或换行分隔的A-F选项)
    const options = []
    const optionRegex = /([A-F])[\.、．]\s*([\s\S]*?)(?=\s+[A-F][\.、．]|$)/g
    let optMatch
    while ((optMatch = optionRegex.exec(cleanBlock)) !== null) {
      options.push(`${optMatch[1].toUpperCase()}. ${optMatch[2].trim()}`)
    }

    // 7. 综合判定题型与标准答案
    let qType = '单选题'
    let answer = ''

    if (typeHint === '判断题' || (typeHint === '' && options.length === 0 && ansMatchStr && /^[A-B√×对错]+$/.test(ansMatchStr) && !fbAnswer)) {
      qType = '判断题'
      options.length = 0 
      options.push('A. 对', 'B. 错')
      answer = ansMatchStr ? ansMatchStr.replace(/\s/g, '').toUpperCase() : ''
      if (answer === '对' || answer === '√') answer = 'A'
      else if (answer === '错' || answer === '×') answer = 'B'
    } else if (typeHint === '填空题' || (typeHint === '' && options.length === 0 && fbAnswer)) {
      qType = '填空题'
      options.length = 0
      if (fbAnswer) {
        const matches = [...fbAnswer.matchAll(/\(\d+\)\s*(.+)/g)]
        if (matches.length > 0) {
          answer = matches.map(match => match[1].trim()).join('|')
        } else {
          answer = fbAnswer.trim().split('\n')[0].trim()
        }
      }
    } else if (options.length > 0) {
      answer = ansMatchStr ? ansMatchStr.replace(/\s/g, '').toUpperCase() : ''
      qType = answer.length > 1 ? '多选题' : '单选题'
      if (typeHint === '多选题') qType = '多选题'
      if (typeHint === '单选题') qType = '单选题'
    } else {
      return 
    }

    // 8. 提纯题干主体
    let qText = cleanBlock
    if (options.length > 0 && qType !== '判断题') {
      const splitMatch = cleanBlock.match(/\s+[A-F][\.、．]\s*/)
      if (splitMatch) {
        qText = cleanBlock.substring(0, splitMatch.index).trim()
      }
    } else if (qType === '判断题') {
      qText = cleanBlock.replace(/\s*[A-B][\.、．]\s*(?:对|错)\s*/g, '')
    }
    
    // 剔除前端题号及题型说明
    qText = qText.replace(/^\d+[\.、．]\s*(?:\(|（|【|\[)?(?:单选题|多选题|判断题|填空题|选择题)?(?:\)|）|】|\])?\s*(?:[：:])?\s*/, '').trim()

    if (!qText || (!answer && options.length === 0 && qType !== '填空题')) return

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