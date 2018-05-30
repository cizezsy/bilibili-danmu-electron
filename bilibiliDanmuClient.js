'use strict';

const EventEmitter = require('events').EventEmitter;
const https = require('https');
const parseString = require('xml2js').parseString;
const net = require('net');

const opeartions = {
    SEND_HEART_BEAT: 2,
    POPULARITY: 3,
    COMMAND: 5,
    AUTH_JOIN: 7,
    RECEIVE_HEART_BEAT: 8
};

function pack(data, opeartion) {
    const body = Buffer.from(JSON.stringify(data));

    const buf = Buffer.alloc(body.length + 16);
    buf.writeInt32BE(body.length + 16, 0);
    buf.writeInt16BE(16, 4);
    buf.writeInt16BE(1, 6);
    buf.writeInt32BE(opeartion, 8);
    buf.writeInt32BE(1, 12);

    buf.write(JSON.stringify(data), 16);
    return buf;
}

function retriveRoomId(roomId, client) {
    https.get({
        host: 'api.live.bilibili.com',
        path: `/room/v1/Room/room_init?id=${roomId}`
    }, res => {
        if (res.statusCode !== 200) {
            client.emit('err', `Retrive Room ID Failed:Response with ${res.statusCode} ${res.statusMessage}`);
            return;
        }

        const bodyChuncks = [];
        res.on('data', chunck => {
            bodyChuncks.push(chunck);
        });

        res.on('end', () => {
            client.emit('retriveRoomId',
                JSON.parse(Buffer.concat(bodyChuncks).toString()));
        });
    });
}

function retriveServerAddr(roomId, client) {
    https.get({
        host: 'live.bilibili.com',
        path: `/api/player?id=cid:${roomId}`
    }, res => {
        if (res.statusCode !== 200) {
            client.emit('err', `Retrive Server Address Failed:Response with ${res.statusCode} ${res.statusMessage}`);
            return;
        }

        const bodyChuncks = [];
        res.on('data', chunck => {
            bodyChuncks.push(chunck);
        });

        res.on('end', () => {
            parseString(`<root>${Buffer.concat(bodyChuncks).toString()}</root>`, (err, result) => {
                client.emit('retriveServerAddr', result.root.server[0]);
            });
        });
    });
}

function authJoin(roomId, client) {
    const buf = pack({
        uid: 0,
        roomId: roomId,
        protover: 1,
        plantform: 'web',
        'clientver': '1.4.0'
    }, opeartions.AUTH_JOIN);

    client.send(buf);
}

function startHeartBeatLoop(client) {
    const buf = pack({}, opeartions.SEND_HEART_BEAT);
    client.send(buf);

    setTimeout(() => {
        startHeartBeatLoop(client);
    }, 30000);
}

class DanmuClient extends EventEmitter {

    constructor(roomId) {
        super();
        this.roomId = roomId;
    }

    start() {
        retriveRoomId(this.roomId, this);

        this.on('retriveRoomId', data => {
            if (data.code !== 0 || data.msg !== 'ok') {
                this.emit('err', `Retrive Room ID Failed:${data.msg}`);
                return;
            }

            const realRoomId = data.data.room_id;
            if (!realRoomId) {
                this.emit('err', `Retrive Room ID Failed:${realRoomId}`);
                return;
            }

            this.roomId = realRoomId;

            retriveServerAddr(this.roomId, this);
        });

        this.on('retriveServerAddr', serverAddr => {
            const tcpClient = net.createConnection(788, serverAddr, () => {
                tcpClient.write(pack({
                    roomid: this.roomId,
                    uid: parseInt(100000000000000.0 + 200000000000000.0 * Math.random(), 10)
                }, opeartions.AUTH_JOIN));
                startHeartBeatLoop(this);
            });
            this.client = tcpClient;
            this.client.on('data', data => {
                this.emit('message', data);
            });
        });

        this.on('message', data => {
            const opeartion = data.readInt32BE(8);
            let body = data.slice(16, data.length);

            switch (opeartion) {
                case opeartions.RECEIVE_HEART_BEAT:
                    this.send(pack({}, opeartions.SEND_HEART_BEAT));
                    break;
                case opeartions.POPULARITY:
                    let value = 0;
                    for (let v of body) {
                        value <<= 8;
                        value += v;
                    }
                    this.emit('popularity', value);
                    break;
                case opeartions.COMMAND:
                    body = JSON.parse(body.toString());
                    switch (body.cmd) {
                        case 'DANMU_MSG':
                            this.emit('danmu', body);
                            break;
                        case 'SEND_GIFT':
                            this.emit('gift', body);
                            break;
                        case 'WELCOME':
                            this.emit('welcome', body);
                            break;
                        case 'WELCOME_GUARD':
                            this.emit('welcom_guard', body);
                            break;
                        case 'SYS_MSG':
                            this.emit('system_msg', body);
                            break;
                        case 'PREPARING':
                            this.emit('preparing', body);
                            break;
                        case 'LIVE':
                            this.emit('start_live', body);
                            break;
                        case 'WISH_BOTTLE':
                            this.emit('wish_bottle', body);
                            break;
                    }
                    break;
            }
        });

        this.on('error', err => {
            console.log(err);
        });
    }

    send(data) {
        this.client.write(data);
    }
}

module.exports = {
    DanmuClient,
    pack
}