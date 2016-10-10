import test from "ava";
import { Etcd } from "..";

test.before("clean etcd", (t) => {
	const etcd = new Etcd();
	let deletedKeys = etcd.deleteSync("test_kv", "\0");
	console.log(`cleaned ${deletedKeys} keys from etcd`);
});

test.beforeEach("create etcd", (t: any) => {
	t.context.etcd = new Etcd();
});

let keyCounter = 0;
test.beforeEach("create a random key", (t: any) => {
	// for some reason the `t` isn't set to have a `context` in `beforeEach`
	t.context.rkey = "test_kv" + keyCounter++;
});

test.afterEach((t: any) => {
	const etcd = t.context.etcd as Etcd;
	clearInterval(etcd.clientLeaseInterval);
});

test("set() return true", (t) => {
	const etcd = t.context.etcd as Etcd;
	return etcd.set(t.context.rkey, 34).then((result) => {
		t.true(result);
	});
});

test("set() store string value as-is", (t) => {
	const etcd = t.context.etcd as Etcd;
	return etcd.set(t.context.rkey, "value").then(() => {
		return etcd.get(t.context.rkey);
	}).then((value) => {
		t.is(value, "value");
	});
});

test("set() store undefined as empty", (t) => {
	const etcd = t.context.etcd as Etcd;
	return etcd.set(t.context.rkey, void 0).then(() => {
		return etcd.get(t.context.rkey);
	}).then((value) => {
		t.is(value, "");
	});
});

test("set() store null as empty", (t) => {
	const etcd = t.context.etcd as Etcd;
	return etcd.set(t.context.rkey, null).then(() => {
		return etcd.get(t.context.rkey);
	}).then((value) => {
		t.is(value, "");
	});
});

test("set() store number as string", (t) => {
	const etcd = t.context.etcd as Etcd;
	return etcd.set(t.context.rkey, 34).then(() => {
		return etcd.get(t.context.rkey);
	}).then((value) => {
		t.is(value, "34");
	});
});

test("set() store JSON for object", (t) => {
	const etcd = t.context.etcd as Etcd;
	let object = { test: 34 };
	return etcd.set(t.context.rkey, object).then(() => {
		return etcd.get(t.context.rkey);
	}).then((value) => {
		t.is(value, JSON.stringify(object));
	});
});

test("set() store JSON for array", (t) => {
	const etcd = t.context.etcd as Etcd;
	let object = [ "test", 34 ];
	return etcd.set(t.context.rkey, object).then(() => {
		return etcd.get(t.context.rkey);
	}).then((value) => {
		t.is(value, JSON.stringify(object));
	});
});

test("get() return null for unset key", (t) => {
	const etcd = t.context.etcd as Etcd;
	return etcd.get(t.context.rkey).then((value) => {
		t.is(value, null);
	});
});

test("range() return {} for unset keys", (t) => {
	const etcd = t.context.etcd as Etcd;
	return etcd.range(t.context.rkey + "_1", t.context.rkey + "_9").then((value) => {
		t.deepEqual(value, {});
	});
});

test("range() returns keys", (t) => {
	const etcd = t.context.etcd as Etcd;
	const keys = {
		[t.context.rkey + "_1"]: "value 1",
		[t.context.rkey + "_3"]: "value 2",
		[t.context.rkey + "_4"]: "value 3",
		[t.context.rkey + "_7"]: "value 4",
		[t.context.rkey + "_8"]: "value 5",
	};
	for (let kv in keys) {
		etcd.setSync(kv, keys[kv]);
	}
	let value = etcd.rangeSync(t.context.rkey + "_1", t.context.rkey + "_9");
	t.deepEqual(value, keys);
});

test("setSync()", (t) => {
	const etcd = t.context.etcd as Etcd;
	let result = etcd.setSync(t.context.rkey, 34);
	t.true(result);
});

test("getSync()", (t) => {
	const etcd = t.context.etcd as Etcd;
	etcd.setSync(t.context.rkey, "getSync test");
	let value = etcd.getSync(t.context.rkey);
	t.is(value, "getSync test");
});
