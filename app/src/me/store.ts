// What the phone remembers between opens: the words and the bundle, and nothing else.
// SPDX-License-Identifier: Apache-2.0

const KEY = "blindside:me";

export type Me = { readonly words: string; readonly bundle: string };

export const EMPTY_ME: Me = { words: "", bundle: "" };

const text = (value: unknown): string => (typeof value === "string" ? value : "");

export const loadMe = (): Me => {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) {
      return EMPTY_ME;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return EMPTY_ME;
    }
    const record = parsed as Record<string, unknown>;
    return { words: text(record["words"]), bundle: text(record["bundle"]) };
  } catch {
    return EMPTY_ME;
  }
};

export const saveMe = (me: Me): void => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(me));
  } catch {
    // Storage off: the page still works for as long as it is open.
  }
};

export const forgetMe = (): void => {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing was kept, so there is nothing to forget.
  }
};
