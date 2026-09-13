# Demo video: two minutes

Shot list and words. No slides until the last ten seconds. Everything on screen is the real thing:
no mockups, no sped-up footage without saying so.

## 0:00 - 0:12  The game people already play

*Phone, held. The landing page.*

> Millions of people play this game every year. Senior Assassin, office Killer, campus Assassins.
> Everyone gets a secret target, you tag them in real life, you inherit their target, last one
> standing wins the pot. Two things have always been broken about it: somebody has to hold the
> money, and somebody has to hold the list.

## 0:12 - 0:40  Play it

*Tap "Play a game right now". Open the envelope. Tag. Open, tag. Open, tag. Win. Claim.*

> This is running the real compiled contract, in this browser tab. No wallet, no chain, nothing
> installed. Open your target. Tag them. You inherit theirs.
>
> And here is the whole point, on the right. That is everything the chain learned from that tag:
> two spent notes and one new one. Not my name, not theirs, not the link between us.

*Pause on the chain panel for a beat. Then claim the pot.*

> Last one standing proves it and the contract pays out. Nobody handed me anything.

## 0:40 - 1:05  The part everyone skips

*Scroll to "When it goes wrong". Press the four buttons in order, slowly, watching the pot.*

> An escrow that can only pay a winner is a trap the first time a game does not produce one.
> Somebody always refuses to hand over their code. Somebody loses their phone.
>
> So: I quit, and I leave a code only my own hunter can use. Nobody tags anyone again. The
> deadline passes, and anybody, not the organizer, anybody, opens refunds. Every player takes back
> exactly what they put in, tagged or not.
>
> That last part is deliberate. If only survivors were refunded, refusing to surrender would pay.
> This way the best a refuser can do is a draw.

## 1:05 - 1:30  On a real chain

*Terminal. `pnpm --filter @blindside/cli local`. Cut to the finished run, or run it live and cut.*

> That was the rules. This is the chain. One command brings up a Midnight node, an indexer and a
> proof server, deploys the contract, and plays a four player game through it. Deploy, four joins,
> a start, three tags, a payout. Every one of those is a real zero-knowledge proof.

*Switch to the evidence page in the app.*

> The app shows what that run did, because it reads the file the run wrote. Contract address,
> every transaction, what every step cost. About twenty to thirty seconds a move, which is the
> honest number for a game where a move happens once an hour.

## 1:30 - 1:45  What an observer sees

*The spectator page, pointed at that contract.*

> This reads that game straight out of the indexer. Phase, how many joined, how many are left, the
> pot, the spent notes, the players as pseudonyms. This screen is deliberately boring. This is
> everything anybody watching the chain can learn, and it does not include who tagged whom.

## 1:45 - 2:00  The limit, and what is next

*Back to the landing page, on the line that admits it.*

> One thing this version does not hide: the organizer builds the target list, so the organizer
> knows it. They cannot fake a tag and they cannot touch the pot, and it says so on the front
> page. Removing that is next: a public pseudonymous cycle with encrypted dossiers, so nobody
> holds the map.
>
> Blindside. Everyone has a target. Nobody knows who has them.

## Notes for the recording

- Phone viewport throughout for the app, a real phone if possible.
- Do not speed anything up silently. If a proof takes thirty seconds, either show it or say the
  footage is cut.
- The chain panel is the star. Give it a full beat after the first tag.
- No gun imagery, no crosshairs, no red spatter. The word is "tag".
