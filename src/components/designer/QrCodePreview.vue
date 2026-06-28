<template>
  <div class="qr-preview" :style="{ width: `${size}px`, height: `${size}px` }">
    <img v-if="dataUrl" :src="dataUrl" alt="二维码预览" />
    <span v-else>二维码</span>
  </div>
</template>

<script setup lang="ts">
import QRCode from "qrcode"
import { ref, watch } from "vue"

const props = withDefaults(
  defineProps<{
    content?: string
    size?: number
  }>(),
  {
    content: "",
    size: 96,
  }
)

const dataUrl = ref("")

watch(
  () => [props.content, props.size],
  async () => {
    try {
      dataUrl.value = await QRCode.toDataURL(props.content || " ", {
        width: props.size,
        margin: 1,
        errorCorrectionLevel: "M",
      })
    } catch {
      dataUrl.value = ""
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.qr-preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(120, 120, 120, 0.24);
  background: #fff;

  img {
    width: 100%;
    height: 100%;
    display: block;
  }

  span {
    color: #8a8f98;
    font-size: 12px;
  }
}
</style>
