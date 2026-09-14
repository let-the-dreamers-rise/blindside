# Wave 1: what was built

Midnight Buildathon, Wave 1. Everything below is in this repository and can be run.

## In one paragraph

Blindside is the tag game your school or office already plays, with two things it has never had:
a prize pot nobody can run off with, and a target list nobody can leak. Everyone is secretly
assigned one other player. You tag them in real life, they say five words out loud, and a
zero-knowledge proof settles the tag on Midnight without the chain learning who tagged whom. You
inherit their target. The last player standing proves it and the contract pays out. Millions of
people already play this every year over group chats and spreadsheets, with the money moving
through an organizer's personal payment app.

You can play it before you read any of that. The hunt is a pixel place at night, a campus or a
park, with four, eight or twelve players on it and ten strangers who are not in the game: one of
the players is hunting you and you do not know which. Buildings and trees block sight, standing
in a crowd hides you, running is loud, and three quarters of a minute in the grounds start
closing until everybody is in one courtyard and it has to end.

It is a game, and it is also the clearest way we found to show what the chain does and does not
learn. Press **The chain** while you play and the campus is replaced, in place, by everything an
observer holding the whole ledger can read at that moment. The counts move while you watch. The
list of people does not, because that list is the whole of what the chain knows about people.

## What a judge can check in five minutes

| | |
|---|---|
| Play the hunt, no wallet | [the hunt](https://let-the-dreamers-rise.github.io/blindside/#/hunt): a pixel campus at night, one of the others hunting you. Pick four players for a game that fits in ninety seconds. Every tag, refusal, payout and refund runs the real compiled contract in the browser tab |
| See what the chain does not | press **The chain** mid-game: the same moment with everything identifying taken out. Three players out, the record says three are out, and nothing says which three or who put them there |
| Play the paper version | [the sandbox](https://let-the-dreamers-rise.github.io/blindside/#/sandbox), the same contract with the buttons showing |
| Be a player on the night | [the phone page](https://let-the-dreamers-rise.github.io/blindside/#/me): your words, the bundle, your target, and a check on the words you heard. No server |
| Run one yourself | the console at `#/live` deploys, takes joins, starts a game and publishes the bundle from the tab. Settling a tag from a browser is refused by proof-server 8.1.0 and the CLI does it instead; both are written up rather than papered over |
| Watch the pot leave a broken game | the same page, "When it goes wrong": quit, let the deadline pass, open refunds, watch the pot drain back to the players |
| See it on a real chain | [the evidence page](https://let-the-dreamers-rise.github.io/blindside/#/evidence): contract address, every transaction, every timing |
| See what an observer learns | [the spectator view](https://let-the-dreamers-rise.github.io/blindside/#/watch) reads a deployed game out of a Midnight indexer. It is deliberately unimpressive |

## The cryptography, briefly

A game is a directed cycle. Each "A hunts B" is a note hidden behind a hash and inserted into a
`HistoricMerkleTree<8, Bytes<32>>`:

```
leaf      = H("blindside:edge:v1", hunter, target, rand)
nullifier = H("blindside:null:v1", rand)
```

A tag spends two notes and creates one, under fresh randomness:

```
before   A -> B -> C
tag      spend (A -> B), spend (B -> C), create (A -> C)
after    A -> C
```

The nullifier comes from the note's randomness alone, so it cannot be matched to the leaf it
retires; the new note uses randomness nobody else has seen, so it cannot be matched to either note
it replaces. The chain gains two opaque values and one leaf. Winning is a self-loop: the last
player's note points at themselves, and proving it is live is the claim.

A tag needs three things held by two people: the victim's tag token, which only they can produce;
the hunter's own secret; and the hunter's note proving this victim is their target. Words overheard
across a room are one of three, so they are useless to a stranger.

The handover is the part that decides whether anybody plays. A tag needs 96 bytes of the victim's
hidden note, which nobody can read out loud, so the design inverts it: the bytes are published as
ciphertext and the key is what gets said. Five words from the BIP-39 list are 55 bits, derived into
a key with Argon2id at 19 MiB, so one legitimate hunter pays a third of a second and a guesser pays
it 36 quadrillion times. The organizer seals each player's target to that key and cannot open it
again, because the secret half exists nowhere until its owner says the words.

That is what makes the game work over a phone line, a video call or a direct message, rather than
only between people standing next to each other. Presence was never what made a tag real. Consent
was.

## Engineering

- **Compact contract, 8 circuits**: `join`, `startGame`, `tag`, `claimVictory`, `resign`,
  `openRefunds`, `cancel`, `refund`. Compiles on the 0.31.1 toolchain.
- **Six pure circuits exported and called from TypeScript**, so no client ever reimplements a hash
  the circuit has to verify.
- **One engine**: the simulator the tests drive is the same one the browser sandbox drives.
- **Escrow**: entry fees arrive through `receiveUnshielded`, payouts leave through
  `sendUnshielded` to an address bound at join. There is no organizer withdrawal.
- **A full game on a real chain**: deploy, four joins, a start, three tags and a payout against a
  Midnight node, indexer and proof server, about four minutes fifty seconds end to end, recorded
  in `app/src/evidence/chain-run.json` and shown in the app.

Two problems that only appear on a real chain, both fixed and both commented in the code: signing
unshielded inputs writes to a copy of the intents map unless it is assigned back, and a circuit
proven against a state the indexer has not caught up to fails as an unattributable assertion
inside the proof.

## Quality

| | |
|---|---|
| Contract tests | 50, covering the lifecycle, every rejection by its player-facing message, what the ledger contains after a tag, and the four ways a real game breaks |
| Crypto and game core | 64, including the end to end proof that five spoken words yield exactly what the tag circuit checks |
| The hunt's simulation | 98, pure and seeded: the same seed is the same game twice, and every structural test runs against both maps |
| Does the game actually resolve | whole hunts played out with nobody at the keyboard, at every size, every tag through the compiled contract. It is a measurement, not an intention: before the grounds closed it left five to seven players standing at full time |
| Browser tests | 28, on a phone viewport, including a hunt won to the payout, a hunt lost to your hunter, the chain's view before and after a tag, both maps, a shared link picked up mid-game, and a player's phone reading a real bundle |
| Coverage gates | 80 percent, currently 94 percent statements on the engine and 97 on the core |
| CI | checks that every repository path the docs name still exists, compiles the contract from source rather than trusting the committed circuits, then typechecks, tests, builds and plays the browser game |

## The design decision worth arguing about

An escrow that can only pay a winner is a trap the first time a game does not produce one. Real
games break in four ways: someone refuses to surrender, someone loses their phone, someone quits,
the winner never claims. So there is a deadline fixed at creation, after which **anyone** can open
refunds, and every player who joined takes back exactly what they put in.

Refunds reach players who were tagged as well as players still alive. That is the part that
matters: if only survivors were refunded, refusing to surrender would be profitable. As it stands
the best a refuser can do is force a draw and get their own fee back. The alternative, letting the
organizer eliminate people, would let the organizer hand the pot to a friend.

## What this version does not do

Stated plainly, because a privacy product that overclaims is worse than one that admits a limit.

- **The organizer builds the cycle, so the organizer knows the map.** They cannot fake a tag and
  cannot touch the pot, but they can see who hunts whom. Removing this is the next milestone.
- **A refuser can force a draw.** Never a win, but a draw.
- **Sixteen players per game.**
- **No live wallet flow in the app yet.** A real game is driven from the runner; the app plays the
  sandbox and watches real games.
- **Test tokens only.** Real money needs mainnet and a legal review first.

## Next

Host-blind assignment, so nobody holds the map: a public pseudonymous cycle with encrypted
dossiers. Sponsored fees, so a player needs no tokens at all. More than sixteen players.
