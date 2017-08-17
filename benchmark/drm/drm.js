/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, This test tests the performance of a simple drm system:
*        A new digital item (e.g a song) can be uploaded to the server for publishing.
*        The smart contract checks if the item is already published
*        If not, a identity(hash) is generated for this item and stored in the ledger.
*        The identity is returned to the client, and can be used to query the state.
*        The performance of publishing and querying are tested.
*/


'use strict'

var path = require('path');
var config_path;
if(process.argv.length < 3) {
    config_path = path.join(__dirname, 'config.json');
}
else {
    config_path = path.join(__dirname, process.argv[2]);
}

// use default framework to run the tests
var framework = require('../../src/comm/bench-flow.js');
framework.run(config_path);



