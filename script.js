var bypassFuncSrc = "_=>_"
var store = {
  initStates: {
    funcDataArr: [],
    initInput: "",
    initValues: {
      funcDataArr: {
        src: bypassFuncSrc,
        pipeShowCfg: {
          expandOutput: false,
          preferHTMLView: false
        }
      },
      initInput: new Date(-12345).toISOString(),
      bypassFuncSrc
    },
    initFillLen: 2
  }
}
function initFill(
  states = store.initStates,
  initFillValues = store.initStates.initValues) {
  Object.entries(initFillValues)
  .forEach(([key,value])=>{
    if(Array.isArray(states[key])){
      states[key] = Array.isArray(value)?value:
        range(
          states.initFillLen
        ).map(_=>copyViaJson(value))
    }else{
      states[key] = typeof value == "object" ?
        copyViaJson(value) :
        value
    }
  })
}
initFill();

var app = new Vue({
  el: '#app',
  data: {
    ...store.initStates,
    modes: { //pipe-tools
      splice: false,
      bypass: false
    },
    focusOn: "",
    inputFile: null,
    inputFileValue: null,
    lockInput: false,
    enableReread: false,
    enableReset: false,
    showOutputOfIndex: NaN
  },
  computed: {
    funcArr: function() {
      return this.funcDataArr
      .map(fd=>newFunc(fd.src))
    },
    pipeline: function(){
      return bloatedPipeline(this.funcArr,this.initInput)
    },
    output: function() {
      return this.pipeline.slice(-1)[0].output
    }
  },
  watch: {
    inputFile: function() {
      this.resetInitInputViaInitFile()
    }
  },
  methods: {...console,
    toggleBVOf, lineCnt, someOf, initFill, setSelection,
    newPipe(count=1) {
      for (_ of range(count)) {
        this.funcDataArr
        .push(copyViaJson(
          this.initValues.funcDataArr
        ))
      }
    },
    splicePipe(start, delCnt, ...items) {
      this.funcDataArr.splice(start, delCnt, ...items)
    },
    swapPipe(i0,i1) {
      if(i0<0||i1<0){return}
      item0 = this.funcDataArr[i0]
      item1 = this.funcDataArr[i1]
      this.splicePipe(i0,1,item1)
      this.splicePipe(i1,1,item0)
    },
    bypassPipe(index) {
      var currentPipe = this.funcDataArr[index]
      if (!currentPipe.bypassed) {
        var bpFuncData = {
          src: this.initValues.bypassFuncSrc,
          pipeShowCfg: copyViaJson(
            currentPipe.pipeShowCfg
          ),
          bypassed: currentPipe
        }
        this.splicePipe(index, 1, bpFuncData)
      }else{
        this.splicePipe(index, 1, currentPipe.bypassed)
      }
    },
    readTextFile(file,job) {
      var reader = new FileReader()
      var that = this
      reader.onload = ()=>{
        that.initInput = reader.result
        that.lockInput = true
        if(job){job()}
      }
      reader.readAsText(file?file:this.inputFile)
    },
    resetInitInputViaInitFile() {
      var that = this
      this.readTextFile(undefined,()=>{
        that.$refs.initInputTA.addEventListener("change",()=>{that.enableReread=true},{once:true})
        that.enableReread = false
      })
    },
    removeAll() {
      this.funcDataArr = []
      this.initInput = ""
      this.inputFile = null
      this.inputFileValue = null
      this.showOutputOfIndex = NaN
    },
    putFuncsFromFile(file) {
      var reader = new FileReader()
      var that = this
      reader.onload = ()=>{
        that.getFuncsFromExport(reader.result,file.type)
      }
      reader.readAsText(file)
    },
    getFuncsFromExport(srcText,filetype) {
      var funcSrcs
      if(/json/.test(filetype)){
        var obj = JSON.parse(srcText)
        if(Array.isArray(obj)){funcSrcs = obj}
        else{funcSrcs = obj.funcDataArr.map(d=>d.src?d.src:d)}
      }else{
        var [f] = srcText.split(/(\r\n|[\r\n])={9,}/)
        var fl = f.split(/\r\n|[\r\n]/)
        var delims =
          fl.map((s,i)=>[/^={5,}$/.test(s),i]).filter(([s,i])=>s).map(([s,i])=>i)
          .concat(fl.length)
        funcSrcs = delims.map((d,i,a)=>fl.slice(a[i-1]+1,d)).map(s=>s.join`\n`)
      }
      this.newPipe(funcSrcs.length)
      this.funcDataArr.forEach((d,i)=>{d.src=funcSrcs[i]})
    }
  }
})

function newFunc(src) {
  try{
    return {
      func: (new Function(`var f=${src};return f;`))()
    }
  }catch(err){
    if(!src||/^\s*$/.test(src)){
      return {
        error: Error("empty source"),
        reason: "empty"
      }
    }
    return {error: err}
  }
}
function bloatedPipeline(functionArray, initialInput) {
  return functionArray.reduce((prevs,f)=>{
    var input = prevs.length>0 ?
      prevs.slice(-1)[0].output :
      initialInput
    var output, error
    if(input instanceof Error){
      output = new Error("error in previous step")
      error = "prev"
    }else if(!f.func){
      output = f.error?f.error:new Error("no function")
      error = f.error ?
        f.reason == "empty" ? "empty" : "func"
      :"nofunc"
    }else{
      try{
        output = f.func(input)
        error = false
      }catch(err){
        output = err
        error = "runtime"
      }
    }
    return prevs.concat({output, error, type: error ? output.name : typeof output})
  },[])
}

function toggleBVOf(obj, key) {
  if(typeof obj[key] == "boolean"){
    obj[key] = !obj[key]
  }
}

function range(len) {
  return (new Array(len)).fill(0).map((_,i)=>i)
}

function copyViaJson(obj) { //avoid shallow-copying of init value objs
  return JSON.parse(JSON.stringify(obj))
}

function lineCnt(text) {
  var match = text.match(/\r\n|[\r\n]/g)
  return match===null ? text?1:0 : match.length+1
}

function someOf(obj, filter) {
  return Object.entries(obj).some(
    filter?filter:entry=>entry[1]
  )
}

function setBlobURL(data,type="export",rawtext=false) {
  var dlname = `ketu_${type.replace(/[\s\$]/g,"")}_${new Date().toISOString().replace(/[^\d]/g,"")}.${rawtext?"txt":"json"}`
  var a = document.querySelectorAll(".bloblink")
  var blob = rawtext ?
    new Blob([data.toString()],{type:"text/plain"}) :
    new Blob([JSON.stringify(data,null,2)],{type:"text/json"})
  for(var i of a){
    i.href = URL.createObjectURL(blob)
    if(i.hasAttribute('download')){i.download = dlname}
  }
  var a2 = document.querySelectorAll(".datalink")
  var dataReader = new FileReader()
  dataReader.onload = ()=>{
    for(var i of a2){
      i.href = dataReader.result
      if(i.hasAttribute('download')){i.download = dlname}
    }
  }
  dataReader.readAsDataURL(blob)
}

function setSelection(node) {
  var sel = window.getSelection()
  sel.selectAllChildren(node)
}

["alert","prompt","confirm"]
.forEach(m=>{
  window[m] = function(...args){
    var msg = `window.${m} is suppressed here\n(args: ${args.join(',\n')})`
    console.warn(msg)
    throw Error(msg)
  }
})
