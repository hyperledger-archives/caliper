## Caliper Introduction

Caliper is a blockchain performance benchmark framework, which allows users to test different blockchain solutions with predefined use cases, and get a set of performance test results.

Currently supported blockchain solutions:
* [fabric 1.0](https://github.com/hyperledger/fabric)
* [sawtooth](https://github.com/hyperledger/sawtooth-core) 

Currently supported performance indicators:
* Success rate
* Throughput (TPS)
* Transaction confirmation latency
* Resource consumption (CPU, Memory, Network IO,...)

To learn more details, please refer to [Architecture introduction](docs/Architecture.md). 

## Build

### Pre-requisites

Make sure following tools are installed
* NodeJS 6.X
* Docker
* Docker-compose
* Blockchain system for test

Run `npm install` to install dependencies locally

### Install blockchain SDKs
* Fabric
  * Clone [fabric-sdk-node](https://github.com/hyperledger/fabric-sdk-node) and run the headless tests to make sure everything is ok
  * Install **fabric-client** and **fabric-ca-client** from the SDK, e.g run `npm install path-to-sdk/fabric-client path-to-sdk/fabric-ca-client` in caliper's root folder, or just copy the `node_modules` from fabric-sdk-node project 
  
* Sawtooth
  * Clone [sawtooth-core](https://github.com/hyperledger/sawtooth-core) and run the `./bin/run_tests -m javascript_sdk` to test the SDK
  * Install **sawtooth-sdk** from the SDK, e.g run `npm install path-to-sdk/javascript` in capliper's root folder.


## Run an existing benchmark

All predefined benchmarks can be found in [*caliper/benchmark*](./benchmark) folder. 
To start a benchmark, just run `node main.js -c yourconfig.json -n yournetwork.json` in the folder of the benchmark. 
* -c : specify the config file of the benchmark, if not used,  *config.json* will be used as default.
* -n : specify the config file of the blockchain network under test. If not used, the file address must be specified in the benchmak config file.
```bash
# start the simple benchmark, default config.json is used
cd ~/caliper/benchmark/simple
node main.js
```

Each benchmark is provided along with some networks under test which are defined in [*caliper/network*](./network) folder.
The network can be deployed automatically by using *'command'* object in the configuration file to define the bootstrap commands, as well as the clear-up commands, e.g
```json
{
  "command" : {
    "start": "docker-compose -f network/fabric/simplenetwork/docker-compose.yaml up -d",
    "end" : "docker-compose -f network/fabric/simplenetwork/docker-compose.yaml down;docker rm $(docker ps -aq)"
  }
}
```

User's own existing blockchain network can also be integrated with the benchmark, as long as the network is properly configured by the configuration file. See [Confgituraion Introduction](./docs/Architecture.md#configuration-file) to learn how to write the configuration.

A HTML report will be generated automatically after the testing.

**Alternative**

You can also use npm scripts to run a benchmark.
* npm run list: list all available benchmarks
```bash
$ npm run list

> caliper@0.1.0 list /home/hurf/caliper
> node ./scripts/list.js

Available benchmarks:
drm
simple
```

* npm test: run a benchmark with specific config files
```bash
$ npm test -- simple -c ./benchmark/simple/config.json -n ./benchmark/simple/fabric.json

> caliper@0.1.0 test /home/hurf/caliper
> node ./scripts/test.js "simple" "-c" "./benchmark/simple/config.json" "-n" "./benchmark/simple/fabric.json"
......
```



## Write your own benchmarks
Caliper provides a set of nodejs NBIs (North Bound Interfaces) for applications to interact with backend blockchain system. Check the [*src/comm/blockchain.js*](./src/comm/blockchain.js) to learn about the NBIs. Multiple *Adaptors* are implemented to translate the NBIs to different blockchain protocols. So developers can write a benchmark once, and run it with different blockchain systems.

Generally speaking, to write a new caliper benchmark, you need to:
* Write smart contracts for systems you want to test
* Write a testing flow using caliper NBIs. Caliper provides a default benchmark engine, which is pluggable and configurable to integrate new tests easily. For more details, please refer to [Benchmark Engine](./docs/Architecture.md#benchmark-engine) .
* Write a configuration file to define the backend network and benchmark arguments.

## Directory Structure
**Directory** | **Description**
------------------ | --------------
/benchmark | Samples of the blockchain benchmarks
/docs | Documents
/network | Boot configuration files used to deploy some predefined blockchain network under test.
/src | Souce code of the framework
/src/contract | Smart contracts for different blockchain systems
  
 

