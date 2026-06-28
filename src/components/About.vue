<template>
  <div class="template-help-page">
    <header class="help-header">
      <div>
        <h1>模板语法速查</h1>
        <p>当前模板引擎默认使用 Go Template。数据字段从示例数据 JSON 中读取，字段路径前面加点号。</p>
      </div>
      <a :href="githubUrl" target="_blank" rel="noreferrer">源码</a>
    </header>

    <section class="help-section">
      <h2>常用写法</h2>
      <div class="syntax-grid">
        <article v-for="item in syntaxItems" :key="item.name" class="syntax-card">
          <h3>{{ item.name }}</h3>
          <p>{{ item.description }}</p>
          <pre><code>{{ item.example }}</code></pre>
        </article>
      </div>
    </section>

    <section class="help-section">
      <h2>内置判断与函数</h2>
      <table class="help-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>说明</th>
            <th>示例</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in builtinFunctions" :key="item.name">
            <td><code>{{ item.name }}</code></td>
            <td>{{ item.description }}</td>
            <td><code>{{ item.example }}</code></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="help-section">
      <h2>PdfTurtle 扩展函数</h2>
      <table class="help-table">
        <thead>
          <tr>
            <th>函数</th>
            <th>说明</th>
            <th>示例</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in pdfTurtleFunctions" :key="item.name">
            <td><code>{{ item.name }}</code></td>
            <td>{{ item.description }}</td>
            <td><code>{{ item.example }}</code></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="help-section">
      <h2>完整示例</h2>
      <pre class="wide-code"><code>{{ fullExample }}</code></pre>
    </section>
  </div>
</template>

<script setup lang="ts">
const githubUrl = "https://github.com/lucas-gaitzsch/pdf-turtle"

const syntaxItems = [
  {
    name: "读取字段",
    description: "用点号访问 JSON 字段，支持多级对象。",
    example: "{{ .title }}\n{{ .customer.name }}",
  },
  {
    name: "循环列表",
    description: "range 遍历数组，end 表示循环结束。",
    example: "{{ range .items }}\n  <div>{{ .name }}</div>\n{{ end }}",
  },
  {
    name: "循环为空",
    description: "range 可以带 else，列表为空时显示备用内容。",
    example: "{{ range .items }}\n  {{ .name }}\n{{ else }}\n  暂无数据\n{{ end }}",
  },
  {
    name: "条件判断",
    description: "if 判断真假，else 表示否则，end 表示结束。",
    example: "{{ if .paid }}已付款{{ else }}未付款{{ end }}",
  },
  {
    name: "临时作用域",
    description: "with 在字段存在时进入该对象，里面的点号就是这个对象。",
    example: "{{ with .customer }}\n  {{ .name }} / {{ .phone }}\n{{ end }}",
  },
  {
    name: "定义变量",
    description: "用 := 定义变量，后续可重复使用。",
    example: "{{ $total := multiply .price .count }}\n合计：{{ $total }}",
  },
  {
    name: "管道写法",
    description: "竖线会把左侧结果传给右侧函数。",
    example: "{{ .amount | printf \"%.2f\" }}",
  },
  {
    name: "注释",
    description: "注释不会输出到 PDF。",
    example: "{{/* 这里是模板注释 */}}",
  },
  {
    name: "去除空白",
    description: "在大括号旁加减号，可以裁剪模板附近空白。",
    example: "{{- if .name -}}{{ .name }}{{- end -}}",
  },
]

const builtinFunctions = [
  { name: "eq", description: "等于", example: "{{ if eq .status \"paid\" }}已付款{{ end }}" },
  { name: "ne", description: "不等于", example: "{{ if ne .status \"cancelled\" }}有效{{ end }}" },
  { name: "lt", description: "小于", example: "{{ if lt .score 60 }}不及格{{ end }}" },
  { name: "le", description: "小于等于", example: "{{ if le .stock 0 }}缺货{{ end }}" },
  { name: "gt", description: "大于", example: "{{ if gt .amount 1000 }}大额订单{{ end }}" },
  { name: "ge", description: "大于等于", example: "{{ if ge .level 3 }}高级{{ end }}" },
  { name: "and", description: "并且", example: "{{ if and .paid .shipped }}已完成{{ end }}" },
  { name: "or", description: "或者", example: "{{ if or .phone .email }}可联系{{ end }}" },
  { name: "not", description: "取反", example: "{{ if not .enabled }}已停用{{ end }}" },
  { name: "len", description: "长度", example: "{{ len .items }}" },
  { name: "index", description: "按下标或 key 取值", example: "{{ index .items 0 }}" },
  { name: "printf", description: "格式化文本或数字", example: "{{ printf \"%.2f\" .amount }}" },
  { name: "print", description: "拼接输出", example: "{{ print .firstName .lastName }}" },
]

const pdfTurtleFunctions = [
  { name: "marshal", description: "把对象转成 JSON，常用于图表脚本数据注入。", example: "{{ marshal .chartData }}" },
  { name: "barcodeQr", description: "生成二维码 SVG。", example: "{{ barcodeQr .url }}" },
  { name: "barcodeEan", description: "生成 EAN 条形码 SVG，内容通常是 8 位或 13 位数字。", example: "{{ barcodeEan .ean }}" },
  { name: "barcodeCode128", description: "生成 CODE128 条形码 SVG，适合订单号、批次号等字母数字混合内容。", example: "{{ barcodeCode128 .orderCode }}" },
  { name: "barcodeCode39", description: "生成 CODE39 条形码 SVG，适合较短的编码文本。", example: "{{ barcodeCode39 .sku }}" },
  { name: "strContains", description: "判断字符串是否包含片段。", example: "{{ if strContains .remark \"加急\" }}加急{{ end }}" },
  { name: "strHasPrefix", description: "判断字符串是否以指定内容开头。", example: "{{ if strHasPrefix .code \"VIP\" }}会员{{ end }}" },
  { name: "strHasSuffix", description: "判断字符串是否以指定内容结尾。", example: "{{ if strHasSuffix .file \".pdf\" }}PDF{{ end }}" },
  { name: "add", description: "两个数字相加。", example: "{{ add .a .b }}" },
  { name: "subtract", description: "两个数字相减。", example: "{{ subtract .total .discount }}" },
  { name: "multiply", description: "两个数字相乘。", example: "{{ multiply .price .count }}" },
  { name: "divide", description: "两个数字相除。", example: "{{ divide .total .count }}" },
  { name: "float64ToInt", description: "小数转整数。", example: "{{ float64ToInt .amount }}" },
  { name: "intToFloat64", description: "整数转小数。", example: "{{ intToFloat64 .count }}" },
  { name: "bitwiseAnd", description: "按位与，适合处理状态位。", example: "{{ bitwiseAnd .flags 2 }}" },
]

const fullExample = `<h1>{{ .title }}</h1>

{{ if .remark }}
  <p>{{ .remark }}</p>
{{ end }}

<table>
  <tr>
    <th>名称</th>
    <th>数量</th>
    <th>单价</th>
    <th>小计</th>
  </tr>
  {{ range .items }}
  <tr>
    <td>{{ .name }}</td>
    <td>{{ .count }}</td>
    <td>{{ printf "%.2f" .price }}</td>
    <td>{{ multiply .price .count }}</td>
  </tr>
  {{ else }}
  <tr>
    <td colspan="4">暂无明细</td>
  </tr>
  {{ end }}
</table>

<div style="width:120px;height:120px">
  {{ barcodeQr .url }}
</div>`
</script>

<style scoped lang="scss">
.template-help-page {
  min-height: 100%;
  padding: 22px;
  background: #eef3f8;
  color: #111827;
  overflow: auto;
}

.help-header,
.help-section {
  max-width: 1120px;
  margin: 0 auto 16px;
  border: 1px solid #d8e0eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;

  h1 {
    margin: 0 0 6px;
    font-size: 24px;
  }

  p {
    margin: 0;
    color: #64748b;
  }

  a {
    color: #1d4ed8;
    text-decoration: none;
    white-space: nowrap;
  }
}

.help-section {
  padding: 18px;

  h2 {
    margin: 0 0 14px;
    font-size: 18px;
  }
}

.syntax-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}

.syntax-card {
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  padding: 12px;
  background: #fbfdff;

  h3 {
    margin: 0 0 6px;
    font-size: 15px;
  }

  p {
    min-height: 40px;
    margin: 0 0 10px;
    color: #64748b;
    font-size: 13px;
  }
}

.help-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;

  th,
  td {
    border: 1px solid #dbe3ee;
    padding: 10px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
  }

  th {
    background: #f1f5f9;
    font-weight: 700;
  }

  th:first-child,
  td:first-child {
    width: 150px;
  }
}

pre {
  margin: 0;
  padding: 10px;
  overflow: auto;
  border-radius: 6px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.55;
}

code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
}

td code {
  color: #0f172a;
  background: #eef2f7;
  padding: 2px 4px;
  border-radius: 4px;
}

.wide-code {
  max-height: 520px;
}

@media only screen and (max-width: 720px) {
  .template-help-page {
    padding: 12px;
  }

  .help-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .help-table {
    min-width: 720px;
  }

  .help-section {
    overflow: auto;
  }
}
</style>
