import { assert } from "chai";
import { BigNumber, ethers } from 'ethers'
import { wei } from "../../utils/wei";
import optimism from "../../utils/optimism";
import testing, { scenario, ScenarioTest } from "../../utils/testing";
import {
  tokenRateAndTimestampPacked,
  refSlotTimestamp,
  nonRebasableFromRebasableL1,
  nonRebasableFromRebasableL2,
  rebasableFromNonRebasableL1,
  rebasableFromNonRebasableL2,
  getExchangeRate,
  almostEqual
} from "../../utils/testing/helpers";

type ContextType = Awaited<ReturnType<ReturnType<typeof ctxFactory>>>

function bridgingTestsSuit(scenarioInstance: ScenarioTest<ContextType>) {
  scenarioInstance
    .after(async (ctx) => {
      await ctx.l1Provider.send("evm_revert", [ctx.snapshot.l1]);
      await ctx.l2Provider.send("evm_revert", [ctx.snapshot.l2]);
    })

    .step("Activate bridging on L1", async (ctx) => {
      const { l1LidoTokensBridge } = ctx;
      const { l1ERC20ExtendedTokensBridgeAdmin } = ctx.accounts;

      const isDepositsEnabled = await l1LidoTokensBridge.isDepositsEnabled();

      if (!isDepositsEnabled) {
        await l1LidoTokensBridge
          .connect(l1ERC20ExtendedTokensBridgeAdmin)
          .enableDeposits();
      } else {
        console.log("L1 deposits already enabled");
      }

      const isWithdrawalsEnabled =
        await l1LidoTokensBridge.isWithdrawalsEnabled();

      if (!isWithdrawalsEnabled) {
        await l1LidoTokensBridge
          .connect(l1ERC20ExtendedTokensBridgeAdmin)
          .enableWithdrawals();
      } else {
        console.log("L1 withdrawals already enabled");
      }

      assert.isTrue(await l1LidoTokensBridge.isDepositsEnabled());
      assert.isTrue(await l1LidoTokensBridge.isWithdrawalsEnabled());
    })

    .step("Activate bridging on L2", async (ctx) => {
      const { l2ERC20ExtendedTokensBridge } = ctx;
      const { l2ERC20ExtendedTokensBridgeAdmin } = ctx.accounts;

      const isDepositsEnabled = await l2ERC20ExtendedTokensBridge.isDepositsEnabled();

      if (!isDepositsEnabled) {
        await l2ERC20ExtendedTokensBridge
          .connect(l2ERC20ExtendedTokensBridgeAdmin)
          .enableDeposits();
      } else {
        console.log("L2 deposits already enabled");
      }

      const isWithdrawalsEnabled =
        await l2ERC20ExtendedTokensBridge.isWithdrawalsEnabled();

      if (!isWithdrawalsEnabled) {
        await l2ERC20ExtendedTokensBridge
          .connect(l2ERC20ExtendedTokensBridgeAdmin)
          .enableWithdrawals();
      } else {
        console.log("L2 withdrawals already enabled");
      }

      assert.isTrue(await l2ERC20ExtendedTokensBridge.isDepositsEnabled());
      assert.isTrue(await l2ERC20ExtendedTokensBridge.isWithdrawalsEnabled());
    })

    .step("L1 -> L2 deposit via depositERC20() method", async (ctx) => {
      const {
        l1Token,
        l1TokenRebasable,
        l2TokenRebasable,
        l1LidoTokensBridge,
        l1CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        accountingOracle
      } = ctx;
      const { accountA: tokenHolderA } = ctx.accounts;
      const { depositAmountOfRebasableToken } = ctx.constants;

      ctx.totalPooledEther = await l1TokenRebasable.getTotalPooledEther();
      ctx.totalShares = await l1TokenRebasable.getTotalShares();
      ctx.tokenRate = getExchangeRate(ctx.constants.tokenRateDecimals, ctx.totalPooledEther, ctx.totalShares);

      /// wrap L1: stETH -> wstETH
      const depositAmountNonRebasable = nonRebasableFromRebasableL1(
        depositAmountOfRebasableToken,
        ctx.totalPooledEther,
        ctx.totalShares
      );

      console.log("depositAmountOfRebasableToken=",depositAmountOfRebasableToken);
      console.log("wrap L1: depositAmountNonRebasable=",depositAmountNonRebasable);

      await l1TokenRebasable
        .connect(tokenHolderA.l1Signer)
        .approve(l1LidoTokensBridge.address, depositAmountOfRebasableToken);

      const rebasableTokenHolderASharesBalanceBefore = await l1TokenRebasable.sharesOf(tokenHolderA.address);
      const wrappedRebasableTokenBalanceBefore = await l1TokenRebasable.sharesOf(l1Token.address);
      const nonRebasableTokenBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);

      ctx.balances.accountABalanceBeforeDeposit = rebasableTokenHolderASharesBalanceBefore;

      const tx = await l1LidoTokensBridge
        .connect(tokenHolderA.l1Signer)
        .depositERC20(
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          depositAmountOfRebasableToken,
          200_000,
          "0x"
        );
      const refSlotTime = await refSlotTimestamp(accountingOracle);
      const dataToSend = await tokenRateAndTimestampPacked(ctx.tokenRate, refSlotTime, "0x");

      await assert.emits(l1LidoTokensBridge, tx, "ERC20DepositInitiated", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        depositAmountOfRebasableToken,
        dataToSend,
      ]);

      const l2DepositCalldata = l2ERC20ExtendedTokensBridge.interface.encodeFunctionData(
        "finalizeDeposit",
        [
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          tokenHolderA.address,
          tokenHolderA.address,
          depositAmountNonRebasable,
          dataToSend,
        ]
      );

      const messageNonce = await l1CrossDomainMessenger.messageNonce();

      await assert.emits(l1CrossDomainMessenger, tx, "SentMessage", [
        l2ERC20ExtendedTokensBridge.address,
        l1LidoTokensBridge.address,
        l2DepositCalldata,
        messageNonce,
        200_000,
      ]);

      const rebasableTokenHolderASharesBalanceAfter = await l1TokenRebasable.sharesOf(tokenHolderA.address);
      const wrappedRebasableTokenBalanceAfter = await l1TokenRebasable.sharesOf(l1Token.address);
      const nonRebasableTokenBridgeBalanceAfter = await l1Token.balanceOf(l1LidoTokensBridge.address);

      assert.equalBN(
        rebasableTokenHolderASharesBalanceBefore.sub(depositAmountNonRebasable),
        rebasableTokenHolderASharesBalanceAfter
      );

      assert.equalBN(
        wrappedRebasableTokenBalanceBefore.add(depositAmountNonRebasable),
        wrappedRebasableTokenBalanceAfter
      );

      assert.equalBN(
        nonRebasableTokenBridgeBalanceBefore.add(depositAmountNonRebasable),
        nonRebasableTokenBridgeBalanceAfter
      );
    })

    .step("Finalize deposit on L2", async (ctx) => {
      const {
        l1TokenRebasable,
        accountingOracle,
        l2TokenRebasable,
        l1LidoTokensBridge,
        l2CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        totalPooledEther,
        totalShares,
        tokenRate
      } = ctx;

      const { depositAmountOfRebasableToken, tokenRateDecimals } = ctx.constants;

      // first wrap on L1
      const depositAmountNonRebasable = nonRebasableFromRebasableL1(depositAmountOfRebasableToken, totalPooledEther, totalShares);
      // second wrap on L2
      const depositAmountRebasable = rebasableFromNonRebasableL2(depositAmountNonRebasable, tokenRateDecimals, tokenRate);

      console.log("input:      depositAmountOfRebasableToken=",depositAmountOfRebasableToken);
      console.log("wrap on L1: depositAmountNonRebasable=",depositAmountNonRebasable);
      console.log("wrap on L2: depositAmountRebasable=",depositAmountRebasable);

      const { accountA: tokenHolderA, l1CrossDomainMessengerAliased } = ctx.accounts;

      const tokenHolderABalanceBefore = await l2TokenRebasable.sharesOf(tokenHolderA.address);
      const l2TokenRebasableTotalSupplyBefore = await l2TokenRebasable.getTotalShares();

      const refSlotTime = await refSlotTimestamp(accountingOracle);
      const dataToReceive = await tokenRateAndTimestampPacked(ctx.tokenRate, refSlotTime, "0x");

      const tx = await l2CrossDomainMessenger
        .connect(l1CrossDomainMessengerAliased)
        .relayMessage(
          1,
          l1LidoTokensBridge.address,
          l2ERC20ExtendedTokensBridge.address,
          0,
          300_000,
          l2ERC20ExtendedTokensBridge.interface.encodeFunctionData("finalizeDeposit", [
            l1TokenRebasable.address,
            l2TokenRebasable.address,
            tokenHolderA.address,
            tokenHolderA.address,
            depositAmountNonRebasable,
            dataToReceive,
          ]),
          { gasLimit: 5_000_000 }
        );

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "DepositFinalized", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        depositAmountRebasable,
        "0x",
      ]);

      const tokenHolderABalanceAfter = await l2TokenRebasable.sharesOf(tokenHolderA.address);
      const l2TokenRebasableTotalSupplyAfter = await l2TokenRebasable.getTotalShares();

      assert.equalBN(
        tokenHolderABalanceBefore.add(depositAmountNonRebasable),
        tokenHolderABalanceAfter
      );

      assert.equalBN(
        l2TokenRebasableTotalSupplyBefore.add(depositAmountNonRebasable),
        l2TokenRebasableTotalSupplyAfter
      );
    })

    .step("L2 -> L1 withdrawal via withdraw()", async (ctx) => {
      const { accountA: tokenHolderA } = ctx.accounts;
      const {
        l1TokenRebasable,
        l2TokenRebasable,
        l2ERC20ExtendedTokensBridge,
        tokenRate
      } = ctx;
      const { withdrawalAmountOfRebasableToken, tokenRateDecimals } = ctx.constants;

      // unwrap on L2: stETH -> wstETH
      const withdrawalAmountNonRebasable = nonRebasableFromRebasableL2(withdrawalAmountOfRebasableToken, tokenRateDecimals, tokenRate);

      const tokenHolderASharesBalanceBefore = await l2TokenRebasable.sharesOf(tokenHolderA.address);
      const l2TotalSupplyBefore = await l2TokenRebasable.getTotalShares();

      console.log("input: withdrawalAmountOfRebasableToken=",withdrawalAmountOfRebasableToken);

      const tx = await l2ERC20ExtendedTokensBridge
        .connect(tokenHolderA.l2Signer)
        .withdraw(
          l2TokenRebasable.address,
          withdrawalAmountOfRebasableToken,
          0,
          "0x"
        );

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "WithdrawalInitiated", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        withdrawalAmountOfRebasableToken,
        "0x",
      ]);

      const tokenHolderASharesBalanceAfter = await l2TokenRebasable.sharesOf(tokenHolderA.address);
      const l2TotalSupplyAfter = await l2TokenRebasable.getTotalShares();

      console.log("rebasable on L1 tokenHolderASharesBalanceBefore=",tokenHolderASharesBalanceBefore);
      console.log("rebasable on L1 tokenHolderASharesBalanceAfter=",tokenHolderASharesBalanceAfter);

      assert.equalBN(
        tokenHolderASharesBalanceBefore.sub(withdrawalAmountNonRebasable),
        tokenHolderASharesBalanceAfter
      );
      assert.equalBN(
        l2TotalSupplyBefore.sub(withdrawalAmountNonRebasable),
        l2TotalSupplyAfter
      );
    })

    .step("Finalize withdrawal on L1", async (ctx) => {
      const {
        l1Token,
        l1TokenRebasable,
        l1CrossDomainMessenger,
        l1LidoTokensBridge,
        l2CrossDomainMessenger,
        l2TokenRebasable,
        l2ERC20ExtendedTokensBridge,
        totalPooledEther,
        totalShares,
        tokenRate
      } = ctx;
      const { accountA: tokenHolderA, l1Stranger } = ctx.accounts;
      const { depositAmountOfRebasableToken, withdrawalAmountOfRebasableToken, tokenRateDecimals } = ctx.constants;

      const depositAmountNonRebasable = nonRebasableFromRebasableL1(depositAmountOfRebasableToken, totalPooledEther, totalShares);
      // unwrap on L2: stETH -> wstETH
      const withdrawalAmountNonRebasable = nonRebasableFromRebasableL2(withdrawalAmountOfRebasableToken, tokenRateDecimals, tokenRate);
      // unwrap on L1: wstETH -> stETH
      const withdrawalAmountRebasable = rebasableFromNonRebasableL1(withdrawalAmountNonRebasable, totalPooledEther, totalShares);
      // bad double conversion on L1 bridge: stETH -> wstETH makes 1 shares loses.
      const withdrawalAmountNonRebasableWithLoss = nonRebasableFromRebasableL1(withdrawalAmountRebasable, totalPooledEther, totalShares);

      console.log("input:        withdrawalAmountOfRebasableToken=",withdrawalAmountOfRebasableToken);
      console.log("unwrap on L2: withdrawalAmountNonRebasable=",withdrawalAmountNonRebasable);
      console.log("unwrap on L1: withdrawalAmountRebasable=",withdrawalAmountRebasable);

      const tokenHolderABalanceBefore = await l1TokenRebasable.sharesOf(tokenHolderA.address);
      const l1LidoTokensBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);

      await l1CrossDomainMessenger
        .connect(l1Stranger)
        .setXDomainMessageSender(l2ERC20ExtendedTokensBridge.address);

      const tx = await l1CrossDomainMessenger
        .connect(l1Stranger)
        .relayMessage(
          l1LidoTokensBridge.address,
          l2CrossDomainMessenger.address,
          l1LidoTokensBridge.interface.encodeFunctionData(
            "finalizeERC20Withdrawal",
            [
              l1TokenRebasable.address,
              l2TokenRebasable.address,
              tokenHolderA.address,
              tokenHolderA.address,
              withdrawalAmountNonRebasable,
              "0x",
            ]
          ),
          0
        );

      await assert.emits(l1LidoTokensBridge, tx, "ERC20WithdrawalFinalized", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderA.address,
        withdrawalAmountRebasable,
        "0x",
      ]);

      const tokenHolderABalanceAfter = await l1TokenRebasable.sharesOf(tokenHolderA.address);
      const l1LidoTokensBridgeBalanceAfter = await l1Token.balanceOf(l1LidoTokensBridge.address);

      console.log("rebasable on L1 tokenHolderABalanceBefore=",tokenHolderABalanceBefore);
      console.log("rebasable on L1 tokenHolderABalanceAfter=",tokenHolderABalanceAfter);
      console.log("diff on L1 tokenHolderA=",depositAmountNonRebasable.sub(tokenHolderABalanceBefore.add(withdrawalAmountNonRebasable)));

      assert.equalBN(
        l1LidoTokensBridgeBalanceBefore.sub(withdrawalAmountNonRebasable),
        l1LidoTokensBridgeBalanceAfter
      );

      assert.equalBN(
        tokenHolderABalanceBefore.add(withdrawalAmountNonRebasableWithLoss),
        tokenHolderABalanceAfter
      );

      /// check that user balance is correct after depositing and withdrawal.
      const deltaDepositWithdrawalShares = depositAmountNonRebasable.sub(withdrawalAmountNonRebasable);
      assert.isTrue(almostEqual(
        ctx.balances.accountABalanceBeforeDeposit,
        tokenHolderABalanceAfter.add(deltaDepositWithdrawalShares))
      );
    })

    .step("L1 -> L2 deposit via depositERC20To()", async (ctx) => {

      const {
        l1Token,
        l1TokenRebasable,
        accountingOracle,
        l1LidoTokensBridge,
        l2TokenRebasable,
        l1CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        l1TokensHolder
      } = ctx;
      const { accountA: tokenHolderA, accountB: tokenHolderB } = ctx.accounts;
      assert.notEqual(tokenHolderA.address, tokenHolderB.address);
      const { depositAmountOfRebasableToken } = ctx.constants;

      ctx.totalPooledEther = await l1TokenRebasable.getTotalPooledEther();
      ctx.totalShares = await l1TokenRebasable.getTotalShares();
      ctx.tokenRate = getExchangeRate(ctx.constants.tokenRateDecimals, ctx.totalPooledEther, ctx.totalShares);

      /// wrap L1: stETH -> wstETH
      const depositAmountNonRebasable = nonRebasableFromRebasableL1(depositAmountOfRebasableToken, ctx.totalPooledEther, ctx.totalShares);

      console.log("depositAmountOfRebasableToken=",depositAmountOfRebasableToken);
      console.log("wrap L1: depositAmountNonRebasable=",depositAmountNonRebasable);

      // top up balance if it became less after first deposit and loosing 1-2 wei.
      var rebasableTokenHolderABalanceBefore = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      if (rebasableTokenHolderABalanceBefore.lt(depositAmountOfRebasableToken)) {
        const diff = depositAmountOfRebasableToken.sub(rebasableTokenHolderABalanceBefore);
        console.log("top up diff=",diff);
        await l1TokenRebasable
          .connect(l1TokensHolder)
          .transfer(tokenHolderA.l1Signer.address, diff);
      }

      await l1TokenRebasable
        .connect(tokenHolderA.l1Signer)
        .approve(l1LidoTokensBridge.address, depositAmountOfRebasableToken);

      const wrappedRebasableTokenBalanceBefore = await l1TokenRebasable.sharesOf(l1Token.address);
      const rebasableTokenHolderASharesBalanceBefore = await l1TokenRebasable.sharesOf(tokenHolderA.address);
      const nonRebasableTokenBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);

      // save to check balance later
      ctx.balances.accountABalanceBeforeDeposit = rebasableTokenHolderASharesBalanceBefore;
      ctx.balances.accountBBalanceBeforeDeposit = await l2TokenRebasable.sharesOf(tokenHolderB.address);

      const tx = await l1LidoTokensBridge
        .connect(tokenHolderA.l1Signer)
        .depositERC20To(
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          tokenHolderB.address,
          depositAmountOfRebasableToken,
          200_000,
          "0x"
        );

      const refSlotTime = await refSlotTimestamp(accountingOracle);
      const dataToSend = await tokenRateAndTimestampPacked(ctx.tokenRate, refSlotTime, "0x");

      await assert.emits(l1LidoTokensBridge, tx, "ERC20DepositInitiated", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderB.address,
        depositAmountOfRebasableToken,
        dataToSend,
      ]);

      const l2DepositCalldata = l2ERC20ExtendedTokensBridge.interface.encodeFunctionData(
        "finalizeDeposit",
        [
          l1TokenRebasable.address,
          l2TokenRebasable.address,
          tokenHolderA.address,
          tokenHolderB.address,
          depositAmountNonRebasable,
          dataToSend,
        ]
      );

      const messageNonce = await l1CrossDomainMessenger.messageNonce();

      await assert.emits(l1CrossDomainMessenger, tx, "SentMessage", [
        l2ERC20ExtendedTokensBridge.address,
        l1LidoTokensBridge.address,
        l2DepositCalldata,
        messageNonce,
        200_000,
      ]);

      const rebasableTokenHolderASharesBalanceAfter = await l1TokenRebasable.balanceOf(tokenHolderA.address);
      const nonRebasableTokenBridgeBalanceAfter = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const wrappedRebasableTokenBalanceAfter = await l1TokenRebasable.sharesOf(l1Token.address);

      assert.equalBN(
        rebasableTokenHolderASharesBalanceBefore.sub(depositAmountNonRebasable),
        rebasableTokenHolderASharesBalanceAfter
      );

      assert.equalBN(
        nonRebasableTokenBridgeBalanceBefore.add(depositAmountNonRebasable),
        nonRebasableTokenBridgeBalanceAfter
      )

      assert.equalBN(
        wrappedRebasableTokenBalanceBefore.add(depositAmountNonRebasable),
        wrappedRebasableTokenBalanceAfter
      );
    })

    .step("Finalize deposit on L2", async (ctx) => {
      const {
        l1TokenRebasable,
        accountingOracle,
        l1LidoTokensBridge,
        l2TokenRebasable,
        l2CrossDomainMessenger,
        l2ERC20ExtendedTokensBridge,
        totalPooledEther,
        totalShares,
        tokenRate
      } = ctx;

      const {
        accountA: tokenHolderA,
        accountB: tokenHolderB,
        l1CrossDomainMessengerAliased,
      } = ctx.accounts;

      const { depositAmountOfRebasableToken, tokenRateDecimals } = ctx.constants;

      ctx.totalPooledEther = await l1TokenRebasable.getTotalPooledEther();
      ctx.totalShares = await l1TokenRebasable.getTotalShares();
      ctx.tokenRate = getExchangeRate(tokenRateDecimals, totalPooledEther, totalShares);

      // wrap on L1
      const depositAmountNonRebasable = nonRebasableFromRebasableL1(depositAmountOfRebasableToken, totalPooledEther, totalShares);
      // wrap on L2: loosing 1-2 wei for big numbers
      const depositAmountRebasable = rebasableFromNonRebasableL2(depositAmountNonRebasable, tokenRateDecimals, tokenRate);

      console.log("input:      depositAmountOfRebasableToken=",depositAmountOfRebasableToken);
      console.log("wrap on L1: depositAmountNonRebasable=",depositAmountNonRebasable);
      console.log("wrap on L2: depositAmountRebasable=",depositAmountRebasable);

      const refSlotTime = await refSlotTimestamp(accountingOracle);
      const dataToReceive = await tokenRateAndTimestampPacked(ctx.tokenRate, refSlotTime, "0x");

      const l2TokenRebasableTotalSupplyBefore = await l2TokenRebasable.getTotalShares();
      const tokenHolderBBalanceBefore = await l2TokenRebasable.sharesOf(tokenHolderB.address);

      const tx = await l2CrossDomainMessenger
        .connect(l1CrossDomainMessengerAliased)
        .relayMessage(
          1,
          l1LidoTokensBridge.address,
          l2ERC20ExtendedTokensBridge.address,
          0,
          300_000,
          l2ERC20ExtendedTokensBridge.interface.encodeFunctionData("finalizeDeposit", [
            l1TokenRebasable.address,
            l2TokenRebasable.address,
            tokenHolderA.address,
            tokenHolderB.address,
            depositAmountNonRebasable,
            dataToReceive,
          ]),
          { gasLimit: 5_000_000 }
        );

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "DepositFinalized", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderA.address,
        tokenHolderB.address,
        depositAmountRebasable,
        "0x",
      ]);

      const l2TokenRebasableTotalSupplyAfter = await l2TokenRebasable.getTotalShares();
      const tokenHolderBBalanceAfter = await l2TokenRebasable.sharesOf(tokenHolderB.address);

      assert.equalBN(
        tokenHolderBBalanceBefore.add(depositAmountNonRebasable),
        tokenHolderBBalanceAfter,
      );

      assert.equalBN(
        l2TokenRebasableTotalSupplyBefore.add(depositAmountNonRebasable),
        l2TokenRebasableTotalSupplyAfter
      );
    })

    .step("L2 -> L1 withdrawal via withdrawTo()", async (ctx) => {
      const { l1TokenRebasable, l2TokenRebasable, l2ERC20ExtendedTokensBridge, tokenRate } = ctx;
      const { accountA: tokenHolderA, accountB: tokenHolderB } = ctx.accounts;

      const { withdrawalAmountOfRebasableToken, tokenRateDecimals } = ctx.constants;

      const withdrawalAmountNonRebasable = nonRebasableFromRebasableL2(withdrawalAmountOfRebasableToken, tokenRateDecimals, tokenRate);

      console.log("input: withdrawalAmountOfRebasableToken=",withdrawalAmountOfRebasableToken);

      const tokenHolderBBalanceBefore = await l2TokenRebasable.sharesOf(tokenHolderB.address);
      const l2TotalSupplyBefore = await l2TokenRebasable.getTotalShares();

      const tx = await l2ERC20ExtendedTokensBridge
        .connect(tokenHolderB.l2Signer)
        .withdrawTo(
          l2TokenRebasable.address,
          tokenHolderA.address,
          withdrawalAmountOfRebasableToken,
          0,
          "0x"
        );

      await assert.emits(l2ERC20ExtendedTokensBridge, tx, "WithdrawalInitiated", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderB.address,
        tokenHolderA.address,
        withdrawalAmountOfRebasableToken,
        "0x",
      ]);

      const tokenHolderABalanceAfter = await l2TokenRebasable.sharesOf(tokenHolderB.address);
      const l2TotalSupplyAfter = await l2TokenRebasable.getTotalShares()

      assert.equalBN(
        tokenHolderBBalanceBefore.sub(withdrawalAmountNonRebasable),
        tokenHolderABalanceAfter
      );
      assert.equalBN(
        l2TotalSupplyBefore.sub(withdrawalAmountNonRebasable),
        l2TotalSupplyAfter
      );
    })

    .step("Finalize withdrawal on L1", async (ctx) => {
      const {
        l1Token,
        l1TokenRebasable,
        l1CrossDomainMessenger,
        l1LidoTokensBridge,
        l2CrossDomainMessenger,
        l2TokenRebasable,
        l2ERC20ExtendedTokensBridge,
        totalPooledEther,
        totalShares,
        tokenRate
      } = ctx;
      const {
        accountA: tokenHolderA,
        accountB: tokenHolderB,
        l1Stranger,
      } = ctx.accounts;

      const { depositAmountOfRebasableToken, withdrawalAmountOfRebasableToken, tokenRateDecimals } = ctx.constants;

      const depositAmountNonRebasable = nonRebasableFromRebasableL1(depositAmountOfRebasableToken, totalPooledEther, totalShares);
      // unwrap on L2: stETH -> wstETH
      const withdrawalAmountNonRebasable = nonRebasableFromRebasableL2(withdrawalAmountOfRebasableToken, tokenRateDecimals, tokenRate);
      // unwrap on L1: wstETH -> stETH
      const withdrawalAmountRebasable = rebasableFromNonRebasableL1(withdrawalAmountNonRebasable, totalPooledEther, totalShares);
      // bad double conversion on L1 bridge: stETH -> wstETH makes 1 shares loses.
      const withdrawalAmountNonRebasableWithLoss = nonRebasableFromRebasableL1(withdrawalAmountRebasable, totalPooledEther, totalShares);

      console.log("input:        withdrawalAmountOfRebasableToken=",withdrawalAmountOfRebasableToken);
      console.log("unwrap on L2: withdrawalAmountNonRebasable=",withdrawalAmountNonRebasable);
      console.log("unwrap on L1: withdrawalAmountRebasable=",withdrawalAmountRebasable);

      const tokenHolderABalanceBefore = await l1TokenRebasable.sharesOf(tokenHolderA.address);
      const l1LidoTokensBridgeBalanceBefore = await l1Token.balanceOf(l1LidoTokensBridge.address);

      await l1CrossDomainMessenger
        .connect(l1Stranger)
        .setXDomainMessageSender(l2ERC20ExtendedTokensBridge.address);

      const tx = await l1CrossDomainMessenger
        .connect(l1Stranger)
        .relayMessage(
          l1LidoTokensBridge.address,
          l2CrossDomainMessenger.address,
          l1LidoTokensBridge.interface.encodeFunctionData(
            "finalizeERC20Withdrawal",
            [
              l1TokenRebasable.address,
              l2TokenRebasable.address,
              tokenHolderB.address,
              tokenHolderA.address,
              withdrawalAmountNonRebasable,
              "0x",
            ]
          ),
          0
        );

      await assert.emits(l1LidoTokensBridge, tx, "ERC20WithdrawalFinalized", [
        l1TokenRebasable.address,
        l2TokenRebasable.address,
        tokenHolderB.address,
        tokenHolderA.address,
        withdrawalAmountRebasable,
        "0x",
      ]);

      const l1LidoTokensBridgeBalanceAfter = await l1Token.balanceOf(l1LidoTokensBridge.address);
      const tokenHolderABalanceAfter = await l1TokenRebasable.sharesOf(tokenHolderA.address);
      const tokenHolderBBalanceAfter = await l2TokenRebasable.sharesOf(tokenHolderB.address);

      console.log("rebasable on L1 tokenHolderABalanceBefore=",tokenHolderABalanceBefore);
      console.log("rebasable on L1 tokenHolderABalanceAfter=",tokenHolderABalanceAfter);
      console.log("diff on L1 tokenHolderA=",tokenHolderABalanceAfter.sub(tokenHolderABalanceBefore.add(withdrawalAmountRebasable)));

      assert.equalBN(
        l1LidoTokensBridgeBalanceBefore.sub(withdrawalAmountNonRebasable),
        l1LidoTokensBridgeBalanceAfter
      );

      assert.equalBN(
        tokenHolderABalanceBefore.add(withdrawalAmountNonRebasableWithLoss),
        tokenHolderABalanceAfter
      );

      /// check that user balance is correct after depositing and withdrawal.
      const deltaDepositWithdrawalShares = depositAmountNonRebasable.sub(withdrawalAmountNonRebasable);
      assert.isTrue(almostEqual(
        ctx.balances.accountABalanceBeforeDeposit,
        tokenHolderABalanceAfter.add(deltaDepositWithdrawalShares))
      );
      assert.isTrue(almostEqual(
        ctx.balances.accountBBalanceBeforeDeposit,
        tokenHolderBBalanceAfter.sub(deltaDepositWithdrawalShares))
      );
    })

    .run();
}

function ctxFactory(
  tokenRateDecimals: BigNumber,
  depositAmountOfRebasableToken: BigNumber,
  withdrawalAmountOfRebasableToken: BigNumber
) {
  return async () => {
    const hasDeployedContracts = testing.env.USE_DEPLOYED_CONTRACTS(false);

    const {
      totalPooledEther,
      totalShares,
      l1Provider,
      l2Provider,
      l1ERC20ExtendedTokensBridgeAdmin,
      l2ERC20ExtendedTokensBridgeAdmin,
      ...contracts
    } = await optimism.testing().getIntegrationTestSetup();

    const l1Snapshot = await l1Provider.send("evm_snapshot", []);
    const l2Snapshot = await l2Provider.send("evm_snapshot", []);

    await optimism.testing().stubL1CrossChainMessengerContract();

    const accountA = testing.accounts.accountA(l1Provider, l2Provider);
    const accountB = testing.accounts.accountB(l1Provider, l2Provider);

    await testing.setBalance(
      await contracts.l1TokensHolder.getAddress(),
      wei.toBigNumber(wei`1000000000000 ether`), // to be able to stake stETH
      l1Provider
    );

    await testing.setBalance(
      await l1ERC20ExtendedTokensBridgeAdmin.getAddress(),
      wei.toBigNumber(wei`1 ether`),
      l1Provider
    );

    await testing.setBalance(
      await l2ERC20ExtendedTokensBridgeAdmin.getAddress(),
      wei.toBigNumber(wei`1 ether`),
      l2Provider
    );

    const l1CrossDomainMessengerAliased = await testing.impersonate(
      testing.accounts.applyL1ToL2Alias(contracts.l1CrossDomainMessenger.address),
      l2Provider
    );

    await testing.setBalance(
      await l1CrossDomainMessengerAliased.getAddress(),
      wei.toBigNumber(wei`1 ether`),
      l2Provider
    );

    const l1TokensHolderAddress = await contracts.l1TokensHolder.getAddress();
    const l1TokensHolderRebasableBalance = await contracts.l1TokenRebasable.balanceOf(l1TokensHolderAddress);
    if (hasDeployedContracts && l1TokensHolderRebasableBalance.lt(depositAmountOfRebasableToken)) {
      await l1Provider.getSigner(l1TokensHolderAddress).sendTransaction({
        from: l1TokensHolderAddress,
        to: contracts.l1TokenRebasable.address,
        value: ethers.utils.parseUnits("140000", "ether") // STAKE_LIMIT
      });
    }

    await contracts.l1TokenRebasable
      .connect(contracts.l1TokensHolder)
      .transfer(accountA.l1Signer.address, depositAmountOfRebasableToken);

    var accountABalanceBeforeDeposit = BigNumber.from(0);
    var accountBBalanceBeforeDeposit = BigNumber.from(0);
    var tokenRate = BigNumber.from(0);

    return {
      l1Provider,
      l2Provider,
      ...contracts,
      accounts: {
        accountA,
        accountB,
        l1Stranger: testing.accounts.stranger(l1Provider),
        l1ERC20ExtendedTokensBridgeAdmin,
        l2ERC20ExtendedTokensBridgeAdmin,
        l1CrossDomainMessengerAliased,
      },
      constants: {
        depositAmountOfRebasableToken,
        withdrawalAmountOfRebasableToken,
        tokenRateDecimals,
      },
      totalPooledEther,
      totalShares,
      tokenRate,
      balances: {
        accountABalanceBeforeDeposit,
        accountBBalanceBeforeDeposit
      },
      snapshot: {
        l1: l1Snapshot,
        l2: l2Snapshot,
      },
    };
  }
}

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging X rebasable token integration test ",
    ctxFactory(
      BigNumber.from(27),
      wei.toBigNumber(wei`0.001 ether`),
      //BigNumber.from(10).pow(18-3)
      wei.toBigNumber(wei`0.001 ether`).sub(100)
    )
  )
);

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging 1 wei rebasable token integration test",
    ctxFactory(
      BigNumber.from(27),
      wei.toBigNumber(wei`1 wei`),
      wei.toBigNumber(wei`1 wei`)
    )
  )
);

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging Zero rebasable token integration test",
    ctxFactory(
      BigNumber.from(27),
      BigNumber.from('0'),
      BigNumber.from('0')
    )
  )
);

const useDeployedContracts = testing.env.USE_DEPLOYED_CONTRACTS(false);

if (useDeployedContracts) {
  bridgingTestsSuit(
    scenario(
      "Optimism :: Bridging Big rebasable token integration test",
      ctxFactory(
        BigNumber.from(27),
        ethers.utils.parseUnits("130000", "ether"),
        ethers.utils.parseUnits("130000", "ether").sub(100) // correct big number because during rounding looses 1-2 wei
        /// Thus, user can't withdraw the same amount
      )
    )
  );
} else {
  bridgingTestsSuit(
    scenario(
      "Optimism :: Bridging Big rebasable token integration test",
      ctxFactory(
        BigNumber.from(27),
        BigNumber.from(10).pow(27),
        BigNumber.from(10).pow(27).sub(2) // correct big number because during rounding looses 1-2 wei
        /// Thus, user can't withdraw the same amount
      )
    )
  );
}
