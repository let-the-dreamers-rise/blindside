# How Blindside is built

Four packages, one contract, and a rule that nothing is reimplemented twice.

```
contract/   the Compact contract, its witnesses, and a simulator that drives it
core/       the cryptography and game logic both the app and the runner share
app/        the mobile web client
cli/        a whole game against a real chain
```

## The one rule

Every hash the game depends on is a `pure circuit` in the contract, exported and called from
TypeScript. `tagTokenOf`, `playerOf`, `leafOf`, `nullifierOf`, `refundNullifierOf` and
`hostCommitmentOf` exist once, in Compact. The app and the runner call them through the compiled
bindings rather than reimplementing them, so a client can never drift from the circuit that has
to verify its work.

The same rule applies to the simulator. `contract/src/simulator.ts` is what the tests drive and
what the browser sandbox drives. There is no second engine that might behave differently from the
one under test.

## The game as notes and nullifiers

A game is a directed cycle: every player hunts exactly one other, and following the arrows from
anyone reaches everyone. Each arrow is a note, hidden behind a hash:

```
leaf       = H("blindside:edge:v1", hunter, target, rand)
nullifier  = H("blindside:null:v1", rand)
```

The leaves go into a `HistoricMerkleTree<8, Bytes<32>>` on chain. The openings go to the players,
sealed to their own keys. A tag spends two notes and creates one:

```
before   A -> B -> C
tag      spend (A -> B), spend (B -> C), create (A -> C) with fresh randomness
after    A -> C
```

The nullifier is derived from the note's randomness alone, so it cannot be matched to the leaf it
retires. The new note uses randomness nobody else has seen, so it cannot be matched to either of
the notes it replaces. What the chain gains is two opaque values and one new leaf.

The tree is `Historic`, which matters more than it looks: a player's Merkle path was built against
an older root, and by the time they tag, other people have inserted leaves. Checking the path
against any root the tree has ever had is what lets a game run without everyone refreshing after
every move.

Winning is a self-loop. The last player's note points at themselves, and proving that note is live
is the claim.

## What a tag needs

Three things, held by two different people:

1. The victim's tag token, which only the victim can produce from their own secret.
2. The hunter's own secret, which proves the hunter is who the note says.
3. The hunter's note, proving that this victim is their target and not someone else's.

A code photographed off a screen is therefore useless: it is one of three, and the other two never
leave the hunter's device. This is why the surrender is a handover and not a scan of a public
board.

## Privacy boundaries

| Lives on chain | Lives on the device |
|---|---|
| phase, entry fee, cap, deadline, pot | your secret |
| player commitments | your note's opening |
| the Merkle tree of notes | your target's name |
| spent nullifiers | the host's secret |
| counts: joined, alive, tags | |

`disclose()` marks every value that crosses from the second column to the first, so the compiler
refuses to let anything leak by accident.

## Always-exit

An escrow that can only pay a winner is a trap the first time a game does not produce one. Four
things really happen in real games, and each has a path:

| What happens | What the contract does |
|---|---|
| Someone refuses to surrender | Deadline passes, `openRefunds`, everyone takes their fee back |
| Someone loses their phone | Same |
| Someone quits on purpose | `resign` publishes a dead drop only their own hunter can use |
| The winner never claims | Same as the first: refunds reach everyone who joined |

Refunds go to players who were tagged as well as players still alive. That is deliberate: if only
survivors were refunded, refusing to surrender would be a way to profit. As it stands the best a
refuser can do is a draw in which they get back exactly what they put in.

Payout addresses are bound at `join`, not supplied at `claim`, so a stolen phone can lose a game
but cannot redirect the money.

## Two ways to run it

**Sandbox.** The compiled contract runs in the browser tab through the simulator. Every rule and
every refusal is the contract's. Proofs and settlement are not real, and the page says so. This is
the demo that needs no wallet.

**A real chain.** `cli/src/game-run.ts` drives the same contract through `midnight-js` against a
node, an indexer and a proof server: deploy, four joins, a start, three tags, a payout. It writes
what it did into `app/src/evidence/chain-run.json`, which the app shows.

Two things that only show up on a real chain:

- **Unshielded inputs need signatures, and the intents accessor returns a copy.** Signing the
  inputs in place writes to a map that is thrown away, and the node rejects the transaction as
  malformed. `cli/src/signing.ts` assigns the signed intents back.
- **A circuit is proven against the state the indexer last served.** A call made immediately after
  the call it depends on can be built against a state that does not contain it, which surfaces as
  a failed assertion inside the proof with nothing to say which one. Every dependent call waits
  for the chain to show the previous one first.

## Testing

| Layer | What it covers |
|---|---|
| `contract/src/test/lifecycle` | the happy path, phase by phase |
| `contract/src/test/rejections` | every assertion, by the error a player would see |
| `contract/src/test/privacy` | what the ledger does and does not contain after a tag |
| `contract/src/test/always-exit` | the four ways a real game breaks |
| `core/src/test` | envelopes, tag codes, the host's shuffle, the error map |
| `app/e2e` | a whole game in a browser, on a phone viewport |

Coverage is gated at 80 percent for the game engine and the crypto core. CI compiles the contract
from source rather than trusting the committed circuits.
