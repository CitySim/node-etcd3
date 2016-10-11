# node-etcd3

[![Build Status](https://travis-ci.org/CitySim/node-etcd3.svg?branch=master)](https://travis-ci.org/CitySim/node-etcd3)
[![CircleCI](https://circleci.com/gh/CitySim/node-etcd3/tree/master.svg?style=svg)](https://circleci.com/gh/CitySim/node-etcd3/tree/master)

a node client for the new [etcd](https://github.com/coreos/etcd/) v3 grpc API

**WIP: this client is work in Progress. Braking changes are avoided if possible, but may happen until the first stable version is reached**

* supports node 0.12, 4-6
* easy to use
* Promise based
* offers sync methods
* Docs: [go here](https://citysim.github.io/node-etcd3)
  * may be broken/outdated until typedoc can handle typescript v2 (currently update v0.4.1, yay)
* Changelog: [go here](https://github.com/CitySim/node-etcd3/blob/master/CHANGELOG.md)

```javascript
const { Etcd } = require("node-etcd3");
const etcd = new Etcd();

etcd.setSync("testKey", 34)
etcd.get("testKey").then(function (val) {
    console.log("testKey =>", val) // testKey => 34
    console.log("unset =>", etcd.getSync("unset")) // unset => null
})
```

## Roadmap

**working:**
* KV - get
* KV - range
* KV - set
* KV - delete
* Lease - grant
* Lease - keep alive

**todo for v1:**
* Lease - revoke
* watch - watch
* KV - compact

**todo for later:**
* KV - txn
* cluster
* maintenance
* auth

## Intro & Examples

* all methods return a [Promise](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise)
* most methods also come in a sync-flavor, like `getSync` for `get`
  * these are handy for setting up things on application start

### get() and set() with Promises

```javascript
etcd.get("env").then(function (env) {
    return etcd.set(env + "/testKey", 34)
}).then(function () {
    console.log("set testKey for env!")
}).catch(function (err) {
    console.error("error", err);
})
```

### getSync()

```javascript
const mainDB = new DB({
    server: etcd.getSync("db/main/server"),
    user: etcd.getSync("db/main/user"),
    password: etcd.getSync("db/main/password")
});
```

### how to store a Object, Buffer, number, ... ?

etcd stores binary data (actually even the keys a buffers). But for ease of use node-etcd3 works with string most of the time. But you can still
easily store a Buffer to etcd, just pass it into `set()`.
* a NodeJS `Buffer` will be stored it as-is.
* `string`s also get stored as-is.
* `number`s will be stored as string.
* any other object is put in `JSON.stringify` and stored as string

see below to see how to get a Buffer (or ...) out again

### get & range return type

* get offers multiple ways to return the data
 * `value` (default): returns a string
 * `json`: parses the value and return the parsed object
 * `buffer`: returns a NodeJS `Buffer` containing the value
 * `raw`: an object containing detailed information, such as the `version` or `lease`
* they work for `get()` and `range()`

```javascript
etcd.get("app/logo.png", "buffer");
etcd.get("app/config", "json");
```

### leases

* leases are basically etcd3 way of doing TTL for keys, but they work great for multiple keys at once
* node-etcd3 has 3 main ways for working with leases
 * **use the client lease**  
   the client has one managed lease, use `"client"` as lease ID then calling `set()`. It is kept alive automatically and you don't have a hand
   around the lease ID yourself.  
   `etcd.set("my/key", "hello leases!", "client")`
 * **use leases**  
   you can also get your own lease using the `leaseGrant()` method.  
   `let myVeryOwnLease = etcd.leaseGrant()`
 * **simply set a TTL**  
   you can pass in a number as lease to create a new lease with the TTL and use it for the key.  
   `etcd.set("ttl/key", "expire after 100s", 100);`
