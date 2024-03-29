import { app, BrowserWindow, nativeTheme } from 'electron'
const Database = require('../../src/boot/database').Database
var PouchDB = require('pouchdb')
var express = require('express')
var cors = require('cors')
var expressApp = express()
var Dat = require('dat-node')

const path = require('path')
const fs = require('fs-extra')
const encryptorKey = 'Fe3$MFl1nmf7'
const cryptr = require('aes256')
const dats = new Map()
const downloadsFolder = require('downloads-folder')

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

    expressApp.use(
      cors({ origin: 'http://localhost:8081', credentials: true })
    )
    expressApp.use('/db', require('express-pouchdb')(PouchDB))

    expressApp.listen(3333)
    var packageDatabase = new PouchDB('local-packages')

    const database = new Database(packageDatabase)

    database.getPackages().subscribe(p => {
      console.log(p)
      // promises = []

      // // Stop dats
      // dats.forEach(d => {
      //   const promise = new Promise((resolve, reject) => {
      //     d.close(() => {
      //       resolve()
      //     })
      //   })
      //   promises.push(promise)
      // })

      // await Promise.all(promises)

      p.forEach(g => {
        if (g.download && !dats.get(g.path)) {
          dats.set(g.path, {})
          const targetDir = path.join(downloadsFolder(), 'Deploy', g.path.replace(/\\/g, '/'))
          console.log('package download: ' + targetDir)
          fs.ensureDirSync(targetDir)
          Dat(targetDir, { key: g.storage }, function (err, dat) {
            if (err) throw err
            dats.set(g.path, dat)
            const stats = dat.trackStats()

            stats.on('update', () => {
              const st = stats.get()
              console.log(st)
              if (st.downloaded !== st.files) {
                g.downloading = true
              } else {
                g.downloading = false
              }

              database.updatePackage(g)
            })

            dat.joinNetwork(function (err) {
              console.error(err)
              if (err) throw err

              if (!dat.network.connected || !dat.network.connecting) {
                console.error('No users currently online for that key.')
              }
            })
          })
        }
      })
    })

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
        const packages = JSON.parse(
          cryptr.decrypt(encryptorKey, db.get('storage')[0].structure)
        ).children.map(s => ({
          name: s.name,
          storage: s.storage,
          path: s.path
        }))
        mainWindow.webContents.send('orbit-replicated', packages)
        database.updatePackages(packages)
        console.log('update recieved', packages)
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
