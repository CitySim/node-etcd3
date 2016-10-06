# node-etcd3

a node client for the new [etcd](https://github.com/coreos/etcd/) v3 grpc API

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
