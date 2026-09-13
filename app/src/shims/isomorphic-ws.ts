// isomorphic-ws hands a browser its own WebSocket as a default export only, and the indexer
// provider imports it by name. Same object either way.
// SPDX-License-Identifier: Apache-2.0

const Impl = globalThis.WebSocket;

export { Impl as WebSocket };
export default Impl;
