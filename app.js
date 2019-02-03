const notifier = require('node-notifier')
const cheerio = require('cheerio')
const request = require('request')
const dmg = require('./dmg')
const ncp = require('ncp').ncp;
const https = require('follow-redirects').https;
const fs = require('fs')
const os = require('os')
const path = require('path')
const rmdir = require('rmdir')
const readline = require('readline')
const schedule = require('node-schedule')

const TMPDIR = os.tmpdir()
const APP_PATH = '/Applications/VLC-Nightly.app'
const NIGHTLY_BASE = 'https://nightlies.videolan.org/'
const NIGHTLY_SUBPATH = '/build/macosx-intel/last'
const NIGHTLY_URL = new URL(NIGHTLY_SUBPATH, NIGHTLY_BASE).toString()

function error(msg) {
  console.error('Error', msg)
  notifier.notify({
    title: 'Error',
    message: msg,
    sound: true,
    closeLabel: 'Close',
    actions: 'Close',
    wait: true,
    icon: path.join(__dirname, 'assets', 'notifier-icon.png')
  })
}

function message(msg, title = null) {
  console.log(title === null ? 'Success' : title, msg)
  const params = {
    message: msg,
    sound: false,
    timeout: 15,
    closeLabel: 'Close',
    actions: 'Close',
    icon: path.join(__dirname, 'assets', 'notifier-icon.png'),
  }
  if (title && typeof title === 'string') {
    params.title = title
  }
  notifier.notify(params)
}

function update(daemonize = false) {
  if (daemonize) {
    const rule = new schedule.RecurrenceRule()
    rule.hour = 24
    schedule.scheduleJob(rule, runUpdate)
  } else {
    runUpdate()
  }
}

message('Update started', 'VLC Nightly Updathjgkjer')
function runUpdate() {
  message('Update started', 'VLC Nightly Updater')

  https.get(NIGHTLY_URL, res => {
    if (res.statusCode !== 200) {
      err(`Getting latest nightly page (${NIGHTLY_URL}) returned code ${res.statusCode}`)
      process.exit(1)
    } else {
      let html = ''
      res.on('data', data => {
        html = data.toString('utf8')
        processResponse(html)
      })
    }
  }).on('error', err => {
    error(`Failed getting nightly page: ${err.message}`)
    process.exit(2)
  })
}

function processResponse(html) {
  const $ = cheerio.load(html)
  let file = $('table tr > td > a:contains(".dmg")').attr('href')
  saveFile(file)
}

saveFile.dest = null

function saveFile(file) {
  const link = new URL(`${NIGHTLY_SUBPATH}/${file}`, NIGHTLY_BASE).toString()
  const tempdir = fs.mkdtempSync(`${TMPDIR}${path.sep}`)
  const filePath = path.join(tempdir, file)
  const dest = fs.createWriteStream(filePath)
  saveFile.dest = dest.path
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
        console.log(`Downloaded ${percentDownloaded}%`)
        lastPrinted = percentDownloaded
      }
    })

  req.on('error', err => {
      error(`Getting latest nightly archive returned code ${err.statusCode}`)
      cleanup().catch(err => {
        process.exit(3)
      })
    })
    .pipe(dest)
    .on('error', err => {
      error(this, `Failed saving file: ${err.message}`)
      cleanup().catch(err => {
        process.exit(4)
      })
    })
    .on('finish', () => {
      console.log(`Finished downloading ${link}`)
      installUpdate(filePath)
    })
}

function cleanup() {
  return new Promise((resolve, reject) => {
    if (saveFile.dest) {
      try {
        fs.unlinkSync(saveFile.dest)
      } catch (e) {
        error(`Failed deleting ${saveFile.dest}: ${e.message}`)
      }
    }
    if (backupExisting.backupPath && fs.existsSync(backupExisting.backupPath)) {
      rmdir(backupExisting.backupPath, err => {
        error(`Failed deleting backup ${backupExisting.backupPath}: ${err}`)
      })
      if (installUpdate.mountedPath && installUpdate.devPath) {
        dmg.remove(installUpdate.mountedPath, installUpdate.devPath).then(s => {
          resolve(s)
        }, err => {
          error(`Failed removing dmg: ${err.message}`)
          reject(err)
        })
      }
    }
  })
}

backupExisting.backupPath = null

function backupExisting(appPath) {
  const backupPath = backupExisting.backupPath = `${appPath}.${Date.now()}`
  fs.renameSync(appPath, backupPath)
  if (!fs.existsSync(backupPath) && fs.existsSync(appPath)) {
    error(`Failed making backup of existing app`, 'Warning')
  }
}

installUpdate.mountedPath = null
installUpdate.devPath = null

function installUpdate(filePath) {
  dmg.mount(filePath).then(mounts => {
    const mountedPath = mounts.volume
    const devPath = mounts.device
    installUpdate.mountedPath = mountedPath
    installUpdate.devPath = devPath
    if (fs.existsSync(APP_PATH)) {
      console.log(`${APP_PATH} exists, backing up...`)
      backupExisting(APP_PATH)
      console.log(`Installing ${APP_PATH}`)
      installApp(mountedPath)
    } else {
      console.log(`${APP_PATH} doesn't exist, installing...`)
      installApp(mountedPath)
    }
  }, err => {
    error(`Failed mounting ${filePath}: ${err.message}`)
    cleanup().catch(err => {
      process.exit(4)
    })
  })
}

function installApp(mountedPath) {
  const options = {
    limit: 8,
    clobber: true,
    stopOnErr: true
  }
  ncp(path.join(mountedPath, 'VLC.app'), APP_PATH, options, ncperr => {
    if (ncperr) {
      error(`Failed copying app: ${ncperr.message}`)
      cleanup().catch(err => {
        process.exit(5)
      })
    } else {
      cleanup().then(s => {
        message(`Successfully updated ${APP_PATH}`, 'Update Sucessful')
        console.log(`Successfully unmounted ${mountedPath}`)
        process.exit(0)
      }, err => {
        error(`Failed unmounting dmg: ${err.message}`)
        cleanup().catch(err => {
          console.log('Failed unmounting dmg')
        })
      })
    }
  })
}

// if (require.main === module) {
update()
// }