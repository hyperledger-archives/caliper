/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file Implementation of default test client process.
*/

'use strict'

/* global variables */
var tape  = require('tape');
var _test = require('tape-promise');
var test  = _test(tape);
var path  = require('path');
var bc    = require('../../src/comm/blockchain.js');

/**
 * Message handler
 */
process.on('message', function(message) {
    if(message.hasOwnProperty('type')) {
        try {
            var result;
            switch(message.type) {
                case 'queryNewTx':
                    queryNewTxInfo()
                    .then((queryResult) => {
                         process.send({type: 'queryResult', session: message.session, data: queryResult});
                    });
                    break;
                case 'test':
                    doTest(message)
                    .then((testResult) => {
                        result = testResult;
                        return queryNewTxInfo();
                    })
                    .then((queryResult) => {
                         process.send({type: 'queryResult', session: 'final', data: queryResult});
                         return sleep(200);
                    })
                    .then(() => {
                         process.send({type: 'testResult', data: result});
                    });
                    break;
                default:
                    process.send({type: 'error', data: 'unknown message type'});
            }
        }
        catch(err) {
            process.send({type: 'error', data: err});
        };
    }
    else {
         process.send({type: 'error', data: 'unknown message type'});
    }
})

var blockchain;
var results = [];
var txNum   = 0;
function queryNewTxInfo() {
    var tmpArray = results.slice();
    var tmpNum   = txNum;
    results = [];
    txNum   = 0;
    var stats = blockchain.getDefaultTxStats(tmpArray);
    return Promise.resolve({submitted: tmpNum, committed:stats});
}

function doTest(msg) {
    blockchain = new bc(msg.config);
    var cb = require(path.join(__dirname, '../../', msg.cb));
    var bcContext;
    var bcResults;

    return blockchain.getContext(msg.cmd)
    .then((context) => {
        bcContext = context;
        var rounds   = Array(msg.numb).fill(0);
        var promises = [];
        var idx       = 0;
        var start     = process.uptime();
        var sleepTime = (msg.tps > 0) ? 1000/msg.tps : 0;

        console.log('start client ' + process.pid +  (cb.info ? (':' + cb.info) : ''));

        return rounds.reduce(function(prev, item) {
            return prev.then( () => {
                txNum++;        // TODO: fix, wrong number if run() creates multiple transactions
                promises.push(cb.run().then((result)=>{
                    results.push(result);
                    return Promise.resolve(result);
                }));
                idx++;
                return rateControl(sleepTime, start, idx);
            });
        }, cb.init(blockchain, context, msg.args))
        .then( () => {
            return Promise.all(promises);
        })
        .then( (result) => {
            bcResults = result;
            return blockchain.releaseContext(bcContext);
        })
        .then( () => {
            return cb.end(bcResults);
        })
        .then( (out) => {
            var stats = blockchain.getDefaultTxStats(bcResults);
            if(msg.hasOwnProperty('out') && typeof out !== 'undefined') {
                stats.out = { key: msg['out'], value : out};
            }
            return Promise.resolve(stats);
        });
    })
    .catch( (err) => {
        console.log('Client ' + process.pid + ': error ' + (err.stack ? err.stack : err));
        return Promise.reject(err);
    });
}

/**
* Sleep a suitable time according to the required transaction generation time
* @timePerTx {number}, time interval for transaction generation
* @start {number}, generation time of the first transaction
* @txSeq {number}, sequence number of the current transaction
* @return {promise}
*/
function rateControl(timePerTx, start, txSeq) {
    if(timePerTx === 0) {
        return Promise.resolve();
    }
    var diff = Math.floor(timePerTx * txSeq - (process.uptime() - start)*1000);
    if( diff > 10) {
        return sleep(diff);
    }
    else {
        return Promise.resolve();
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}