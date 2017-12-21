/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict'

const CLIENT_LOCAL = 'local';
const CLIENT_ZOO   = 'zookeeper';
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
                    this.type = CLIENT_ZOO;
                    if(this.config.hasOwnProperty('server')) {
                        this.server = this.config.server;
                    }
                    else {
                        return Promise.reject(new Error('Failed to find zookeeper server address in config file'));
                    }
                    break;
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
    *              config: path of the blockchain config file   TODO: how to deal with the config file when transfer it to a remote client (via zookeeper), as well as any local materials like cyrpto keys??
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
                // todo
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
                // todo
            default:
                return Promise.reject(new Error('Unknown client type: ' + this.type));
        }
    }


    /**
    * pseudo private functions
    */

    /**
    * functions for CLIENT_LOCAL
    */
    _startLocalTest(message, queryCB) {
        var promises = [];
        var path = require('path');
        var childProcess = require('child_process');
        this.localClients = [];
        var results = this.results;
        var txPerClient  = Math.floor(message.numb / this.number);
        var tpsPerClient = Math.floor(message.tps / this.number);
        if(txPerClient < 1) {
            txPerClient = 1;
        }
        if(tpsPerClient < 1) {
            tpsPerClient = 1;
        }
        message.numb = txPerClient;
        message.tps  = tpsPerClient;

        for(let i = 0 ; i < this.number ; i++) {
            let p = new Promise( (resolve, reject) => {
                            let child = childProcess.fork(path.join(__dirname, 'local-client.js'));
                            this.localClients.push(child);
                            child.on('message', function(msg) {
                                if(msg.type === 'testResult') {
                                    results.push(msg.data);
                                    resolve();
                                    child.kill();
                                }
                                else if(msg.type === 'error') {
                                    reject('client encountered error, ' + msg.data);
                                    child.kill();
                                }
                                else if(msg.type === 'queryResult') {
                                    queryCB(msg.session, msg.data);
                                }
                            });

                            child.on('error', function(){
                                reject('client encountered unexpected error');
                            });

                            child.on('exit', function(){
                                console.log('client exited');
                                resolve();
                            });

                            child.send(message);
                        });
            promises.push(p);
        }
        return Promise.all(promises);
    }

    _sendLocalMessage(message) {
        this.localClients.forEach((client)=>{
            client.send(message);
        });
        return this.localClients.length;
    }
}

module.exports = Client;

/**
* get the maximum,minimum,total, average value from a number array
* @arr {Array}
* @return {Object}
*/
function getStatistics(arr) {
    if(arr.length === 0) {
        return {max : NaN, min : NaN, total : NaN, avg : NaN};
    }

    var max = arr[0], min = arr[0], total = arr[0];
    for(let i = 1 ; i< arr.length ; i++) {
        let value = arr[i];
        if(value > max) {
            max = value;
        }
        if(value < min) {
            min = value;
        }
        total += value;
    }

    return {max : max, min : min, total : total, avg : total/arr.length};
}

/**
* Normalize the byte number
* @data {Number}
* @return {string}
*/
function byteNormalize(data) {
    if(isNaN(data)) {
        return '-';
    }
    var kb = 1024;
    var mb = kb * 1024;
    var gb = mb * 1024;
    if(data < kb) {
        return data.toString() + 'B';
    }
    else if(data < mb) {
        return (data / kb).toFixed(1) + 'KB';
    }
    else if(data < gb) {
        return (data / mb).toFixed(1) + 'MB';
    }
    else{
        return (data / gb).toFixed(1) + 'GB';
    }
}

/**
* Cut down the string in case it's too long
* @data {string}
* @return {string}
*/
function strNormalize(data) {
    if(typeof data !== 'string' || data === null) {
        return '-';
    }

    const maxLen = 30;
    if(data.length <= maxLen) {
        return data;
    }

    var newstr = data.slice(0,25) + '...' + data.slice(-5);
    return newstr;
}