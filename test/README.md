# Tests

## Unit
Unit tests for smart contracts. Due to their close relation, some tests create multiple real contract instances instead of using mocks.

## Integration
Run on forks only
### Non-rebasable token (wstETH) bridging tests
Testing the positive scenario of bridging the wstETH token. For `stETH on OP`, a series of tests were created to verify the state during the upgrade process.
#### L1 and L2 has only wstETH bridging. Pre-stETH upgrade state.
```bash
npx hardhat test ./test/integration/bridging-non-rebasable-old_L1-old_L2.integration.test.ts
```
#### State when L1 already upgraded and L2 isn't. Half-baked stETH on Op upgrade state.
```bash
npx hardhat test ./test/integration/bridging-non-rebasable-new_L1-old_L2.integration.test.ts
```
#### State when both L1 and L2 are upgraded.
```bash
npx hardhat test ./test/integration/bridging-non-rebasable.integration.test.ts
```
## managing-e2e
These tests are designed to run on a real blockchain and modify some important state. Therefore, they should only be used on a testnet.

## e2e
These tests are designed to run on a real blockchain. However, due to the lengthy withdrawal process on Optimism, it is necessary to manually complete the withdrawals by first running the prove step
```bash
export TX_HASH=<take_it_from_bridging...e2e.test.ts>
npx ts-node --files ./scripts/optimism/prove-message.ts
```
and then finalizing it after 7 days.
```bash
export TX_HASH=<take_it_from_previouse_step>
npx ts-node --files ./scripts/optimism/finalize-message.ts
```



