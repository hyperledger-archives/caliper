/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file Implementation of default test client process.
*/

'use strict'

/* global variables */
var path  = require('path');
var bc    = require('../blockchain.js');

/**
 * Message handler
 */
process.on('message', function(message) {
    if(message.hasOwnProperty('type')) {
        try {
            switch(message.type) {
                case 'test':
                    var result;
                    doTest(message)
                    .then((output) => {
                        result = output;
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
var results      = [];
var txNum        = 0;
var txLastNum    = 0;
var txUpdateTail = 0;
var txUpdateTime = 1000;
function txUpdate() {
    var newNum = txNum - txLastNum;
    txLastNum += newNum;

    var newResults =  results.slice(txUpdateTail);
    txUpdateTail += newResults.length;
    if(newResults.length === 0 && newNum === 0) {
        return;
    }

    var newStats;
    if(newResults.length === 0) {
        newStats = bc.createNullDefaultTxStats();
    }
    else {
        newStats = blockchain.getDefaultTxStats(newResults, false);
    }
    process.send({type: 'txUpdated', data: {submitted: newNum, committed: newStats}});
}

function addResult(result) {
    if(Array.isArray(result)) { // contain multiple results
        for(let i = 0 ; i < result.length ; i++) {
            results.push(result[i]);
        }
    }
    else {
        results.push(result);
    }
}

function beforeTest() {
    results  = [];
    txNum    = 0;
    txUpdateTail = 0;
    txLastNum = 0;
}

function doTest(msg) {
    blockchain = new bc(path.join(__dirname, '../../..', msg.config));
    var cb = require(path.join(__dirname, '../../..', msg.cb));
    var bcContext;

    beforeTest();
    // start a interval to report results repeatedly
    var txUpdateInter = setInterval(txUpdate, txUpdateTime);
    var clearUpdateInter = function () {
        // stop reporter
        if(txUpdateInter) {
            clearInterval(txUpdateInter);
            txUpdateInter = null;
            txUpdate();
        }
    };
    console.log('do test with:', msg);
    return blockchain.getContext(msg.label, msg.clientargs)
    .then((context) => {
        bcContext = context;
        var rounds   = Array(msg.numb).fill(0);
        var promises = [];
        var idx       = 0;
        var start;
        var initComplete = false;
        var sleepTime = (msg.tps > 0) ? 1000/msg.tps : 0;

        console.log('Info: client ' + process.pid +  ' start test ' + (cb.info ? (':' + cb.info) : ''));
        return rounds.reduce(function(prev, item) {
            return prev.then( () => {
                txNum++;        // TODO: fix, wrong number if run() creates multiple transactions
                promises.push(cb.run().then((result)=>{
                    addResult(result);
                    return Promise.resolve();
                }));
                idx++;
                if (!initComplete) {
                     initComplete = true;
                     start = Date.now();
                }
                return rateControl(sleepTime, start, idx);
            });
        }, cb.init(blockchain, context, msg.args))
        .then( () => {
            return Promise.all(promises);
        })
        .then(()=>{
            return blockchain.releaseContext(bcContext);
        })
    })
    .then( () => {
        clearUpdateInter();
        return cb.end(results);
    })
    .then( (out) => {
        // conditionally trim beginning and end results for this test run
        if (msg.trim) {            
            let trim;
            if(msg.duration) {
                // Considering time based number of transactions
                trim = msg.trim * msg.tps;             
            } else {
                // Considering set number of transactions
                trim = msg.trim;
            }
            let safeCut = (2 * trim) < results.length ? trim : results.length;
            results = results.slice(safeCut, results.length - safeCut);
        }

        var stats = blockchain.getDefaultTxStats(results, true);
        return Promise.resolve(stats);
    })
    .catch( (err) => {
        clearUpdateInter();
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
    var diff = Math.floor(timePerTx * txSeq - (Date.now() - start));
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