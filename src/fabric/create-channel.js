/**
 * Modifications Copyright 2017 HUAWEI
 * Copyright 2016 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

if (global && global.hfc) global.hfc.config = undefined;
require('nconf').reset();
var utils = require('fabric-client/lib/utils.js');
var logger = utils.getLogger('E2E create-channel');

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var Client = require('fabric-client');
var util = require('util');
var fs = require('fs');
var path = require('path');
var grpc = require('grpc');

var testUtil = require('./util.js');
var e2eUtils = require('./e2eUtils.js');

var the_user = null;

function run(config_path) {

    return new Promise(function(resolve, reject) {
        test('\n\n***** create channels  *****\n\n', function(t) {
            Client.addConfigFile(config_path);
            var fabric = Client.getConfigSetting('fabric');
            var ORGS = fabric.network;
            var channel_name = fabric.channel.name;
            var channel_conf = fabric.channel.config;
            var client = new Client();

            // TODO: 1. multiple channels support 2. add indicator in config to tell not to start the channel in case the channel has already benn created

            var caRootsPath = ORGS.orderer.tls_cacerts;
            let data = fs.readFileSync(path.join(__dirname, '../..', caRootsPath));
            let caroots = Buffer.from(data).toString();

            var orderer = client.newOrderer(
                ORGS.orderer.url,
                {
                    'pem': caroots,
                    'ssl-target-name-override': ORGS.orderer['server-hostname']
                }
            );

            var config = null;
            var signatures = [];
            var orgarray   = [];
            for (let v in ORGS) {
                if(v.indexOf('org') === 0) {
                    orgarray[orgarray.length] = v;
                }
            }
            var org = orgarray[0].name;

            utils.setConfigSetting('key-value-store', 'fabric-client/lib/impl/FileKeyValueStore.js');

            return Client.newDefaultKeyValueStore({
                path: testUtil.storePathForOrg(org)
            }).then((store) => {
                client.setStateStore(store);
                var cryptoSuite = Client.newCryptoSuite();
                cryptoSuite.setCryptoKeyStore(Client.newCryptoKeyStore({path: testUtil.storePathForOrg(org)}));
                client.setCryptoSuite(cryptoSuite);

                return testUtil.getOrderAdminSubmitter(client, t);
            }).then((admin) =>{
                // use the config update created by the configtx tool
                let envelope_bytes = fs.readFileSync(path.join(__dirname, '../..', channel_conf));
                config = client.extractChannelConfig(envelope_bytes);

                // TODO: read from channel config instead of binary tx file

                // enroll orgs one by one
                return orgarray.reduce(function(prev, item){
                    return prev.then(() => {
                        client._userContext = null;
                        return testUtil.getSubmitter(client, t, true, item).then((admin) =>{
                            // sign the config
                            let signature = client.signChannelConfig(config);
                            let string_signature = signature.toBuffer().toString('hex');
                            // TODO: signature counting against policies on the orderer
                            // at the moment is being investigated, but it requires this
                            // weird double-signature from each org admin
                            signatures.push(string_signature);
                            signatures.push(string_signature);
                            return Promise.resolve();
                        });
                    })
                }, Promise.resolve())
                .then(()=>{
                    client._userContext = null;
                    return testUtil.getOrderAdminSubmitter(client, t);
                });
            }).then((admin) => {
                the_user = admin;

                // sign the config
                var signature = client.signChannelConfig(config);

                // collect signature from orderer org admin
                // TODO: signature counting against policies on the orderer
                // at the moment is being investigated, but it requires this
                // weird double-signature from each org admin
                signatures.push(signature);
                signatures.push(signature);

                // build up the create request
                let tx_id = client.newTransactionID();
                var request = {
                    config: config,
                    signatures : signatures,
                    name : channel_name,
                    orderer : orderer,
                    txId  : tx_id
                };

                // send create request to orderer
                return client.createChannel(request);
            })
            .then((result) => {
                if(result.status && result.status === 'SUCCESS') {
                    t.pass('created channel successfully');
                    t.comment('Sleep 5s......');
                    return e2eUtils.sleep(5000).then(() => {
                        t.end();
                        return resolve();
                    });
                } else {
                    t.fail('Failed to create the channel. ');
                    t.end();
                    return reject(new Error('Fabric: Create channel failed'));
                }
            })
            .catch((err) => {
                t.fail('Failed to create the channel, ' + (err.stack?err.stack:err));
                t.end();
                return reject(new Error('Fabric: Create channel failed'));
            });
        });
    });
}

module.exports.run = run;

