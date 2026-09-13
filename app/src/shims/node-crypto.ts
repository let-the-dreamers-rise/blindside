// The wallet SDK asks Node for its webcrypto. A browser has exactly that API already, on
// globalThis, so this hands it back instead of letting the bundler stub the module out and leave
// the SDK holding an undefined at runtime.
// SPDX-License-Identifier: Apache-2.0

const browserCrypto = globalThis.crypto;

export const webcrypto = browserCrypto;
export const subtle = browserCrypto.subtle;
export const randomUUID = (): string => browserCrypto.randomUUID();
export const getRandomValues = <T extends ArrayBufferView<ArrayBuffer>>(array: T): T =>
  browserCrypto.getRandomValues(array);

export default { webcrypto, subtle, randomUUID, getRandomValues };
