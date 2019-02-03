#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
if (fs.statSync(__filename).isSymbolicLink()) {
    const realPath = fs.readlinkSync(__filename)
    const realLink = fs.realpathSync(realPath)
    const projPath = path.resolve('..', realLink)
    const program = path.join(projPath, 'index.js')

    require(program)(/-?-d(aemon)?/.test(process.argv[2], process.argv[3]))
} else {
    const realPath = fs.realpathSync(__filename)
    const program = path.join(realPath, '..', 'index.js')

    require(program)(/-?-d(aemon)?/.test(process.argv[2], process.argv[3]))
}