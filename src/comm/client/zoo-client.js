/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
*/

'use strict'

if (process.argv.length < 3) {
    console.log('Missed zookeeper address');
    process.exit(0);
}

var Blockchain = require('../blockchain.js');
var ZooKeeper = require('node-zookeeper-client');
var zk = ZooKeeper.createClient(process.argv[2]);
var zkUtil = require('./zoo-util.js');
var clientUtil = require('./client-util.js');
var path = require('path');

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

var clientID = '', inNode = '', outNode = '';
var closed = false;
var results  = [];
function close() {
    if (closed) {
        return;
    }
    closed = true;
    if(inNode !== '') {
        zk.remove(inNode, -1, (err)=>{
            if(err) {
                console.log(err.stack);
                return;
            }
            console.log('Node '+inNode+' is deleted');
        });
    }
    if(outNode !== '') {
        zk.remove(outNode, -1, (err)=>{
            if(err) {
                console.log(err.stack);
                return;
            }
            console.log('Node '+outNode+' is deleted');
        });
    }
    zk.close();
}

// {session: {interval:obj, waiting:number, submitted:0, committed:[]}}
var localClients = 0;
var queryWaiting = {};
const WAITING_TIMEOUT = 500;    // waiting for 500ms to get local result

function sendQueryResult(session) {
    var p = queryWaiting[session];
    Blockchain.mergeDefaultTxStats(p.committed);
    var message = {
        type: 'queryResult',
        session: session,
        data: {
            submitted: p.submitted,
            committed: p.committed[0]
        }
    }
    var buf = new Buffer(JSON.stringify(message));
    write(buf);
}
function queryCB(session, data) {
    //queryCB(msg.session, msg.data);
    // {type: 'queryResult', session: message.session, data: queryResult}
    //{submitted: tmpNum, committed:stats}

    if(session === 'final') {   // final session is committed without original request message
        let message = {
            type: 'queryResult',
            session: session,
            data: data
        }
        let buf = new Buffer(JSON.stringify(message));
        write(buf);
    }
    else if(data === 'timeout') {     // timeout, return as much information as possible
        if(queryWaiting.hasOwnProperty(session) && queryWaiting[session].committed.length > 0 ) {
            sendQueryResult(session);
        }
    }
    else if(queryWaiting.hasOwnProperty(session)) {     // new session result
        let p = queryWaiting[session];
        p.waiting -= 1;
        p.submitted += data.submitted;
        p.committed.push(data.committed);
        if(p.waiting < 1) { // send result if received all responses
            sendQueryResult(session);
            clearTimeout(p.interval);
            delete queryWaiting[session];
        }
    }
}

function finishCB() {
    Blockchain.mergeDefaultTxStats(results);
    var message = {type: 'testResult', data: results[0]};
    var buf = new Buffer(JSON.stringify(message));
    write(buf);
}

function write(data) {
    return zkUtil.createP(zk, outNode+'/msg-', data, ZooKeeper.CreateMode.EPHEMERAL_SEQUENTIAL, 'Failed to send message (create node) due to');
}

function zooMessageCallback(data) {
    //return zkUtil.getDataP(zk, path, null, 'Failed to getData from zookeeper')
    var msg  = JSON.parse(data.toString());
    // test
    console.log('Receive message, type='+msg.type);

    switch(msg.type) {
        case 'test':
            localClients = msg.clients;
            results = [];
            clientUtil.startTest(msg.clients, msg,queryCB, results)
            .then(() => {
                return finishCB();
            })
            .catch((err)=>{
                console.log('==Exception while testing, ' + err);
                results = [];   // clear all results and then return the end message
                return finishCB();
            });
            break;
        case 'queryNewTx':
            let obj = setTimeout(()=>{
                queryCB(msg.session, 'timeout');
            },WAITING_TIMEOUT);
            let p = {
                waiting: localClients,
                interval: obj,
                submitted:0,
                committed:[]
            };
            p.waiting = clientUtil.sendMessage(msg);
            queryWaiting[msg.session] = p;
            break;
        default:
            clientUtil.sendMessage(msg);
            break;
    }
    return Promise.resolve(closed);
}

function watch() {
    /*zkUtil.watchChildrenP(
        zk,
        inNode,
        (children) => {
            if(children.length === 0) {
                return Promise.resolve(false);
            }
            children.sort();
            return zooMessageCallback(inNode+'/'+children[0])
                .catch((err) => {
                    console.log('Exception encountered when watching message from zookeeper, due to:');
                    console.log(err);
                    return Promise.resolve(true);
                });
        },
        'Failed to watch children nodes in zookeeper'
    )*/
    zkUtil.watchMsgQueueP(
        zk,
        inNode,
        (data) => {
            return zooMessageCallback(data)
                .catch((err) => {
                    console.log('Exception encountered when watching message from zookeeper, due to:');
                    console.log(err);
                    return Promise.resolve(true);
                });
        },
        'Failed to watch children nodes in zookeeper'
    )
}

zk.once('connected', function() {
    console.log('Connected to ZooKeeper');
    zkUtil.existsP(zk, zkUtil.NODE_ROOT, 'Failed to find NODE_ROOT due to')
    .then((found)=>{
        if(found) {
            return Promise.resolve();
        }
        else {
            return zkUtil.createP(zk, zkUtil.NODE_ROOT, null, ZooKeeper.CreateMode.PERSISTENT, 'Failed to create NODE_ROOT due to');
        }
    })
    .then(()=>{
        return zkUtil.existsP(zk, zkUtil.NODE_CLIENT, 'Failed to find clients node due to')
    })
    .then((found)=>{
        if(found) {
            return Promise.resolve();
        }
        else {
            return zkUtil.createP(zk, zkUtil.NODE_CLIENT, null, ZooKeeper.CreateMode.PERSISTENT, 'Failed to create clients node due to');
        }
    })
    .then(()=>{         // create client node
        let random = new Date().getTime();
        let clientPath = zkUtil.NODE_CLIENT + '/client_'+random+'_';
        return zkUtil.createP(zk, clientPath, null, ZooKeeper.CreateMode.EPHEMERAL_SEQUENTIAL, 'Failed to create client node due to');
    })
    .then((clientPath)=>{
        console.log('Created client node:'+clientPath);
        clientID = path.basename(clientPath);
        inNode   = zkUtil.getInNode(clientID);
        outNode  = zkUtil.getOutNode(clientID);
        return zkUtil.createP(zk, inNode, null, ZooKeeper.CreateMode.PERSISTENT, 'Failed to create receiving queue due to');
    })
    .then((inPath)=>{
        console.log('Created receiving queue at:'+inPath);
        return zkUtil.createP(zk, outNode, null, ZooKeeper.CreateMode.PERSISTENT, 'Failed to create sending queue due to');
    })
    .then((outPath)=>{
        console.log('Created sending queue at:'+outPath);
        console.log('Waiting for messages at:'+inNode+'......');
        watch();
    })
    .catch((err)=> {
        console.log(err.stack ? err.stack : err);
        close();
    });
});

process.on('SIGINT', () => { close(); });

zk.connect();

