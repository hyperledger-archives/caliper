/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file Implementation of the temporary demo
*/


'use strict'

/* global variables */
var path = require('path');
var demoFile = path.join(__dirname, '../output/demo.json');
var demoInterval = 1;   // interval length(s)
var demoXLen = 60;     // default x axis length
var demoData;
var demoInterObj = null;
var demoSessionID = 0;
//var demoProcesses = [];
var demoQueryQueue = {};
function demoInit() {
    var fs = require('fs');
    demoData =  {
        throughput: {
            x: [],
            submitted: [0],
            succeeded: [0],
            failed: [0]
        },
        latency: {
            x: [],
            max: [0],
            min: [0],
            avg: [0]
        },
        summary: {
            txSub: 0,
            txSucc: 0,
            txFail: 0,
            round: 0,
        },
        report: ''
    }
    for(let i = 0 ; i < demoXLen ; i++) {
        demoData.throughput.x.push(i * demoInterval);
        demoData.latency.x.push(i * demoInterval);
    }
    fs.writeFileSync(demoFile,  JSON.stringify(demoData));
}
module.exports.init = demoInit;

function demoRefreshX() {
    var len = demoData.throughput.submitted.length;
    while(demoData.throughput.x.length < len) {
        if(demoData.throughput.x.length === 0) {
            demoData.throughput.x[0] = 0;
        }
        else {
            let last = demoData.throughput.x[demoData.throughput.x.length - 1];
            demoData.throughput.x.push(last + demoInterval);
        }
    }
    len = demoData.latency.max.length;
    while(demoData.latency.x.length < len) {
        if(demoData.latency.x.length === 0) {
            demoData.latency.x[0] = 0;
        }
        else {
            let last = demoData.latency.x[demoData.latency.x.length - 1];
            demoData.latency.x.push(last + demoInterval);
        }
    }
}

function demoAddThroughput(sub, suc, fail) {
    demoData.throughput.submitted.push(sub/demoInterval);
    demoData.throughput.succeeded.push(suc/demoInterval);
    demoData.throughput.failed.push(fail/demoInterval);
    demoData.summary.txSub  += sub;
    demoData.summary.txSucc += suc;
    demoData.summary.txFail += fail;
}
function demoAddLatency(max, min, avg) {
    demoData.latency.max.push(max);
    demoData.latency.min.push(min);
    demoData.latency.avg.push(avg);
}

function demoRefreshData(sessionID) {
    if(sessionID === 'all') {
        // refresh all data
        var fake = {data: []};
        for(let key in demoQueryQueue) {
            if(demoQueryQueue[key].data.length > 0) {
                fake.data.push.apply(fake.data, demoQueryQueue[key].data);
            }
        }
        demoQueryQueue = {fake: fake};
        sessionID = 'fake';
    }

    if(demoQueryQueue[sessionID].data.length === 0) {
        demoAddThroughput(0,0,0);
        demoAddLatency(0,0,0);
    }
    else {
        var sub = 0, suc = 0, fail = 0;
        var deMax = -1, deMin = -1, deAvg = 0;
        for(let i = 0 ; i < demoQueryQueue[sessionID].data.length ; i++) {
            let data = demoQueryQueue[sessionID].data[i];
            sub += data.submitted;
            suc += data.committed.succ;
            fail += data.committed.fail;

            if(data.committed.succ > 0) {
                if(deMax === -1 || deMax < data.committed.delay.max) {
                    deMax = data.committed.delay.max;
                }
                if(deMin === -1 || deMin > data.committed.delay.min) {
                    deMin = data.committed.delay.min;
                }
                deAvg += data.committed.delay.sum;
            }
        }
        if(suc > 0) {
            deAvg /= suc;
        }
        /*sub /= demoInterval;
        suc /= demoInterval;
        fail /= demoInterval;*/
        demoAddThroughput(sub, suc, fail);

        if(deMax === NaN || deMin === NaN || deAvg === 0) {
            demoAddLatency(0,0,0);
        }
        else {
            demoAddLatency(deMax, deMin, deAvg);
        }

    }

    demoRefreshX();

    console.log('Submitted: ' + demoData.summary.txSub
        + ' Succ: ' + demoData.summary.txSucc
        + ' Fail:' +  demoData.summary.txFail
        + ' Unfinished:' + (demoData.summary.txSub - demoData.summary.txSucc - demoData.summary.txFail));

    delete demoQueryQueue[sessionID];

    var fs = require('fs');
    fs.writeFileSync(demoFile,  JSON.stringify(demoData));
}
function demoQueryCB(sessionID, result) {
    if(typeof sessionID === 'undefined' || sessionID === null) {
        /*if(demoQueryQueue.hasOwnProperty('final')) {
            demoRefreshData('final');
        }
        else
        {
            demoData.throughput.submitted.push(0);
            demoData.throughput.succeeded.push(0);
            demoData.throughput.failed.push(0);
            todo
            demoRefreshX();
        }*/
        demoRefreshData('all');
    }
    else {
        if(demoQueryQueue.hasOwnProperty(sessionID)){
            demoQueryQueue[sessionID].wait -= 1;
            demoQueryQueue[sessionID].data.push(result);
            if(demoQueryQueue[sessionID].wait === 0 && sessionID !== 'final') {
                demoRefreshData(sessionID);
            }
        }
        else {
            // final or missed msg, will be enforced refresh later
            demoQueryQueue[sessionID] = { wait: 99999, data: [result] };
        }
    }
}
module.exports.queryCB = demoQueryCB;

var client;
var started = false;
function demoStartWatch(clientObj) {
    //demoProcesses = processes.slice();
    client = clientObj;
    started = true;
    if(demoInterObj === null) {
        // start a interval to send query request
        demoInterObj = setInterval(()=>{
            let id = demoSessionID.toString();
            demoSessionID++;
            if(started) {
                let ok = client.sendMessage({type: 'queryNewTx', session: id});
                if(ok > 0) {
                    demoQueryQueue[id] = { wait: ok, data: [] };
                }
                else {
                    demoRefreshData('all');
                }
            }
            else {
                demoRefreshData('all');
            }
        }, demoInterval * 1000);
    }
}
module.exports.startWatch = demoStartWatch;

function demoPauseWatch() {
    demoData.summary.round += 1;
    started = false;
    //demoRefreshData('all');
}

module.exports.pauseWatch = demoPauseWatch;

function demoStopWatch(output) {
    if(demoInterObj) {
        clearInterval(demoInterObj);
        demoInterObj = null;
    }
    /*if(demoQueryQueue.hasOwnProperty('final')) {
        demoRefreshData('final');
    }*/
    demoData.report = output;
    demoRefreshData('all');
}

module.exports.stopWatch = demoStopWatch;

