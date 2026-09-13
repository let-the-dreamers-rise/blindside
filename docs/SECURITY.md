# Security model

What Blindside protects, what it does not, and who has to be trusted.

## Who knows what

| Fact | Public chain | Organizer | Your hunter | You |
|---|---|---|---|---|
| The game, its fee, cap and deadline | yes | yes | yes | yes |
| Player pseudonyms (commitments) | yes | yes | yes | yes |
| Player names | no | yes, in this version | only their own target | your own target |
| Who hunts whom | no | yes, in this version | their own note only | your own note only |
| Who tagged whom | no | can infer the first tag on each starting note | knows their own | learns only that they are out |
| Who is still alive | a count only | can infer | own status | own status |
| Winner's payout address | yes | yes | yes | yes |

## Threats

| Threat | Result |
|---|---|
| Claiming a tag that never happened | Blocked. A tag needs the victim's tag token, which only they can hand over. |
| Using a code photographed off a screen | Blocked. The proof also needs the hunter's own secret and their note pointing at that victim. |
| Replaying a code | Blocked by nullifiers, and by the hunter's note being replaced after each tag. |
| Tagging someone who is not your target | Blocked: "That is not your target". |
| Organizer steals the pot | Impossible. No circuit pays the organizer. The only ways money leaves are the winner's claim and per-player refunds. |
| Organizer fakes a tag | Impossible. They hold no player's secret and no player's tag token. |
| Organizer redirects a payout | Impossible. Payout addresses are bound at join, not supplied at claim. |
| Stolen phone | Cannot redirect money, for the same reason. Can impersonate that player in the game. |
| One player refuses to surrender | Cannot win the pot. At the deadline every player, tagged or alive, takes their own fee back. |
| A player disappears | Same: the deadline releases everyone's money. |
| Winner never claims | Same. |
| A player quits deliberately | `resign` publishes their code. Only their own hunter holds a note pointing at them, so only that hunter can use it. |
| Sybil (one person, many seats) | Not prevented in this version. Every seat costs an entry fee. Host-signed invites are the fix. |
| Hostile text in a player name | Names are decrypted user input: control characters stripped, capped at 24 characters, rendered as text only. |
| Watching the mempool | Nothing useful there: a proof, two nullifiers, one new note. |

## Trust assumptions in this version

1. **The organizer knows the map.** They build the cycle, so they can see who hunts whom, and
   because they chose each starting note's randomness they can recognise those notes when they are
   spent. They cannot fake a tag or touch the pot. Removing this is the next milestone.
2. **The refusal draw.** Refunds reach everyone who joined, so refusing to surrender never wins the
   pot. It can still end the game in a draw. The alternative, letting the organizer eliminate
   people, would let them hand the pot to a friend. The draw is the lesser evil.
3. **Real-world observation beats any of this.** People see each other. Victims know who tagged
   them. The chain is simply not where a game like this leaks.

## Handling secrets

- A player's secret and tag token never leave the device and are never sent to any server.
- Everything else on the device is derived from that one secret, so the keycard backup is one QR.
- Proving happens either in the wallet or against a proof server the player controls. The app
  warns if a prover URL is not local.
- Nothing secret is ever logged.

## Reporting

Open a GitHub issue for anything that is not a live exploit. For a live exploit, contact the
maintainer privately first.
