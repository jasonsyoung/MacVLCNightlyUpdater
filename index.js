module.exports = function (daemonize = false, cmd=null) {
    if (daemonize) {
        const daemon = require('daemonize2').setup({
            main: 'app.js',
            name: 'vlc-nightly-updater-mac',
        })

        switch (cmd) {
            case 'start':
                daemon.start()
                break
            case 'stop':
                daemon.stop()
                break
            default:
                console.log('Usage: [start|stop]')
        }
    } else {
        require('./app.js')
    }
}