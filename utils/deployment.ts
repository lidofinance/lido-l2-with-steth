import chalk from "chalk";
import { BigNumber, Wallet } from "ethers";

import env from "./env";
import { DeployScript } from "./deployment/DeployScript";
import { BridgingManagerSetupConfig } from "./bridging-management";

interface EthereumDeploymentConfig extends BridgingManagerSetupConfig {
  bridgeProxyAdmin: string;

  l1TokenNonRebasable: string;
  l1RebasableToken: string;
  accountingOracle: string;
  l2GasLimitForPushingTokenRate: BigNumber;
  l1TokenBridge: string;
  lido: string;
  tokenRateNotifierOwner: string;
}

interface OptimismDeploymentConfig extends BridgingManagerSetupConfig {
  bridgeProxyAdmin: string;

  govBridgeExecutor: string;

  /// Oracle
  tokenRateOracleProxyAdmin: string;
  tokenRateOracleAdmin: string;
  tokenRateUpdateEnabled: boolean;
  tokenRateUpdateDisablers?: string[],
  tokenRateUpdateEnablers?: string[],

  tokenRateOutdatedDelay: BigNumber;
  maxAllowedL2ToL1ClockLag: BigNumber;
  maxAllowedTokenRateDeviationPerDayBp: BigNumber;
  oldestRateAllowedInPauseTimeSpan: BigNumber;
  minTimeBetweenTokenRateUpdates: BigNumber;
  initialTokenRateValue: BigNumber;
  initialTokenRateL1Timestamp: BigNumber;

  /// L2 wstETH address to upgrade
  l2TokenNonRebasableAddress: string;
  l2TokenNonRebasableDomainVersion: string;

  /// L2 stETH
  l2TokenRebasableDomainVersion: string;
  l2TokenRebasableProxyAdmin: string;

  /// bridge
  l2TokenBridge: string;
}

interface MultiChainDeploymentConfig {
  ethereum: EthereumDeploymentConfig;
  optimism: OptimismDeploymentConfig;
}

export function loadMultiChainDeploymentConfig(): MultiChainDeploymentConfig {
  return {
    ethereum: {
      l1TokenNonRebasable: env.address("L1_NON_REBASABLE_TOKEN"),
      l1RebasableToken: env.address("L1_REBASABLE_TOKEN"),
      accountingOracle: env.address("ACCOUNTING_ORACLE"),
      l2GasLimitForPushingTokenRate: BigNumber.from(env.string("L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE")),
      l1TokenBridge: env.address("L1_TOKEN_BRIDGE"),
      lido: env.address("LIDO"),
      tokenRateNotifierOwner: env.address("TOKEN_RATE_NOTIFIER_OWNER"),

      // Bridge
      bridgeProxyAdmin: env.address("L1_PROXY_ADMIN"),
      bridgeAdmin: env.address("L1_BRIDGE_ADMIN"),
      depositsEnabled: env.bool("L1_DEPOSITS_ENABLED", false),
      withdrawalsEnabled: env.bool("L1_WITHDRAWALS_ENABLED", false),
      depositsEnablers: env.addresses("L1_DEPOSITS_ENABLERS", []),
      depositsDisablers: env.addresses("L1_DEPOSITS_DISABLERS", []),
      withdrawalsEnablers: env.addresses("L1_WITHDRAWALS_ENABLERS", []),
      withdrawalsDisablers: env.addresses("L1_WITHDRAWALS_DISABLERS", []),
    },
    optimism: {
      govBridgeExecutor: env.address("GOV_BRIDGE_EXECUTOR"),

      /// TokenRateOracle
      tokenRateOracleProxyAdmin: env.address("TOKEN_RATE_ORACLE_PROXY_ADMIN"),
      tokenRateOracleAdmin: env.address("TOKEN_RATE_ORACLE_ADMIN"),
      tokenRateUpdateEnabled: env.bool("TOKEN_RATE_UPDATE_ENABLED", true),
      tokenRateUpdateDisablers: env.addresses("TOKEN_RATE_UPDATE_DISABLERS", []),
      tokenRateUpdateEnablers: env.addresses("TOKEN_RATE_UPDATE_ENABLERS", []),

      tokenRateOutdatedDelay: BigNumber.from(env.string("TOKEN_RATE_OUTDATED_DELAY")),
      maxAllowedL2ToL1ClockLag: BigNumber.from(env.string("MAX_ALLOWED_L2_TO_L1_CLOCK_LAG")),
      maxAllowedTokenRateDeviationPerDayBp: BigNumber.from(env.string("MAX_ALLOWED_TOKEN_RATE_DEVIATION_PER_DAY_BP")),
      oldestRateAllowedInPauseTimeSpan: BigNumber.from(env.string("OLDEST_RATE_ALLOWED_IN_PAUSE_TIME_SPAN")),
      minTimeBetweenTokenRateUpdates: BigNumber.from(env.string("MIN_TIME_BETWEEN_TOKEN_RATE_UPDATES")),
      initialTokenRateValue: BigNumber.from(env.string("INITIAL_TOKEN_RATE_VALUE")),
      initialTokenRateL1Timestamp: BigNumber.from(env.string("INITIAL_TOKEN_RATE_L1_TIMESTAMP")),

      // wstETH
      l2TokenNonRebasableAddress: env.address("L2_TOKEN_NON_REBASABLE"),
      l2TokenNonRebasableDomainVersion: env.string("L2_TOKEN_NON_REBASABLE_SIGNING_DOMAIN_VERSION"),

      // stETH
      l2TokenRebasableDomainVersion: env.string("L2_TOKEN_REBASABLE_SIGNING_DOMAIN_VERSION"),
      l2TokenRebasableProxyAdmin: env.string("L2_TOKEN_REBASABLE_PROXY_ADMIN"),

      // Bridge
      l2TokenBridge: env.address("L2_TOKEN_BRIDGE"),

      bridgeProxyAdmin: env.address("L2_PROXY_ADMIN"),
      bridgeAdmin: env.address("L2_BRIDGE_ADMIN"),
      depositsEnabled: env.bool("L2_DEPOSITS_ENABLED", false),
      withdrawalsEnabled: env.bool("L2_WITHDRAWALS_ENABLED", false),
      depositsEnablers: env.addresses("L2_DEPOSITS_ENABLERS", []),
      depositsDisablers: env.addresses("L2_DEPOSITS_DISABLERS", []),
      withdrawalsEnablers: env.addresses("L2_WITHDRAWALS_ENABLERS", []),
      withdrawalsDisablers: env.addresses("L2_WITHDRAWALS_DISABLERS", []),
    },
  };
}

export async function printDeploymentConfig() {
  const pad = " ".repeat(4);
  console.log(`${pad}· Network: ${env.string("NETWORK")}`);
  console.log(`${pad}· Forking: ${env.bool("FORKING")}`);
}

export async function printMultiChainDeploymentConfig(
  title: string,
  l1Deployer: Wallet,
  l2Deployer: Wallet,
  deploymentParams: MultiChainDeploymentConfig,
  l1DeployScript: DeployScript,
  l2DeployScript: DeployScript
) {
  const { ethereum, optimism } = deploymentParams;
  console.log(chalk.bold(`${title}\n`));

  console.log(chalk.bold("  · Deployment Params:"));
  await printDeploymentConfig();
  console.log();

  console.log(chalk.bold("  · L1 Deployment Params:"));
  await printEthereumDeploymentConfig(l1Deployer, ethereum, false);
  console.log();
  console.log(chalk.bold("  · L1 Deployment Actions:"));
  l1DeployScript.print({ padding: 6 });

  console.log(chalk.bold("  · L2 Deployment Params:"));
  await printOptimismDeploymentConfig(l2Deployer, optimism, false);
  console.log();
  console.log(chalk.bold("  · L2 Deployment Actions:"));
  l2DeployScript.print({ padding: 6 });
}


async function printEthereumDeploymentConfig(
  deployer: Wallet,
  params: EthereumDeploymentConfig,
  sctratchDeploy: boolean
) {
  const pad = " ".repeat(4);
  const chainId = await deployer.getChainId();
  console.log(`${pad}· Chain ID: ${chainId}`);
  console.log(`${pad}· Deployer: ${chalk.underline(deployer.address)}`);

  console.log(`${pad}· l1TokenNonRebasable: ${chalk.underline(params.l1TokenNonRebasable)}`);
  console.log(`${pad}· l1RebasableToken: ${chalk.underline(params.l1RebasableToken)}`);
  console.log(`${pad}· accountingOracle: ${chalk.underline(params.accountingOracle)}`);
  console.log(`${pad}· l2GasLimitForPushingTokenRate: ${chalk.underline(params.l2GasLimitForPushingTokenRate)}`);
  console.log(`${pad}· l1TokenBridge: ${chalk.underline(params.l1TokenBridge)}`);
  console.log(`${pad}· lido: ${chalk.underline(params.lido)}`);
  console.log(`${pad}· tokenRateNotifierOwner: ${chalk.underline(params.tokenRateNotifierOwner)}`);

  if(sctratchDeploy) {
    console.log(`${pad}· Proxy Admin: ${chalk.underline(params.bridgeProxyAdmin)}`);
    console.log(`${pad}· Bridge Admin: ${chalk.underline(params.bridgeAdmin)}`);
    console.log(`${pad}· Deposits Enabled: ${params.depositsEnabled}`);
    console.log(
      `${pad}· Withdrawals Enabled: ${JSON.stringify(params.withdrawalsEnabled)}`
    );
    console.log(
      `${pad}· Deposits Enablers: ${JSON.stringify(params.depositsEnablers)}`
    );
    console.log(
      `${pad}· Deposits Disablers: ${JSON.stringify(params.depositsDisablers)}`
    );
    console.log(
      `${pad}· Withdrawals Enablers: ${JSON.stringify(
        params.withdrawalsEnablers
      )}`
    );
    console.log(
      `${pad}· Withdrawals Disablers: ${JSON.stringify(
        params.withdrawalsDisablers
      )}`
    )
  }
}

async function printOptimismDeploymentConfig(
  deployer: Wallet,
  params: OptimismDeploymentConfig,
  sctratchDeploy: boolean
) {
  const pad = " ".repeat(4);
  const chainId = await deployer.getChainId();
  console.log(`${pad}· Chain ID: ${chainId}`);
  console.log(`${pad}· Deployer: ${chalk.underline(deployer.address)}`);
  console.log(`${pad}· govBridgeExecutor: ${chalk.underline(params.govBridgeExecutor)}`);
  console.log(`${pad}· tokenRateOracleProxyAdmin: ${chalk.underline(params.tokenRateOracleProxyAdmin)}`);
  console.log(`${pad}· tokenRateOracleAdmin: ${chalk.underline(params.tokenRateOracleAdmin)}`);
  console.log(`${pad}· tokenRateUpdateEnabled: ${chalk.underline(params.tokenRateUpdateEnabled)}`);
  console.log(`${pad}· tokenRateUpdateDisablers: ${chalk.underline(params.tokenRateUpdateDisablers)}`);
  console.log(`${pad}· tokenRateUpdateEnablers: ${chalk.underline(params.tokenRateUpdateEnablers)}`);
  console.log(`${pad}· tokenRateOutdatedDelay: ${chalk.underline(params.tokenRateOutdatedDelay)}`);
  console.log(`${pad}· maxAllowedL2ToL1ClockLag: ${chalk.underline(params.maxAllowedL2ToL1ClockLag)}`);
  console.log(`${pad}· maxAllowedTokenRateDeviationPerDayBp: ${chalk.underline(params.maxAllowedTokenRateDeviationPerDayBp)}`);
  console.log(`${pad}· oldestRateAllowedInPauseTimeSpan: ${chalk.underline(params.oldestRateAllowedInPauseTimeSpan)}`);
  console.log(`${pad}· minTimeBetweenTokenRateUpdates: ${chalk.underline(params.minTimeBetweenTokenRateUpdates)}`);
  console.log(`${pad}· initialTokenRateValue: ${chalk.underline(params.initialTokenRateValue)}`);
  console.log(`${pad}· initialTokenRateL1Timestamp: ${chalk.underline(params.initialTokenRateL1Timestamp)}`);
  console.log(`${pad}· l2TokenNonRebasableAddress: ${chalk.underline(params.l2TokenNonRebasableAddress)}`);
  console.log(`${pad}· l2TokenNonRebasableDomainVersion: ${chalk.underline(params.l2TokenNonRebasableDomainVersion)}`);
  console.log(`${pad}· l2TokenRebasableProxyAdmin: ${chalk.underline(params.l2TokenRebasableProxyAdmin)}`);
  console.log(`${pad}· l2TokenRebasableDomainVersion: ${chalk.underline(params.l2TokenRebasableDomainVersion)}`);
  console.log(`${pad}· l2TokenBridge: ${chalk.underline(params.l2TokenBridge)}`);

  if (sctratchDeploy) {
    console.log(`${pad}· Proxy Admin: ${chalk.underline(params.bridgeProxyAdmin)}`);
    console.log(`${pad}· Bridge Admin: ${chalk.underline(params.bridgeAdmin)}`);
    console.log(`${pad}· Deposits Enabled: ${params.depositsEnabled}`);
    console.log(
      `${pad}· Withdrawals Enabled: ${JSON.stringify(params.withdrawalsEnabled)}`
    );
    console.log(
      `${pad}· Deposits Enablers: ${JSON.stringify(params.depositsEnablers)}`
    );
    console.log(
      `${pad}· Deposits Disablers: ${JSON.stringify(params.depositsDisablers)}`
    );
    console.log(
      `${pad}· Withdrawals Enablers: ${JSON.stringify(
        params.withdrawalsEnablers
      )}`
    );
    console.log(
      `${pad}· Withdrawals Disablers: ${JSON.stringify(
        params.withdrawalsDisablers
      )}`
    );
  }
}

export default {
  loadMultiChainDeploymentConfig,
  printMultiChainDeploymentConfig,
};
