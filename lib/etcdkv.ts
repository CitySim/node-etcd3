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
