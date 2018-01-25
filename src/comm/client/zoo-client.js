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
    clear()
    .then(()=>{
        let promises = [];
        if(inNode !== '') {
            promises.push(zkUtil.removeP(zk, inNode, -1, 'Failed to remove inNode due to'));
        }
        if(outNode !== '') {
            promises.push(zkUtil.removeP(zk, outNode, -1, 'Failed to remove inNode due to'));
        }
    })
    .then(()=>{
        console.log('Node ' + inNode + ' ' + outNode + ' is deleted');
        inNode = '';
        outNode = '';
        zk.close();
    })
    .catch((err)=>{
        inNode = '';
        outNode = '';
        zk.close();
    })
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
function queryResult(session, data) {
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

function finish() {
    Blockchain.mergeDefaultTxStats(results);
    var message = {type: 'testResult', data: results[0]};
    var buf = new Buffer(JSON.stringify(message));
    write(buf);
}

function clear() {
    var promises = [];
    if(inNode !== '') {
        promises.push(zkUtil.removeChildrenP(zk, inNode, 'Failed to remove children due to'));
    }
    if(outNode !== '') {
        promises.push(zkUtil.removeChildrenP(zk, outNode, 'Failed to remove children due to'));
    }
    clientUtil.stop();
    return Promise.all(promises);
}

function write(data) {
    return zkUtil.createP(zk, outNode+'/msg_', data, ZooKeeper.CreateMode.EPHEMERAL_SEQUENTIAL, 'Failed to send message (create node) due to');
}

function zooMessageCallback(data) {
    var msg  = JSON.parse(data.toString());
    console.log('Receive message, type='+msg.type);

    switch(msg.type) {
        case 'test':
            localClients = msg.clients;
            results = [];
            zkUtil.removeChildrenP(zk, outNode, 'Failed to remove children in outNode due to')
            .then(()=>{
                return clientUtil.startTest(msg.clients, msg, queryResult, results);
            })
            .then(() => {
                return finish();
            })
            .catch((err)=>{
                console.log('==Exception while testing, ' + err);
                results = [];   // clear all results and then return the end message
                return finish();
            });
            break;
        case 'queryNewTx':
            let obj = setTimeout(()=>{
                queryResult(msg.session, 'timeout');
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
        case 'quit':
            clear();
            break;
        default:
            clientUtil.sendMessage(msg);
            break;
    }
    return Promise.resolve(closed);
}

function watch() {
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
    ).catch((err) => {
        return;
    })
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

