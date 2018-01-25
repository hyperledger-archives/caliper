/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the Fabric class, which implements the caliper's NBI for hyperledger fabric
*/


'use strict'

var txType =  {
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
    TRANSFER_ASSET : 16
};

module.exports.txType = txType;

module.exports.getTxTypeName = function (type) {
    for(let key in txType) {
        if(txType[key] === type) {
            return key;
        }
    }
    return 'unknown';
}

