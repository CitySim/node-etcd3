import test from "ava";
import { Etcd } from "..";

const etcd = new Etcd();

let keyCounter = 0;
test.beforeEach("create a random key", t => {
	t.context.rkey = "test_" + keyCounter++;
})

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

/*test("get() return always string", async (t) => {
	await etcd.set("number", 34);
	t.is(typeof (await etcd.get("number")), "string");
});*/

test("get() return null for unset key", async (t) => {
	t.is(await etcd.get(t.context.rkey), null);
});
