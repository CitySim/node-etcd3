import { Etcd } from './etcd';
import {
  CompareCreated, CompareValue, CompareTypeDef,
  PutRequest, RangeRequest, CompareVersion, DeleteRangeRequest
} from './transaction';
import * as uuid from 'node-uuid';

const LOCK_ATTEMPS = 10;

export class Lock {
  etcdClient: Etcd;
  key: string;
  ttl: number = 60;
  lease?: string;
  uuid?: string;
  version = 0;

  constructor (
    etcdClient: any,
    key: string,
    ttl: number = 60,
    lease?: string
  ) {
    if (!etcdClient) {
      throw new Error('No etcd client found');
    }

    this.etcdClient = etcdClient;
    this.key = key;
    this.ttl = ttl;
    this.version = 0;
    this.uuid = uuid.v4();
  }

  wait (t) {
    return new Promise(function(resolve) {
        setTimeout(resolve, t)
    });
  }

  *accquire (waitTime = 1000): IterableIterator<any> {
    let success = false;
    let attemps = LOCK_ATTEMPS;
    let response;

    while (!success && attemps > 0) {
      attemps -= 1;
      if (!this.lease) {
        this.lease = yield this.etcdClient.leaseGrant(this.ttl);
      }

      let compare = [
        new CompareVersion(
          CompareTypeDef.CompareResult.EQUAL,
          new Buffer(this.key),
          this.version
        )
      ];

      let createLock = [
        new PutRequest({
          key: new Buffer(this.key),
          value: new Buffer(this.uuid),
          lease: this.lease,
        })
      ];

      let getLock = [
        new RangeRequest({
          key: new Buffer(this.key),
        }),
      ];

      response = yield this.etcdClient
        .createTransaction(compare, createLock, getLock);
      success = response.succeeded;

      if (!success) {
        yield this.wait(waitTime);
      }
    }

    return success;
  }

  *release (): IterableIterator<any> {
    let success = false;

    let compareOps = [
      new CompareValue(
        CompareTypeDef.CompareResult.EQUAL,
        new Buffer(this.key),
        new Buffer(this.uuid),
      )
    ];

    let deleteOps = [
      new DeleteRangeRequest({
        key: new Buffer(this.key)
      })
    ];

    let result = yield this.etcdClient.createTransaction(
      compareOps, deleteOps, []
    );

    return result.succeeded;
  }

  *refresh () : IterableIterator<any> {
    if (this.lease) {
      return this.etcdClient.leaseKeepAlive(this.lease, this.ttl);
    }

    throw new Error('No lease associated with lock. Is lock created?');
  }
}
