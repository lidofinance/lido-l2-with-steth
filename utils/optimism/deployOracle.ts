import { assert } from "chai";
import { BigNumber, Wallet } from "ethers";
import { DeployScriptParams, OptDeploymentOptions } from "./types";
import addresses from "./addresses";
import network from "../network";
import { DeployScript, Logger } from "../deployment/DeployScript";
import {
  OssifiableProxy__factory,
  TokenRateOracle__factory,
  TokenRateNotifier__factory,
  OpStackTokenRatePusher__factory
} from "../../typechain";

interface OptL1DeployScriptParams extends DeployScriptParams {
  lido: string;
  l2GasLimitForPushingTokenRate: BigNumber;
  accountingOracle: string;
  l1Token: string;
}

interface OptL2DeployScriptParams extends DeployScriptParams {
  tokenRateOracle: {
    maxAllowedL2ToL1ClockLag: BigNumber;
    maxAllowedTokenRateDeviationPerDayBp: BigNumber;
    oldestRateAllowedInPauseTimeSpan: BigNumber;
    minTimeBetweenTokenRateUpdates: BigNumber;
    tokenRate: BigNumber;
    l1Timestamp: BigNumber;
    l2ERC20TokenBridge: string;
    tokenRateOutdatedDelay: BigNumber;
  }
}

export class OracleL1DeployScript extends DeployScript {
  constructor(
    deployer: Wallet,
    tokenRateNotifierImplAddress: string,
    opStackTokenRatePusherImplAddress: string,
    logger?: Logger
  ) {
    super(deployer, logger);
    this.tokenRateNotifierImplAddress = tokenRateNotifierImplAddress;
    this.opStackTokenRatePusherImplAddress = opStackTokenRatePusherImplAddress;
  }

  public tokenRateNotifierImplAddress: string;
  public opStackTokenRatePusherImplAddress: string;
}

export class OracleL2DeployScript extends DeployScript {
  constructor(
    deployer: Wallet,
    tokenRateOracleImplAddress: string,
    tokenRateOracleProxyAddress: string,
    logger?: Logger
  ) {
    super(deployer, logger);
    this.tokenRateOracleImplAddress = tokenRateOracleImplAddress;
    this.tokenRateOracleProxyAddress = tokenRateOracleProxyAddress;
  }

  public tokenRateOracleImplAddress: string;
  public tokenRateOracleProxyAddress: string;
}

/// Deploy Oracle + L1 part to push rate
/// L1 part
///     TokenRateNotifier
///     OpStackTokenRatePusher
/// L2 part
///     TokenRateOracle + proxy
export default function deploymentOracle(
  options: OptDeploymentOptions = {}
) {
  const optAddresses = addresses();
  return {
    async oracleDeployScript(
      l1Params: OptL1DeployScriptParams,
      l2Params: OptL2DeployScriptParams,
    ): Promise<[OracleL1DeployScript, OracleL2DeployScript]> {

      const [
        expectedL1TokenRateNotifierImplAddress,
        expectedL1OpStackTokenRatePusherImplAddress,
      ] = await network.predictAddresses(l1Params.deployer, 2);

      const [
        expectedL2TokenRateOracleImplAddress,
        expectedL2TokenRateOracleProxyAddress
      ] = await network.predictAddresses(l2Params.deployer, 2);

      const l1DeployScript = new OracleL1DeployScript(
        l1Params.deployer,
        expectedL1TokenRateNotifierImplAddress,
        expectedL1OpStackTokenRatePusherImplAddress,
        options?.logger
      )
        .addStep({
          factory: TokenRateNotifier__factory,
          args: [
            l1Params.deployer.address,
            l1Params.lido,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL1TokenRateNotifierImplAddress),
        })
        .addStep({
          factory: OpStackTokenRatePusher__factory,
          args: [
            optAddresses.L1CrossDomainMessenger,
            l1Params.l1Token,
            l1Params.accountingOracle,
            expectedL2TokenRateOracleProxyAddress,
            l1Params.l2GasLimitForPushingTokenRate,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL1OpStackTokenRatePusherImplAddress),
        });

      const l2DeployScript = new OracleL2DeployScript(
        l2Params.deployer,
        expectedL2TokenRateOracleImplAddress,
        expectedL2TokenRateOracleProxyAddress,
        options?.logger
      )
        .addStep({
          factory: TokenRateOracle__factory,
          args: [
            optAddresses.L2CrossDomainMessenger,
            l2Params.tokenRateOracle.l2ERC20TokenBridge,
            expectedL1OpStackTokenRatePusherImplAddress,
            l2Params.tokenRateOracle.tokenRateOutdatedDelay,
            l2Params.tokenRateOracle.maxAllowedL2ToL1ClockLag,
            l2Params.tokenRateOracle.maxAllowedTokenRateDeviationPerDayBp,
            l2Params.tokenRateOracle.oldestRateAllowedInPauseTimeSpan,
            l2Params.tokenRateOracle.minTimeBetweenTokenRateUpdates,
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL2TokenRateOracleImplAddress),
        })
        .addStep({
          factory: OssifiableProxy__factory,
          args: [
            expectedL2TokenRateOracleImplAddress,
            l2Params.admins.proxy,
            TokenRateOracle__factory.createInterface().encodeFunctionData(
              "initialize",
              [
                l2Params.admins.bridge,
                l2Params.tokenRateOracle.tokenRate,
                l2Params.tokenRateOracle.l1Timestamp
              ]
            ),
            options?.overrides,
          ],
          afterDeploy: (c) =>
            assert.equal(c.address, expectedL2TokenRateOracleProxyAddress),
        });

      return [l1DeployScript as OracleL1DeployScript, l2DeployScript as OracleL2DeployScript];
    },
  };
}
