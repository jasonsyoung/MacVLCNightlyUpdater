#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const realPath = fs.realpathSync(__filename)
const realLink = fs.readlinkSync(realPath)
const projPath = path.resolve('..', realLink)
const program = path.join(projPath, 'index.js')

require(program)(/-?-d(aemon)?/.test(process.argv[2], process.argv[3]))
