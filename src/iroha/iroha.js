/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the Fabric class, which implements the caliper's NBI for hyperledger fabric
*/


'use strict'


var iroha = require('./external/irohanode');

function blob2array(blob) {
    var bytearray = new Uint8Array(blob.size());
    for (let i = 0 ; i < blob.size() ; ++i) {
        bytearray[i] = blob.get(i);
    }
    return bytearray;
}

var path = require('path');
class Iroha extends BlockchainInterface{
    constructor(config_path) {
        super(config_path);
    }

    init() {
        return Promise.resolve();
    }

    installSmartContract() {

        // now iroha doesn't support smart contract, using internal transactions to construct contracts

        return Promise.resolve();
    }

    getContext(name) {
        try {
            var config = require(this.configPath);

            // find callbacks for simulated smart contract
            var sc = config.iroha.fakecontract;
            var fakeContracts = {};
            for(let contract in sc) {
                let facPath  = path.join(__dirname, '../..', contract.factory);
                let factory  = require(facPath);
                for(let id in contract.id) {
                    if(!factory[id]) {
                        throw new Error('Could not get function ' + contract.id + ' in ' + factory);
                    }
                    else {
                        if(fakeContracts.hasOwnProperty(id)) {
                            console.log('WARNING: multiple callbacks for ' + id + ' have been found');
                        }
                        else {
                            fakeContracts[id] = factory[id];
                        }
                    }
                }
            }

            // find a random node as the access point
            var nodes  = [];
            for(let v in config.iroha.network) {
                if(v.hasOwnProperty('torii') && v.hasOwnProperty('test-user')) {
                    nodes.push(v);
                }
            }
            if(nodes.length === 0) {
                throw new Error('Could not find valid access points');
            }
            var node = nodes[Math.floor(Math.random()*(nodes.length))];
            var user = config.iroha.user[node['test-user']];
            var privPath = path.join(__dirname, '../..', user['key-priv']);
            var pubPath  = path.join(__dirname, '../..', user['key-pub']);
            var fs = require('fs');
            var keyPriv = fs.readFileSync(privPath).toString();
            var keyPub  = fs.readFileSync(pubPath).toString();
            var crypto = new iroha.ModelCrypto();
            var keys = crypto.convertFromExisting(keyPub, keyPriv);
            return Promise.resolve({
                torii: node.torii,
                creator: node['test-user'],
                keys: keys,
                contract: fakeContracts
            });
        }
        catch (err) {
            console.log(err);
            return Promise.reject(new Error('Failed when finding access point or user key));
        }
    }

    releaseContext(context) {
        return Promise.resolve();
    }

    invokeSmartContract(context, contractID, contractVer, args, timeout) {
        // todo
    }

    queryState(context, contractID, contractVer, key) {
        // todo
    }

    getDefaultTxStats(stats, results) {
        // todo

    }
}
module.exports = Iroha;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}