import { assert } from "chai";
import network, { SignerOrProvider } from "../../utils/network";
import testingUtils, { scenario } from "../../utils/testing";
import { BigNumber } from 'ethers'
import {
  WstETHStub__factory,
  TokenRateNotifier__factory,
  TokenRateOracle__factory
} from "../../typechain";

scenario("Optimism :: Push token rate to Oracle E2E test", ctxFactory)

  .step("Push Token Rate", async (ctx) => {
    await ctx.tokenRateNotifier
      .connect(ctx.l1Tester)
      .handlePostTokenRebase(1, 2, 3, 4, 5, 6, 7, { gasLimit: 5_000_000 });
  })

  .step("Receive token rate", async (ctx) => {
    const tokenRate = await ctx.l1Token.getStETHByWstETH(BigNumber.from(10).pow(27));

    const answer = await ctx.tokenRateOracle.latestAnswer();
    assert.equalBN(answer, tokenRate);

    const [
      ,
      latestRoundDataAnswer,
      ,
      ,
    ] = await ctx.tokenRateOracle.latestRoundData();
    assert.equalBN(latestRoundDataAnswer, tokenRate);
  })

  .run();

async function ctxFactory() {
  const testingSetup = await getE2ETestSetup();

  return {
    l1Tester: testingSetup.l1Tester,
    l2Tester: testingSetup.l2Tester,
    l1Provider: testingSetup.l1Provider,
    l2Provider: testingSetup.l2Provider,
    l1Token: testingSetup.l1Token,
    tokenRateNotifier: testingSetup.tokenRateNotifier,
    tokenRateOracle: testingSetup.tokenRateOracle
  };
}

async function getE2ETestSetup() {
  const testerPrivateKey = testingUtils.env.TESTING_PRIVATE_KEY();

  const [ethProvider, optProvider] = network.getProviders({ forking: false });
  const [l1Tester, l2Tester] = network.getSigners(testerPrivateKey, { forking: false });
  const contracts = await loadDeployedContracts(l1Tester, l2Tester);

  return {
    l1Tester,
    l2Tester,
    l1Provider: ethProvider,
    l2Provider: optProvider,
    ...contracts,
  };
}

async function loadDeployedContracts(
  l1SignerOrProvider: SignerOrProvider,
  l2SignerOrProvider: SignerOrProvider
) {
  return {
    l1Token: WstETHStub__factory.connect(
      testingUtils.env.OPT_L1_NON_REBASABLE_TOKEN(),
      l1SignerOrProvider
    ),
    tokenRateNotifier: TokenRateNotifier__factory.connect(
      testingUtils.env.OPT_L1_TOKEN_RATE_NOTIFIER(),
      l1SignerOrProvider
    ),
    tokenRateOracle: TokenRateOracle__factory.connect(
      testingUtils.env.OPT_L2_TOKEN_RATE_ORACLE(),
      l2SignerOrProvider
    ),
    l1SignerOrProvider,
    l2SignerOrProvider
  };
}
