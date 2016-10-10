import test from "ava";
import { Etcd } from "..";

test.beforeEach((t: any) => {
	t.context.rkey = "test_kv_" + Math.random();
	t.context.etcd = new Etcd();
	t.context.etcd.deleteSync(t.context.rkey, "\0");
});

test.afterEach((t: any) => {
	const etcd = t.context.etcd as Etcd;
	etcd.close();
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

test("set() uses lease", (t) => {
	const etcd = t.context.etcd as Etcd;
	etcd.leaseGrant(5).then((lease) => {
		etcd.setSync(t.context.rkey, "plop", lease);
		let kv = etcd.getSync(t.context.rkey, "raw");
		t.is(kv.value.toString(), "plop");
		t.is(kv.lease, lease);
	});
});

test("set() with TTL", (t) => {
	const etcd = t.context.etcd as Etcd;
	etcd.set(t.context.rkey, "plop", 50).then((lease) => {
		let kv = etcd.getSync(t.context.rkey, "raw");
		t.is(kv.value.toString(), "plop");
		t.is(kv.lease, lease);
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
