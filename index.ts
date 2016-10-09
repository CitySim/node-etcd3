/// <reference path="typings/index.d.ts" />

const grpc = require("grpc");
const deasyncPromise = require("deasync-promise");

const etcdProto = grpc.load(__dirname + "/protos/rpc.proto");

class EtcdError extends Error {
	internal;

	constructor(message, internal) {
		super(message);
		this.internal = internal;
	}
}

export interface EtcdOptions {
}

export class Etcd {
	servers: string[];
	options: EtcdOptions;
	credentials: any = grpc.credentials.createInsecure();
	clients: any;

	constructor(servers: string[] = [ "localhost:2379" ], options: EtcdOptions = {}) {
		this.servers = servers;
		if (this.servers.length > 1)
			console.warn("etcd3: currently only the first server address is used");
		this.options = options;
		this.clients = {
			KV: new etcdProto.etcdserverpb.KV(this.servers[0], this.credentials)
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

	/**
	 * blocking version of get()
	 * @see {@link get}
	 */
	getSync(key: string): string {
		return deasyncPromise(this.get(key));
	}
	/**
	 * get a key from etcd
	 * @param key - key to get
	 * @return value of the key
	 */
	get(key: string): Promise<string> {
		return this.callClient("KV", "range", {
			key: new Buffer(key)
		}).then((res) => {
			if (res.kvs.length) {
				return res.kvs[0].value.toString();
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
	rangeSync(fromKey: string, toKey: string): any {
		return deasyncPromise(this.range(fromKey, toKey));
	}
	/**
	 * get a range of key from etcd
	 * @param fromKey - key to start from
	 * @param toKey - key to end on
	 * @return value of the key
	 */
	range(fromKey: string, toKey: string): Promise<any> {
		return this.callClient("KV", "range", {
			key: new Buffer(fromKey),
			range_end: new Buffer(toKey),
			limit: 500
		}).then((res) => {
			let result: any = {};
			for (let kv of res.kvs) {
				result[kv.key.toString()] = kv.value.toString();
			}
			return result;
		});
	}

	/**
	 * blocking version of set()
	 * @see {@link set}
	 */
	setSync(key: string, value: any): boolean {
		return deasyncPromise(this.set(key, value));
	}
	/**
	 * set a key/value to etcd.
	 * * a `Buffer` is saved as-is
	 * * `null` is saved as an empty string
	 * * `undefined` is saved as an empty string
	 * * strings are saved as-is
	 * * everthing else is tried to `JSON.stringify(value)`
	 * @param key - etcd key to set
	 * @param value - content to set
	 * @return `true`
	 */
	set(key: string, value: any): Promise<boolean> {
		return this.callClient("KV", "put", {
			key: new Buffer(key),
			value: this.getBuffer(value)
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
}
