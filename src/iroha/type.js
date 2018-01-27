/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the Fabric class, which implements the caliper's NBI for hyperledger fabric
*/


'use strict'

var txType =  {
    // commands
    ADD_ASSET_QUANTITY : 1,
    ADD_PEER : 2,
    ADD_SIGATORY : 3,
    APPEND_ROLE : 4,
    CREATE_ACCOUNT : 5,
    CREATE_ASSET : 6,
    CREATE_DOMAIN : 7,
    CREATE_ROLE : 8,
    DETACH_ROLE : 9,
    GRANT_PERMISSION : 10,
    REMOVE_SIGNATORY : 11,
    REVOKE_PERMISSION : 12,
    SET_ACCOUNT_DETAIL : 13,
    SET_ACCOUNT_QUORUM : 14,
    SUBTRACT_ASSET_QUANTITY : 15,
    TRANSFER_ASSET : 16,
    // query, started from 100
    GET_ACCOUNT : 101,
    GET_SIGNATORIES : 102,
    GET_ACCOUNT_TRANSACTIONS : 103,
    GET_ACCOUNT_ASSERT_TRANSACTIONS : 104,
    GET_TRANSACTIONS : 105,
    GET_ACCOUNT_ASSETS : 106,
    GET_ASSET_INFO : 107,
    GET_ROLES : 108,
    GET_ROLE_PERMISSIONS : 109
};
module.exports.txType = txType;

/**
* judge whether the type is a command type or query type
* @type {Number}
* @return {Number}, 0: command; 1: query
*/
module.exports.commandOrQuery = function (type) {
    if(type < 100) {
        return 0;
    }
    else {
        return 1;
    }
}

module.exports.getTxTypeName = function (type) {
    for(let key in txType) {
        if(txType[key] === type) {
            return key;
        }
    }
    return 'unknown';
}

