import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum Phase { lobby = 0,
                    live = 1,
                    finished = 2,
                    timedOut = 3,
                    cancelled = 4
}

export type Edge = { target: Uint8Array; rand: Uint8Array };

export type Surrender = { tagToken: Uint8Array;
                          target: Uint8Array;
                          rand: Uint8Array
                        };

export type Witnesses<PS> = {
  hostSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  playerSecret(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  myEdge(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Edge];
  edgePath(context: __compactRuntime.WitnessContext<Ledger, PS>,
           leaf_0: Uint8Array): [PS, { leaf: Uint8Array,
                                       path: { sibling: { field: bigint },
                                               goes_left: boolean
                                             }[]
                                     }];
  surrendered(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Surrender];
  freshRand(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  join(context: __compactRuntime.CircuitContext<PS>,
       c_0: Uint8Array,
       payout_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  startGame(context: __compactRuntime.CircuitContext<PS>, leaves_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
  tag(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimVictory(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  resign(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  openRefunds(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  cancel(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  refund(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  join(context: __compactRuntime.CircuitContext<PS>,
       c_0: Uint8Array,
       payout_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  startGame(context: __compactRuntime.CircuitContext<PS>, leaves_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
  tag(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimVictory(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  resign(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  openRefunds(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  cancel(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  refund(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  tagTokenOf(sk_0: Uint8Array): Uint8Array;
  playerOf(kt_0: Uint8Array): Uint8Array;
  leafOf(hunter_0: Uint8Array, e_0: Edge): Uint8Array;
  nullifierOf(e_0: Edge): Uint8Array;
  refundNullifierOf(c_0: Uint8Array): Uint8Array;
  hostCommitmentOf(sk_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  tagTokenOf(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  playerOf(context: __compactRuntime.CircuitContext<PS>, kt_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  leafOf(context: __compactRuntime.CircuitContext<PS>,
         hunter_0: Uint8Array,
         e_0: Edge): __compactRuntime.CircuitResults<PS, Uint8Array>;
  nullifierOf(context: __compactRuntime.CircuitContext<PS>, e_0: Edge): __compactRuntime.CircuitResults<PS, Uint8Array>;
  refundNullifierOf(context: __compactRuntime.CircuitContext<PS>,
                    c_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  hostCommitmentOf(context: __compactRuntime.CircuitContext<PS>,
                   sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  join(context: __compactRuntime.CircuitContext<PS>,
       c_0: Uint8Array,
       payout_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  startGame(context: __compactRuntime.CircuitContext<PS>, leaves_0: Uint8Array[]): __compactRuntime.CircuitResults<PS, []>;
  tag(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  claimVictory(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  resign(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  openRefunds(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  cancel(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  refund(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly phase: Phase;
  readonly hostCommit: Uint8Array;
  readonly entryFee: bigint;
  readonly maxPlayers: bigint;
  readonly deadline: bigint;
  readonly pot: bigint;
  readonly playerCount: bigint;
  readonly aliveCount: bigint;
  readonly tagCount: bigint;
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
  deadDrops: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Surrender;
    [Symbol.iterator](): Iterator<[Uint8Array, Surrender]>
  };
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
               cap_0: bigint,
               hostC_0: Uint8Array,
               endsAt_0: bigint): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
