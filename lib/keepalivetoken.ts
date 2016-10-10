import { EventEmitter } from "events";

export class KeepAliveToken extends EventEmitter {
	handler: any;
	lease: string;
	intervalId: any;

	constructor(handler: any, lease: string, interval: number = 1000) {
		super();
		this.handler = handler;
		this.lease = lease;

		if (interval == null)
			interval = 1000;

		this.intervalId = setInterval(() => {
			try {
				this.handler.write({
					ID: this.lease
				});
			} catch (err) {
				console.error(`etcd lease keep alive write error, lease: ${this.lease}`);
				this.cancel();
			}
		}, interval);

		// handler.on("data", (data) => {})

		/*this.handler.on("end", () => {
			console.error(`etcd lease keep alive end, lease: ${this.lease}`);
			this.handler.cancel();
			this.cancel();
		});*/
	}

	cancel() {
		clearInterval(this.intervalId);
		this.handler.end();
	}
};