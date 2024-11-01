import { assert } from "chai";
import { BigNumber } from "ethers";
import env from "../../utils/env";
import { wei } from "../../utils/wei";
import optimism from "../../utils/optimism";
import testing, { scenario } from "../../utils/testing";
import { getExchangeRate, refSlotTimestamp } from "../../utils/testing/helpers";

scenario("Optimism :: Token Rate Oracle integration test", ctxFactory)

  .step("Push Token Rate", async (ctx) => {
    const {
      tokenRateOracle,
      opTokenRatePusher,
      l1CrossDomainMessenger,
      accountingOracle
    } = ctx;

    const {
      tokenRate,
    } = ctx.constants;

    const account = ctx.accounts.accountA;

    const tx = await opTokenRatePusher
      .connect(account.l1Signer)
      .pushTokenRate();

    const messageNonce = await l1CrossDomainMessenger.messageNonce();
    const updateRateTime = await refSlotTimestamp(accountingOracle);
    const l2Calldata = tokenRateOracle.interface.encodeFunctionData(
      "updateRate",
      [
        tokenRate,
        updateRateTime
      ]
    );

    await assert.emits(l1CrossDomainMessenger, tx, "SentMessage", [
      tokenRateOracle.address,
      opTokenRatePusher.address,
      l2Calldata,
      messageNonce,
      300_000,
    ]);
  })

  .step("Finalize pushing rate", async (ctx) => {
    const {
      opTokenRatePusher,
      tokenRateOracle,
      l1CrossDomainMessenger,
      accountingOracle
    } = ctx;

    const [
      ,
      tokenRateAnswerBefore,
      startedAt_updatedRateBefore,
      ,
    ] = await tokenRateOracle.latestRoundData();

    console.log("tokenRateAnswerBefore=", tokenRateAnswerBefore);
    console.log("startedAt_updatedRateBefore=",startedAt_updatedRateBefore);

    const {
      tokenRate
    } = ctx.constants;

    const account = ctx.accounts.accountA;
    await l1CrossDomainMessenger
      .connect(account.l1Signer)
      .setXDomainMessageSender(opTokenRatePusher.address);

    const minTimeBetweenTokenRateUpdates = await tokenRateOracle.MIN_TIME_BETWEEN_TOKEN_RATE_UPDATES();
    const updateRateTime = (await refSlotTimestamp(accountingOracle))
      .add(minTimeBetweenTokenRateUpdates)
      .add(1000);

    const messageNonce = await l1CrossDomainMessenger.messageNonce();

    const tx = await ctx.l2CrossDomainMessenger
      .connect(ctx.accounts.l1CrossDomainMessengerAliased)
      .relayMessage(
        messageNonce,
        opTokenRatePusher.address,
        tokenRateOracle.address,
        0,
        300_000,
        tokenRateOracle.interface.encodeFunctionData("updateRate", [
          tokenRate,
          updateRateTime
        ]),
        { gasLimit: 5_000_000 }
      );

    console.log("new tokenRate=",tokenRate);
    console.log("new updateRateTime=",updateRateTime);

    if ((updateRateTime.sub(startedAt_updatedRateBefore)).gt(minTimeBetweenTokenRateUpdates)) {
      await assert.emits(tokenRateOracle, tx, "RateUpdated", [
        tokenRate,
        updateRateTime
      ]);
    }

    const answer = await tokenRateOracle.latestAnswer();
    assert.equalBN(answer, tokenRate);

    const [
      ,
      tokenRateAnswer,
      startedAt_,
      ,
    ] = await tokenRateOracle.latestRoundData();

    assert.equalBN(tokenRateAnswer, tokenRate);
    assert.equalBN(startedAt_, updateRateTime);
  })

  .run();

async function ctxFactory() {
  const networkName = env.network("TESTING_OPT_NETWORK", "mainnet");

  const {
    totalPooledEther,
    totalShares,
    l1Provider,
    l2Provider,
    l1ERC20ExtendedTokensBridgeAdmin,
    l2ERC20ExtendedTokensBridgeAdmin,
    ...contracts
  } = await optimism.testing(networkName).getIntegrationTestSetup();

  const tokenRateDecimals = BigNumber.from(27);
  const tokenRate = getExchangeRate(tokenRateDecimals, totalPooledEther, totalShares);

  const optContracts = optimism.contracts(networkName, { forking: true });
  const l2CrossDomainMessenger = optContracts.L2CrossDomainMessenger;

  await optimism.testing(networkName).stubL1CrossChainMessengerContract();

  const l1CrossDomainMessengerAliased = await testing.impersonate(
    testing.accounts.applyL1ToL2Alias(optContracts.L1CrossDomainMessengerStub.address),
    l2Provider
  );
  await testing.setBalance(
    await l1CrossDomainMessengerAliased.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    l2Provider
  );

  const tokenRateOracle = contracts.tokenRateOracle;
  const opTokenRatePusher = contracts.opStackTokenRatePusher;
  const l1Token = contracts.l1Token;
  const accountingOracle = contracts.accountingOracle;

  const accountA = testing.accounts.accountA(l1Provider, l2Provider);
  const l1CrossDomainMessenger = optContracts.L1CrossDomainMessengerStub;

  return {
    tokenRateOracle,
    opTokenRatePusher,
    l1CrossDomainMessenger,
    l2CrossDomainMessenger,
    l1Token,
    accountingOracle,
    l1Provider,
    accounts: {
      accountA,
      l1CrossDomainMessengerAliased
    },
    constants: {
      tokenRate
    }
  };
}
