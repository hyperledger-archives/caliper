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
var pbTransaction = require('./external/block_pb.js').Transaction;
var pbQuery = require('./external/queries_pb.js').Query;
var grpc = require('grpc');
var endpointGrpc = require('./external/endpoint_grpc_pb.js');
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
        // return Promise.resolve();
        return sleep(5000); // wait for iroha network to start up
                            // TODO: how to judge iroha service's status elegantly?
    }

    installSmartContract() {

        // now iroha doesn't support smart contract, using internal transactions to construct contracts

        return Promise.resolve();
    }

    createClients (number) {
        try{
            console.log('Creating new account for test clients......');

            // get admin infro
            var config = require(this.configPath);
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

            // generate random name, [a-zA-Z-]
            var seed = "abcdefghijklmnopqrstuvwxyz";
            var accountNames = [];
            var generateName = function() {
                var name = "";
                for(let i = 0 ; i < 5 ; i++) {
                    name += seed.charAt(Math.floor(Math.random() * seed.length));
                }
                if(accountNames.indexOf(name) < 0) {
                    return name;
                }
                else {
                    return generateName();
                }
            }
            for(let i = 0 ; i < number ; i++) {
                let keys = crypto.generateKeypair();
                let name = generateName();
                let id   = name + '@' + domain;
                accountNames.push(name);
                result.push({
                                name:    name,
                                domain:  domain,
                                id:      id,
                                pubKey:  keys.publicKey().toString(),
                                privKey: keys.privateKey().toString(),
                            });
                // build create account transaction
                let commands = [{
                                    type: irohaType.txType['CREATE_ACCOUNT'],
                                    args: [name, domain, keys.publicKey()]
                               },
                               {
                                    type: irohaType.txType['APPEND_ROLE'],
                                    args: [id, 'admin']
                               }];
                console.log('Create account for ' + id);
                let p = irohaCommand(grpcCommandClient, adminAccount, Date.now(), this.txCounter, adminKeys, commands);
                this.txCounter++;
                promises.push(p);
            }

            return Promise.all(promises)
                    .then(()=>{
                        console.log('Submitted create account transactions.');
                        return sleep(5000);
                    })
                    .then(()=>{
                        console.log('Query accounts to see if they already exist ......')
                        let promises = [];
                        for(let i = 0 ; i < result.length ; i++) {
                            let acc = result[i];
                            let p = new Promise((resolve, reject)=>{
                                            irohaQuery(grpcQueryClient,
                                                       adminAccount,
                                                       Date.now(),
                                                       this.queryCounter,
                                                       adminKeys,
                                                       {
                                                            type: irohaType.txType['GET_ACCOUNT'],
                                                            args: [acc.id]
                                                       },
                                                       (response) => {
                                                           let accountResp = response.getAccountResponse();
                                                           console.log('Got account successfully: ' + accountResp.getAccount().getAccountId());
                                                           resolve();
                                                       }
                                            )
                                            .catch((err)=>{
                                                console.log(err);
                                                reject(new Error('Failed to query account'));
                                            });
                            });
                            this.queryCounter++;
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
            console.log(err);
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

function errorInvalidArgs(type, expectedNum, actualNum) {
    return new Error('Wrong arguments number for ' + irohaType.getTxTypeName(type) + ' : expected ' + expectedNum + ' , got ' + actualNum);
}

function irohaCommand(client, account, time, counter, keys, commands) {
    try {
         var tx = txBuilder.creatorAccountId(account)
                            .txCounter(counter)
                            .createdTime(time);
         var txHashBlob;
         commands.reduce((prev, command) => {
            return prev.then((trans) => {
                let type = command.type;
                let args = command.args;
                let expectedArgs = 0;
                switch(type) {
                    case irohaType.txType['CREATE_ACCOUNT']:
                        expectedArgs = 3;
                        if(args.length === 3) {
                           return Promise.resolve(trans.createAccount(args[0], args[1], args[2]));
                        }
                        break;
                    case irohaType.txType['APPEND_ROLE']:
                        expectedArgs = 2;
                        if(args.length === 2) {
                            return Promise.resolve(trans.appendRole(args[0], args[1]));
                        }
                        break;
                    default:
                        return Promise.reject(new Error('Unimplemented command:' + irohaType.getTxTypeName(command.type)));
                }
                return Promise.reject(errorInvalidArgs(type, expectedArgs, args.length));
            });
         }, Promise.resolve(tx))
         .then((transaction) => {
            tx = transaction.build();
            let txblob  = protoTxHelper.signAndAddSignature(tx, keys).blob();
            let txArray = blob2array(txblob);
            let txProto = pbTransaction.deserializeBinary(txArray);
            txHashBlob  = tx.hash().blob();

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
        console.log(err);
        return Promise.reject('Failed to submit iroha tranaction');
    }
}

function irohaQuery(client, account, time, counter, keys, queryCommand, callback) {
    try {
        var query = queryBuilder.creatorAccountId(account)
                                .createdTime(time)
                                .queryCounter(counter);
        var type = queryCommand.type;
        var args = queryCommand.args;
        switch(type) {
            case irohaType.txType['GET_ACCOUNT']:
                if(args.length === 1) {
                    query = query.getAccount(args[0]);
                }
                else{
                    throw errorInvalidArgs(type, 1, args.length);
                }
                break;
            default:
                throw new Error('Unimplemented query:' + irohaType.getTxTypeName(type));
        }
        query = query.build();
        var queryBlob  = protoQueryHelper.signAndAddSignature(query, keys).blob();
        var queryArray = blob2array(queryBlob);
        var protoQuery = pbQuery.deserializeBinary(queryArray);
        var responseType = require('./external/responses_pb.js').QueryResponse.ResponseCase;
        return new Promise((resolve, reject)=>{
                    client.find(protoQuery, (err, response)=>{
                        if(err){
                            console.log(err);
                            reject(err);
                        }
                        else {
                            if(response.getResponseCase() === responseType['ERROR_RESPONSE']) { // error response
                                reject(new Error('Query error, error code : ' + response.getErrorResponse().getReason()));
                            }
                            else {
                                callback(response);
                                resolve();
                            }
                        }
                    });
        });
    }
    catch(err) {
        console.log(err);
        return Promise.reject('Failed to submit iroha query');
    }
}