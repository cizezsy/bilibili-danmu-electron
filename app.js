'use strict';

const {
    ipcRenderer
} = require('electron');

function start() {
    const formInput = window.document.querySelector('form input');
    const roomId = formInput.value;

    ipcRenderer.send('startReceiveDanmu', roomId);

    return false;
}