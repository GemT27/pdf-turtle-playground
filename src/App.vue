<template>
  <q-layout view="hHh lpR fFf" class="fit-in-view-height">
    <q-drawer
      :model-value="true"
      side="left"
      show-if-above
      :mini="miniState"
      @mouseover="miniState = false"
      @mouseout="miniState = true"
      mini-to-overlay
      :width="250"
      :mini-width="70"
      :breakpoint="200"
      bordered
      class="drawer"
    >
      <q-list padding>
        <q-item class="header">
          <q-item-section avatar class="icon">
            <q-icon :name="mdiTortoise" color="primary" size="38px" />
          </q-item-section>
          <q-item-section class="title text-primary">
            PdfTurtle
          </q-item-section>
        </q-item>
        <q-item clickable v-ripple :to="playgroundRoute" class="item" active-class="item-selected">
          <q-item-section avatar>
            <q-icon :name="mdiApplicationBracketsOutline" />
          </q-item-section>
          <q-item-section>设计器</q-item-section>
        </q-item>

        <q-item clickable v-ripple :to="aboutRoute" class="item" active-class="item-selected">
          <q-item-section avatar>
            <q-icon :name="mdiInformationOutline" />
          </q-item-section>
          <q-item-section>关于</q-item-section>
        </q-item>
      </q-list>

      <q-list>
        <q-item class="item" :href="swaggerUrl" target="_blank">
          <q-item-section avatar>
            <q-icon :name="mdiCodeBraces" />
          </q-item-section>
          <q-item-section>Swagger</q-item-section>
        </q-item>
        <q-item class="item" href="https://github.com/lucas-gaitzsch/pdf-turtle" target="_blank">
          <q-item-section avatar>
            <q-icon :name="mdiGithub" />
          </q-item-section>
          <q-item-section>源码</q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-page-container class="fit-in-view-height">
      <q-page class="fit-in-view-height">
        <router-view v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<style lang="scss">
.fit-in-view-height {
  height: 100vh;
}

.drawer {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 6px;

  .header {
    justify-content: start !important;
    padding: 0;

    .icon {
      padding-left: 10px !important;
      padding-right: 23px;
    }

    .title {
      font-weight: bold;
      font-size: 1.4em;
    }
  }

  .item {
    margin: 16px 0;
    border-radius: 64px;

    &.item-selected {
      background-color: #88888835;
    }
  }
}

.q-menu {
  background-color: rgba(255, 255, 255, 0.7) !important;
  backdrop-filter: blur(4px);
}
</style>

<script lang="ts">
import { defineComponent, provide, ref } from "vue"
import { routeNames } from "./router"
import { useQuasar } from "quasar"

import {
  mdiApplicationBracketsOutline,
  mdiInformationOutline,
  mdiTortoise,
  mdiGithub,
  mdiCodeBraces,
} from "@quasar/extras/mdi-v6"
import { serverBaseUrl } from "./config/server"

const localStorageIsDarkThemeKey = "isDarkMode"

export default defineComponent({
  name: "App",

  setup() {
    const $q = useQuasar()

    const themeIsDark = ref(false)
    $q.dark.set(false)
    localStorage.setItem(localStorageIsDarkThemeKey, "false")
    provide("themeIsDark", themeIsDark)

    const miniState = ref(true)

    return {
      playgroundRoute: { name: routeNames.Playground },
      aboutRoute: { name: routeNames.About },
      miniState,
      swaggerUrl: `${serverBaseUrl}/swagger/index.html`,
      mdiApplicationBracketsOutline,
      mdiInformationOutline,
      mdiTortoise,
      mdiCodeBraces,
      mdiGithub,
    }
  },
})
</script>
