import { app, BrowserWindow, nativeTheme } from 'electron'

try {
  if (
    process.platform === 'win32' &&
    nativeTheme.shouldUseDarkColors === true
  ) {
    require('fs').unlinkSync(
      require('path').join(app.getPath('userData'), 'DevTools Extensions')
    )
  }
} catch (_) {}

/**
 * Set `__statics` path to static files in production;
 * The reason we are setting it here is that the path needs to be evaluated at runtime
 */
if (process.env.PROD) {
  global.__statics = require('path')
    .join(__dirname, 'statics')
    .replace(/\\/g, '\\\\')
}

let mainWindow

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      // Change from /quasar.conf.js > electron > nodeIntegration;
      // More info: https://quasar.dev/quasar-cli/developing-electron-apps/node-integration
      nodeIntegration: QUASAR_NODE_INTEGRATION,
      nodeIntegrationInWorker: QUASAR_NODE_INTEGRATION

      // More info: /quasar-cli/developing-electron-apps/electron-preload-script
      // preload: path.resolve(__dirname, 'electron-preload.js')
    },
    frame: false
  })

  mainWindow.loadURL(process.env.APP_URL).then(() => {
    const IPFS = require('ipfs')
    const OrbitDB = require('orbit-db')

    // For js-ipfs >= 0.38

    // Create IPFS instance
    const initIPFSInstance = async () => {
      return await IPFS.create({ repo: './ipfs' })
    }

    initIPFSInstance().then(async ipfs => {
      const orbitdb = await OrbitDB.createInstance(ipfs)

      // Create / Open a database
      const db = await orbitdb.open(
        '/orbitdb/zdpuArAhoH47pxDHvkHuZKrMUsALrWpfwex4Ded9ewrxhW1U2/deploy-hyper',
        { sync: true }
      )
      await db.load()

      // Listen for updates from peers
      db.events.on('replicated', address => {
        console.log('orbit-db replicated')
        setTimeout(() => {
          mainWindow.webContents.send('orbit-replicated', db.get('storage'))
        }, 3000)
      })

      mainWindow.webContents.send('orbit-replicated', db.get('storage'))
    })

    mainWindow.on('closed', () => {
      mainWindow = null
    })
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
