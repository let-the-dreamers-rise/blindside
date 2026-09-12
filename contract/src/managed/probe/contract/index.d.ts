import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum Phase { lobby = 0,
                    live = 1,
                    finished = 2,
                    timedOut = 3,
                    cancelled = 4
}

export type Edge = { target: Uint8Array; rand: Uint8Array };

export type Witnesses<PS> = {
  myEdge(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Edge];
  edgePath(context: __compactRuntime.WitnessContext<Ledger, PS>,
           leaf_0: Uint8Array): [PS, { leaf: Uint8Array,
                                       path: { sibling: { field: bigint },
                                               goes_left: boolean
                                             }[]
                                     }];
}

export type ImpureCircuits<PS> = {
  probeJoin(context: __compactRuntime.CircuitContext<PS>,
            c_0: Uint8Array,
            payout_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  probeStart(context: __compactRuntime.CircuitContext<PS>,
             leaves_0: Uint8Array[],
             endsAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  probeSpend(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  probeTimeout(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  probePay(context: __compactRuntime.CircuitContext<PS>, c_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  probeJoin(context: __compactRuntime.CircuitContext<PS>,
            c_0: Uint8Array,
            payout_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  probeStart(context: __compactRuntime.CircuitContext<PS>,
             leaves_0: Uint8Array[],
             endsAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  probeSpend(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  probeTimeout(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  probePay(context: __compactRuntime.CircuitContext<PS>, c_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  probeJoin(context: __compactRuntime.CircuitContext<PS>,
            c_0: Uint8Array,
            payout_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  probeStart(context: __compactRuntime.CircuitContext<PS>,
             leaves_0: Uint8Array[],
             endsAt_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  probeSpend(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  probeTimeout(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  probePay(context: __compactRuntime.CircuitContext<PS>, c_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly phase: Phase;
  readonly entryFee: bigint;
  readonly maxPlayers: bigint;
  readonly deadline: bigint;
  readonly pot: bigint;
  players: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  payouts: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  drops: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Edge;
    [Symbol.iterator](): Iterator<[Uint8Array, Edge]>
  };
  edges: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  spent: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly playerCount: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               fee_0: bigint,
               cap_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
