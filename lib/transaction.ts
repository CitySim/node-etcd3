const grpc = require("grpc");
const etcdProto = grpc.load(__dirname + "/../protos/rpc.proto");

export module CompareTypeDef
{
    export enum CompareResult
    {
      EQUAL = 0,
      GREATER = 1,
      LESS = 2,
    }
    export enum CompareTarget {
      VERSION = 0,
      CREATE = 1,
      MOD = 2,
      VALUE = 3,
    }
}

export enum SortOrder {
  NONE = 0, // default, no sorting
  ASCEND = 1, // lowest target value first
  DESCEND = 2, // highest target value first
}

export enum SortTarget {
  KEY = 0,
  VERSION = 1,
  CREATE = 2,
  MOD = 3,
  VALUE = 4,
}

export class EtcdCompare {
  compare: any;

  constructor (
    operator: CompareTypeDef.CompareResult,
    targetType: CompareTypeDef.CompareTarget,
    key: Buffer,
    compareTo: any,
  ) {
    this.compare = {};
    this.compare.result = operator;
    this.compare.target = targetType;
    this.compare.key = key;

    switch(targetType) {
      case CompareTypeDef.CompareTarget.CREATE:
        this.compare.create_revision = compareTo;
        break;
      case CompareTypeDef.CompareTarget.VERSION:
        this.compare.version = compareTo;
        break;
      case CompareTypeDef.CompareTarget.MOD:
        this.compare.mod_revision = compareTo;
        break;
      case CompareTypeDef.CompareTarget.VALUE:
        this.compare.value = compareTo;
        break;
    }
  }

  getOp() {
    return this.compare;
  }
};

export class CompareValue extends EtcdCompare {
  constructor (
    operator: CompareTypeDef.CompareResult,
    key: Buffer,
    compareTo: Buffer
  ) {
    super(operator, CompareTypeDef.CompareTarget.VALUE, key, compareTo);
  }
}

export class CompareLastRevision extends EtcdCompare {
  constructor (
    operator: CompareTypeDef.CompareResult,
    key: Buffer,
    compareTo: Number
  ) {
    super(
      operator,
      CompareTypeDef.CompareTarget.MOD,
      key,
      compareTo
    );
  }
}

export class CompareCreated extends EtcdCompare {
  constructor (
    operator: CompareTypeDef.CompareResult,
    key: Buffer,
    compareTo: Number
  ) {
    super(
      operator,
      CompareTypeDef.CompareTarget.CREATE,
      key,
      compareTo
    );
  }
}

export class CompareVersion extends EtcdCompare {
  constructor (
    operator: CompareTypeDef.CompareResult,
    key: Buffer,
    compareTo: Number
  ) {
    super(
      operator,
      CompareTypeDef.CompareTarget.VERSION,
      key,
      compareTo
    );
  }
}

export class EtcdOpRequest {
  type: any;
  request: any;

  constructor () {}

  getType () {
    return this.type;
  }

  getOp(): any {
    let op = {};
    if (!this.type) {
      throw new Error('Operation type not defined');
    }

    op[this.type] = this.request;
    return new etcdProto.etcdserverpb.RequestOp(op);
  }

  getRequest () {
    return this.request;
  }
}

export class DeleteRangeRequest extends EtcdOpRequest {
  type = 'request_delete_range';
  request: {
    key: Buffer,
    range_end?: Number,
  };

  constructor (request) {
    super();
    this.request = new etcdProto.etcdserverpb.DeleteRangeRequest(request);
  }
}

export class RangeRequest extends EtcdOpRequest  {
  type = 'request_range';
  request: {
    key: Buffer,
    range_end?: any,
    limit?: number,
    revision?: number,
    sort_order?: SortOrder,
    sort_target?: SortTarget,
    serializable?: boolean,
    keys_only?: boolean,
    count_only?: boolean,
  };

  constructor (request: any) {
    super();
    this.request = request;
  }
}

export class PutRequest extends EtcdOpRequest  {
  type = 'request_put';
  request: {
    key: Buffer,
    value: Buffer,
    lease?: Number,
  };

  constructor (request) {
    super();
    this.request = new etcdProto.etcdserverpb.PutRequest(request);
  }
}

export class EtcdTransaction {
  transaction: any;

  constructor (
    compareOps: Array<EtcdCompare>,
    successOps?: Array<EtcdOpRequest>,
    failureOps?: Array<EtcdOpRequest>
  ) {
    this.transaction = {};

    this.transaction.compare = this.mapOps(compareOps);
    this.transaction.success = this.mapOps(successOps);
    this.transaction.failure = this.mapOps(failureOps);
  }

  mapOps(ops) {
    if (!ops) {
      return [];
    }
    return ops.map(op => {
      return op.getOp();
    });
  }

  getOp() {
    return this.transaction;
  }
}
