<template>
  <q-page class="flex flex-top">
    <q-list bordered separator style="width: 100%">
      <q-item clickable v-ripple v-for="item in packages" v-bind:key="item.name">
        <q-item-section>{{ item.name }}</q-item-section>
        <q-space />
        <q-btn
          round
          color="warning"
          v-if="item.download"
          icon="open_in_new"
          style="margin-right: 16px"
        />
        <q-btn
          round
          color="secondary"
          v-if="!item.download"
          @click="changeDownloadState(item)"
          icon="cloud_download"
        />
        <q-btn
          round
          color="primary"
          v-if="item.download"
          @click="changeDownloadState(item)"
          icon="check"
        />
      </q-item>
    </q-list>
  </q-page>
</template>

<script>
export default {
  name: 'PageIndex',
  data () {
    return {
      packages: []
    }
  },
  created () {
    this.$q.electron.ipcRenderer.on('orbit-replicated', (event, value) => {
      const packages = value[0].structure.children.map(s => ({
        name: s.name
      }))
      this.$database.updatePackages(packages)
    })

    this.$database.getPackages().subscribe(sp => {
      this.packages = sp
      console.log(sp)
    })
  },
  methods: {
    changeDownloadState (pack) {
      pack.download = !pack.download
      this.$database.updatePackages(this.packages)
    }
  }
}
</script>
