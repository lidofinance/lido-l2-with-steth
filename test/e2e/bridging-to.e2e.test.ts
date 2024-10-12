import {
  CrossChainMessenger,
  DAIBridgeAdapter,
  MessageStatus,
} from "@eth-optimism/sdk";
import { assert } from "chai";
import { TransactionResponse } from "@ethersproject/providers";
import { LidoBridgeAdapter } from "../../utils/optimism/LidoBridgeAdapter";

import env from "../../utils/env";
import { wei } from "../../utils/wei";
import network from "../../utils/network";
import optimism from "../../utils/optimism";
import { scenario } from "../../utils/testing";
import chalk from "chalk";

let depositTokensTxResponse: TransactionResponse;
let withdrawTokensTxResponse: TransactionResponse;

scenario("Optimism :: Bridging non-rebasable via depositTo/withdrawTo E2E test", ctxFactory)
  .step(
    "Validate tester has required amount of L1 token",
    async ({ l1Token, l1Tester, depositAmount }) => {
      const balance = await l1Token.balanceOf(l1Tester.address);
      assert.isTrue(
        balance.gte(depositAmount),
        "Tester has not enough L1 token"
      );
    }
  )

  .step("Set allowance for L1LidoTokensBridge to deposit", async (ctx) => {
    const allowanceTxResponse = await ctx.crossChainMessenger.approveERC20(
      ctx.l1Token.address,
      ctx.l2Token.address,
      ctx.depositAmount
    );

    await allowanceTxResponse.wait();

    assert.equalBN(
      await ctx.l1Token.allowance(
        ctx.l1Tester.address,
        ctx.l1LidoTokensBridge.address
      ),
      ctx.depositAmount
    );
  })

  .step("Bridge tokens to L2 via depositERC20To()", async (ctx) => {
    depositTokensTxResponse = await ctx.l1LidoTokensBridge
      .connect(ctx.l1Tester)
      .depositERC20To(
        ctx.l1Token.address,
        ctx.l2Token.address,
        ctx.l1Tester.address,
        ctx.depositAmount,
        2_000_000,
        "0x",
        { gasLimit: 2_000_000}
      );

    await depositTokensTxResponse.wait();
  })

  .step("Waiting for status to change to RELAYED", async (ctx) => {
    await ctx.crossChainMessenger.waitForMessageStatus(
      depositTokensTxResponse.hash,
      MessageStatus.RELAYED
    );
  })

  .step("Withdraw tokens from L2 via withdrawERC20To()", async (ctx) => {
    withdrawTokensTxResponse = await ctx.l2ERC20ExtendedTokensBridge
      .connect(ctx.l2Tester)
      .withdrawTo(
        ctx.l2Token.address,
        ctx.l1Tester.address,
        ctx.withdrawalAmount,
        0,
        "0x"
      );
    await withdrawTokensTxResponse.wait();
  })

  .step("Log withdrawTokensTxResponse", async (ctx) => {
    console.log(`Save this value to TX_HASH env variable ${chalk.green(withdrawTokensTxResponse.hash)}`);
  })

  .run();

async function ctxFactory() {
  const networkName = env.network("TESTING_OPT_NETWORK", "sepolia");
  const testingSetup = await optimism.testing(networkName).getE2ETestSetup();

  return {
    depositAmount: wei`0.0001 ether`,
    withdrawalAmount: wei`0.0001 ether`,
    l1Tester: testingSetup.l1Tester,
    l2Tester: testingSetup.l2Tester,
    l1Token: testingSetup.l1Token,
    l2Token: testingSetup.l2Token,
    l1LidoTokensBridge: testingSetup.l1LidoTokensBridge,
    l2ERC20ExtendedTokensBridge: testingSetup.l2ERC20ExtendedTokensBridge,
    crossChainMessenger: new CrossChainMessenger({
      l2ChainId: network.chainId("opt", networkName),
      l1ChainId: network.chainId("eth", networkName),
      l1SignerOrProvider: testingSetup.l1Tester,
      l2SignerOrProvider: testingSetup.l2Tester,
      bridges: {
        LidoBridge: {
          Adapter: LidoBridgeAdapter,
          l1Bridge: testingSetup.l1LidoTokensBridge.address,
          l2Bridge: testingSetup.l2ERC20ExtendedTokensBridge.address,
        },
      },
    }),
  };
}
