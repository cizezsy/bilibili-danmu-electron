'use strict';

const {
    app,
    ipcMain,
    BrowserWindow,
} = require('electron');
const notifier = require('electron-notifications');
const DanmuClient = require('./bilibiliDanmuClient').DanmuClient;
const pack = require('./bilibiliDanmuClient').pack;


let win;

function createWindow() {
    win = new BrowserWindow({
        width: 370,
        height: 90,
        useContentSize: true
    });

    win.loadFile('index.html');
    win.on('closed', () => {
        win = null;
    });
}

ipcMain.on('startReceiveDanmu', (event, roomId) => {

    const client = new DanmuClient(roomId);
    client.start();

    client.on('popularity', data => {
        notifier.notify('Current People', {
            icon:"placehold",
            message: `${data}`,
            buttons: ['Dismiss'],
        });
    });

    client.on('danmu', data => {
        notifier.notify('Dan Mu', {
            icon:"placehold",
            message: `${data}`,
            buttons: ['Dismiss'],
        });
    });
    client.on('gift', data => {
        console.log(data);
    });
    client.on('welcome', data => {
        console.log(data);
    });
    client.on('welcom_guard', data => {
        console.log(data);
    });
    client.on('system_msg', data => {
        console.log(data);
    });
    client.on('preparing', data => {
        console.log(data);
    });
    client.on('start_live', data => {
        console.log(data);
    });
    client.on('wish_bottle', data => {
        console.log(data);
    });
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.plantform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (win === null) {
        win = createWindow();
    }
});