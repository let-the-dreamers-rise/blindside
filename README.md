# Blindside

**Everyone has a target. Nobody knows who has them.**

Blindside is a real-world hidden-target tag game on [Midnight](https://midnight.network). You are
secretly assigned one other player to tag. When you tag them in real life they show you a one-time
code; a zero-knowledge proof settles the tag on chain without revealing who tagged whom, and you
inherit their target. The last player standing proves it and the contract pays out the pot.

The genre is Senior Assassin, office Killer, campus Assassins. Millions of people play it every
year over group chats and spreadsheets, with the prize money moving through the organizer's
personal payment app.

## What this does that an app with a database cannot

1. **A pot nobody can run off with, and nobody can trap.** Entry fees sit in the contract. It pays
   only the player who proves they are last. There is no organizer withdrawal, and a deadline plus
   a resign path mean one stubborn or absent player cannot lock the money up forever.
2. **The chain never learns who tagged whom.** Tags are proofs over hidden notes. The public feed
   says "someone was tagged, 11 remain", and that is all it can say.
3. **Tags nobody can fake, payouts nobody can redirect.** A tag needs the victim's surrendered code
   *and* the hunter's own secret, so a photographed screen is useless to anyone else. The payout
   address is fixed when you join, so a stolen phone cannot send the pot somewhere new.

## What this version does not do

Stated plainly, because a privacy product that overclaims is worse than one that admits a limit:

- **The organizer builds the cycle, so the organizer knows the map.** They cannot fake a tag and
  cannot touch the pot, but they can see who is hunting whom. Removing that is the next milestone.
- **A player who refuses to surrender can force a draw.** At the deadline everyone, tagged or
  alive, gets their entry fee back. Refusing can never win the pot, but it can end the game. The
  alternative, letting the organizer eliminate people, would let them hand the pot to a friend.
- **Sixteen players per game** in this version.
- **Testnet only.** Real money needs mainnet and a legal review first.

## How the game maps onto the cryptography

Each "A hunts B" is a hidden note in a Merkle tree, blinded with fresh randomness. A tag spends two
notes and creates one:

```
before   A -> B -> C
tag      spend (A -> B), spend (B -> C), create (A -> C) with new randomness
after    A -> C
```

The chain sees two nullifiers that cannot be tied back to the notes they retire, plus one new leaf.
It does not see A, B, or C. The last tag leaves the winner pointing at themselves, and that
self-loop is the proof of victory.

## Status

| Piece | State |
|---|---|
| Compact contract (8 circuits) | Compiles on 0.31.1 |
| Simulator test suite | 43 tests passing |
| Escrow on preprod | Next |
| Mobile web app | Next |
| Real game with real players | Planned before submission |

## Running it

Requires Node 22, pnpm, and the Compact toolchain (Linux or WSL2; the toolchain does not run
natively on Windows).

```bash
pnpm install
pnpm --filter @blindside/contract compact   # compile the contract
pnpm --filter @blindside/contract test       # 43 tests
```

## Layout

```
contract/src/blindside.compact   the game: join, startGame, tag, claimVictory,
                                 resign, openRefunds, cancel, refund
contract/src/witnesses.ts        private state, never leaves the device
contract/src/test/game.ts        harness: one ledger, many identities
contract/src/test/              lifecycle, rejections, privacy, always-exit
```

The tests named `always-exit` are the important ones. They are the four ways a real game breaks:
someone refuses to surrender, someone loses their phone, someone drops out, and the winner never
claims. In each case the money still gets out.

## Safety and tone

18+. The word is "tag", never anything else. No location broadcasting, no weapon imagery, consent
at every handover, and a stop rule that always wins. Prize pots are testnet only.

## License

Apache-2.0.
