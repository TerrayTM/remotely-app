const electron = require('electron');
const url = require('url');
const path = require('path');

const { app, BrowserWindow } = electron;
let main;

app.on('ready', () => {
    main = new BrowserWindow({
        minWidth: 240,
        minHeight: 320,
        width: 240,
        height: 320,
        frame: false,
        show: false,
        transparent: true,
        resizable: false,
        icon: path.join(__dirname, 'src/assets/img/remotely-icon.png'),
        webPreferences: {
            devTools: false,
            nodeIntegration: true
        }
    });

    main.once('ready-to-show', () => {
        main.show();
    });

    main.webContents.on('new-window', function (event, path) {
        event.preventDefault();
        electron.shell.openExternal(path);
    });

    main.loadURL(url.format({
        pathname: path.join(__dirname, 'src/app/main.html'),
        protocol: 'file:',
        slashes: true
    }));
});