## Caliper Introduction

Caliper is a general purpose blockchain benchmark framework, which allows users to test different blockchain solutions with predefined use cases, and get a set of perfomance test results.

Currently supported blockchain soultions:
* [fabric 1.0](https://github.com/hyperledger/fabric)
* [sawtooth](https://github.com/hyperledger/sawtooth-core) 

Currently supported performance indicators:
* Success ratio
* Transactions per second (TPS)
* Transaction committing delay
* Resource consumption (CPU, Memory, Network IO,...)

To learn more details , please refer to [Architecture introduction](doc/Architecture.md). 

## Build

### Pre-requisites

Make sure following tools are installed
* NodeJS 6.X
* Docker
* Docker-compose

Run `npm install` to install dependencies locally

###Install blockchain SDKs
* Fabric
  * Clone [fabric-sdk-node](https://github.com/hyperledger/fabric-sdk-node) and run the headless tests to make sure everything is ok
  * Install **fabric-client** and **fabric-ca-client** from the SDK, e.g run `npm install path-to-sdk/fabric-client path-to-sdk/fabric-ca-client` in caliper's root folder, or just copy the `node_modules` from fabric-sdk-node project 
  
* Sawtooth
  * Clone [sawtooth-core](https://github.com/hyperledger/sawtooth-core) and run the `./bin/run_tests -m javascript_sdk` to test the SDK
  * Install **sawtooth-sdk** from the SDK, e.g run `npm install path-to-sdk/javascript` in capliper's root folder.


##Benchmark Tests

All predefined benchmark tests can be found in *capliper/benchmark* folder, starting a test is very easy, following the step:
* Start the backend's blockchain network for test manually. Now caliper does not support starting blockchain network automatically. Some example networks are defined in *caliper/network* folder.
* Go into the use case folder you want to test, modify the configuration file to define the network started in step 1, as well as  other testing arguments. To learn more about the meaning of configuration file, please refer to [Configuration Introduction](./doc/Architecture.md/#configuration-file). 
* Run `node yourtest.js yourconfig.json` to start the test. Usually, the test file has the same name as the test case. If configuration file is not specified, *config.json* will be used by default.

Example:
```bash
# start a predefined fabric network
cd ~/caliper/network/fabric/simplenetwork
docker-compose up -d

# start the simple test case, default config.json is used
cd ~/caliper/benchmark/simple
node simple.js

# clear the environment after the test
docker-compose down
docker rm $(docker ps -aq)
```     

##How to write a new test
Caliper provides a set of nodejs NBIs for applications to interact with backend blockchain system. Multiple *Adaptors* are implemented to translate the NBIs to different blockchain protocol. So developers can write a test  once, and run the test with different blockchain systems.

Generally speaking, to write a new caliper test, you need to :
* Write smart contracts for systems you want to test
* Write a test flow using caliper NBIs. The simplest way to implement a test flow  is to use *bench-flow.js* which already defines a default test flow      
* Write configuration file to define the underlying network and  testing  arguments.

For more information about the test flow, please refer to [Test Framework](./doc/Architecture.md#Test-Framework).
 

