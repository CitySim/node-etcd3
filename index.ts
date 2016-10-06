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

interface EtcdOptions {
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

	getSync(key: string) { return deasyncPromise(this.get(key)) }
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

	setSync(key: string, value: string) { return deasyncPromise(this.set(key, value)) }
	async set(key: string, value: string) {
		return this.callClient("KV", "put", {
			key: this.getBuffer(key),
			value: this.getBuffer(value)
		}).then((res) => {
			return true
		})
	}
}
