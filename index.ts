/// <reference path="typings/index.d.ts" />

const grpc = require("grpc");
const extend = require("lodash.assignin");
const deasyncPromise = require("deasync-promise");

const etcdProto = grpc.load(__dirname + "/protos/rpc.proto");

class EtcdError extends Error {
	internal;

	constructor(message, internal) {
		super(message);
		this.internal = internal;
	}
}

export interface EtcdKV {
	/** key is the key in bytes. An empty key is not allowed. */
	key: Buffer;
	/** create_revision is the revision of last creation on this key. */
	create_revision: number;
	/** mod_revision is the revision of last modification on this key. */
	mod_revision: number;
	/**
	 * version is the version of the key. A deletion resets
	 * the version to zero and any modification of the key
	 * increases its version.
	 */
	version: number;
	/** value is the value held by the key, in bytes. */
	value: Buffer;
	/**
	 * lease is the ID of the lease that attached to key.
	 * When the attached lease expires, the key will be deleted.
	 * If lease is 0, then no lease is attached to the key.
	 */
	lease: string;
}

export interface EtcdOptions {
	/** TTL of the managed client lease. seconds */
	appLeaseTtl?: number;
	/** Internal in which to keep alive the lease. milleseconds */
	appLeaseKeepAlive?: number;
}

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
	clientLeaseInterval: number;

	constructor(servers: string[] = [ "localhost:2379" ], options: EtcdOptions = {}) {
		this.options = extend(Etcd.defaults, options);

		this.servers = servers;
		if (this.servers.length > 1)
			console.warn("etcd3: currently only the first server address is used");

		this.clients = {
			KV: new etcdProto.etcdserverpb.KV(this.servers[0], this.credentials),
			Lease: new etcdProto.etcdserverpb.Lease(this.servers[0], this.credentials),
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

	getClientLease(): Promise<string> {
		if (this.clientLeasePromise) {
			return this.clientLeasePromise;
		}

		return this.clientLeasePromise = this.leaseGrant(this.options.appLeaseTtl).then((lease) => {
			this.clientLease = lease;
			this.clientLeaseInterval = this.leaseKeepAlive(lease, this.options.appLeaseKeepAlive);
			return lease;
		});
	}

	/**
	 * blocking version of get()
	 * @see {@link get}
	 */
	getSync(key: string, returnType?: "value"): string;
	getSync(key: string, returnType: "json"): any;
	getSync(key: string, returnType: "buffer"): Buffer;
	getSync(key: string, returnType: "raw"): EtcdKV;
	getSync(key: string, returnType: "value" | "json" | "buffer" | "raw"): any {
		return deasyncPromise(this.get(key, returnType as any));
	}
	/**
	 * get a key from etcd
	 * @param key - key to get
	 * @return value of the key
	 */
	get(key: string, returnType?: "value"): Promise<string>;
	get(key: string, returnType: "json"): Promise<any>;
	get(key: string, returnType: "buffer"): Promise<Buffer>;
	get(key: string, returnType: "raw"): Promise<EtcdKV>;
	get(key: string, returnType: "value" | "json" | "buffer" | "raw" = "value"): Promise<any> {
		return this.callClient("KV", "range", {
			key: new Buffer(key)
		}).then((res) => {
			if (res.kvs.length) {
				switch (returnType) {
					case "raw": return res.kvs[0];
					case "buffer": return res.kvs[0].value;
					case "value": return res.kvs[0].value.toString();
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
	 * @param fromKey - key to start from
	 * @param toKey - key to end on
	 * @return value of the key
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
					case "raw": result[key] = kv; break;
					case "buffer": result[key] = kv.value; break;
					case "value": result[key] = kv.value.toString(); break;
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
	setSync(key: string, value: any, lease?: string): boolean {
		return deasyncPromise(this.set(key, value, lease));
	}
	/**
	 * set a key/value to etcd.
	 * * a `Buffer` is saved as-is
	 * * `null` is saved as an empty string
	 * * `undefined` is saved as an empty string
	 * * strings are saved as-is
	 * * everthing else is tried to `JSON.stringify(value)`
	 *
	 * if you set "lease" to "client" a lease uniq to the instance of the Client will be used. This lease
	 * will be created automatic and will be kept alive automatic.
	 *
	 * @param key - etcd key to set
	 * @param value - content to set
	 * @param lease - lease ID to use, or `client` to the client lease
	 * @return `true`
	 */
	set(key: string, value: any, lease?: string): Promise<boolean> {
		let getLease = Promise.resolve(lease);
		if (lease === "client") {
			getLease = this.getClientLease();
		}

		return getLease.then((lease) => {
			return this.callClient("KV", "put", {
				key: new Buffer(key),
				value: this.getBuffer(value),
				lease: lease
			});
		}).then((res) => {
			return true;
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
	 * @param key - etcd key to delete
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
	 * @param ttl - requested ttl of the lease
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
	 * @return id of interval used
	 */
	leaseKeepAlive(lease: string, interval: number = 1000): number {
		let handler = this.callClientStream("Lease", "leaseKeepAlive");

		let intervalId: any = setInterval(() => {
			handler.write({
				ID: lease
			});
		}, interval);

		// handler.on("data", (data) => {})

		handler.on("end", () => {
			console.error(`etcd lease keep alive end, lease: ${lease}`);
			clearInterval(intervalId);
		});

		return intervalId;
	}
}
