/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict'

const CLIENT_LOCAL = 'local';
const CLIENT_ZOO   = 'zookeeper';

var zkUtil  = require('./zoo-util.js');
var ZooKeeper = require('node-zookeeper-client');
var clientUtil = require('./client-util.js');
var Client = class {
    constructor(config, callback) {
        var conf = require(config);
        this.config = conf.test.clients;
        this.results = [];           // output of recent test round
    }

    /**
    * init client objects
    * @return {Promise}
    */
    init() {
        if(this.config.hasOwnProperty('type')) {
            switch(this.config.type) {
                case CLIENT_LOCAL:
                    this.type = CLIENT_LOCAL;
                    if(this.config.hasOwnProperty('number')) {
                        this.number = this.config.number;
                    }
                    else {
                        this.number = 1;
                    }
                    break;
                case CLIENT_ZOO:
                    return this._initZoo();
                default:
                    return Promise.reject(new Error('Unknown client type, should be local or zookeeper'));
            }
        }
        else {
            return Promise.reject(new Error('Failed to find client type in config file'));
        }
        return Promise.resolve();
    }

    /**
    * start the test
    * @message, {
    *              type: 'test',
    *              label : label name,
    *              numb:   total number of simulated txs,
    *              tps:    number of txs generated per second,
    *              args:   user defined arguments,
    *              cb  :   path of the callback js file,
    *              config: path of the blockchain config file   // TODO: how to deal with the local config file when transfer it to a remote client (via zookeeper), as well as any local materials like cyrpto keys??
    *              out:    (optional)key of the output data
    *            };
    * @queryCB {callback}, callback of query message
    * @finishCB {callback}, callback after the test finished
    * @args{any}, args that should be passed to finishCB, the callback is invoke as finishCB(this.results, args)
    * @return {Promise}
    */
    startTest(message, queryCB, finishCB, args) {
        var p;
        switch(this.type) {
            case CLIENT_LOCAL:
                p = this._startLocalTest(message, queryCB);
                break;
            case CLIENT_ZOO:
                 p = this._startZooTest(message, queryCB);
                 break;
            default:
                return Promise.reject(new Error('Unknown client type: ' + this.type));
        }
        return p.then(()=>{
            return finishCB(this.results, args);
        })
        .then(()=>{
            this.results = [];
            return Promise.resolve();
        })
        .catch((err)=>{
            this.results = [];
            return Promise.reject(err);
        })
    }

    /**
    * send message to actual clients
    * @message {object}
    * @return {Number}, sent message numbers
    */
    sendMessage(message) {
        switch(this.type) {
            case CLIENT_LOCAL:
                return this._sendLocalMessage(message);
            case CLIENT_ZOO:
                return this._sendZooMessage(message).catch((err) => {
                    return 0;
                });
            default:
                console.log('Unknown client type: ' + this.type);
                return 0;
        }
    }

    stop() {
        switch(this.type) {
            case CLIENT_ZOO:
                this._stopZoo();
            case CLIENT_LOCAL:
            default:
                ; // nothing todo
        }
        this.results = [];
    }


    /**
    * pseudo private functions
    */

    /**
    * functions for CLIENT_LOCAL
    */
    _startLocalTest(message, queryCB) {
        return clientUtil.startTest(this.number, message,queryCB, this.results);
    }

    _sendLocalMessage(message) {
        return clientUtil.sendMessage(message);
    }

    /**
    * functions for CLIENT_ZOO
    */
    /**
    * zookeeper structure
    * /caliper---clients---client_xxx   // list of clients
    *         |         |--client_yyy
    *         |         |--....
    *         |--client_xxx_in---msg_xxx {message}
    *         |               |--msg_xxx {message}
    *         |               |--......
    *         |--client_xxx_out---msg_xxx {message}
    *         |                |--msg_xxx {message}
    *         |--client_yyy_in---...
    */

    _initZoo() {
        const TIMEOUT = 5000;
        this.type = CLIENT_ZOO;
        this.zoo  = {
            server: '',
            zk: null,
            hosts: [],    // {id, innode, outnode}
            clientsPerHost: 1
        };

        if(!this.config.hasOwnProperty('zoo')) {
            return Promise.reject('Failed to find zoo property in config file');
        }

        var configZoo = this.config.zoo;
        if(configZoo.hasOwnProperty('server')) {
            this.zoo.server = configZoo.server;
        }
        else {
            return Promise.reject(new Error('Failed to find zookeeper server address in config file'));
        }
        if(configZoo.hasOwnProperty('clientsPerHost')) {
            this.zoo.clientsPerHost = configZoo.clientsPerHost;
        }

        var zk = ZooKeeper.createClient(this.zoo.server, {
            sessionTimeout: TIMEOUT,
            spinDelay : 1000,
            retries: 0
        });
        this.zoo.zk = zk;
        var zoo = this.zoo;
        // test var p = new Promise((resolve, reject) => {
        this.zoo.p = new Promise((resolve, reject) => {
            zoo.connectHandle = setTimeout(()=>{
                reject('Could not connect to ZooKeeper');
            }, TIMEOUT+100);
            zk.once('connected', () => {
                console.log('Connected to ZooKeeper');

                zkUtil.existsP(zk, zkUtil.NODE_CLIENT, 'Failed to find clients due to')
                .then((found)=>{
                    if(zoo.connectHandle) {
                        clearTimeout(zoo.connectHandle);
                        zoo.connectHandle = null;
                    }
                    if(!found) {
                        // since zoo-client(s) should create the node if it does not exist,no caliper node means no valid zoo-client now.
                        throw new Error('Could not found clients node in zookeeper');
                    }

                    return zkUtil.getChildrenP(
                        zk,
                        zkUtil.NODE_CLIENT,
                        null,
                        'Failed to list clients due to');
                })
                .then((clients) => {
                    // TODO: not support add/remove zookeeper clients now
                    console.log('get zookeeper clients:' + clients);
                    for (let i = 0 ; i < clients.length ; i++) {
                        let clientID = clients[i];
                        this.zoo.hosts.push({
                            id: clientID,
                            innode: zkUtil.getInNode(clientID),
                            outnode:zkUtil.getOutNode(clientID)
                        });
                    }
                    resolve();
                })
                .catch((err)=>{
                    zk.close();
                    return reject(err);
                });
            });
        });

        console.log('Connecting to ZooKeeper......');
        zk.connect();
        return Promise.resolve();
        //return this.zoo.p;
    }

    _startZooTest(message, queryCB) {
        return this.zoo.p.then(() => {
            var number = this.zoo.hosts.length;
            var txPerClient  = Math.floor(message.numb / number);
            var tpsPerClient = Math.floor(message.tps / number);
            if(txPerClient < 1) {
                txPerClient = 1;
            }
            if(tpsPerClient < 1) {
                tpsPerClient = 1;
            }
            message.numb = txPerClient;
            message.tps  = tpsPerClient;
            message['clients'] = this.zoo.clientsPerHost;
            return this._sendZooMessage(message)
        })
        .then((number)=>{
            if(number > 0) {
                return zooStartWatch(this.zoo, queryCB, number, this.results);
            }
            else {
                return Promise.reject(new Error('Failed to start the remote test'));
            }
        })
        .catch((err)=>{
            console.log('Failed to start the remote test');
            return Promise.reject(err);
        });
    }

    _sendZooMessage(message) {
        return this.zoo.p.then(() => {
            var promises = [];
            var succ = 0;

            var data = new Buffer(JSON.stringify(message));

            this.zoo.hosts.forEach((host)=>{
                let p = zkUtil.createP(this.zoo.zk, host.innode+'/msg-', data, ZooKeeper.CreateMode.EPHEMERAL_SEQUENTIAL, 'Failed to send message (create node) due to')
                        .then((path)=>{
                            succ++;
                            return Promise.resolve();
                        })
                        .catch((err)=>{
                            return Promise.resolve();
                        });
                promises.push(p);
            });
            return Promise.all(promises)
            .then(()=>{
                return Promise.resolve(succ);
            });
        });
    }

    _stopZoo() {
        if(this.zoo.zk) {
            this.zoo.zk.close();
            this.zoo.zk = null;
        }
        this.zoo.hosts = [];
    }
}

module.exports = Client;


/*function zooMessageCallback(zk, path, queryCB, results) {
    return zkUtil.getDataP(zk, path, null, 'Failed to getData from zookeeper')
        .then((data)=>{
            let msg  = JSON.parse(data.toString());
            let stop = false;
            switch(msg.type) {
                case 'testResult':
                    results.push(msg.data);
                    stop = true;   // stop watching
                    break;
                case 'error':
                    console.log('Client encountered error, ' + msg.data);
                    stop = true;   // stop watching
                    break;
                case 'queryResult':
                    queryCB(msg.session, msg.data);
                    stop = false;
                    break;
                default:
                    console.log('Unknown message type: ' + msg.type);
                    stop = false;
                    break;
            }
            zk.remove(path, -1, (err)=>{
                if(err) {
                    console.log(err.stack);
                    return;
                }
            });
            return Promise.resolve(stop);
        });
}*/
function zooMessageCallback(data, queryCB, results) {
    var msg  = JSON.parse(data.toString());
    var stop = false;
    switch(msg.type) {
        case 'testResult':
            results.push(msg.data);
            stop = true;   // stop watching
            break;
        case 'error':
            console.log('Client encountered error, ' + msg.data);
            stop = true;   // stop watching
            break;
        case 'queryResult':
            queryCB(msg.session, msg.data);
            stop = false;
            break;
        default:
            console.log('Unknown message type: ' + msg.type);
            stop = false;
            break;
    }
    return Promise.resolve(stop);
}

function zooStartWatch(zoo, queryCB, numOfTermin, results) {
    var promises = [];
    var loop = numOfTermin;
    var zk   = zoo.zk;
    zoo.hosts.forEach((host)=>{
        let path = host.outnode;
        let lastnode = null;
        let p = zkUtil.watchMsgQueueP(
                    zk,
                    path,
                    (data)=>{
                        return zooMessageCallback(data, queryCB, results)
                            .catch((err) => {
                                console.log('Exception encountered when watching message from zookeeper, due to:');
                                console.log(err);
                                return Promise.resolve(true);
                            });
                    },
                    'Failed to watch zookeeper children'
                );
        promises.push(p);
    });
    return Promise.all(promises);
}
