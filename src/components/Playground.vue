<template>
  <div class="layout-wrapper visual-builder" @keydown.ctrl.s.prevent.stop="saveBundle()" @keydown.ctrl.o.prevent.stop="openBundlePicker()">
    <q-file v-show="false" ref="uploadBundle" v-model="bundleFileInputModel" />

    <header class="builder-topbar">
      <div class="title-block">
        <q-icon :name="mdiTurtle" size="28px" color="primary" />
        <div>
          <div class="app-title">PDF 可视化设计器</div>
          <div class="app-subtitle">{{ designerTitle }}</div>
        </div>
      </div>

      <div class="toolbar-actions">
        <q-select
          v-model="renderTemplateData.options.pageFormat"
          :options="pageSizes"
          label="纸张"
          dense
          outlined
          class="page-select"
        />
        <q-toggle v-model="renderTemplateData.options.landscape" label="横向" dense />

        <q-btn label="资源" :icon="mdiFileImagePlusOutline" flat no-caps>
          <q-menu class="q-pa-sm">
            <assets v-model="renderTemplateData.assets" />
          </q-menu>
        </q-btn>

        <q-btn label="文件" :icon="mdiPackageVariant" flat no-caps>
          <q-menu auto-close>
            <q-item clickable @click="openBundlePicker()">
              <q-item-section avatar>
                <q-icon :name="mdiFolderOutline" />
              </q-item-section>
              <q-item-section>
                <q-item-label>打开模板包</q-item-label>
                <q-item-label caption>Ctrl+O</q-item-label>
              </q-item-section>
            </q-item>

            <q-item clickable @click="saveBundle()">
              <q-item-section avatar>
                <q-icon :name="mdiContentSaveOutline" />
              </q-item-section>
              <q-item-section>
                <q-item-label>保存模板包</q-item-label>
                <q-item-label caption>Ctrl+S</q-item-label>
              </q-item-section>
            </q-item>

            <q-separator />

            <q-item clickable @click="loadEmptyData()">
              <q-item-section avatar>
                <q-icon :name="mdiBroom" />
              </q-item-section>
              <q-item-section>新建空白模板</q-item-section>
            </q-item>

            <q-item clickable @click="loadSampleData()">
              <q-item-section avatar>
                <q-icon :name="mdiImageAutoAdjust" />
              </q-item-section>
              <q-item-section>恢复示例模板</q-item-section>
            </q-item>
          </q-menu>
        </q-btn>

        <div v-if="requestTimeInMs" class="runtime">
          {{ (requestTimeInMs / 1000).toFixed(1) }}s
          <q-btn round flat dense size="sm" :icon="mdiInformationOutline" title="渲染日志">
            <q-menu class="render-log-menu">
              <div class="render-log-header">
                <strong>渲染日志</strong>
                <q-badge v-if="renderLogTruncated" color="warning" text-color="dark">已截断</q-badge>
              </div>

              <q-separator />

              <q-list v-if="renderLog.length" dense separator>
                <q-item v-for="(entry, index) in renderLog" :key="index">
                  <q-item-section>
                    <div class="render-log-entry-title">
                      <q-badge outline :color="renderLogLevelColor(entry.level)">
                        {{ entry.level }}
                      </q-badge>
                      <span>{{ entry.source }}</span>
                      <span v-if="entry.timestamp" class="render-log-timestamp">{{ entry.timestamp }}</span>
                    </div>
                    <pre class="render-log-text">{{ entry.text }}</pre>
                    <div v-if="entry.url || entry.line || entry.column" class="render-log-location">
                      {{ entry.url }}
                      <span v-if="entry.line">:{{ entry.line }}</span>
                      <span v-if="entry.column">:{{ entry.column }}</span>
                    </div>
                  </q-item-section>
                </q-item>
              </q-list>

              <div v-else class="render-log-empty">暂无渲染日志。</div>
            </q-menu>
          </q-btn>
        </div>

        <q-btn round flat dense :icon="mdiCogOutline" title="服务设置">
          <q-menu class="settings-menu">
            <q-input
              v-model="settings.serverUrl"
              label="后端地址"
              placeholder="http://localhost:8000"
              dense
              outlined
            />
            <q-input v-model="settings.secret" label="密钥" placeholder="Bearer token" dense outlined />
          </q-menu>
        </q-btn>
      </div>
    </header>

    <main class="builder-shell">
      <aside class="component-library">
        <div class="panel-heading">组件库</div>
        <button
          v-for="item in componentLibrary"
          :key="item.type"
          class="library-item"
          draggable="true"
          type="button"
          @click="addComponent(item.type)"
          @dragstart="onLibraryDragStart($event, item.type)"
        >
          <q-icon :name="item.icon" size="22px" />
          <span>
            <strong>{{ item.name }}</strong>
            <small>{{ item.description }}</small>
          </span>
          <q-icon :name="mdiPlus" size="18px" />
        </button>
      </aside>

      <section class="workbench">
        <div class="workbench-tabs">
          <q-tabs v-model="workbenchTab" dense no-caps inline-label align="left">
            <q-tab name="design" :icon="mdiViewDashboardOutline" label="画布" />
            <q-tab name="preview" :icon="mdiEyeOutline" label="PDF 预览" />
            <q-tab name="code" :icon="mdiCodeTags" label="高级代码" />
          </q-tabs>
        </div>

        <div class="workbench-body">
          <div v-show="workbenchTab === 'design'" class="canvas-scroll" @pointerdown.self="clearSelectedComponent()">
            <div class="canvas-paper" :style="canvasPaperStyle" @pointerdown.self="clearSelectedComponent()">
              <div
                ref="canvasPage"
                class="canvas-page"
                :style="canvasPageStyle"
                @pointerdown.self="clearSelectedComponent()"
                @dragover.prevent
                @drop="onCanvasDrop"
              >
                <div v-if="designerComponents.length === 0" class="empty-canvas" @pointerdown.stop="clearSelectedComponent()">
                  空白页面
                </div>

                <article
                  v-for="(component, index) in designerComponents"
                  :key="component.id"
                  class="canvas-component"
                  :class="{ selected: component.id === selectedComponentId }"
                  :style="componentShellStyle(component)"
                  :draggable="component.props.positionMode !== 'absolute'"
                  @click.stop="selectComponent(component.id)"
                  @pointerdown.stop="onComponentPointerDown($event, component)"
                  @dragstart="onComponentDragStart($event, component.id)"
                  @dragover.prevent
                  @drop.stop="onComponentDrop($event, index)"
                >
                  <div class="component-actions" @pointerdown.stop>
                    <q-icon :name="mdiDrag" size="18px" class="drag-icon" />
                    <span>{{ component.name }}</span>
                    <button type="button" title="上移" @click.stop="moveComponent(index, -1)">
                      <q-icon :name="mdiArrowUp" size="16px" />
                    </button>
                    <button type="button" title="下移" @click.stop="moveComponent(index, 1)">
                      <q-icon :name="mdiArrowDown" size="16px" />
                    </button>
                    <button type="button" title="复制" @click.stop="duplicateComponent(component.id)">
                      <q-icon :name="mdiContentCopy" size="16px" />
                    </button>
                    <button type="button" title="删除" @click.stop="removeComponent(component.id)">
                      <q-icon :name="mdiDeleteOutline" size="16px" />
                    </button>
                  </div>

                  <div class="component-preview" :style="componentBoxStyle(component)">
                    <div v-if="component.type === 'heading'" class="preview-heading" :style="textStyle(component)">
                      {{ textPreviewValue(component) }}
                    </div>

                    <p v-else-if="component.type === 'paragraph'" class="preview-paragraph" :style="textStyle(component)">
                      {{ textPreviewValue(component) }}
                    </p>

                    <div v-else-if="component.type === 'metric'" class="preview-metric" :style="metricStyle(component)">
                      <span>{{ component.props.label }}</span>
                      <strong>{{ metricPreviewValue(component) }}</strong>
                    </div>

                    <div v-else-if="component.type === 'table'" class="preview-table">
                      <h3>{{ component.props.title }}</h3>
                      <table>
                        <thead>
                          <tr>
                            <th v-for="column in component.props.columns" :key="column.id">{{ column.label }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(row, rowIndex) in sampleRows(component)" :key="rowIndex">
                            <td v-for="column in component.props.columns" :key="column.id">
                              {{ getValueByPath(row, column.field) }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div v-else-if="component.type === 'qr'" class="code-preview" :style="{ textAlign: component.props.align }">
                      <qr-code-preview :content="codePreviewValue(component)" :size="component.props.size" />
                    </div>

                    <div v-else-if="component.type === 'barcode'" class="code-preview" :style="{ textAlign: component.props.align }">
                      <barcode-preview
                        :content="codePreviewValue(component)"
                        :format="component.props.barcodeFormat"
                        :width="component.props.width"
                        :height="component.props.height"
                      />
                    </div>

                    <hr v-else-if="component.type === 'divider'" class="preview-divider" :style="dividerStyle(component)" />
                  </div>
                </article>
              </div>
            </div>
          </div>

          <div v-show="workbenchTab === 'preview'" class="pdf-container">
            <div v-if="isLoading || hasError" class="loading-wrapper">
              <q-circular-progress v-if="isLoading" indeterminate size="xl" />
              <div v-else-if="hasError" class="error-state">
                <q-icon :name="mdiTurtle" size="xl" />
                <h4>渲染失败</h4>
                <div>{{ errMsg?.msg }}</div>
                <div>{{ errMsg?.err }}</div>
                <div>{{ errMsg?.requestId }}</div>
              </div>
            </div>

            <object v-if="pdfResponseDataUrl" type="application/pdf" :data="pdfResponseDataUrl" class="pdf-viewer">
              <div class="pdf-fallback">
                <p>当前浏览器无法内嵌显示 PDF。</p>
                <q-btn :href="pdfResponseDataUrl" target="_blank" size="lg" :icon="mdiOpenInNew">外部打开</q-btn>
              </div>
            </object>
          </div>

          <div v-show="workbenchTab === 'code'" class="code-container">
            <q-tabs v-model="codeTab" dense no-caps inline-label align="left">
              <q-tab name="body" label="正文模板" />
              <q-tab name="model" label="示例数据" />
              <q-tab name="request" label="接口参数" />
            </q-tabs>
            <q-separator />
            <q-tab-panels v-model="codeTab" keep-alive class="code-panels">
              <q-tab-panel name="body">
                <html-editor
                  :model-value="renderTemplateData.htmlTemplate"
                  class="editor"
                  @update:model-value="updateHtmlTemplateFromEditor"
                />
              </q-tab-panel>
              <q-tab-panel name="model">
                <json-editor v-model="renderTemplateData.modelStr" class="editor" />
              </q-tab-panel>
              <q-tab-panel name="request">
                <json-editor v-model="requestPayloadJson" class="editor" />
              </q-tab-panel>
            </q-tab-panels>
          </div>
        </div>
      </section>

      <aside class="property-panel">
        <div class="panel-heading">属性面板</div>

        <el-scrollbar class="property-scrollbar">
          <el-form v-if="selectedComponent" label-position="top" class="property-form">
            <div class="property-title">
              <q-icon :name="selectedComponent.icon" size="22px" />
              <strong>{{ selectedComponent.name }}</strong>
            </div>

            <el-form-item label="快捷宽度">
              <el-segmented
                v-model="selectedComponent.props.layoutWidth"
                :options="layoutWidthOptions"
                class="width-shortcuts"
              />
            </el-form-item>

            <div class="dimension-grid">
              <el-form-item label="宽度(px)">
                <el-input-number
                  v-model="selectedComponent.props.layoutWidth"
                  :min="1"
                  :max="3000"
                  :step="1"
                  controls-position="right"
                />
              </el-form-item>
              <el-form-item label="高度(px)">
                <el-input-number
                  v-model="selectedComponent.props.layoutHeight"
                  :min="0"
                  :max="3000"
                  :step="1"
                  controls-position="right"
                />
              </el-form-item>
            </div>

            <el-form-item label="定位方式">
              <el-segmented v-model="selectedComponent.props.positionMode" :options="positionModeOptions" block />
            </el-form-item>

            <div v-if="selectedComponent.props.positionMode === 'absolute'" class="dimension-grid">
              <el-form-item label="X 坐标(px)">
                <el-input-number
                  v-model="selectedComponent.props.x"
                  :min="0"
                  :max="contentWidthPx"
                  :step="1"
                  controls-position="right"
                />
              </el-form-item>
              <el-form-item label="Y 坐标(px)">
                <el-input-number
                  v-model="selectedComponent.props.y"
                  :min="0"
                  :max="contentHeightPx"
                  :step="1"
                  controls-position="right"
                />
              </el-form-item>
            </div>

            <el-form-item label="对齐">
              <el-segmented v-model="selectedComponent.props.align" :options="alignOptions" block />
            </el-form-item>

            <el-form-item label="下方间距">
              <el-input-number v-model="selectedComponent.props.marginBottom" :min="0" :max="60" :step="1" controls-position="right" />
            </el-form-item>

            <template v-if="selectedComponent.type === 'heading'">
              <el-form-item label="取值方式">
                <el-select v-model="selectedComponent.props.valueSource">
                  <el-option label="固定值" value="static" />
                  <el-option label="数据字段" value="field" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="selectedComponent.props.valueSource !== 'field'" label="标题内容">
                <el-input v-model="selectedComponent.props.text" />
              </el-form-item>
              <el-form-item v-else label="字段路径">
                <el-select v-model="selectedComponent.props.field" filterable allow-create default-first-option>
                  <el-option v-for="field in fieldOptions" :key="field" :label="field" :value="field" />
                </el-select>
              </el-form-item>
              <el-form-item label="字号">
                <el-slider v-model="selectedComponent.props.fontSize" :min="16" :max="44" />
              </el-form-item>
              <el-form-item label="文字颜色">
                <el-color-picker v-model="selectedComponent.props.color" />
              </el-form-item>
            </template>

            <template v-else-if="selectedComponent.type === 'paragraph'">
              <el-form-item label="取值方式">
                <el-select v-model="selectedComponent.props.valueSource">
                  <el-option label="固定值" value="static" />
                  <el-option label="数据字段" value="field" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="selectedComponent.props.valueSource !== 'field'" label="文本内容">
                <el-input v-model="selectedComponent.props.text" type="textarea" :rows="5" />
              </el-form-item>
              <el-form-item v-else label="字段路径">
                <el-select v-model="selectedComponent.props.field" filterable allow-create default-first-option>
                  <el-option v-for="field in fieldOptions" :key="field" :label="field" :value="field" />
                </el-select>
              </el-form-item>
              <el-form-item label="字号">
                <el-slider v-model="selectedComponent.props.fontSize" :min="10" :max="24" />
              </el-form-item>
              <el-form-item label="文字颜色">
                <el-color-picker v-model="selectedComponent.props.color" />
              </el-form-item>
            </template>

            <template v-else-if="selectedComponent.type === 'metric'">
              <el-form-item label="指标名称">
                <el-input v-model="selectedComponent.props.label" />
              </el-form-item>
              <el-form-item label="取值方式">
                <el-select v-model="selectedComponent.props.valueSource">
                  <el-option label="固定值" value="static" />
                  <el-option label="数据字段" value="field" />
                </el-select>
              </el-form-item>
              <el-form-item v-if="selectedComponent.props.valueSource === 'static'" label="固定值">
                <el-input v-model="selectedComponent.props.valueText" />
              </el-form-item>
              <el-form-item v-else label="字段路径">
                <el-select v-model="selectedComponent.props.field" filterable allow-create default-first-option>
                  <el-option v-for="field in fieldOptions" :key="field" :label="field" :value="field" />
                </el-select>
              </el-form-item>
              <el-form-item label="后缀">
                <el-input v-model="selectedComponent.props.suffix" />
              </el-form-item>
              <el-form-item label="背景色">
                <el-color-picker v-model="selectedComponent.props.backgroundColor" />
              </el-form-item>
            </template>

            <template v-else-if="selectedComponent.type === 'table'">
              <el-form-item label="表格标题">
                <el-input v-model="selectedComponent.props.title" />
              </el-form-item>
              <el-form-item label="数据列表">
                <el-select v-model="selectedComponent.props.rowsPath" filterable allow-create default-first-option>
                  <el-option v-for="field in arrayFieldOptions" :key="field" :label="field" :value="field" />
                </el-select>
              </el-form-item>
              <el-form-item label="斑马纹">
                <el-switch v-model="selectedComponent.props.striped" />
              </el-form-item>
              <div class="column-editor">
                <div class="column-editor-head">
                  <span>表格列</span>
                  <el-button size="small" @click="addTableColumn()">添加列</el-button>
                </div>
                <div v-for="(column, index) in selectedColumns" :key="column.id" class="column-row">
                  <el-input v-model="column.label" placeholder="列名" />
                  <el-input v-model="column.field" placeholder="字段" />
                  <el-button text type="danger" @click="removeTableColumn(index)">删除</el-button>
                </div>
              </div>
            </template>

            <template v-else-if="selectedComponent.type === 'qr'">
              <el-form-item label="取值方式">
                <el-select v-model="selectedComponent.props.valueSource">
                  <el-option label="固定值" value="static" />
                  <el-option label="数据字段" value="field" />
                </el-select>
              </el-form-item>
              <el-form-item label="二维码内容">
                <el-input
                  v-if="selectedComponent.props.valueSource !== 'field'"
                  v-model="selectedComponent.props.content"
                  type="textarea"
                  :rows="4"
                />
                <el-select v-else v-model="selectedComponent.props.field" filterable allow-create default-first-option>
                  <el-option v-for="field in fieldOptions" :key="field" :label="field" :value="field" />
                </el-select>
              </el-form-item>
              <el-form-item label="二维码尺寸(px)">
                <el-input-number v-model="selectedComponent.props.size" :min="48" :max="220" controls-position="right" />
              </el-form-item>
            </template>

            <template v-else-if="selectedComponent.type === 'barcode'">
              <el-form-item label="条形码类型">
                <el-select v-model="selectedComponent.props.barcodeFormat">
                  <el-option v-for="format in barcodeFormatOptions" :key="format.value" :label="format.label" :value="format.value" />
                </el-select>
              </el-form-item>
              <el-form-item label="取值方式">
                <el-select v-model="selectedComponent.props.valueSource">
                  <el-option label="固定值" value="static" />
                  <el-option label="数据字段" value="field" />
                </el-select>
              </el-form-item>
              <el-form-item label="条形码内容">
                <el-input v-if="selectedComponent.props.valueSource !== 'field'" v-model="selectedComponent.props.content" />
                <el-select v-else v-model="selectedComponent.props.field" filterable allow-create default-first-option>
                  <el-option v-for="field in fieldOptions" :key="field" :label="field" :value="field" />
                </el-select>
              </el-form-item>
              <el-form-item label="条码宽度(px)">
                <el-input-number v-model="selectedComponent.props.width" :min="120" :max="360" controls-position="right" />
              </el-form-item>
              <el-form-item label="条码高度(px)">
                <el-input-number v-model="selectedComponent.props.height" :min="32" :max="120" controls-position="right" />
              </el-form-item>
            </template>

            <template v-else-if="selectedComponent.type === 'divider'">
              <el-form-item label="线条颜色">
                <el-color-picker v-model="selectedComponent.props.color" />
              </el-form-item>
              <el-form-item label="线条粗细">
                <el-input-number v-model="selectedComponent.props.thickness" :min="1" :max="8" controls-position="right" />
              </el-form-item>
            </template>
          </el-form>

          <el-form v-else label-position="top" class="property-form">
            <div class="property-title">
              <q-icon :name="mdiFileDocumentOutline" size="22px" />
              <strong>页面设置</strong>
            </div>

            <el-form-item label="报表名称">
              <el-input v-model="designerTitle" />
            </el-form-item>
            <el-form-item label="纸张大小">
              <el-select v-model="renderTemplateData.options.pageFormat" :disabled="useCustomPageSize">
                <el-option v-for="size in pageSizes" :key="size" :label="size" :value="size" />
              </el-select>
            </el-form-item>
            <el-form-item label="自定义纸张">
              <el-switch v-model="useCustomPageSize" />
            </el-form-item>
            <div v-if="useCustomPageSize" class="dimension-grid">
              <el-form-item label="纸张宽度(mm)">
                <el-input-number
                  v-model="customPageWidth"
                  :min="20"
                  :max="2000"
                  :step="1"
                  controls-position="right"
                />
              </el-form-item>
              <el-form-item label="纸张高度(mm)">
                <el-input-number
                  v-model="customPageHeight"
                  :min="20"
                  :max="3000"
                  :step="1"
                  controls-position="right"
                />
              </el-form-item>
            </div>
            <el-form-item label="横向排版">
              <el-switch v-model="renderTemplateData.options.landscape" />
            </el-form-item>
            <div class="margin-grid">
              <el-form-item label="上边距">
                <el-input-number v-model="renderTemplateData.options.margins.top" :min="0" :max="80" controls-position="right" />
              </el-form-item>
              <el-form-item label="右边距">
                <el-input-number v-model="renderTemplateData.options.margins.right" :min="0" :max="80" controls-position="right" />
              </el-form-item>
              <el-form-item label="下边距">
                <el-input-number v-model="renderTemplateData.options.margins.bottom" :min="0" :max="80" controls-position="right" />
              </el-form-item>
              <el-form-item label="左边距">
                <el-input-number v-model="renderTemplateData.options.margins.left" :min="0" :max="80" controls-position="right" />
              </el-form-item>
            </div>
          </el-form>
        </el-scrollbar>
      </aside>
    </main>
  </div>
</template>

<script setup lang="ts">
import type { RenderOptions } from "@/swagger-client"
import HtmlEditor from "@/components/editors/HtmlEditor.vue"
import JsonEditor from "@/components/editors/JsonEditor.vue"
import Assets from "./option-inputs/Assets.vue"
import BarcodePreview from "@/components/designer/BarcodePreview.vue"
import QrCodePreview from "@/components/designer/QrCodePreview.vue"

import {
  mdiArrowDown,
  mdiArrowUp,
  mdiBarcode,
  mdiBroom,
  mdiCodeTags,
  mdiCogOutline,
  mdiContentCopy,
  mdiContentSaveOutline,
  mdiDeleteOutline,
  mdiDrag,
  mdiEyeOutline,
  mdiFileDocumentOutline,
  mdiFileImagePlusOutline,
  mdiFolderOutline,
  mdiFormatTitle,
  mdiImageAutoAdjust,
  mdiInformationOutline,
  mdiOpenInNew,
  mdiPackageVariant,
  mdiPlus,
  mdiQrcode,
  mdiTableLarge,
  mdiTextBoxOutline,
  mdiTurtle,
  mdiViewDashboardOutline,
} from "@quasar/extras/mdi-v6"

import { useBundleHandling } from "./composables/bundle-handling"
import { usePdfRendering } from "./composables/pdf-rendering"
import { createDebounce } from "@/utils/debounce"
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue"
import { getBaseRenderData } from "@/models/render-data-base"
import { QFile } from "quasar"

type ComponentType = "heading" | "paragraph" | "metric" | "table" | "qr" | "barcode" | "divider"
type Align = "left" | "center" | "right"
type PositionMode = "flow" | "absolute"
type ValueSource = "static" | "field"
type BarcodeFormat = "CODE128" | "EAN13" | "EAN8" | "CODE39"
type PageFormat = NonNullable<RenderOptions["pageFormat"]>

type TableColumn = {
  id: string
  label: string
  field: string
}

type DesignerComponentProps = {
  align?: Align
  backgroundColor?: string
  barcodeFormat?: BarcodeFormat
  color?: string
  columns?: TableColumn[]
  content?: string
  field?: string
  fontSize?: number
  height?: number
  label?: string
  layoutHeight?: number
  layoutWidth?: number
  layoutSpan?: number
  marginBottom?: number
  positionMode?: PositionMode
  rowsPath?: string
  size?: number
  striped?: boolean
  suffix?: string
  text?: string
  thickness?: number
  title?: string
  valueSource?: ValueSource
  valueText?: string
  width?: number
  x?: number
  y?: number
}

type DesignerComponent = {
  id: string
  type: ComponentType
  name: string
  description: string
  icon: string
  props: DesignerComponentProps
}

type ComponentLibraryItem = {
  type: ComponentType
  name: string
  description: string
  icon: string
  defaults: () => DesignerComponentProps
}

type PlaygroundDraft = {
  version: 1
  designerTitle?: string
  components?: unknown[]
  htmlTemplate?: string
  modelStr?: string
  options?: Record<string, unknown>
  templateSource?: "designer" | "manual"
}

const pageSizes: PageFormat[] = ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "Letter", "Legal"]
const workbenchTab = ref<"design" | "preview" | "code">("design")
const codeTab = ref<"body" | "model" | "request">("body")
const designerTitle = ref("销售报表")
const selectedComponentId = ref("")
const draggedComponentId = ref("")
const canvasPage = ref<HTMLElement>()
const requestPayloadJson = ref("")
const templateSource = ref<"designer" | "manual">("designer")
const isApplyingRequestPayload = ref(false)
const isRefreshingRequestPayload = ref(false)
const isUpdatingHtmlTemplateFromDesigner = ref(false)
const isRestoringDraft = ref(false)

const {
  renderTemplateData,
  settings,
  isLoading,
  hasError,
  errMsg,
  requestTimeInMs,
  renderLog,
  renderLogTruncated,
  pdfResponseDataUrl,
  requestPdf,
} = usePdfRendering()
const { bundleFileInputModel, saveBundle } = useBundleHandling(renderTemplateData)

const MM_TO_PX = 96 / 25.4
const DEFAULT_CONTENT_WIDTH_PX = 604
const COMPONENT_GAP_PX = 12
const playgroundDraftStorageKey = "pdf-turtle-playground-draft"
const saveDraftDebounce = createDebounce()
const pageSizeInMm: Record<string, { width: number; height: number }> = {
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  A6: { width: 105, height: 148 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
}

const alignOptions = [
  { label: "居左", value: "left" },
  { label: "居中", value: "center" },
  { label: "居右", value: "right" },
]

const layoutWidthOptions = computed(() => {
  const fullWidth = contentWidthPx.value
  return [
    { label: "整行", value: fullWidth },
    { label: "1/2", value: shortcutWidth(fullWidth, 2) },
    { label: "1/3", value: shortcutWidth(fullWidth, 3) },
    { label: "1/4", value: shortcutWidth(fullWidth, 4) },
  ]
})

const positionModeOptions = [
  { label: "流式排版", value: "flow" },
  { label: "自定义坐标", value: "absolute" },
]

const barcodeFormatOptions: { label: string; value: BarcodeFormat }[] = [
  { label: "CODE128", value: "CODE128" },
  { label: "EAN13", value: "EAN13" },
  { label: "EAN8", value: "EAN8" },
  { label: "CODE39", value: "CODE39" },
]

const sampleModel = {
  title: "销售报表",
  remark: "本报表展示本周期销售概览、订单明细和扫码信息，可用于经营复盘。",
  qrContent: "https://github.com/lucas-gaitzsch/pdf-turtle",
  barcodeValue: "PT-20260628-001",
  summary: {
    totalSales: 32993,
    salesPerWeek: 82,
    performanceIndex: 5.132,
    salesVolume: 848932,
  },
  sales: [
    {
      orderNumber: 10107,
      productLine: "Motorcycles",
      customerName: "Land of Toys Inc.",
      country: "USA",
      quantityOrdered: 30,
      priceEach: 95.7,
      status: "Shipped",
    },
    {
      orderNumber: 10121,
      productLine: "Motorcycles",
      customerName: "Reims Collectables",
      country: "France",
      quantityOrdered: 34,
      priceEach: 81.35,
      status: "Shipped",
    },
    {
      orderNumber: 10134,
      productLine: "Classic Cars",
      customerName: "Mini Gifts Distributors Ltd.",
      country: "USA",
      quantityOrdered: 41,
      priceEach: 94.74,
      status: "Shipped",
    },
  ],
}

const componentLibrary: ComponentLibraryItem[] = [
  {
    type: "heading",
    name: "标题",
    description: "报表标题",
    icon: mdiFormatTitle,
    defaults: () => ({
      text: "销售报表",
      valueSource: "static",
      field: "title",
      align: "left",
      fontSize: 30,
      color: "#111827",
      layoutHeight: 0,
      layoutWidth: DEFAULT_CONTENT_WIDTH_PX,
      marginBottom: 12,
      positionMode: "flow",
      x: 0,
      y: 0,
    }),
  },
  {
    type: "paragraph",
    name: "文本",
    description: "说明内容",
    icon: mdiTextBoxOutline,
    defaults: () => ({
      text: "这里填写报表说明、备注或业务摘要。",
      valueSource: "static",
      field: "remark",
      align: "left",
      fontSize: 13,
      color: "#4b5563",
      layoutHeight: 0,
      layoutWidth: DEFAULT_CONTENT_WIDTH_PX,
      marginBottom: 14,
      positionMode: "flow",
      x: 0,
      y: 0,
    }),
  },
  {
    type: "metric",
    name: "指标卡",
    description: "关键数字",
    icon: mdiViewDashboardOutline,
    defaults: () => ({
      label: "总销售额",
      valueSource: "field",
      field: "summary.totalSales",
      valueText: "32993",
      suffix: " 元",
      align: "left",
      backgroundColor: "#eef6ff",
      color: "#1d4ed8",
      layoutHeight: 0,
      layoutWidth: shortcutWidth(DEFAULT_CONTENT_WIDTH_PX, 2),
      marginBottom: 14,
      positionMode: "flow",
      x: 0,
      y: 0,
    }),
  },
  {
    type: "table",
    name: "明细表格",
    description: "列表数据",
    icon: mdiTableLarge,
    defaults: () => ({
      title: "订单明细",
      rowsPath: "sales",
      align: "left",
      striped: true,
      layoutHeight: 0,
      layoutWidth: DEFAULT_CONTENT_WIDTH_PX,
      marginBottom: 14,
      positionMode: "flow",
      x: 0,
      y: 0,
      columns: [
        createColumn("订单号", "orderNumber"),
        createColumn("客户", "customerName"),
        createColumn("国家", "country"),
        createColumn("数量", "quantityOrdered"),
        createColumn("状态", "status"),
      ],
    }),
  },
  {
    type: "qr",
    name: "二维码",
    description: "QR Code",
    icon: mdiQrcode,
    defaults: () => ({
      content: "https://github.com/lucas-gaitzsch/pdf-turtle",
      valueSource: "static",
      field: "qrContent",
      size: 104,
      align: "left",
      layoutHeight: 0,
      layoutWidth: shortcutWidth(DEFAULT_CONTENT_WIDTH_PX, 2),
      marginBottom: 14,
      positionMode: "flow",
      x: 0,
      y: 0,
    }),
  },
  {
    type: "barcode",
    name: "条形码",
    description: "CODE128 条码",
    icon: mdiBarcode,
    defaults: () => ({
      content: "PT-20260628-001",
      valueSource: "static",
      field: "barcodeValue",
      barcodeFormat: "CODE128",
      width: 190,
      height: 58,
      align: "left",
      layoutHeight: 0,
      layoutWidth: shortcutWidth(DEFAULT_CONTENT_WIDTH_PX, 2),
      marginBottom: 14,
      positionMode: "flow",
      x: 0,
      y: 0,
    }),
  },
  {
    type: "divider",
    name: "分隔线",
    description: "横向分隔",
    icon: mdiMinusIcon(),
    defaults: () => ({
      align: "left",
      color: "#d1d5db",
      thickness: 1,
      layoutHeight: 0,
      layoutWidth: DEFAULT_CONTENT_WIDTH_PX,
      marginBottom: 14,
      positionMode: "flow",
      x: 0,
      y: 0,
    }),
  },
]

const designerComponents = reactive<DesignerComponent[]>([
  createComponent("heading"),
  createComponent("paragraph"),
  createComponent("metric"),
  createComponent("table"),
  createComponent("qr"),
])

const uploadBundle = ref<QFile>()
const selectedComponent = computed(() => designerComponents.find((component) => component.id === selectedComponentId.value))
const selectedColumns = computed(() => selectedComponent.value?.props.columns ?? [])
const modelObject = computed(() => parseModel(renderTemplateData.modelStr))
const fieldOptions = computed(() => collectFields(modelObject.value).filter((field) => !field.includes("[].")))
const arrayFieldOptions = computed(() => collectArrayFields(modelObject.value))
const pageWidthPx = computed(() => getPageSizePx().width)
const pageHeightPx = computed(() => getPageSizePx().height)
const contentWidthPx = computed(() => getContentSizePx().width)
const contentHeightPx = computed(() => getContentSizePx().height)
const pageMarginPx = computed(() => getMarginSizePx())
const useCustomPageSize = computed({
  get: () => Boolean(renderTemplateData.options.pageSize?.width && renderTemplateData.options.pageSize?.height),
  set: (enabled: boolean) => {
    renderTemplateData.options.pageSize = enabled ? { ...getPageSizeMm() } : undefined
  },
})
const customPageWidth = computed({
  get: () => renderTemplateData.options.pageSize?.width ?? getPageSizeMm().width,
  set: (width: number | undefined) => {
    renderTemplateData.options.pageSize = {
      height: renderTemplateData.options.pageSize?.height ?? getPageSizeMm().height,
      width: clampInteger(width, 20, 2000, getPageSizeMm().width),
    }
  },
})
const customPageHeight = computed({
  get: () => renderTemplateData.options.pageSize?.height ?? getPageSizeMm().height,
  set: (height: number | undefined) => {
    renderTemplateData.options.pageSize = {
      height: clampInteger(height, 20, 3000, getPageSizeMm().height),
      width: renderTemplateData.options.pageSize?.width ?? getPageSizeMm().width,
    }
  },
})
const canvasPaperStyle = computed(() => {
  const margins = pageMarginPx.value
  return {
    boxSizing: "border-box",
    minHeight: `${pageHeightPx.value}px`,
    padding: `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`,
    width: `${pageWidthPx.value}px`,
  }
})
const canvasPageStyle = computed(() => ({
  minHeight: `${contentHeightPx.value}px`,
  width: `${contentWidthPx.value}px`,
}))

type CoordinateDragState = {
  component: DesignerComponent
  canvasRect: DOMRect
  offsetX: number
  offsetY: number
  width: number
  height: number
}

let coordinateDragState: CoordinateDragState | null = null

function mdiMinusIcon() {
  return "M19,13H5V11H19V13Z"
}

function shortcutWidth(fullWidth: number, parts: number) {
  return Math.max(1, Math.round((fullWidth - COMPONENT_GAP_PX * (parts - 1)) / parts))
}

function getContentSizePx() {
  const page = getPageSizePx()
  const margins = getMarginSizePx()

  return {
    width: Math.max(1, page.width - margins.left - margins.right),
    height: Math.max(1, page.height - margins.top - margins.bottom),
  }
}

function getPageSizePx() {
  const size = getPageSizeMm()
  const widthMm = renderTemplateData.options.landscape ? size.height : size.width
  const heightMm = renderTemplateData.options.landscape ? size.width : size.height

  return {
    width: Math.max(1, Math.round(widthMm * MM_TO_PX)),
    height: Math.max(1, Math.round(heightMm * MM_TO_PX)),
  }
}

function getMarginSizePx() {
  const margins = renderTemplateData.options.margins
  return {
    top: Math.max(0, Math.round((margins.top ?? 0) * MM_TO_PX)),
    right: Math.max(0, Math.round((margins.right ?? 0) * MM_TO_PX)),
    bottom: Math.max(0, Math.round((margins.bottom ?? 0) * MM_TO_PX)),
    left: Math.max(0, Math.round((margins.left ?? 0) * MM_TO_PX)),
  }
}

function getPageSizeMm() {
  const customWidth = renderTemplateData.options.pageSize?.width
  const customHeight = renderTemplateData.options.pageSize?.height
  if (customWidth && customHeight) {
    return { width: customWidth, height: customHeight }
  }

  return pageSizeInMm[renderTemplateData.options.pageFormat] ?? pageSizeInMm.A4
}

function createId() {
  return crypto.randomUUID()
}

function createColumn(label: string, field: string): TableColumn {
  return {
    id: createId(),
    label,
    field,
  }
}

function cloneProps(props: DesignerComponentProps): DesignerComponentProps {
  return {
    ...props,
    columns: props.columns?.map((column) => ({ ...column, id: createId() })),
  }
}

function cloneSerializableProps(props: DesignerComponentProps): DesignerComponentProps {
  return {
    ...props,
    columns: props.columns?.map((column) => ({ ...column })),
  }
}

function createComponent(type: ComponentType): DesignerComponent {
  const item = componentLibrary.find((libraryItem) => libraryItem.type === type)
  if (!item) {
    throw new Error(`Unknown component type: ${type}`)
  }

  return {
    id: createId(),
    type: item.type,
    name: item.name,
    description: item.description,
    icon: item.icon,
    props: cloneProps(item.defaults()),
  }
}

function normalizeDraftComponent(value: unknown): DesignerComponent | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null
  }

  const item = componentLibrary.find((libraryItem) => libraryItem.type === value.type)
  if (!item) {
    return null
  }

  const rawProps = isRecord(value.props) ? value.props : {}
  const defaults = item.defaults()
  const columns = Array.isArray(rawProps.columns)
    ? rawProps.columns.filter(isRecord).map((column) => ({
        id: typeof column.id === "string" ? column.id : createId(),
        label: typeof column.label === "string" ? column.label : "列",
        field: typeof column.field === "string" ? column.field : "",
      }))
    : defaults.columns

  return {
    id: typeof value.id === "string" ? value.id : createId(),
    type: item.type,
    name: item.name,
    description: item.description,
    icon: item.icon,
    props: {
      ...defaults,
      ...(rawProps as DesignerComponentProps),
      columns,
    },
  }
}

function createDraft(): PlaygroundDraft {
  return {
    version: 1,
    designerTitle: designerTitle.value,
    components: designerComponents.map((component) => ({
      id: component.id,
      type: component.type,
      props: cloneSerializableProps(component.props),
    })),
    htmlTemplate: renderTemplateData.htmlTemplate ?? "",
    modelStr: renderTemplateData.modelStr,
    options: JSON.parse(JSON.stringify(renderTemplateData.options)) as Record<string, unknown>,
    templateSource: templateSource.value,
  }
}

function saveDraftToLocalStorage() {
  if (isRestoringDraft.value) {
    return
  }

  localStorage.setItem(playgroundDraftStorageKey, JSON.stringify(createDraft()))
}

function scheduleSaveDraft() {
  saveDraftDebounce(() => saveDraftToLocalStorage(), 200)
}

function loadDraftFromLocalStorage() {
  const rawDraft = localStorage.getItem(playgroundDraftStorageKey)
  if (!rawDraft) {
    return false
  }

  let draft: unknown
  try {
    draft = JSON.parse(rawDraft)
  } catch {
    localStorage.removeItem(playgroundDraftStorageKey)
    return false
  }

  if (!isRecord(draft) || draft.version !== 1) {
    return false
  }

  isRestoringDraft.value = true
  Object.assign(renderTemplateData, getBaseRenderData(true))
  renderTemplateData.templateEngine = "golang"
  renderTemplateData.headerHtmlTemplate = ""
  renderTemplateData.footerHtmlTemplate = ""
  renderTemplateData.assets = []
  renderTemplateData.modelStr = typeof draft.modelStr === "string" ? draft.modelStr : JSON.stringify(sampleModel, null, 2)
  renderTemplateData.htmlTemplate = typeof draft.htmlTemplate === "string" ? draft.htmlTemplate : ""

  if (isRecord(draft.options)) {
    applyRenderOptions(draft.options)
  }

  designerTitle.value = typeof draft.designerTitle === "string" ? draft.designerTitle : "销售报表"
  templateSource.value = draft.templateSource === "manual" ? "manual" : "designer"
  selectedComponentId.value = ""
  designerComponents.splice(
    0,
    designerComponents.length,
    ...(Array.isArray(draft.components) ? draft.components : [])
      .map(normalizeDraftComponent)
      .filter((component): component is DesignerComponent => component !== null)
  )

  syncDesignerState(templateSource.value === "designer")
  refreshRequestPayloadJson()
  queueMicrotask(() => {
    isRestoringDraft.value = false
  })
  return true
}

function addComponent(type: ComponentType) {
  const component = createComponent(type)
  designerComponents.push(component)
  selectComponent(component.id)
}

function selectComponent(id: string) {
  selectedComponentId.value = id
}

function clearSelectedComponent() {
  selectedComponentId.value = ""
}

function openBundlePicker() {
  uploadBundle.value?.$el.click()
}

function loadEmptyData() {
  Object.assign(renderTemplateData, getBaseRenderData(true))
  renderTemplateData.templateEngine = "golang"
  renderTemplateData.modelStr = JSON.stringify({}, null, 2)
  renderTemplateData.headerHtmlTemplate = ""
  renderTemplateData.footerHtmlTemplate = ""
  designerTitle.value = "空白模板"
  selectedComponentId.value = ""
  designerComponents.splice(0)
  syncDesignerState(true)
}

function loadSampleData() {
  Object.assign(renderTemplateData, getBaseRenderData(true))
  renderTemplateData.templateEngine = "golang"
  renderTemplateData.modelStr = JSON.stringify(sampleModel, null, 2)
  renderTemplateData.options.pageFormat = "A4"
  renderTemplateData.options.landscape = false
  renderTemplateData.headerHtmlTemplate = ""
  renderTemplateData.footerHtmlTemplate = ""
  designerTitle.value = "销售报表"
  selectedComponentId.value = ""
  designerComponents.splice(
    0,
    designerComponents.length,
    createComponent("heading"),
    createComponent("paragraph"),
    createComponent("metric"),
    createComponent("table"),
    createComponent("qr")
  )
  syncDesignerState(true)
}

function renderLogLevelColor(level: string) {
  switch (level) {
    case "error":
      return "negative"
    case "warning":
    case "warn":
      return "warning"
    case "info":
    case "log":
      return "primary"
    default:
      return "grey"
  }
}

function onLibraryDragStart(event: DragEvent, type: ComponentType) {
  event.dataTransfer?.setData("application/pdf-turtle-component", type)
  event.dataTransfer?.setData("text/plain", type)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "copy"
  }
}

function onCanvasDrop(event: DragEvent) {
  const type = event.dataTransfer?.getData("application/pdf-turtle-component") as ComponentType
  if (type) {
    addComponent(type)
  }
}

function onComponentDragStart(event: DragEvent, id: string) {
  const component = designerComponents.find((item) => item.id === id)
  if (component?.props.positionMode === "absolute") {
    event.preventDefault()
    return
  }

  draggedComponentId.value = id
  event.dataTransfer?.setData("application/pdf-turtle-existing-component", id)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move"
  }
}

function onComponentDrop(event: DragEvent, targetIndex: number) {
  const newType = event.dataTransfer?.getData("application/pdf-turtle-component") as ComponentType
  if (newType) {
    const component = createComponent(newType)
    designerComponents.splice(targetIndex, 0, component)
    selectComponent(component.id)
    return
  }

  const sourceId = event.dataTransfer?.getData("application/pdf-turtle-existing-component") || draggedComponentId.value
  const sourceIndex = designerComponents.findIndex((component) => component.id === sourceId)
  if (sourceIndex < 0 || sourceIndex === targetIndex) {
    return
  }

  const [component] = designerComponents.splice(sourceIndex, 1)
  const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  designerComponents.splice(insertIndex, 0, component)
}

function onComponentPointerDown(event: PointerEvent, component: DesignerComponent) {
  selectComponent(component.id)

  if (component.props.positionMode !== "absolute" || event.button !== 0 || isInteractiveTarget(event.target)) {
    return
  }

  const element = event.currentTarget
  const canvas = canvasPage.value
  if (!(element instanceof HTMLElement) || !canvas) {
    return
  }

  const componentRect = element.getBoundingClientRect()
  const canvasRect = canvas.getBoundingClientRect()
  coordinateDragState = {
    component,
    canvasRect,
    offsetX: event.clientX - componentRect.left,
    offsetY: event.clientY - componentRect.top,
    width: componentRect.width,
    height: componentRect.height,
  }

  element.setPointerCapture?.(event.pointerId)
  window.addEventListener("pointermove", onCoordinateDragMove)
  window.addEventListener("pointerup", onCoordinateDragEnd, { once: true })
  window.addEventListener("pointercancel", onCoordinateDragEnd, { once: true })
  event.preventDefault()
}

function onCoordinateDragMove(event: PointerEvent) {
  if (!coordinateDragState) {
    return
  }

  const { component, canvasRect, offsetX, offsetY, width, height } = coordinateDragState
  component.props.x = clampInteger(event.clientX - canvasRect.left - offsetX, 0, Math.max(0, contentWidthPx.value - width), 0)
  component.props.y = clampInteger(event.clientY - canvasRect.top - offsetY, 0, Math.max(0, contentHeightPx.value - height), 0)
}

function onCoordinateDragEnd() {
  coordinateDragState = null
  window.removeEventListener("pointermove", onCoordinateDragMove)
  window.removeEventListener("pointerup", onCoordinateDragEnd)
  window.removeEventListener("pointercancel", onCoordinateDragEnd)
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button, input, textarea, select, .el-input, .el-select"))
}

function moveComponent(index: number, offset: -1 | 1) {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= designerComponents.length) {
    return
  }

  const [component] = designerComponents.splice(index, 1)
  designerComponents.splice(targetIndex, 0, component)
}

function duplicateComponent(id: string) {
  const index = designerComponents.findIndex((component) => component.id === id)
  if (index < 0) {
    return
  }

  const source = designerComponents[index]
  const duplicate: DesignerComponent = {
    ...source,
    id: createId(),
    props: cloneProps(source.props),
  }
  designerComponents.splice(index + 1, 0, duplicate)
  selectComponent(duplicate.id)
}

function removeComponent(id: string) {
  const index = designerComponents.findIndex((component) => component.id === id)
  if (index < 0) {
    return
  }

  designerComponents.splice(index, 1)
  if (selectedComponentId.value === id) {
    selectedComponentId.value = designerComponents[Math.min(index, designerComponents.length - 1)]?.id ?? ""
  }
}

function addTableColumn() {
  if (!selectedComponent.value) {
    return
  }

  const columns = selectedComponent.value.props.columns ?? []
  columns.push(createColumn("新列", "field"))
  selectedComponent.value.props.columns = columns
}

function removeTableColumn(index: number) {
  selectedColumns.value.splice(index, 1)
}

function componentShellStyle(component: DesignerComponent) {
  const layoutWidth = getLayoutWidth(component)
  const layoutHeight = getLayoutHeight(component)

  if (component.props.positionMode === "absolute") {
    const maxX = Math.max(0, contentWidthPx.value - layoutWidth)
    const maxY = Math.max(0, contentHeightPx.value - layoutHeight)

    return {
      cursor: "move",
      flex: "none",
      left: `${clampInteger(component.props.x, 0, maxX, 0)}px`,
      position: "absolute",
      top: `${clampInteger(component.props.y, 0, maxY, 0)}px`,
      width: `${layoutWidth}px`,
      zIndex: component.id === selectedComponentId.value ? 2 : 1,
    }
  }

  return {
    flex: "0 0 auto",
    width: `${layoutWidth}px`,
  }
}

function componentBoxStyle(component: DesignerComponent) {
  const layoutHeight = getLayoutHeight(component)

  return {
    boxSizing: "border-box",
    height: layoutHeight > 0 ? `${layoutHeight}px` : undefined,
    marginBottom: `${component.props.marginBottom ?? 0}px`,
    overflow: layoutHeight > 0 ? "hidden" : undefined,
  }
}

function getLayoutHeight(component: DesignerComponent): number {
  return clampInteger(component.props.layoutHeight, 0, 3000, 0)
}

function getLayoutWidth(component: DesignerComponent): number {
  const widthFromSpan = component.props.layoutSpan ? Math.round((component.props.layoutSpan / 12) * contentWidthPx.value) : undefined
  return clampInteger(component.props.layoutWidth ?? widthFromSpan, 1, 3000, DEFAULT_CONTENT_WIDTH_PX)
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numberValue)) {
    return fallback
  }
  return Math.min(Math.max(Math.round(numberValue), min), max)
}

function textStyle(component: DesignerComponent) {
  return {
    color: component.props.color,
    fontSize: `${component.props.fontSize ?? 14}px`,
    textAlign: component.props.align,
  }
}

function metricStyle(component: DesignerComponent) {
  return {
    backgroundColor: component.props.backgroundColor,
    color: component.props.color,
    textAlign: component.props.align,
  }
}

function dividerStyle(component: DesignerComponent) {
  return {
    border: "0",
    borderTop: `${component.props.thickness ?? 1}px solid ${component.props.color ?? "#d1d5db"}`,
    marginBottom: `${component.props.marginBottom ?? 0}px`,
  }
}

function metricPreviewValue(component: DesignerComponent) {
  const value =
    component.props.valueSource === "field"
      ? getValueByPath(modelObject.value, component.props.field ?? "")
      : component.props.valueText
  return `${value ?? ""}${component.props.suffix ?? ""}`
}

function textPreviewValue(component: DesignerComponent) {
  if (component.props.valueSource === "field") {
    const value = getValueByPath(modelObject.value, component.props.field ?? "")
    return value == null ? "" : String(value)
  }

  return component.props.text ?? ""
}

function codePreviewValue(component: DesignerComponent) {
  if (component.props.valueSource === "field") {
    const value = getValueByPath(modelObject.value, component.props.field ?? "")
    return value == null ? "" : String(value)
  }

  return component.props.content ?? ""
}

function sampleRows(component: DesignerComponent) {
  const rows = getValueByPath(modelObject.value, component.props.rowsPath ?? "")
  return Array.isArray(rows) ? rows.slice(0, 3) : []
}

function parseModel(modelStr: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(modelStr) as unknown
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getValueByPath(source: unknown, path: string) {
  if (!path) {
    return ""
  }

  return path.split(".").reduce<unknown>((current, key) => {
    if (!isRecord(current)) {
      return undefined
    }
    return current[key]
  }, source)
}

function collectFields(source: unknown, prefix = ""): string[] {
  if (Array.isArray(source)) {
    const first = source[0]
    return isRecord(first) ? collectFields(first, prefix ? `${prefix}[].` : "[].") : []
  }
  if (!isRecord(source)) {
    return []
  }

  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}${key}` : key
    if (Array.isArray(value)) {
      return [path, ...collectFields(value, `${path}.`)]
    }
    if (isRecord(value)) {
      return [path, ...collectFields(value, `${path}.`)]
    }
    return [path]
  })
}

function collectArrayFields(source: unknown, prefix = ""): string[] {
  if (!isRecord(source)) {
    return []
  }

  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(value)) {
      return [path]
    }
    if (isRecord(value)) {
      return collectArrayFields(value, path)
    }
    return []
  })
}

function updateHtmlTemplateFromEditor(value: string) {
  renderTemplateData.htmlTemplate = value
  renderTemplateData.templateEngine = "golang"
  renderTemplateData.headerHtmlTemplate = ""
  renderTemplateData.footerHtmlTemplate = ""

  if (!isUpdatingHtmlTemplateFromDesigner.value) {
    templateSource.value = "manual"
  }
}

function createRequestPayloadJson() {
  return JSON.stringify(
    {
      options: renderTemplateData.options,
      htmlTemplate: renderTemplateData.htmlTemplate ?? "",
    },
    null,
    2
  )
}

function refreshRequestPayloadJson() {
  isRefreshingRequestPayload.value = true
  requestPayloadJson.value = createRequestPayloadJson()
  queueMicrotask(() => {
    isRefreshingRequestPayload.value = false
  })
}

function applyRequestPayloadJson(value: string) {
  if (isApplyingRequestPayload.value || isRefreshingRequestPayload.value || !value.trim()) {
    return
  }

  let payload: unknown
  try {
    payload = JSON.parse(value)
  } catch {
    return
  }

  if (!isRecord(payload)) {
    return
  }

  isApplyingRequestPayload.value = true

  if (typeof payload.htmlTemplate === "string") {
    renderTemplateData.htmlTemplate = payload.htmlTemplate
    templateSource.value = "manual"
  }

  if (isRecord(payload.options)) {
    applyRenderOptions(payload.options)
  }

  renderTemplateData.templateEngine = "golang"
  renderTemplateData.headerHtmlTemplate = ""
  renderTemplateData.footerHtmlTemplate = ""

  queueMicrotask(() => {
    isApplyingRequestPayload.value = false
  })
}

function applyRenderOptions(options: Record<string, unknown>) {
  if (typeof options.pageFormat === "string" && pageSizes.includes(options.pageFormat as PageFormat)) {
    renderTemplateData.options.pageFormat = options.pageFormat as PageFormat
  }

  if (typeof options.landscape === "boolean") {
    renderTemplateData.options.landscape = options.landscape
  }

  if (typeof options.excludeBuiltinStyles === "boolean") {
    renderTemplateData.options.excludeBuiltinStyles = options.excludeBuiltinStyles
  }

  if (isRecord(options.pageSize)) {
    const width = clampInteger(options.pageSize.width, 20, 2000, 0)
    const height = clampInteger(options.pageSize.height, 20, 3000, 0)
    renderTemplateData.options.pageSize = width > 0 && height > 0 ? { width, height } : undefined
  } else if ("pageSize" in options) {
    renderTemplateData.options.pageSize = undefined
  }

  if (isRecord(options.margins)) {
    renderTemplateData.options.margins = {
      top: clampInteger(options.margins.top, 0, 300, renderTemplateData.options.margins.top ?? 25),
      right: clampInteger(options.margins.right, 0, 300, renderTemplateData.options.margins.right ?? 25),
      bottom: clampInteger(options.margins.bottom, 0, 300, renderTemplateData.options.margins.bottom ?? 20),
      left: clampInteger(options.margins.left, 0, 300, renderTemplateData.options.margins.left ?? 25),
    }
  }
}

function syncGeneratedTemplate() {
  isUpdatingHtmlTemplateFromDesigner.value = true
  renderTemplateData.templateEngine = "golang"
  renderTemplateData.htmlTemplate = createBodyTemplate()
  renderTemplateData.headerHtmlTemplate = ""
  renderTemplateData.footerHtmlTemplate = ""
  queueMicrotask(() => {
    isUpdatingHtmlTemplateFromDesigner.value = false
  })
}

function syncDesignerState(forceTemplate = false) {
  designerComponents.forEach(clampComponentCoordinates)
  renderTemplateData.templateEngine = "golang"
  renderTemplateData.headerHtmlTemplate = ""
  renderTemplateData.footerHtmlTemplate = ""

  if (forceTemplate || templateSource.value === "designer") {
    templateSource.value = "designer"
    syncGeneratedTemplate()
  }
}

function clampComponentCoordinates(component: DesignerComponent) {
  component.props.layoutWidth = getLayoutWidth(component)

  if (component.props.positionMode !== "absolute") {
    return
  }

  const maxX = Math.max(0, contentWidthPx.value - getLayoutWidth(component))
  const maxY = Math.max(0, contentHeightPx.value - getLayoutHeight(component))
  component.props.x = clampInteger(component.props.x, 0, maxX, 0)
  component.props.y = clampInteger(component.props.y, 0, maxY, 0)
}

function createBodyTemplate() {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    html,
    body {
      margin: 0;
      padding: 0;
    }
    body.visual-report {
      color: #111827;
      font-family: Arial, "Microsoft YaHei", sans-serif;
      font-size: 12pt;
      line-height: 1.45;
      margin: 0;
      padding: 0;
    }
    .visual-grid {
      display: flex;
      flex-wrap: wrap;
      column-gap: 12px;
      row-gap: 0;
      align-content: flex-start;
      align-items: start;
      box-sizing: border-box;
      height: ${contentHeightPx.value}px;
      min-height: ${contentHeightPx.value}px;
      position: relative;
      width: ${contentWidthPx.value}px;
    }
    .visual-block {
      box-sizing: border-box;
      flex: 0 0 auto;
      min-width: 0;
    }
    .metric-card {
      border: 1px solid #dbe3ee;
      border-radius: 6px;
      box-sizing: border-box;
      padding: 12px 14px;
    }
    .metric-card span {
      display: block;
      color: #64748b;
      font-size: 10pt;
      margin-bottom: 4px;
    }
    .metric-card strong {
      display: block;
      font-size: 22pt;
      line-height: 1.1;
    }
    .report-table h3 {
      margin: 0 0 8px;
      font-size: 14pt;
    }
    .report-table table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 10pt;
    }
    .report-table th,
    .report-table td {
      border: 1px solid #d7dee8;
      padding: 6px 8px;
      text-align: left;
      word-break: break-word;
    }
    .report-table th {
      background: #f1f5f9;
      font-weight: 700;
    }
    .report-table.striped tr:nth-child(even) td {
      background: #f8fafc;
    }
    .code-block svg {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body class="visual-report pdf-turtle">
<div class="visual-grid">
${designerComponents.map(componentToHtml).join("\n")}
</div>
</body>
</html>
`.trimStart()
}

function componentToHtml(component: DesignerComponent) {
  switch (component.type) {
    case "heading":
      return wrapComponentHtml(component, `<h1 style="${styleToString({
        margin: `0 0 ${component.props.marginBottom ?? 0}px`,
        color: component.props.color,
        fontSize: `${component.props.fontSize ?? 30}px`,
        lineHeight: "1.2",
        textAlign: component.props.align,
      })}">${textTemplateValue(component)}</h1>`)

    case "paragraph":
      return wrapComponentHtml(component, `<p style="${styleToString({
        margin: `0 0 ${component.props.marginBottom ?? 0}px`,
        color: component.props.color,
        fontSize: `${component.props.fontSize ?? 13}px`,
        textAlign: component.props.align,
        whiteSpace: "pre-wrap",
      })}">${textTemplateValue(component)}</p>`)

    case "metric":
      return wrapComponentHtml(component, `<div class="metric-card" style="${styleToString({
        margin: `0 0 ${component.props.marginBottom ?? 0}px`,
        backgroundColor: component.props.backgroundColor,
        color: component.props.color,
        textAlign: component.props.align,
      })}"><span>${escapeHtml(component.props.label ?? "")}</span><strong>${metricTemplateValue(component)}</strong></div>`)

    case "table":
      return wrapComponentHtml(component, tableToHtml(component))

    case "qr":
      return wrapComponentHtml(component, `<div class="code-block" style="${styleToString({
        margin: `0 0 ${component.props.marginBottom ?? 0}px`,
        textAlign: component.props.align,
      })}"><div style="display:inline-block; width:${component.props.size ?? 104}px; height:${
        component.props.size ?? 104
      }px;">{{ barcodeQr ${codeTemplateArgument(component)} }}</div></div>`)

    case "barcode":
      return wrapComponentHtml(component, `<div class="code-block" style="${styleToString({
        margin: `0 0 ${component.props.marginBottom ?? 0}px`,
        textAlign: component.props.align,
      })}"><div style="display:inline-block; width:${component.props.width ?? 190}px; height:${
        component.props.height ?? 58
      }px;">{{ ${barcodeTemplateFunction(component)} ${codeTemplateArgument(component)} }}</div></div>`)

    case "divider":
      return wrapComponentHtml(component, `<hr style="${styleToString({
        margin: `0 0 ${component.props.marginBottom ?? 0}px`,
        border: "0",
        borderTop: `${component.props.thickness ?? 1}px solid ${component.props.color ?? "#d1d5db"}`,
      })}"/>`)
  }
}

function wrapComponentHtml(component: DesignerComponent, html: string) {
  const layoutHeight = getLayoutHeight(component)
  const layoutWidth = getLayoutWidth(component)
  const wrapperStyles =
    component.props.positionMode === "absolute"
      ? {
          height: layoutHeight > 0 ? `${layoutHeight}px` : undefined,
          left: `${clampInteger(component.props.x, 0, Math.max(0, contentWidthPx.value - layoutWidth), 0)}px`,
          overflow: layoutHeight > 0 ? "hidden" : undefined,
          position: "absolute",
          top: `${clampInteger(component.props.y, 0, Math.max(0, contentHeightPx.value - layoutHeight), 0)}px`,
          width: `${layoutWidth}px`,
        }
      : {
          height: layoutHeight > 0 ? `${layoutHeight}px` : undefined,
          overflow: layoutHeight > 0 ? "hidden" : undefined,
          width: `${layoutWidth}px`,
        }

  return `<div class="visual-block" style="${styleToString(wrapperStyles)}">${html}</div>`
}

function textTemplateValue(component: DesignerComponent) {
  if (component.props.valueSource === "field") {
    return toTemplatePath(component.props.field ?? "")
  }

  return escapeHtml(component.props.text ?? "")
}

function metricTemplateValue(component: DesignerComponent) {
  const suffix = escapeHtml(component.props.suffix ?? "")
  if (component.props.valueSource === "field") {
    return `${toTemplatePath(component.props.field ?? "")}${suffix}`
  }
  return `${escapeHtml(component.props.valueText ?? "")}${suffix}`
}

function codeTemplateArgument(component: DesignerComponent) {
  if (component.props.valueSource === "field") {
    return toTemplateExpression(component.props.field ?? "") || `""`
  }

  return toGoString(component.props.content ?? "")
}

function barcodeTemplateFunction(component: DesignerComponent) {
  switch (component.props.barcodeFormat) {
    case "EAN8":
    case "EAN13":
      return "barcodeEan"
    case "CODE39":
      return "barcodeCode39"
    case "CODE128":
    default:
      return "barcodeCode128"
  }
}

function tableToHtml(component: DesignerComponent) {
  const columns = component.props.columns ?? []
  const rowsPath = toTemplateExpression(component.props.rowsPath ?? "") || "."
  const className = component.props.striped ? "report-table striped" : "report-table"

  return `<div class="${className}" style="${styleToString({
    margin: `0 0 ${component.props.marginBottom ?? 0}px`,
  })}">
  <h3>${escapeHtml(component.props.title ?? "")}</h3>
  <table>
    <thead>
      <tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      {{ range ${rowsPath} }}
      <tr>${columns.map((column) => `<td>${toTemplatePath(column.field)}</td>`).join("")}</tr>
      {{ end }}
    </tbody>
  </table>
</div>`
}

function toTemplatePath(path: string) {
  const expression = toTemplateExpression(path)
  return expression ? `{{ ${expression} }}` : ""
}

function toTemplateExpression(path: string) {
  const cleanPath = path
    .split(".")
    .map((part) => part.trim().replace(/[^A-Za-z0-9_]/g, ""))
    .filter(Boolean)
    .join(".")

  return cleanPath ? `.${cleanPath}` : ""
}

function toGoString(value: string) {
  return JSON.stringify(value)
}

function styleToString(styles: Record<string, string | number | undefined>) {
  return Object.entries(styles)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${toKebabCase(key)}:${value}`)
    .join(";")
}

function toKebabCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

watch([designerComponents, designerTitle], () => syncDesignerState(true), { deep: true })
watch([contentWidthPx, contentHeightPx], () => syncDesignerState())
watch(workbenchTab, (tab) => {
  if (tab === "preview") {
    syncDesignerState(templateSource.value === "designer")
    requestPdf()
  }
})
watch(codeTab, (tab) => {
  if (tab === "request") {
    refreshRequestPayloadJson()
  }
})
watch(requestPayloadJson, (value) => applyRequestPayloadJson(value))
watch(
  [() => renderTemplateData.htmlTemplate, () => renderTemplateData.options],
  () => {
    if (codeTab.value === "request" && !isApplyingRequestPayload.value) {
      refreshRequestPayloadJson()
    }
  },
  { deep: true }
)
watch(
  [
    designerComponents,
    designerTitle,
    templateSource,
    () => renderTemplateData.htmlTemplate,
    () => renderTemplateData.modelStr,
    () => renderTemplateData.options,
  ],
  () => scheduleSaveDraft(),
  { deep: true }
)

onBeforeUnmount(() => {
  onCoordinateDragEnd()
})

if (!loadDraftFromLocalStorage()) {
  loadSampleData()
}
refreshRequestPayloadJson()
requestPdf()
</script>

<style lang="scss">
.visual-builder {
  --panel-bg: rgba(255, 255, 255, 0.9);
  --panel-border: rgba(148, 163, 184, 0.34);
  --muted-text: #64748b;
  --strong-text: #111827;
  --workspace-bg: #e9edf3;

  min-height: inherit;
  height: 100%;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(135deg, rgba(230, 242, 255, 0.75), rgba(246, 248, 251, 0.9)),
    var(--workspace-bg);
  color: var(--strong-text);

  .builder-topbar {
    min-height: 66px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--panel-border);
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(8px);
  }

  .title-block {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 230px;
  }

  .app-title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.2;
  }

  .app-subtitle {
    color: var(--muted-text);
    font-size: 12px;
    line-height: 1.4;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .page-select {
    width: 116px;
  }

  .runtime {
    min-width: 42px;
    color: var(--muted-text);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .settings-menu {
    width: 320px;
    display: grid;
    gap: 12px;
    padding: 14px;
  }

  .builder-shell {
    min-height: 0;
    flex: 1;
    display: grid;
    grid-template-columns: 250px minmax(480px, 1fr) 330px;
    gap: 12px;
    padding: 12px;
  }

  .component-library,
  .property-panel,
  .workbench {
    min-height: 0;
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    background: var(--panel-bg);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  }

  .component-library,
  .property-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .panel-heading {
    min-height: 46px;
    display: flex;
    align-items: center;
    padding: 0 14px;
    border-bottom: 1px solid var(--panel-border);
    font-weight: 700;
  }

  .library-item {
    width: calc(100% - 20px);
    min-height: 68px;
    display: grid;
    grid-template-columns: 28px 1fr 22px;
    align-items: center;
    gap: 10px;
    margin: 10px;
    padding: 10px;
    border: 1px solid rgba(148, 163, 184, 0.34);
    border-radius: 8px;
    background: #fff;
    color: inherit;
    cursor: grab;
    text-align: left;

    &:hover {
      border-color: #2b78d0;
      background: #f8fbff;
    }

    span {
      min-width: 0;
      display: grid;
      gap: 2px;
    }

    strong {
      font-size: 14px;
    }

    small {
      color: var(--muted-text);
      font-size: 12px;
    }
  }

  .workbench {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .workbench-tabs {
    border-bottom: 1px solid var(--panel-border);
    background: rgba(248, 250, 252, 0.92);
  }

  .workbench-body {
    min-height: 0;
    flex: 1;
    position: relative;
  }

  .canvas-scroll,
  .pdf-container,
  .code-container {
    position: absolute;
    inset: 0;
  }

  .canvas-scroll {
    overflow: auto;
    padding: 20px;
  }

  .canvas-paper {
    margin: 0 auto;
    position: relative;
    background: #fff;
    border: 1px solid #d8dee8;
    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.14);
  }

  .canvas-page {
    min-height: 960px;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    align-items: flex-start;
    column-gap: 12px;
    row-gap: 0;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    position: relative;
    background: #ffffff;
    outline: 1px dashed #b7c1d0;
    outline-offset: -1px;
  }

  .empty-canvas {
    width: 100%;
    min-height: 240px;
    display: grid;
    place-items: center;
    border: 1px dashed #b7c1d0;
    color: #94a3b8;
    font-size: 18px;
  }

  .canvas-component {
    position: relative;
    min-width: 0;
    box-sizing: border-box;
    border-radius: 4px;
    outline: 1px solid transparent;
    outline-offset: 0;
    padding: 0;
    cursor: pointer;
    touch-action: none;
    user-select: none;

    &:hover,
    &.selected {
      outline-color: #2b78d0;
    }

    &.selected .component-actions,
    &:hover .component-actions {
      opacity: 1;
    }
  }

  .component-actions {
    position: absolute;
    top: -30px;
    left: 0;
    right: auto;
    min-width: min(100%, 260px);
    max-width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px;
    border: 1px solid #c7d2fe;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12);
    color: #475569;
    font-size: 12px;
    opacity: 0;
    pointer-events: auto;
    transition: opacity 0.12s ease;
    z-index: 8;

    span {
      min-width: 0;
      margin-right: auto;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    button {
      width: 24px;
      height: 24px;
      display: inline-grid;
      place-items: center;
      border: 1px solid #d7dee8;
      border-radius: 6px;
      background: #fff;
      color: #475569;
      cursor: pointer;

      &:hover {
        color: #1d4ed8;
        border-color: #93c5fd;
      }
    }
  }

  .drag-icon {
    color: #94a3b8;
  }

  .component-preview {
    min-height: 20px;
  }

  .preview-heading {
    font-weight: 800;
    line-height: 1.2;
  }

  .preview-paragraph {
    margin: 0;
    line-height: 1.55;
    white-space: pre-wrap;
  }

  .preview-metric {
    padding: 14px 16px;
    border: 1px solid #dbe3ee;
    border-radius: 8px;

    span {
      display: block;
      color: #64748b;
      font-size: 13px;
      margin-bottom: 5px;
    }

    strong {
      display: block;
      font-size: 30px;
      line-height: 1.1;
    }
  }

  .preview-table {
    h3 {
      margin: 0 0 8px;
      font-size: 18px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 13px;
    }

    th,
    td {
      border: 1px solid #d7dee8;
      padding: 7px 8px;
      text-align: left;
      word-break: break-word;
    }

    th {
      background: #f1f5f9;
      font-weight: 700;
    }
  }

  .code-preview {
    width: 100%;
  }

  .preview-divider {
    width: 100%;
  }

  .pdf-container {
    background: #7f8793;

    > * {
      position: absolute;
      height: 100%;
      width: 100%;
    }

    .loading-wrapper {
      z-index: 2;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px);
      color: #fff;
    }

    .error-state {
      max-width: 80%;
      text-align: center;
    }

    .pdf-viewer {
      z-index: 1;
      border: 0;
    }

    .pdf-fallback {
      box-sizing: border-box;
      padding: 32px;
      color: #111827;
      background: #fff;
    }
  }

  .code-container {
    display: flex;
    flex-direction: column;
    background: #fff;
  }

  .code-panels {
    min-height: 0;
    flex: 1;

    .q-tab-panel {
      height: 100%;
      padding: 0;
    }
  }

  .editor {
    height: 100%;
    width: 100%;
  }

  .property-scrollbar {
    min-height: 0;
    flex: 1;
  }

  .property-form {
    padding: 14px;
  }

  .property-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .dimension-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 10px;
  }

  .width-shortcuts {
    width: 100%;

    .el-segmented__item-label {
      white-space: nowrap;
    }
  }

  .column-editor {
    display: grid;
    gap: 10px;
  }

  .column-editor-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 700;
  }

  .column-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 6px;
    align-items: center;
  }

  .margin-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 10px;
  }
}

@media only screen and (max-width: 1180px) {
  .visual-builder {
    .builder-shell {
      grid-template-columns: 220px minmax(420px, 1fr);
    }

    .property-panel {
      grid-column: 1 / -1;
      min-height: 320px;
    }
  }
}

.render-log-menu {
  width: min(640px, calc(100vw - 32px));
  max-height: min(520px, calc(100vh - 96px));
  overflow: auto;

  .render-log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
  }

  .render-log-entry-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.82rem;
    color: rgba(0, 0, 0, 0.64);
  }

  .render-log-timestamp,
  .render-log-location {
    color: rgba(0, 0, 0, 0.48);
    font-size: 0.76rem;
  }

  .render-log-text {
    margin: 6px 0 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.82rem;
  }

  .render-log-empty {
    padding: 18px;
    color: rgba(0, 0, 0, 0.56);
  }
}

@media only screen and (max-width: 780px) {
  .visual-builder {
    .builder-topbar {
      align-items: flex-start;
      flex-direction: column;
    }

    .toolbar-actions {
      justify-content: flex-start;
    }

    .builder-shell {
      grid-template-columns: 1fr;
    }

    .component-library {
      max-height: 280px;
      overflow: auto;
    }

    .canvas-page {
      min-height: 720px;
    }
  }
}
</style>
