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
	server: string;
	options: EtcdOptions;
	credentials: any = grpc.credentials.createInsecure();
	clients: any;

	constructor(server: string = "localhost:2379", options: EtcdOptions = {}) {
		this.server = server;
		this.options = options;
		this.clients = {
			KV: new etcdProto.etcdserverpb.KV(this.server, this.credentials)
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

	private async callClient(client, method, arg): Promise<any> {
		return new Promise((resolve, reject) => {
			this.clients[client][method](arg, (err, response) => {
				if (err) {
					reject(new EtcdError(`etcd ${client}.${method} failed`, err));
					return
				}

				resolve(response)
			});
		})
	}

	/**
	 * blocking version of get()
	 * @see {@link get}
	 */
	getSync(key: string) { return deasyncPromise(this.get(key)) }
	/**
	 * get a key from etcd
	 * @param key - key to get
	 * @return value of the key
	 */
	async get(key: string) {
		return this.callClient("KV", "range", {
			key: this.getBuffer(key)
		}).then((res) => {
			if (res.kvs.length) {
				return res.kvs[0].value.toString()
			} else {
				// key not found
				return null;
			}
		})
	}

	/**
	 * blocking version of set()
	 * @see {@link set}
	 */
	setSync(key: string, value: any) { return deasyncPromise(this.set(key, value)) }
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
	async set(key: string, value: any) {
		return this.callClient("KV", "put", {
			key: this.getBuffer(key),
			value: this.getBuffer(value)
		}).then((res) => {
			return true
		})
	}
}
