// Public surface of the contract package: the generated bindings plus the private-state helpers.
// SPDX-License-Identifier: Apache-2.0

export * from "./managed/blindside/contract/index.js";
export * from "./witnesses.js";
// The simulator is not test-only: Sandbox mode in the app runs the compiled contract in the
// browser through exactly this class, so what a judge plays is the real contract.
export * from "./simulator.js";
