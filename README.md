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


## Run a existing test

All predefined benchmark tests can be found in [*caliper/benchmark*](./benchmark) folder. 
To start a test, just run `node yourtest.js yourconfig.json` in the folder of the test. Usually, the bootstrap file has the same name as the test case. If configuration file is not specified, *config.json* will be used as default.
```bash
# start the simple test case, default config.json is used
cd ~/caliper/benchmark/simple
node simple.js
```

Each benchmark test is provided along with some networks under test which are defined in [*caliper/network*](./network) folder.
The network can be deployed automatically by using *'command'* object in the configuration file to define the bootstrap commands, as well as the clear-up commands, e.g
```json
{
  "command" : {
    "start": "docker-compose -f ../../network/fabric/simplenetwork/docker-compose.yaml up -d",
    "end" : "docker-compose -f ../../network/fabric/simplenetwork/docker-compose.yaml down;docker rm $(docker ps -aq)"
  }
}
```

User's own existing blockchain network can ben also integerated with the test, as long as the network is properly configured in the configuration file. See [Confgituraion Introduction](./docs/Architecture.md#configuration-file) to learn more details.

## Write your own tests
Caliper provides a set of nodejs NBIs (North Bound Interfaces) for applications to interact with backend blockchain system. Check the [*src/comm/blockchain.js*](./src/comm/blockchain.js) to learn about the NBIs. Multiple *Adaptors* are implemented to translate the NBIs to different blockchain protocols. So developers can write a test once, and run it with different blockchain systems.

Generally speaking, to write a new caliper test, you need to:
* Write smart contracts for systems you want to test
* Write a test flow using caliper NBIs. Caliper provides a default test framework, which is plugable and configurable to integrate new tests easily. For more details, please refer to [Test Framework](./docs/Architecture.md#test-framework) .
* Write a configuration file to define the backend network and test arguments.

## Directory Structure
**Directory** | **Description**
------------------ | --------------
/benchmark | Samples of the blockchain test cases
/docs | Documents
/network | Boot configuration files used to deploy some predefined blockchain network for test.
/src | Souce code of the framework
/src/contract | Smart contracts for different blockchain systems
  
 

