/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the Monitor class, which is used to start/stop a monitor to watch the resource consumption
*/


'use strict'

var dockerMonitor = require('./monitor-docker.js');
var table         = require('table');

var Monitor = class {
    constructor(config_path) {
        this.configPath = config_path;
        this.started = false;
    }

    /**
    * start monitoring
    * @return {Promise}
    */
    start() {
        var config = require(this.configPath);
        var m = config.monitor;
        if(typeof m === 'undefined') {
            return Promise.reject(new Error('Failed to find monitor in config file'));
        }

        var type = m.type;
        if(typeof m === 'undefined') {
            return Promise.reject(new Error('Failed to find monitor type in config file'));
        }

        var p;
        if(this.started === true) {
            p = stop();
        }
        else {
            p = Promise.resolve();
        }

        return p.then(() => {
            if(type === 'docker') {     // monitor for local docker containers
                var filter = m.docker;
                if(typeof filter === 'undefined') {
                    filter = {'name': ["all"]};
                }
                var interval = m.interval;
                if(typeof interval === 'undefined') {
                    interval = 1;
                }

                this.monitor = new dockerMonitor(filter, interval);
                return this.monitor.start();
            }

            // TODO: other environments' monitor, e.g. k8s,aws,...

            return Promise.reject(new Error('undefined monitor type: ' + type));
        })
        .then(() => {
            this.started = true;
            return Promise.resolve();
        })
        .catch((err) => {
            return Promise.reject(err);
        })
    }

    /**
    * stop monitoring
    * @return {Promise}
    */
    stop() {
        if(typeof this.monitor !== 'undefined' && this.started === true) {
            return this.monitor.stop().then(() => {
                this.started = false;
                return Promise.resolve();
            })
            .catch((err) => {
                return Promise.reject(err);
            });
        }

        return Promise.resolve();
    }

    /**
    * restart monitoring, all the data recorded before will be cleared
    * @return {Promise}
    */
    restart() {
        if(typeof this.monitor !== 'undefined' && this.started === true){
            return this.monitor.restart();
        }

        return Promise.resolve();
    }

    /**
    * print the default statistics
    */
    printDefaultStats() {
        try {
            var peers = this.monitor.getBriefPeerInfo();   // [{'key': peer's key, 'info' : {peer's attributes}}]
            if(peers.length === 0) {
                throw new Error('could not get peers\' information')
            }

            for(let i in peers) {
                let key = peers[i].key;
                let mem = this.monitor.getMemHistory(key);
                let cpu = this.monitor.getCpuHistory(key);
                let net = this.monitor.getNetworkHistory(key);
                let mem_stat = getStatistics(mem);
                let cpu_stat = getStatistics(cpu);

                peers[i]['info']['Memory(max)'] = byteNormalize(mem_stat.max);
                peers[i]['info']['Memory(avg)'] = byteNormalize(mem_stat.avg);
                peers[i]['info']['CPU(max)'] = cpu_stat.max.toFixed(2) + '%';
                peers[i]['info']['CPU(avg)'] = cpu_stat.avg.toFixed(2) + '%';
                peers[i]['info']['Traffic In']  = byteNormalize(net.in[net.in.length-1] - net.in[0]);
                peers[i]['info']['Traffic Out'] = byteNormalize(net.out[net.out.length-1] - net.out[0]);
            }

            var defaultTable = [];
            var tableHead    = [];
            for(let i in peers[0].info) {
                tableHead.push(i);
            }
            defaultTable.push(tableHead);
            for(let i in peers){
                let row = [];
                for(let j in peers[i].info) {
                    row.push(peers[i].info[j]);
                }
                defaultTable.push(row);
            }

            var t = table.table(defaultTable, {border: table.getBorderCharacters('ramac')});
            console.log('###peers\' stats###');
            console.log(t);
        }
        catch(err) {
            console.log('Failed to read monitoring data, ' + (err.stack ? err.stack : err));
        }
    }
}

module.exports = Monitor;

/**
* get the maximum,minimum,total, average value from a number array
* @arr {Array}
* @return {Object}
*/
function getStatistics(arr) {
    if(arr.length === 0) {
        return {max : NaN, min : NaN, total : NaN, avg : NaN};
    }

    var max = arr[0], min = arr[0], total = arr[0];
    for(let i = 1 ; i< arr.length ; i++) {
        let value = arr[i];
        if(value > max) {
            max = value;
        }
        if(value < min) {
            min = value;
        }
        total += value;
    }

    return {max : max, min : min, total : total, avg : total/arr.length};
}

/**
* Normalize the byte number
* @data {Number}
* @return {string}
*/
function byteNormalize(data) {
    var kb = 1024;
    var mb = kb * 1024;
    var gb = mb * 1024;
    if(data < kb) {
        return data.toString() + 'B';
    }
    else if(data < mb) {
        return (data / kb).toFixed(1) + 'KB';
    }
    else if(data < gb) {
        return (data / mb).toFixed(1) + 'MB';
    }
    else{
        return (data / gb).toFixed(1) + 'GB';
    }
}
