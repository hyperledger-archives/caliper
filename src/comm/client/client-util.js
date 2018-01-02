/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/


'use strict'

const CLIENT_LOCAL = 'local';
const CLIENT_ZOO   = 'zookeeper';

var zkUtil     = require('./zoo-util.js');
var processes  = [];
function startTest(number, message, queryCB, results) {
    var promises = [];
    var path = require('path');
    var childProcess = require('child_process');
    processes = [];
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
    for(let i = 0 ; i < number ; i++) {
        let p = new Promise( (resolve, reject) => {
                        let child = childProcess.fork(path.join(__dirname, 'local-client.js'));
                        processes.push(child);
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
module.exports.startTest = startTest;

function sendMessage(message) {
    processes.forEach((client)=>{
        client.send(message);
    });
    return processes.length;
}
module.exports.sendMessage = sendMessage;