/**
* Copyright 2017 HUAWEI. All Rights Reserved.
*
* SPDX-License-Identifier: Apache-2.0
*
* @file, definition of the MonitorDocker class
*        which is used to watch the resource consumption of specific local docker containers
*/


'use strict'

// todo: now we record the performance information in local variable, should use db later
var MonitorDocker = class {
    constructor(filter, interval) {
        this.filter       = filter;
        this.interval     = interval*1000; // ms
        this.si           = require('systeminformation');
        this.containers   = [];
        this.isReading    = false;
        this.intervalObj  = null;
        /* record statistics of each container
            {
                'time' : [] // time slot
                'container_id" : {              // refer to https://www.npmjs.com/package/systeminformatioin
                    'mem_usage'   : [],
                    'mem_percent' : [],
                    'cpu_percent' : [],
                    'netIO_rx'    : [],
                    'netIO_tx'    : [],
                    'blockIO_rx'  : [],
                    'blockIO_wx'  : []
                }
                next container
                .....
            }
        */
        this.stats = null;

    }

    /**
    * start monitoring
    * @isRestart {Boolean}, indicate whether it is restarting the monitor
    * @return {Promise}
    */
    start(isRestart) {
        if(typeof isRestart === 'undefined') {
            isRestart = false;
        }

        var p;
        if(isRestart) {
            p = Promise.resolve();
        }
        else {
            this.containers = [];
            this.stats = {'time': []};
            p = findContainers.call(this);
        }

        return p.then( () => {
            var self = this;
            function readContainerStats() {
                if(self.isReading) {
                    return;
                }
                self.isReading = true;
                var statPromises = [];
                for(let i = 0 ;i < self.containers.length ; i++){
                    statPromises.push(self.si.dockerContainerStats(self.containers[i].id));
                }
                Promise.all(statPromises).then((results) => {
                    self.stats.time.push(process.uptime());
                    for(let key in results) {
                        let stat = results[key];
                        self.stats[stat.id].mem_usage.push(stat.mem_usage);
                        self.stats[stat.id].mem_percent.push(stat.mem_percent);
                        self.stats[stat.id].cpu_percent.push(stat.cpu_percent);
                        self.stats[stat.id].netIO_rx.push(stat.netIO.rx);
                        self.stats[stat.id].netIO_tx.push(stat.netIO.tx);
                        self.stats[stat.id].blockIO_rx.push(stat.blockIO.r);
                        self.stats[stat.id].blockIO_wx.push(stat.blockIO.w);
                    }
                    self.isReading = false;
                })
                .catch((err) => {
                    self.isReading = false;
                });
            };

            readContainerStats();   // read stats  immediately
            this.intervalObj = setInterval(readContainerStats, this.interval);
            return Promise.resolve();
        })
        .catch((err) => {
            return Promise.reject(err);
        });
    }

    restart() {
        clearInterval(this.intervalObj);
        for(let key in this.stats) {
            if(key === 'time') {
                this.stats[key] = [];
            }
            else {
                for(let v in this.stats[key]) {
                    this.stats[key][v] = [];
                }
            }
        }

        return this.start(true);
    }

    stop() {
        clearInterval(this.intervalObj);
        this.containers = [];
        this.stats      = null;

        return sleep(100);
    }

    /**
    * Get peer list and predefined readable information
    * @return {Array}, {key, info={...}}
    */
    getBriefPeerInfo() {
        var info = [];
        for(let i in this.containers) {
            let c = this.containers[i];
            if(c.hasOwnProperty('id')) {
                info.push({
                    'key'  : c.id,
                    'info' : {
                        'ID' : c.id,
                        'NAME' : c.name
                    }
                });
            }
        }
        return info;
    }

    /**
    * Get peer's history of memory usage, byte
    * @key {string}, peer's key
    * @return {Array}
    */
    getMemHistory(key) {
        return this.stats[key].mem_usage;
    }

    /**
    * Get peer's history of cpu percent, %
    * @key {string}, peer's key
    * @return {Array}
    */
    getCpuHistory(key) {
        return this.stats[key].cpu_percent;
    }

    /**
    * Get peer's history of network io usage, byte
    * @key {string}, peer's key
    * @return {Array}, [{in: inflow traffic, out: outflow traffic}]
    */
    getNetworkHistory(key) {
        return {'in': this.stats[key].netIO_rx, 'out':this.stats[key].netIO_tx};
    }
};
module.exports = MonitorDocker;

/**
* Find local containers according to searching filters
*/
function findContainers() {
    var filterName = this.filter['name'];
    var all = false;
    if(typeof filterName !== 'undefined' && filterName[0] === 'all') {
        all = true;
    }

    return this.si.dockerContainers('active').then((containers) => {
        var size = containers.length;
        if(size === 0) {
            return Promise.reject(new Error('systeminformation: could not find active container'));
        }

        if(all) {
            for(let i = 0 ; i < size ; i++){
                this.containers.push(containers[i]);
                this.stats[containers[i].id] = newContainerStat();
            }
        }
        else {
            // get containers by name
            if(typeof filterName !== 'undefined') {
                for(let i = 0 ; i < size ; i++){
                    if(filterName.indexOf(containers[i].name) >= 0) {
                        this.containers.push(containers[i]);
                        this.stats[containers[i].id] = newContainerStat();
                    }
                }
            }
            // todo: support other filters
        }

        return Promise.resolve();
    })
    .catch((err) => {
        return Promise.reject(err);
    });
}

function newContainerStat() {
    return {
        mem_usage:   [],
        mem_percent: [],
        cpu_percent: [],
        netIO_rx:    [],
        netIO_tx:    [],
        blockIO_rx:  [],
        blockIO_wx:  []
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}