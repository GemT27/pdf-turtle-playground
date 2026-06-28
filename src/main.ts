import { createApp } from "vue"
import { Quasar, QuasarPluginOptions } from "quasar"
import quasarIconSet from "quasar/icon-set/svg-mdi-v6"
import ElementPlus from "element-plus"
import zhCn from "element-plus/es/locale/lang/zh-cn"

import { router } from "./router"

import "quasar/src/css/index.sass"
import "element-plus/dist/index.css"

import App from "./App.vue"

import "./worker/editorWorker"
import { client } from "./swagger-client/client.gen"
import { serverBaseUrl } from "./config/server"

client.setConfig({
  baseURL: serverBaseUrl,
  timeout: 30000,
})

createApp(App)
  .use(Quasar, <QuasarPluginOptions>{
    iconSet: quasarIconSet,
    plugins: {},
    config: {},
  })
  .use(ElementPlus, {
    locale: zhCn,
  })
  .use(router)
  .mount("#app")
