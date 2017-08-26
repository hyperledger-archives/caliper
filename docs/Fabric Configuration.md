A typical fabric json object contains 6 main elements:

* **cryptodir**: defines a relative path of the crypto directory which contains all cryptographic materials, all paths defined in the configuration are relative paths to the fabric root directory. The crypto directory structure must be identical with the output of fabric's cryptogen tool. The sub-directories names must match organizations' names defined in *network* element. The certificates and private keys in this directory are used by Caliper to act as the administrator or the member of corresponding organization to interact with fabric network, e.g to create channel, join channel, install chaincode, invoke chaincode, etc.      
 
```json
{"cryptodir": "network/fabric/simplenetwork/crypto-config"}
```

* network: defines the information of orderers and peers of backend fabric network. For simplicity's sake, only one orderer can be defined now, that causes all proposals being sent to the same orderer, which may hurt ordering performance. That should be fixed in future. The key of organization objects and peer objects must start with 'org' and 'peer'.
```json
{
  "network": {
    "orderer": {
      "url": "grpcs://localhost:7050",
      "mspid": "OrdererMSP",
      "msp": "network/fabric/simplenetwork/crypto-config/ordererOrganizations/example.com/msp/",
      "server-hostname": "orderer.example.com",
      "tls_cacerts": "network/fabric/simplenetwork/crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
    },
    "org1": {
      "name": "peerOrg1",
      "mspid": "Org1MSP",
      "msp": "network/fabric/simplenetwork/crypto-config/peerOrganizations/org1.example.com/msp/",
      "ca": {
        "url": "https://localhost:7054",
        "name": "ca-org1"
      },
      "peer1": {
        "requests": "grpcs://localhost:7051",
        "events": "grpcs://localhost:7053",
        "server-hostname": "peer0.org1.example.com",
        "tls_cacerts": "network/fabric/simplenetwork/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
      },
      "peer2": {
        "requests": "grpcs://localhost:7057",
        "events": "grpcs://localhost:7059",
        "server-hostname": "peer1.org1.example.com",
        "tls_cacerts": "network/fabric/simplenetwork/crypto-config/peerOrganizations/org1.example.com/peers/peer1.org1.example.com/tls/ca.crt"
      }
    }
  }    
}
```    

* **channel**: defines one or more channels used for the test. The defined channels can be created automatically by calling *Blockchain.init()* function. The binary tx file created by fabric configtxgen tool is used to provide details of the channel. 
```json
{
  "channel": [
    {
      "name": "mychannel",
      "config": "network/fabric/simplenetwork/mychannel.tx",
      "organizations": ["org1", "org2"]
    }
  ]
}
```

* **chaincodes**: defines one or more chaincodes, those chaincodes can ben installed and instantiated on all peers of the specific channel by calling *Blockchain.installSmartContract()* function.
```json
{
  "chaincodes": [
    {
      "id": "drm", 
      "path": "contract/fabric/drm", 
      "version": "v0", 
      "channel": "mychannel"
    }
  ]
}
```
* **endorsement-policy**: defines the endorsement policy for all the chaincodes. Currently, only one policy can be defined and the policy is applied to all chaincodes.    
```json
{
  "endorsement-policy": {
    "identities": [
      {
        "role": {
          "name": "member",
          "mspId": "Org1MSP"
        }
      },
      {
        "role": {
          "name": "member",
          "mspId": "Org2MSP"
        }
      }
    ],
    "policy": { "2-of": [{"signed-by": 0}, {"signed-by": 1}]}
  }
}
```

* **context**:defines a set of context to tell Caliper which fabric channle will be interacted with later. The context name(key) is the name of the test defined by *test.rounds[x].cmd* in the test configuration file if the default [test framework](./Architecture.md#test-framework) is used. The information is used by getContext() function to create a fabric client for later use, and register block events with appropriate peers.
```json
{
  "context": {
    "publish": "mychannel",
    "query": "mychannel"
  }
}
```

## TODO List
* network: allow to define mulitple orderers and implement load balancing for ordering proposals.
* channel: allow to define row information of the channel directly as alternative option, instead of the tx file. Also an indicator may be needed to tell Caliper not to recreate the channel in case it has already been created outside. 
* endorsement-policy: allow to define multiple policies and relation between policy and chaincode.
