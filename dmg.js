var exec = require('child_process').exec
var VOLUME_REGEX = /\/Volumes\/(.*)/m
var DEV_REGEX = /\/dev\/disk([0-9])/m

/**
 * Mount a dmg file and return its mounted path.
 *
 * @param {String} path location of .dmg.
 */
function mount(path) {
    return new Promise((resolve, reject) => {
        const command = [
            'hdiutil',
            'mount',
            '-nobrowse',
            '"' + path + '"'
        ]

        exec(command.join(' '), (err, stdout, stderr) => {
            if (err) return callback(err);

            // extract volume path
            const match = stdout.match(VOLUME_REGEX);
            // extract device path
            const device = stdout.match(DEV_REGEX);

            if (!match) {
                reject(new Error('could not extract path out of mount result: ' + stdout))
            }
            if (!device) {
                reject(new Error('could not extract device path out of mount result: ' + stdout))
            }

            resolve({
                volume: match[0],
                device: device[0]
            });
        })
    })
}

/**
 * Unmount a dmg volume.
 *
 * @param {String} path to unmount.
 */
function unmount(path) {
    return new Promise((resolve, reject) => {
        if (!VOLUME_REGEX.test(path))
            reject(new Error('path must contain /Volumes/'))

        const command = [
            'hdiutil',
            'unmount',
            '"' + path + '"'
        ]

        exec(command.join(' '), err => {
            if (err) reject(err);
            else resolve(path);
        });
    })
}

/**
 * Eject a device.
 *
 * @param {String} path to eject.
 */
function eject(path) {
    return new Promise((resolve, reject) => {
    if (!DEV_REGEX.test(path))
        reject(new Error('path must contain /dev/disk'))

    var command = [
        'hdiutil',
        'eject',
        '"' + path + '"'
    ];

    exec(command.join(' '), err => {
        if (err) reject(err)
        else resolve(path)
    });
})
}

/**
 * Unmount and eject a volume.
 *
 * @param {String} path to eject.
 * @param {String} device to eject.
 */
function remove(path, device) {
    return Promise.all([
        unmount(path, err => rej(err)),
        eject(device, err => rej(err))
    ])
}

module.exports.mount = mount
module.exports.unmount = unmount
module.exports.eject = eject
module.exports.remove = remove