// SPDX-License-Identifier: Apache-2.0

type Rule = {
  readonly title: string;
  readonly body: string;
};

const PLAYING: readonly Rule[] = [
  {
    title: "A tag is a hand on a shoulder",
    body: "That is the whole thing. No water, no foam, no thrown objects, nothing that looks like a weapon from across a room, and nothing anyone has to duck. If you would not do it to a stranger, it is not a tag.",
  },
  {
    title: "Stop always wins",
    body: "Anyone can say stop, at any moment, for any reason or none. The tag does not count, the game pauses, and the person who said it does not have to explain. A player who ignores that is out, and the organizer says so publicly.",
  },
  {
    title: "You are tagged when you say you are",
    body: "There is no photo to argue about and no referee. When someone tags you, you say your five words. Saying them is the surrender: it is your decision, made out loud, and nobody can take it from you. They work anywhere a voice or a message goes, so a game does not have to be one building.",
  },
  {
    title: "Nowhere that matters is in play",
    body: "Classrooms, labs, libraries, exams, workplaces, anyone's home, bathrooms, changing rooms, hospitals, places of worship, vehicles and anywhere near a road. Every game also picks its own safe places before it starts. If you are unsure, it is safe.",
  },
  {
    title: "Nobody is tracked",
    body: "The app has no map, no location permission and no way to tell anyone where you are. If you want to find your target, you have to know them.",
  },
  {
    title: "Eighteen and over",
    body: "Adults, playing a game they chose, with money that is currently worthless test tokens. Real money would need a legal review first, and this version does not do it.",
  },
];

const ORGANIZING: readonly Rule[] = [
  {
    title: "Set an end time you can live with",
    body: "The deadline is fixed when the game is created and cannot be moved. When it passes, anybody can open refunds and everyone who joined takes back exactly what they put in.",
  },
  {
    title: "You cannot touch the pot",
    body: "There is no organizer withdrawal. The only ways money leaves the contract are the last player proving they are last, and per-player refunds after the deadline. This is deliberate: you should not have to be trusted.",
  },
  {
    title: "You will know the target list",
    body: "In this version you build the cycle, so you can see who hunts whom. Say so to your players. You cannot fake a tag and you cannot redirect a payout, but you can see the map, and they deserve to know that.",
  },
  {
    title: "Somebody will refuse to surrender",
    body: "They cannot win by it. At the deadline everyone, tagged or not, gets their fee back, so refusing buys a draw and nothing else. Do not try to arbitrate it: the contract already handles it.",
  },
];

const Section = ({ title, rules }: { readonly title: string; readonly rules: readonly Rule[] }) => (
  <section className="card" style={{ marginTop: 18 }}>
    <h2>{title}</h2>
    <dl className="rules">
      {rules.map((rule) => (
        <div key={rule.title}>
          <dt>{rule.title}</dt>
          <dd>{rule.body}</dd>
        </div>
      ))}
    </dl>
  </section>
);

export const Rules = () => (
  <main>
    <a href="#/" className="mono" style={{ color: "var(--paper-dim)" }}>
      &larr; Blindside
    </a>

    <h1 style={{ marginTop: 18 }}>House rules</h1>
    <p className="lede">
      This genre has a bad habit of drifting into things that frighten people who are not playing.
      These rules are not decoration. A game that breaks them is not a Blindside game.
    </p>

    <Section title="Playing" rules={PLAYING} />
    <Section title="Running a game" rules={ORGANIZING} />

    <section className="card" style={{ marginTop: 18 }}>
      <h2>If something goes wrong</h2>
      <p>
        Stop the game. The organizer can cancel before it starts, and after the deadline anyone can
        open refunds and every player gets their entry fee back. Nothing about the money requires
        anyone to behave well.
      </p>
    </section>
  </main>
);
