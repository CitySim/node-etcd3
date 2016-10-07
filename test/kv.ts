import test from "ava";
import { Etcd } from "..";

const etcd = new Etcd();

test.before("clean etcd", (t) => {
	let deletedKeys = etcd.deleteSync("test", "\0");
	console.log(`cleaned ${deletedKeys} keys from etcd`);
});

let keyCounter = 0;
test.beforeEach("create a random key", (t: any) => {
	// for some reason the `t` isn't set to have a `context` in `beforeEach`
	t.context.rkey = "test_" + keyCounter++;
});

test("set() return true", async (t) => {
	t.true(await etcd.set("testKey", 34));
});

test("set() store string value as-is", async (t) => {
	await etcd.set(t.context.rkey, "value");
	let value = await etcd.get(t.context.rkey);
	t.is(value, "value");
});

test("set() store undefined as empty", async (t) => {
	await etcd.set(t.context.rkey, void 0);
	let value = await etcd.get(t.context.rkey);
	t.is(value, "");
});

test("set() store null as empty", async (t) => {
	await etcd.set(t.context.rkey, null);
	let value = await etcd.get(t.context.rkey);
	t.is(value, "");
});

test("set() store number as string", async (t) => {
	await etcd.set(t.context.rkey, 34);
	let value = await etcd.get(t.context.rkey);
	t.is(value, "34");
});

test("set() store JSON for object", async (t) => {
	let object = { test: 34 };
	await etcd.set(t.context.rkey, object);
	let value = await etcd.get(t.context.rkey);
	t.is(value, JSON.stringify(object));
});

test("set() store JSON for array", async (t) => {
	let object = [ "test", 34 ];
	await etcd.set(t.context.rkey, object);
	let value = await etcd.get(t.context.rkey);
	t.is(value, JSON.stringify(object));
});

test("get() return null for unset key", async (t) => {
	t.is(await etcd.get(t.context.rkey), null);
});

test("range() return {} for unset keys", async (t) => {
	let value = await etcd.range(t.context.rkey + "_1", t.context.rkey + "_9");
	t.deepEqual(value, {});
});

test("range() returns keys", async (t) => {
	const keys = {
		[t.context.rkey + "_1"]: "value 1",
		[t.context.rkey + "_3"]: "value 2",
		[t.context.rkey + "_4"]: "value 3",
		[t.context.rkey + "_7"]: "value 4",
		[t.context.rkey + "_8"]: "value 5",
	};
	for (let kv in keys) {
		await etcd.set(kv, keys[kv]);
	}
	let value = await etcd.range(t.context.rkey + "_1", t.context.rkey + "_9");
	t.deepEqual(value, keys);
});

test("setSync()", (t) => {
	let result = etcd.setSync(t.context.rkey, 34);
	t.true(result);
});

test("getSync()", (t) => {
	etcd.setSync(t.context.rkey, "getSync test");
	let value = etcd.getSync(t.context.rkey);
	t.is(value, "getSync test");
});
