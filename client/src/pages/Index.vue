<template>
  <q-page class="flex flex-top">
    <q-list bordered separator style="width: 100%">
      <q-item clickable v-ripple v-for="item in packages" v-bind:key="item.name">
        <q-item-section>{{ item.name }}</q-item-section>
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
      const packages = value[0].structure.children.map((s) => ({
        name: s.name
      }))
      this.$database.updatePackages(packages)
    })

    this.$database.getPackages().subscribe(sp => {
      this.packages = sp
      console.log(sp)
    })
  }
}
</script>
