#!/usr/bin/env bash
echo "var app = Application.currentApplication();\
app.includeStandardAdditions = true;\
app.displayNotification('VLC Nighly Updater', {\
    withTitle: 'Update started...'\
});" | osascript -s he -l JavaScript - 
export PATH="/usr/local/bin:$PATH"
pushd $(/usr/bin/dirname "$(/usr/local/bin/realpath "$0")") &>/dev/null
/usr/local/bin/npm start
popd &>/dev/null

echo "var app = Application.currentApplication();\
app.includeStandardAdditions = true;\
app.displayNotification('VLC Nighly Updater', {\
    withTitle: 'Install completed...'\
});" | osascript -s he -l JavaScript - 