export class EtcdError extends Error {
	internal;

	constructor(message, internal) {
		super(message);
		this.internal = internal;
	}
}
