import Vue from 'vue'
import PouchDB from 'pouchdb'
import { ReplaySubject } from 'rxjs'
const db = new PouchDB('local-package-store')
const docsSubject = new ReplaySubject([])

class Database {
  constructor () {
    db.changes({
      since: 'now',
      live: true,
      include_docs: true
    })
      .on('change', function (change) {
        db.allDocs({ include_docs: true }).then(ps => {
          docsSubject.next(ps.rows.map(r => r.doc))
        })
      })
      .on('complete', function (info) {
        // changes() was canceled
      })
      .on('error', function (err) {
        console.log(err)
      })

    db.allDocs({ include_docs: true }).then(ps => {
      docsSubject.next(ps.rows.map(r => r.doc))
    })
  }

  getPackages () {
    return docsSubject.asObservable()
  }

  updatePackages (packages) {
    packages.forEach(p => {
      db.get(p.name)
        .then(d => {
          if (d) {
            d.name = p.name
            d.download = p.download ? p.download : false
            console.log(d)
            db.put(d).then(() => console.log('package updated'))
          } else {
            db.put({
              _id: p.name,
              name: p.name,
              download: false
            })
          }
        })
        .catch((err) => {
          console.error(err)
          db.put({
            _id: p.name,
            name: p.name,
            download: false
          })
        })
    })

    db.allDocs({ include_docs: true }).then(ps => {
      if (ps && ps.rows) {
        ps.rows
          .map(r => r.doc)
          .forEach(p => {
            if (!packages.find(c => c.name === p.name)) {
              db.get(p.name).then(d => {
                db.remove(d).then(() => console.log('package removed'))
              })
            }
          })
      }
    })
  }
}

Vue.prototype.$database = new Database()
