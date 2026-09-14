// SPDX-License-Identifier: Apache-2.0

import { Suspense, lazy, useEffect, useState } from "react";
import { Landing } from "./screens/Landing.tsx";

// The sandbox pulls in the compiled contract and the Midnight runtime WASM, about a megabyte and
// a half. The landing page does not need any of it, so it only arrives when someone decides to
// play.
const Sandbox = lazy(async () => ({
  default: (await import("./screens/Sandbox.tsx")).Sandbox,
}));
const Evidence = lazy(async () => ({
  default: (await import("./screens/Evidence.tsx")).Evidence,
}));
const Watch = lazy(async () => ({
  default: (await import("./screens/Watch.tsx")).Watch,
}));
const Rules = lazy(async () => ({
  default: (await import("./screens/Rules.tsx")).Rules,
}));
const Live = lazy(async () => ({
  default: (await import("./screens/Live.tsx")).Live,
}));
const Hunt = lazy(async () => ({
  default: (await import("./screens/Hunt.tsx")).Hunt,
}));

const currentRoute = (): string => window.location.hash || "#/";

const Loading = ({ what }: { readonly what: string }) => (
  <main>
    <p className="mono" style={{ color: "var(--paper-dim)" }}>
      {what}
    </p>
  </main>
);

export const App = () => {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  if (route.startsWith("#/hunt")) {
    return (
      <Suspense fallback={<Loading what="Loading the campus..." />}>
        <Hunt />
      </Suspense>
    );
  }
  if (route.startsWith("#/sandbox")) {
    return (
      <Suspense fallback={<Loading what="Loading the contract..." />}>
        <Sandbox />
      </Suspense>
    );
  }
  if (route.startsWith("#/evidence")) {
    return (
      <Suspense fallback={<Loading what="Loading..." />}>
        <Evidence />
      </Suspense>
    );
  }
  if (route.startsWith("#/watch")) {
    return (
      <Suspense fallback={<Loading what="Loading..." />}>
        <Watch />
      </Suspense>
    );
  }
  if (route.startsWith("#/rules")) {
    return (
      <Suspense fallback={<Loading what="Loading..." />}>
        <Rules />
      </Suspense>
    );
  }
  if (route.startsWith("#/live")) {
    return (
      <Suspense fallback={<Loading what="Loading the wallet..." />}>
        <Live />
      </Suspense>
    );
  }
  return <Landing />;
};
