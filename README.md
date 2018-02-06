# EtherPanther

EtherPanther is a simple yet robust decentralized Ether <-> ERC20 tokens exchange.

## Developers info
**Running unit tests**
- assumptions:
  - run using truffle
  - ment to run on the development (local) blockchain only
  - due to lack of possibility to use mocks etc., manual change of all private method to public ones,
    for part of the test, is required
- test scenario:
  - run local node: `ganache-cli --networkId=73`
  - change all private methods into public ones in EtherPanther.sol
  - `truffle test test/unit/private.js`
  - revert all the private methods back to its original definition
  - `truffle test test/unit/public.js`

**Running functional tests**: please see `etherpanther-test-client` repository

**Migrations**
- ropsten: `truffle migrate --network=ropsten`

