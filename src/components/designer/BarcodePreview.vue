<template>
  <div class="barcode-preview" :style="{ width: `${width}px`, height: `${height}px` }">
    <svg ref="barcodeSvg" />
    <span v-if="errorText">{{ errorText }}</span>
  </div>
</template>

<script setup lang="ts">
import JsBarcode from "jsbarcode"
import { nextTick, ref, watch } from "vue"

const props = withDefaults(
  defineProps<{
    content?: string
    format?: string
    width?: number
    height?: number
  }>(),
  {
    content: "9780201379624",
    format: "CODE128",
    width: 180,
    height: 54,
  }
)

const barcodeSvg = ref<SVGSVGElement>()
const errorText = ref("")

watch(
  () => [props.content, props.format, props.width, props.height],
  async () => {
    await nextTick()
    if (!barcodeSvg.value) {
      return
    }

    try {
      errorText.value = ""
      JsBarcode(barcodeSvg.value, props.content || "PT-20260628-001", {
        format: props.format || "CODE128",
        displayValue: false,
        width: 1.6,
        height: props.height,
        margin: 0,
      })
      barcodeSvg.value.setAttribute("preserveAspectRatio", "none")
      barcodeSvg.value.setAttribute("width", "100%")
      barcodeSvg.value.setAttribute("height", "100%")
    } catch {
      barcodeSvg.value.replaceChildren()
      errorText.value = `当前内容不符合 ${props.format || "CODE128"}`
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.barcode-preview {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  overflow: hidden;
  padding: 0;
  border: 1px solid rgba(120, 120, 120, 0.24);
  background: #fff;

  svg {
    width: 100%;
    height: 100%;
    max-width: 100%;
  }

  span {
    color: #c2410c;
    font-size: 12px;
  }
}
</style>
