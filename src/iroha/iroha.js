/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the Fabric class, which implements the caliper's NBI for hyperledger fabric
*/


'use strict'

var BlockchainInterface = require('../comm/blockchain-interface.js');
var iroha = require('./external/irohanode');
var txBuilder = new iroha.ModelTransactionBuilder();
var queryBuilder = new iroha.ModelQueryBuilder();
var crypto = new iroha.ModelCrypto();
var protoTxHelper = new iroha.ModelProtoTransaction();
var protoQueryHelper = new iroha.ModelProtoQuery();
var pbTransaction = require('./pb/block_pb.js').Transaction;
var pbQuery = require('./pb/queries_pb.js').Query;
var grpc = require('grpc');
var endpointGrpc = require('./pb/endpoint_grpc_pb.js');
var irohaType = require('./type.js');
var fs = require('fs');
var path = require('path');
var sleep = require('../comm/sleep.js');

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
        this.txCounter = 1;
        this.queryCounter = 1;
    }

    init() {
        return Promise.resolve();
    }

    installSmartContract() {

        // now iroha doesn't support smart contract, using internal transactions to construct contracts

        return Promise.resolve();
    }

    createClients (number) {
        try{
            console.log('Creating new account for test clients......');

            // get admin infro
            var admin        = config.iroha.admin;
            var domain       = admin.domain;
            var adminAccount = admin.account + '@' + admin.domain;
            var privPath     = path.join(__dirname, '../..', admin['key-priv']);
            var pubPath      = path.join(__dirname, '../..', admin['key-pub']);
            var adminPriv    = fs.readFileSync(privPath).toString();
            var adminPub     = fs.readFileSync(pubPath).toString();
            var adminKeys    = crypto.convertFromExisting(adminPub, adminPriv);

            // create account for each client
            var result = [];
            var promises = [];
            var node = this._findNode();
            var grpcCommandClient = new endpointGrpc.CommandServiceClient(node.torii, grpc.credentials.createInsecure());
            var grpcQueryClient   = new endpointGrpc.QueryServiceClient(node.torii, grpc.credentials.createInsecure());
            for(let i = 0 ; i < number ; i++) {
                let keys = crypto.generateKeypair();
                let name = 'calipertest' + i;
                result.push({
                                name:    name,
                                domain:  domain,
                                pubKey:  keys.publicKey().toString(),
                                privKey: keys.privateKey().toString(),
                            });
                // build create account transaction
                let commands = [{
                                    type:   irohaType.txType['CREATE_ACCOUNT'],
                                    name:   name,
                                    domain: domain,
                                    pubKey: keys.publicKey()
                               }];
                console.log('Submit transaction for account ' + name);
                let p = irohaCommand(grpcCommandClient, adminAccount, Date.now(), this.txCounter, adminKeys, commands);
                this.txCounter++;
                promises.push(p);
            }

            return Promise.all(promises)
                    .then(()=>{
                        return sleep(5000);
                    })
                    .then(()=>{
                        console.log('Query accounts to see if they already exist ......')
                        let promises = [];
                        for(let i = 0 ; i < result.length ; i++) {
                            let acc = result[i];

                            let query = queryBuilder.creatorAccountId(adminAccount)
                                        .createdTime(Date.now())
                                        .queryCounter(this.queryCounter)
                                        .getAccount(acc.name + '@' + acc.domain)
                                        .build();
                            let queryBlob  = protoQueryHelper.signAndAddSignature(query, adminKeys).blob();
                            let queryArray = blob2array(queryBlob);
                            let protoQuery = pbQuery.deserializeBinary(queryArray);
                            let p = new Promise((resolve, reject)=>{
                                grpcQueryClient.find(protoQuery, (err, response)=>{
                                    if(err){
                                        console.log(err);
                                        reject(err);
                                    }
                                    else {
                                        resolve();
                                    }
                                });
                            });
                            promises.push(p);
                        }
                        return Promise.all(promises);
                    })
                    .then(()=>{
                        console.log('Finished create accounts, save key pairs for later use');
                        return Promise.resolve(result);
                    })
                    .catch(()=>{
                        return Promise.reject(new Error('Could not create accounts for Iroha clients'));
                    });
        }
        catch (err) {
            return Promise.reject(new Error('Could not create accounts for Iroha clients'));
        }

    }

    getContext(name, args) {
        try {
            var config = require(this.configPath);

            // find callbacks for simulated smart contract
            var fc = config.iroha.fakecontract;
            var fakeContracts = {};
            for(let i = 0 ; i < fc.length ; i++) {
                let contract = fc[i];
                let facPath  = path.join(__dirname, '../..', contract.factory);
                let factory  = require(facPath);
                for(let j = 0 ; j < contract.id.length ; j++) {
                    let id = contract.id[j]
                    if(!factory.contracts.hasOwnProperty(id)) {
                        throw new Error('Could not get function "' + id + '" in ' + facPath);
                    }
                    else {
                        if(fakeContracts.hasOwnProperty(id)) {
                            console.log('WARNING: multiple callbacks for ' + id + ' have been found');
                        }
                        else {
                            fakeContracts[id] = factory.contracts[id];
                        }
                    }
                }
            }

            var node = this._findNode();

            // return the context
            return Promise.resolve();
            /*return Promise.resolve({
                torii: node.torii,
                creator: node['test-user'],
                keys: keys,
                contract: fakeContracts
            });*/
        }
        catch (err) {
            console.log(err);
            return Promise.reject(new Error('Failed when finding access point or user key'));
        }
    }

    releaseContext(context) {
        return Promise.resolve();
    }

    invokeSmartContract(context, contractID, contractVer, args, timeout) {
        // todo
        return Promise.resolve();
    }

    queryState(context, contractID, contractVer, key) {
        // todo
        return Promise.resolve();
    }

    _findNode() {
        var nodes  = [];
        var config = require(this.configPath);
        for(let i in config.iroha.network) {
            if(config.iroha.network[i].hasOwnProperty('torii')) {
                nodes.push(config.iroha.network[i]);
            }
        }
        if(nodes.length === 0) {
            throw new Error('Could not find valid access points');
        }
        return nodes[Math.floor(Math.random()*(nodes.length))];
    }

}
module.exports = Iroha;

function irohaCommand(client, account, time, counter, keys, commands) {
    try {
         var tx = txBuilder.creatorAccountId(account)
                            .txCounter(counter)
                            .createdTime(time);
         var txHashBlob;
         commands.reduce((prev, command) => {
            switch(command.type) {
                case irohaType.txType['CREATE_ACCOUNT']:
                    return Promise.resolve(prev.createAccount(command.name, command.domain, command.pubKey));
                default:
                    return Promise.reject(new Error('Unimplemented command:' + irohaType.getTxTypeName(command.type)));
            }
         }, Promise.resolve(tx))
         .then((transaction) => {
            transaction.build();
            let txblob  = protoTxHelper.signAndAddSignature(transaction, keys).blob();
            let txArray = blob2array(txblob);
            let txProto = pbTransaction.deserializeBinary(txArray);
            txHashBlob  = transaction.hash().blob();
            return new Promise((resolve, reject) => {
                            client.torii(txProto, (err, data)=>{
                            if(err){
                                reject(err);
                            }
                            else {
                                resolve();
                            }
                        });
                    });
         })
         .then(()=>{
            return Promise.resolve(txHashBlob);
         })
         .catch((err)=>{
            console.log(err);
            return Promise.reject('Failed to submit iroha tranaction');
         })
    }
    catch(err) {
        return Promise.reject('Failed to submit iroha tranaction');
    }
}