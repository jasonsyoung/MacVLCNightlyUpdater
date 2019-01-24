const notifier = require('node-notifier')
const cheerio = require('cheerio')
const request = require('request')
const dmg = require('dmg')
const trash = require('trash')
const ncp = require('ncp').ncp;

ncp.limit = 16

const https = require('follow-redirects').https;
const fs = require('fs')
const os = require('os')
const path = require('path')
const readline = require('readline')

const TMPDIR = os.tmpdir()
const APP_PATH = '/Applications/VLC-Nightly.app'
const NIGHTLY_BASE = 'https://nightlies.videolan.org/'
const NIGHTLY_SUBPATH = '/build/macosx-intel/last'
const NIGHTLY_URL = new URL(NIGHTLY_SUBPATH, NIGHTLY_BASE).toString()

function error (msg) {
  console.error('Error', msg)
  notifier.notify({
    title: 'Error',
    message: msg,
    sound: true
  })
}

function success (msg, title=null) {
  console.log(title === null ? 'Success' : title, msg)
  const params = {
    message: msg,
    sound: true
  }
  if (title && typeof title === 'string') {
    params.title = title
  }
  notifier.notify(params)
}

https.get(NIGHTLY_URL, res => {
  if (res.statusCode !== 200) {
    err(`Getting latest nightly page (${NIGHTLY_URL}) returned code ${res.statusCode}`)
    process.exit(1)
  } else {
    let html = '';
    res.on('data', data => {
      html = data.toString('utf8')
      processResponse(html)
    })
  }

}).on('error', err => {
  error(`Failed getting nightly page: ${err.message}`)
  process.exit(2)
});

function processResponse (html) {
  const $ = cheerio.load(html)
  let file = $('table tr > td > a:contains(".dmg")').attr('href')
  saveFile(file)
}

function saveFile(file) {
  const link = new URL(`${NIGHTLY_SUBPATH}/${file}`, NIGHTLY_BASE).toString()
  const tempdir = fs.mkdtempSync(`${TMPDIR}${path.sep}`)
  const filePath = path.join(tempdir, file)
  const dest = fs.createWriteStream(filePath)

  let length = 0
  let currentLength = 0
  let percentDownloaded = 0
  let lastPrinted = 0
  let req = request.get(link)
  req.on('response', res => {
    length = parseInt(res.headers['content-length'], 10)
  })
  .on('data', chunk => {
    currentLength += chunk.length
    percentDownloaded = (100 * currentLength / length).toFixed(0)
    if (lastPrinted !== percentDownloaded && percentDownloaded % 5 === 0) {
      if (lastPrinted !== 0) {
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
      }
      process.stdout.write(`Downloaded ${percentDownloaded}%`)
      lastPrinted = percentDownloaded
    }
  })

  req.on('error', err => {
    error(`\nGetting latest nightly archive returned code ${err.statusCode}`)
    fs.unlink(dest, process.exit.bind(process, 3))
  })
  .pipe(dest)
  .on('error', err => {
    error(this, `\nFailed saving file: ${err.message}`)
    fs.unlink(dest, process.exit.bind(process, 4))
  })
  .on('finish', () => {
    console.log(`\nFinished downloading ${link}`)
    installUpdate(filePath)
  })
}

function installUpdate(filePath) {
  dmg.mount(filePath, (err, mountedPath) => {
    if (err) {
      error(`Failed mounting ${filePath}: ${err.message}`)
      fs.unlink(filePath, process.exit.bind(process, 4))
    } else {
      if (fs.existsSync(APP_PATH)) {
        console.log(`Attempting to trash existing ${APP_PATH}`)
        trash([ APP_PATH ]).then(() => {
          console.log('Trashed app, installing...')
          installApp(mountedPath)
        }).catch(err => {
          error(`Failed trashing existing app: ${err.message}`)
          dmg.unmount(mountedPath, err => {
            if (err) {
              error(`Failed unmounting dmg: ${err.message}`)
              fs.unlink(filePath, process.exit.bind(process, 5))
            }
          })
          fs.unlink(filePath, process.exit.bind(process, 6))
        })
      } else {
        console.log(`${APP_PATH} doesn't exist, installing...`)
        installApp(mountedPath)
      }
    }
  })
}

function installApp(mountedPath) {
  ncp(path.join(mountedPath, 'VLC.app'), APP_PATH, ncperr => {
    if (ncperr) {
      error(`Failed copying app: ${ncperr.message}`)
    } else {
      success(`Successfully updated ${APP_PATH}`, 'Update Sucessful')
      dmg.unmount(mountedPath, err => {
        if (err) {
          error(`Failed unmounting dmg: ${err.message}`)
          fs.unlink(mountedPath, process.exit.bind(process, 5))
        } else {
          console.log(`Successfully unmounted ${mountedPath}`)
          process.exit(0)
        }
      })
    }
  })
}