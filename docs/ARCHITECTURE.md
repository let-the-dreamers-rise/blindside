# How Blindside is built

Four packages, one contract, and a rule that nothing is reimplemented twice.

```
contract/   the Compact contract, its witnesses, and a simulator that drives it
core/       the cryptography and game logic both the app and the runner share
chain/      wallet, providers and signing, shared by the runner and the browser
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

Words overheard across a room are therefore useless: they are one of three, and the other two never
leave the hunter's device. This is why the surrender is a handover and not a scan of a public
board.

## The handover: five words instead of a screen

The three things above add up to 96 bytes of the victim's private note. Nobody reads 96 bytes
aloud, so the design inverts: **the bytes are published and the key is what gets said.**

```
words      five from the 2048 word BIP-39 list          55 bits
key        x25519 keypair from Argon2id(words, game)    19 MiB, two passes, ~0.3s
item       seal(publicKey, 128 bytes) -> 200 bytes      fixed length, whatever it holds
bundle     blindside1.<game>.<base64url of 32 items>    one line of text
```

A player is exactly two items in that bundle:

| Item | Sealed by | Holds | Who needs it |
|---|---|---|---|
| assignment | the organizer | target, randomness, target's name, generation | the player, and later their hunter |
| tag token | the player themselves | the preimage behind their commitment | their hunter only |

The organizer seals the assignment to a public key derived from words they have never heard, so
they cannot open it again. They never see any tag token at all: a player seals their own, at join,
and the organizer carries it without being able to read it. Both halves are needed for a tag, and
neither alone does anything.

Everything else falls out of this:

- **No server.** The bundle is ciphertext and padding, so it can be pasted anywhere. Players read
  their own target out of the public copy; a hunter opens their victim's half with words they were
  told. Nothing has to travel privately between two phones.
- **It works down a phone line.** Presence was never what made a tag real; consent was. Five words
  carry consent over any channel.
- **Nothing leaks from the shape.** Every item is 200 bytes and every game publishes 32 of them,
  padded with random bytes, so the bundle says nothing about who is in the game or how many.
- **A tag moves a player on.** Tagging inherits a target under fresh randomness, so the tagger
  seals a later *generation* of their assignment and appends it. When several assignments open for
  one key, the highest generation is the live one; order in a shuffled bundle decides nothing.

The words are derived from the player's own secret, so a restored secret restores the codes too and
there is never a second thing to back up. Reading them back is forgiving on purpose: case is
ignored, anything that is not a letter separates words, and a word matches on its first four
letters, because every word in the list is unique in them. "Abando, Ability..." is the same code as
"abandon ability".

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

## Running a chain from a browser tab

The live console deploys the contract, takes joins, starts the game, settles tags and pays out,
from a page, against a real node. There is no server between the tab and the chain: the wallet is
in the tab, the proof server is on the same machine, and the indexer is queried directly.

Getting there took four fixes that are worth writing down, because none of them fail loudly.

| What breaks | Why | Fix |
|---|---|---|
| Every ZK artifact read fails with `ZKConfigurationReadError` | `FetchZkConfigProvider` keeps the fetch it is given and calls it as a plain function. A browser's `fetch` must be called on the window, so it throws `Illegal invocation` before a request leaves the tab, and the error surfaces as a read failure | pass `globalThis.fetch.bind(globalThis)` as the second argument |
| The private state store throws `Class extends value undefined` on load | it is built on Node's `EventEmitter`, which a bundler stubs out | alias `events` to the `events` package |
| The wallet SDK's simulators import `subtle` from a module that is not there | they ask Node for its webcrypto | alias `crypto` and `node:crypto` to a shim that returns `globalThis.crypto` |
| The indexer provider imports `WebSocket` by name | `isomorphic-ws` gives a browser only a default export | alias it to a shim that exports both |

The proving material is the other half. `scripts/zk-assets.mjs` copies the compiled keys and ZKIR
next to the app at build time, 65 MB of it, and the browser fetches one only when it is about to
prove that circuit. Deploying needs the verifier keys, which are small; a tag needs a 19 MB prover
key, which is fetched once and cached by the browser.

What the console cannot do is hide the players from itself: it makes every player's secret in the
tab, so one person can run a whole game and be watched doing it. That is the same limit the
organizer already has in this version, said out loud on the page.

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
  malformed. `chain/src/signing.ts` assigns the signed intents back.
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
| `core/src/test/words` | the word codes, and what a key costs to guess |
| `core/src/test/handover` | five people, one bundle, a tag from spoken words |
| `core/src/test/cycle` | the host's shuffle, and what the bundle does not leak |
| `core/src/test/errors` | contract assertions turned into something a player can act on |
| `app/e2e` | a whole game in a browser, on a phone viewport |

Coverage is gated at 80 percent for the game engine and the crypto core. CI compiles the contract
from source rather than trusting the committed circuits.
