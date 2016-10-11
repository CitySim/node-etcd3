export interface EtcdOptions {
	/** TTL of the managed client lease. seconds */
	appLeaseTtl?: number;
	/** Internal in which to keep alive the lease. millisecond's */
	appLeaseKeepAlive?: number;
}
