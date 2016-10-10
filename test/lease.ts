import test from "ava";
import { Etcd } from "..";

test.before("clean etcd", (t) => {
	const etcd = new Etcd();
	let deletedKeys = etcd.deleteSync("test_lease", "\0");
	console.log(`cleaned ${deletedKeys} keys from etcd`);
});

test.beforeEach("create etcd", (t: any) => {
	t.context.etcd = new Etcd();
});

let keyCounter = 0;
test.beforeEach("create a random key", (t: any) => {
	// for some reason the `t` isn't set to have a `context` in `beforeEach`
	t.context.rkey = "test_lease" + keyCounter++;
});

test.afterEach((t: any) => {
	const etcd = t.context.etcd as Etcd;
	clearInterval(etcd.clientLeaseInterval);
});

test("leaseGrant() return a lease id", (t) => {
	const etcd = t.context.etcd as Etcd;
	return etcd.leaseGrant().then((lease) => {
		t.is(typeof lease, "string");
		t.true(lease.length > 0);
	});
});

test("leaseGrant() with TTL", (t) => {
	const etcd = t.context.etcd as Etcd;
	return etcd.leaseGrant(10).then((lease) => {
		t.is(typeof lease, "string");
		t.true(lease.length > 0);
	});
});

test.cb("set() uses lease", (t) => {
	const etcd = t.context.etcd as Etcd;
	etcd.leaseGrant(5).then((lease) => {
		etcd.setSync(t.context.rkey, "plop", lease);
		let kv = etcd.getSync(t.context.rkey, "raw");
		t.is(kv.value.toString(), "plop");
		t.is(kv.lease, lease);
		setTimeout(() => {
			t.is(etcd.getSync(t.context.rkey), null);
			t.end();
		}, 6000);
	});
});

// for some reason the socket doesn't get closed completly
test.skip.cb("client lease is kept alive", (t) => {
	const etcd = t.context.etcd as Etcd;
	etcd.set(t.context.rkey, "plop", "client").then(() => {
		setTimeout(() => {
			let kv = etcd.getSync(t.context.rkey, "raw");
			t.not(kv, null);
			t.not(kv.lease, null);
			t.is(kv.lease, etcd.clientLease);
			t.end();
		}, (etcd.options.appLeaseTtl * 1000) + 1000);
	});
});

test.skip("set(client) uses client lease", (t) => {
	const etcd = t.context.etcd as Etcd;
	return etcd.set(t.context.rkey, "plop", "client").then(() => {
		let kv = etcd.getSync(t.context.rkey, "raw");
		t.not(kv, null);
		t.not(kv.lease, null);
		t.is(kv.lease, etcd.clientLease);
	});
});

test.skip("getClientLease() multiple calls return the same lease", (t) => {
	const etcd = t.context.etcd as Etcd;
	return Promise.all([
		etcd.getClientLease(),
		etcd.getClientLease(),
		etcd.getClientLease(),
		etcd.getClientLease(),
		etcd.getClientLease(),
		etcd.getClientLease(),
	]).then((leases) => {
		t.not(leases[0], null);
		for (let lease of leases) {
			t.is(lease, leases[0]);
		}
	});
});
