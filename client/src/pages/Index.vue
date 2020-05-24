<template>
  <q-page class="flex flex-center">
    <span v-text="structure" />
  </q-page>
</template>

<script>
export default {
  name: 'PageIndex',
  data () {
    return {
      structure: ''
    }
  },
  created () {
    this.$q.electron.ipcRenderer.on('orbit-replicated', (event, value) => {
      this.structure = JSON.stringify(value, null, 2)
      console.log(this.structure)
    })
  }
}
</script>
