const grpc = require("grpc");
const extend = require("lodash.assignin");
const deasyncPromise = require("deasync-promise");

import { KeepAliveToken } from "./keepalivetoken";
import { EtcdTransaction, EtcdCompare, EtcdOpRequest} from "./transaction";
import { EtcdKV } from "./etcdkv";
import { EtcdError } from "./etcderror";
import { EtcdOptions } from "./etcdoptions";

const etcdProto = grpc.load(__dirname + "/../protos/rpc.proto");
/**
 * etcd client using the grpc protocol of etcd version 3 and later.
 */
export class Etcd {
	static defaults: EtcdOptions = {
		appLeaseTtl: 10,
		appLeaseKeepAlive: null,
	};

	servers: string[];
	options: EtcdOptions;
	credentials: any = grpc.credentials.createInsecure();
	clients: any;

	clientLease: string;
	clientLeasePromise: Promise<string>;
	clientLeaseToken: KeepAliveToken;

	/** KeepAliveToken's created by this client */
	keepAlives: KeepAliveToken[] = [];

	/**
	 * Creates a new etcd client.
	 * @param servers
	 * array of etcd hosts to use
	 *
	 * **Note**: currently only the first server is used, this will be fixed before version 1
	 * @param options - additional options, see {@link defaults} for actual defaults
	 */
	constructor(servers: string[] = [ "localhost:2379" ], options: EtcdOptions = {}) {
		this.options = extend(Etcd.defaults, options);

		this.servers = servers;
		if (this.servers.length > 1)
			console.warn("etcd3: currently only the first server address is used");
		this.clients = {
			KV: new etcdProto.etcdserverpb.KV(this.servers[0], this.credentials),
			Lease: new etcdProto.etcdserverpb.Lease(this.servers[0], this.credentials),
			Watch: new etcdProto.etcdserverpb.Watch(this.servers[0], this.credentials),
		};
	}

	private getBuffer(obj): Buffer {
		if (Buffer.isBuffer(obj))
			return obj;
		else if (obj == null)
			return new Buffer(0);
		else if (typeof obj === "string")
			return new Buffer(obj);
		else
			return new Buffer(JSON.stringify(obj));
	}

	private callClient(client, method, arg): Promise<any> {
		return new Promise((resolve, reject) => {
			this.clients[client][method](arg, (err, response) => {
				if (err) {
					reject(new EtcdError(`etcd ${client}.${method} failed`, err));
					return;
				}

				resolve(response);
			});
		});
	}

	private callClientStream(client, method): any {
		return this.clients[client][method]();
	}

	/**
	 * closes the network connection and stops all keep alives started with this client.
	 */
	close() {
		for (let token of this.keepAlives) {
			token.cancel();
		}
		for (let client of this.clients) {
			let channel = grpc.getClientChannel(client);
			channel.close();
		}
	}

	/**
	 * get the managed client lease. If it isn't created yet, it will be created. The Client lease will be kept alive automatic.
	 * @return lease ID
	 */
	getClientLease(): Promise<string> {
		if (this.clientLeasePromise) {
			return this.clientLeasePromise;
		}

		return this.clientLeasePromise = this.leaseGrant(this.options.appLeaseTtl).then((lease) => {
			this.clientLease = lease;
			this.clientLeaseToken = this.leaseKeepAlive(lease, this.options.appLeaseKeepAlive);
			return lease;
		});
	}

	getSync(key: string, returnType?: "value"): string;
	getSync(key: string, returnType: "json"): any;
	getSync(key: string, returnType: "buffer"): Buffer;
	getSync(key: string, returnType: "raw"): EtcdKV;
	/**
	 * blocking version of get()
	 * @see {@link get}
	 */
	getSync(key: string, returnType: "value" | "json" | "buffer" | "raw"): any {
		return deasyncPromise(this.get(key, returnType as any));
	}
	get(key: string, returnType?: "value"): Promise<string>;
	get(key: string, returnType: "json"): Promise<any>;
	get(key: string, returnType: "buffer"): Promise<Buffer>;
	get(key: string, returnType: "raw"): Promise<EtcdKV>;
	/**
	 * get the value of a key from etcd
	 * @param key - key to get
	 * @param returnType
	 * * `value` (default) - return the as a `string`
	 * * `json` - parse as JSON and return the result
	 * * `buffer` - return a NodeJS Buffer
	 * * `raw` - return the value as it came from etcd
	 * @return value of the key as defined by `returnType`
	 */
	get(key: string, returnType: "value" | "json" | "buffer" | "raw" = "value"): Promise<any> {
		return this.callClient("KV", "range", {
			key: new Buffer(key)
		}).then((res) => {
			if (res.kvs.length) {
				switch (returnType) {
					default:
					case "value": return res.kvs[0].value.toString();
					case "raw": return res.kvs[0];
					case "buffer": return res.kvs[0].value;
					case "json": return JSON.parse(res.kvs[0].value.toString());
				}
			} else {
				// key not found
				return null;
			}
		});
	}

	/**
	 * blocking version of range()
	 * @see {@link range}
	 */
	rangeSync(fromKey: string, toKey: string, returnType?: "value" | "json" | "buffer" | "raw"): any {
		return deasyncPromise(this.range(fromKey, toKey, returnType as any));
	}
	/**
	 * get a range of key from etcd
	 * @param fromKey - key to start from (inclusive)
	 * @param toKey - key to end on (exclusive)
	 * @param returnType
	 * * `value` (default) - return the as a `string`
	 * * `json` - parse as JSON and return the result
	 * * `buffer` - return a NodeJS Buffer
	 * * `raw` - return the value as it came from etcd
	 * @return object with a key for each key returned, value of the key as defined by `returnType`
	 */
	range(fromKey: string, toKey: string, returnType: "value" | "json" | "buffer" | "raw" = "value"): Promise<any> {
		return this.callClient("KV", "range", {
			key: new Buffer(fromKey),
			range_end: new Buffer(toKey),
			limit: 500
		}).then((res) => {
			let result: any = {};
			for (let kv of res.kvs as EtcdKV[]) {
				let key = kv.key.toString();
				switch (returnType) {
					default:
					case "value": result[key] = kv.value.toString(); break;
					case "raw": result[key] = kv; break;
					case "buffer": result[key] = kv.value; break;
					case "json": result[key] = JSON.parse(kv.value.toString()); break;
				}
			}
			return result;
		});
	}

	/**
	 * blocking version of set()
	 * @see {@link set}
	 */
	setSync(key: string, value: any, lease?: number | string): string {
		return deasyncPromise(this.set(key, value, lease));
	}
	/**
	 * set a key/value to etcd.
	 * * a `Buffer` is saved as-is
	 * * `null` is saved as an empty string
	 * * `undefined` is saved as an empty string
	 * * strings are saved as-is
	 * * everything else is tried to `JSON.stringify(value)`
	 *
	 * if you set "lease" to "client" a lease uniq to the instance of the Client will be used. This lease
	 * will be created automatic and will be kept alive automatic.
	 *
	 * @param key - etcd key to set
	 * @param value - content to set
	 * @param lease - lease ID to use, or `client` to the client lease
	 * @return lease ID used if any was used, else `null`
	 */
	set(key: string, value: any, lease?: number | string): Promise<string> {
		let leaseId;
		let getLease = Promise.resolve(lease);
		if (typeof lease === "number") {
			getLease = this.leaseGrant(lease);
		} else if (lease === "client") {
			getLease = this.getClientLease();
		}

		return getLease.then((newLease) => {
			leaseId = newLease;
			return this.callClient("KV", "put", {
				key: new Buffer(key),
				value: this.getBuffer(value),
				lease: leaseId
			});
		}).then((res) => {
			return leaseId;
		});
	}

	/**
	 * blocking version of delete()
	 * @see {@link delete}
	 */
	deleteSync(key: string, keyTo?: string): number {
		return deasyncPromise(this.delete(key, keyTo));
	}
	/**
	 * delete a key from etcd.
	 * @param key - key to start from (inclusive)
	 * @param keyTo - key to end on (exclusive)
	 * @return number of keys deleted
	 */
	delete(key: string, keyTo?: string): Promise<number> {
		return this.callClient("KV", "deleteRange", {
			key: new Buffer(key),
			range_end: keyTo ? new Buffer(keyTo) : null
		}).then((res) => {
			return res.deleted;
		});
	}

	/**
	 * blocking version of leaseGrant()
	 * @see {@link leaseGrant}
	 */
	leaseGrantSync(ttl: number): string {
		return deasyncPromise(this.leaseGrant(ttl));
	}
	/**
	 * request a new lease from etcd
	 * @param ttl - requested TTL of the lease
	 * @return
	 */
	leaseGrant(ttl?: number): Promise<string> {
		return this.callClient("Lease", "leaseGrant", {
			TTL: ttl
		}).then((res) => {
			return res.ID;
		});
	}

	/**
	 * keep a lease alive
	 * @param lease - lease to keep alive
	 * @param interval - interval in which to send keep alives
	 * @return `KeepAliveToken` that was created
	 */
	leaseKeepAlive(lease: string, interval: number = 1000): KeepAliveToken {
		let handler = this.callClientStream("Lease", "leaseKeepAlive");
		let token = new KeepAliveToken(handler, lease, interval);
		this.keepAlives.push(token);
		return token;
	}

	createTransaction(
		compare: Array<EtcdCompare>,
		success: Array<EtcdOpRequest>,
		failure: Array<EtcdOpRequest>,
	): Promise<any> {
		let transaction = new EtcdTransaction(compare, success, failure);

		return this.callClient(
			"KV",
			"txn",
			transaction.getOp()
		);
	}
}
