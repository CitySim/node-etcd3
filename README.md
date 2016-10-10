# node-etcd3

[![travis](https://travis-ci.org/CitySim/node-etcd3.svg?branch=master)](https://travis-ci.org/CitySim/node-etcd3)
[![CircleCI](https://circleci.com/gh/CitySim/node-etcd3/tree/master.svg?style=svg)](https://circleci.com/gh/CitySim/node-etcd3/tree/master)

a node client for the new [etcd](https://github.com/coreos/etcd/) v3 grpc API

* supports node 4, 5 and 6
* easy to use
* Docs: (https://citysim.github.io/node-etcd3/classes/_index_.etcd.html)

## Example

```javascript
const { Etcd } = require("node-etcd3");
const etcd = new Etcd();

etcd.setSync("testKey", 34)
etcd.get("testKey").then(function (val) {
    console.log("testKey =>", val) // testKey => 34
    console.log("unset =>", etcd.getSync("unset")) // unset => null
})
```
