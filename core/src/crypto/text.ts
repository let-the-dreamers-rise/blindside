// Turning bytes into things people and group chats can carry, and back again. Everything that
// comes back is untrusted by the time it is read, so it is parsed, never assumed.
// SPDX-License-Identifier: Apache-2.0

export const MAX_NAME_LENGTH = 24;

export const toHex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export const fromHex = (hex: string): Uint8Array => {
  const pairs = hex.match(/.{2}/g) ?? [];
  return new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16)));
};

/** Names come from other people, so they are stripped before they are ever rendered. */
export const sanitizeName = (raw: string): string =>
  [...raw.replace(/[\p{C}]/gu, "").trim()].slice(0, MAX_NAME_LENGTH).join("");

export const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Returns null rather than throwing: what comes back is always somebody else's typing. */
export const base64UrlDecode = (encoded: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]*$/.test(encoded)) {
    return null;
  }
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
};
