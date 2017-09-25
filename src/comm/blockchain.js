/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the BlockChain class, which is used to interact with backend's blockchain system
*/

'use strict'

var path = require('path');
var Blockchain = class {
    constructor(configPath) {
        var config = require(configPath);

        if(config.hasOwnProperty('fabric')) {
            var fabric = require('../fabric/fabric.js');
            this.bcType = 'fabric';
            this.bcObj = new fabric(configPath);
        }
        else if(config.hasOwnProperty('sawtooth')) {
            var sawtooth = require('../sawtooth/sawtooth.js')
            this.bcType = 'sawtooth';
            this.bcObj = new sawtooth(configPath);
        }
        else {
            this.bcType = 'unknown';
            throw new Error('Unknown blockchain config file ' + configPath);
        }
    }

    /**
    * return the blockchain type
    * @return {string}
    */
    gettype() {
        return this.bcType;
    }

    /**
    * prepare the underlying blockchain environment, e.g. join channel for fabric's peers
    * the function should be called only once for the same backend's blockchain system
    * even if multiple Blockchain objects are instantiated
    * @return {Promise}
    */
    init() {
        return this.bcObj.init();
    }

    /**
    * install smart contract on peers
    * the detailed smart contract's information should be defined in the configuration file
    * @return {Promise}
    */
    installSmartContract() {
        return this.bcObj.installSmartContract();
    }

    /**
    * get a system context that will be used to interact with backend's blockchain system
    * @name {string}, name of the context
    * @return {Promise.resolve(context)}
    */
    getContext(name) {
        return this.bcObj.getContext(name);
    }

    /**
    * release the system context
    * @return {Promise}
    */
    releaseContext(context) {
        return this.bcObj.releaseContext(context);
    }

    /**
    * perform an 'invoke' transaction
    * @context {Object}, context returned by getContext
    * @contractID {string}, smart contract's id
    * @contractVer {string}, smart contract's version
    * @args {Array}, invoking arguments [arg1, arg2, ...]
    * @timeout {Number}, return directly after that time in seconds has elapsed
    * @return {Promise.resolve(Object)}, return the key informations of the transaction, the format is
     *       {
    *           'id': transaction's id
    *           'status':  status of the transaction, should be:
    *                        - 'created': successfully created, but not validated or committed yet
    *                        - 'success': successfully validated and committed in the ledger
    *           'time_create': time that the transaction was created
    *           'time_valid':  time that the transaction was known to be valid and committed in ledger
    *           'result': response payloads of the transaction request
    *           ...... :  blockchain platform specific values
    *         }
    */
    invokeSmartContract(context, contractID, contractVer, args, timeout) {
        if(typeof timeout !== 'number' || timeout < 0) {
            return this.bcObj.invokeSmartContract(context, contractID, contractVer, args, 120);
        }
        else {
            return this.bcObj.invokeSmartContract(context, contractID, contractVer, args, timeout);
        }
    }

    /**
    * * perform a 'query' transaction to get state from the ledger
    * @return {Promsie}, same format as invokeSmartContract's returning
    */
    queryState(context, contractID, contractVer, key) {
        return this.bcObj.queryState(context, contractID, contractVer, key);
    }

    /**
    * txStatistics = {
    *     succ : ,                            // number of succeeded txs
    *     fail : ,                            // number of failed txs
    *     create : {min: , max: },            // min/max time of tx created
    *     valid  : {min: , max: },            // min/max time of tx becoming valid
    *     delay  : {min: , max: , sum: },     // min/max/sum time of txs' processing delay
    *     throughput : {time: ,...},          // tps of each time slot
    *     others: {object}                    // blockchain platform specific values
    * }
    */
    /**
    * generate and return the default statistics of transactions
    * @ results {Array}, results of 'invoke'/'query' transactions
    * @ return {Promise.resolve(txStatistics)}
    */
    // TODO: should be moved to a dependent 'analyser' module in which to do all result analysing work
    getDefaultTxStats(results) {
        var succ = 0, fail = 0, delay = 0;
        var minValid, maxValid, minCreate, maxCreate;
        var minDelay = 100000, maxDelay = 0;
        var throughput = {};
        for(let i = 0 ; i < results.length ; i++) {
            let stat   = results[i];
            let create = stat['time_create'];

            if(typeof minCreate === 'undefined') {
                minCreate = create;
                maxCreate = create;
            }
            else {
                if(create < minCreate) {
                    minCreate = create;
                }
                if(create > maxCreate) {
                    maxCreate = create;
                }
            }

            if(stat.status === 'success') {
                succ++;
                let valid = stat['time_valid'];
                let d     = valid - create;
                if(typeof minValid === 'undefined') {
                    minValid = valid;
                    maxValid = valid;
                }
                else {
                    if(valid < minValid) {
                        minValid = valid;
                    }
                    if(valid > maxValid) {
                        maxValid = valid;
                    }
                }

                delay += d;
                if(d < minDelay) {
                    minDelay = d;
                }
                if(d > maxDelay) {
                    maxDelay = d;
                }

                let idx = Math.round(valid).toString();
                if(typeof throughput[idx] === 'undefined') {
                    throughput[idx] = 1;
                }
                else {
                    throughput[idx] += 1;
                }
            }
            else {
                fail++;
            }
        }

        var stats = {
            'succ' : succ,
            'fail' : fail,
            'create' : {'min' : minCreate, 'max' : maxCreate},
            'valid'  : {'min' : minValid,  'max' : maxValid },
            'delay'  : {'min' : minDelay,  'max' : maxDelay, 'sum' : delay },
            'throughput' : throughput
        };

        if(this.bcObj.getDefaultTxStats !== 'undefined') {
            this.bcObj.getDefaultTxStats(stats, results);
        }

        return stats;
    }
}

module.exports = Blockchain;