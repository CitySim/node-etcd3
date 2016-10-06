# node-etcd3

a node grpc client for the [etcd v3 API](https://github.com/coreos/etcd/)

## Example

```javascript
const { Etcd } = require(".");
const etcd = new Etcd();

etcd.setSync("testKey", 34)
etcd.get("testKey").then(function (val) {
    console.log("testKey =>", val) // testKey => 34
    console.log("unset =>", etcd.getSync("unset")) // unset => null
})
```
