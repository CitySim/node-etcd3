
# 0.4.0

* start changelog
* splitted index.ts into smaller files
* expanded the README
* **BREAKING CHANGE**: implement `KeepAliveToken` to allow better cancelation of keep alive
 * this changes return type of `leaseKeepAlive`
* add `close()` method
* you now can pass in a number as lease into the `set()` method a create a new lease with a TTL and use it for the key.
