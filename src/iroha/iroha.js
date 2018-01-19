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

class Iroha extends BlockchainInterface{
    constructor(config_path) {
        super(config_path);
    }

    init() {
        // todo
    }

    installSmartContract() {
        // todo

    }

    getContext(name) {
        // todo
    }

    releaseContext(context) {
        // todo
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