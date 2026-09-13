// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react";
import { Landing } from "./screens/Landing.tsx";
import { Sandbox } from "./screens/Sandbox.tsx";

const currentRoute = (): string => window.location.hash || "#/";

export const App = () => {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  if (route.startsWith("#/sandbox")) {
    return <Sandbox />;
  }
  return <Landing />;
};
