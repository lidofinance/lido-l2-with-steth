import chalk from "chalk";
import { BigNumber, Wallet } from "ethers";

import env from "./env";
import { DeployScript } from "./deployment/DeployScript";
import { BridgingManagerSetupConfig } from "./bridging-management";


interface L1StETHDeploymentConfig extends L1ScratchDeploymentConfig {
  l1TokenBridge: string;
}

interface L1ScratchDeploymentConfig extends L1DeploymentConfig {
  lido: string;
  tokenRateNotifierOwner: string;
}

interface L1DeploymentConfig extends BridgingManagerSetupConfig {
  l1CrossDomainMessenger: string;
  proxyAdmin: string;
  accountingOracle: string;
  l1TokenNonRebasable: string;
  l1RebasableToken: string;
  l2GasLimitForPushingTokenRate: BigNumber;
}

interface L2StETHDeploymentConfig extends L2ScratchDeploymentConfig {
  l2TokenBridge: string;
  l2TokenNonRebasable: string;
}

interface L2ScratchDeploymentConfig extends L2DeploymentConfig {
}

interface L2DeploymentConfig extends BridgingManagerSetupConfig {
  l2CrossDomainMessenger: string;

  /// Oracle
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
  l2TokenNonRebasableName?: string;
  l2TokenNonRebasableSymbol?: string;
  l2TokenNonRebasableDomainVersion: string;

  /// L2 stETH
  l2TokenRebasableName?: string;
  l2TokenRebasableSymbol?: string;
  l2TokenRebasableDomainVersion: string;

  /// bridge
  proxyAdmin: string;
}

interface MultiChainStETHDeploymentConfig {
  l1: L1StETHDeploymentConfig;
  l2: L2StETHDeploymentConfig;
}

interface MultiChainScratchDeploymentConfig {
  l1: L1ScratchDeploymentConfig;
  l2: L2ScratchDeploymentConfig;
}

interface MultiChainDeploymentConfig {
  l1: L1DeploymentConfig;
  l2: L2DeploymentConfig;
}

export function loadL1StETHDeploymentConfig(): L1StETHDeploymentConfig {
  return {
    ...loadL1ScratchDeploymentConfig(),
    l1TokenBridge: env.address("L1_TOKEN_BRIDGE"),
  }
}

export function loadL2StETHDeploymentConfig(): L2StETHDeploymentConfig {
  return {
    ...loadL2ScratchDeploymentConfig(),
    l2TokenBridge: env.address("L2_TOKEN_BRIDGE"),
    l2TokenNonRebasable: env.address("L2_TOKEN_NON_REBASABLE"),
  }
}

export function loadL1ScratchDeploymentConfig(): L1ScratchDeploymentConfig {
  return {
    ...loadL1DeploymentConfig(),
    lido: env.address("LIDO"),
    tokenRateNotifierOwner: env.address("TOKEN_RATE_NOTIFIER_OWNER"),
  };
}

export function loadL2ScratchDeploymentConfig(): L2ScratchDeploymentConfig {
  return {
    ...loadL2ScratchDeploymentConfig()
  };
}

export function loadL1DeploymentConfig(): L1DeploymentConfig {
  return {
    l1CrossDomainMessenger: env.address("L1_CROSSDOMAIN_MESSENGER"),
    proxyAdmin: env.address("L1_PROXY_ADMIN"),

    l1TokenNonRebasable: env.address("L1_NON_REBASABLE_TOKEN"),
    l1RebasableToken: env.address("L1_REBASABLE_TOKEN"),
    accountingOracle: env.address("ACCOUNTING_ORACLE"),
    l2GasLimitForPushingTokenRate: BigNumber.from(env.string("L2_GAS_LIMIT_FOR_PUSHING_TOKEN_RATE")),

    // Bridge
    bridgeAdmin: env.address("L1_BRIDGE_ADMIN"),
    depositsEnabled: env.bool("L1_DEPOSITS_ENABLED", false),
    withdrawalsEnabled: env.bool("L1_WITHDRAWALS_ENABLED", false),
    depositsEnablers: env.addresses("L1_DEPOSITS_ENABLERS", []),
    depositsDisablers: env.addresses("L1_DEPOSITS_DISABLERS", []),
    withdrawalsEnablers: env.addresses("L1_WITHDRAWALS_ENABLERS", []),
    withdrawalsDisablers: env.addresses("L1_WITHDRAWALS_DISABLERS", []),
  };
}

export function loadL2DeploymentConfig(): L2DeploymentConfig {
  return {
    l2CrossDomainMessenger: env.address("L2_CROSSDOMAIN_MESSENGER"),
    proxyAdmin: env.address("L2_PROXY_ADMIN"),

    /// TokenRateOracle
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
    l2TokenNonRebasableName: env.string("L2_TOKEN_NON_REBASABLE_NAME"),
    l2TokenNonRebasableSymbol: env.string("L2_TOKEN_NON_REBASABLE_SYMBOL"),
    l2TokenNonRebasableDomainVersion: env.string("L2_TOKEN_NON_REBASABLE_SIGNING_DOMAIN_VERSION"),

    // stETH
    l2TokenRebasableName: env.string("L2_TOKEN_REBASABLE_NAME"),
    l2TokenRebasableSymbol: env.string("L2_TOKEN_REBASABLE_SYMBOL"),
    l2TokenRebasableDomainVersion: env.string("L2_TOKEN_REBASABLE_SIGNING_DOMAIN_VERSION"),

    // Bridge
    bridgeAdmin: env.address("L2_BRIDGE_ADMIN"),
    depositsEnabled: env.bool("L2_DEPOSITS_ENABLED", false),
    withdrawalsEnabled: env.bool("L2_WITHDRAWALS_ENABLED", false),
    depositsEnablers: env.addresses("L2_DEPOSITS_ENABLERS", []),
    depositsDisablers: env.addresses("L2_DEPOSITS_DISABLERS", []),
    withdrawalsEnablers: env.addresses("L2_WITHDRAWALS_ENABLERS", []),
    withdrawalsDisablers: env.addresses("L2_WITHDRAWALS_DISABLERS", []),
  };
}

export function loadMultiChainStETHDeploymentConfig(): MultiChainStETHDeploymentConfig {
  return {
    l1: loadL1StETHDeploymentConfig(),
    l2: loadL2StETHDeploymentConfig()
  };
}

export function loadMultiChainDeploymentConfig(): MultiChainDeploymentConfig {
  return {
    l1: loadL1DeploymentConfig(),
    l2: loadL2DeploymentConfig()
  };
}

export function loadMultiChainScratchDeploymentConfig(): MultiChainScratchDeploymentConfig {
  return {
    l1: loadL1ScratchDeploymentConfig(),
    l2: loadL2ScratchDeploymentConfig()
  };
}

export async function printDeploymentConfig() {
  const pad = " ".repeat(4);
  console.log(`${pad}· Forking: ${env.bool("FORKING")}`);
}

export async function printMultiChainDeploymentConfig(
  title: string,
  l1Deployer: Wallet,
  l2Deployer: Wallet,
  deploymentParams: MultiChainDeploymentConfig,
  l1DeployScript: DeployScript,
  l2DeployScript: DeployScript,
  scratchDeploy: boolean
) {
  const { l1, l2 } = deploymentParams;
  console.log(chalk.bold(`${title}\n`));

  console.log(chalk.bold("  · Deployment Params:"));
  await printDeploymentConfig();
  console.log();

  console.log(chalk.bold("  · L1 Deployment Params:"));
  await printL1DeploymentConfig(l1Deployer, l1, scratchDeploy);
  console.log();
  console.log(chalk.bold("  · L1 Deployment Actions:"));
  l1DeployScript.print({ padding: 6 });

  console.log(chalk.bold("  · L2 Deployment Params:"));
  await printL2DeploymentConfig(l2Deployer, l2, scratchDeploy);
  console.log();
  console.log(chalk.bold("  · L2 Deployment Actions:"));
  l2DeployScript.print({ padding: 6 });
}

async function printL1DeploymentConfig(
  deployer: Wallet,
  params: L1DeploymentConfig,
  scratchDeploy: boolean
) {
  const pad = " ".repeat(4);
  const chainId = await deployer.getChainId();
  console.log(`${pad}· Chain ID: ${chainId}`);
  console.log(`${pad}· Deployer: ${chalk.underline(deployer.address)}`);

  console.log(`${pad}·· Proxy Admin: ${chalk.underline(params.proxyAdmin)}`);
  console.log(`${pad}· l1TokenNonRebasable: ${chalk.underline(params.l1TokenNonRebasable)}`);
  console.log(`${pad}· l1RebasableToken: ${chalk.underline(params.l1RebasableToken)}`);
  console.log(`${pad}· accountingOracle: ${chalk.underline(params.accountingOracle)}`);
  console.log(`${pad}· l2GasLimitForPushingTokenRate: ${chalk.underline(params.l2GasLimitForPushingTokenRate)}`);

  if(scratchDeploy) {
    console.log(`${pad}· Ethereum Bridge`);
    console.log(`${pad}·· Bridge Admin: ${chalk.underline(params.bridgeAdmin)}`);
    console.log(`${pad}·· Deposits Enabled: ${params.depositsEnabled}`);
    console.log(
      `${pad}·· Withdrawals Enabled: ${JSON.stringify(params.withdrawalsEnabled)}`
    );
    console.log(
      `${pad}·· Deposits Enablers: ${JSON.stringify(params.depositsEnablers)}`
    );
    console.log(
      `${pad}·· Deposits Disablers: ${JSON.stringify(params.depositsDisablers)}`
    );
    console.log(
      `${pad}·· Withdrawals Enablers: ${JSON.stringify(
        params.withdrawalsEnablers
      )}`
    );
    console.log(
      `${pad}·· Withdrawals Disablers: ${JSON.stringify(
        params.withdrawalsDisablers
      )}`
    )
  }
}

async function printL2DeploymentConfig(
  deployer: Wallet,
  params: L2DeploymentConfig,
  scratchDeploy: boolean
) {
  const pad = " ".repeat(4);
  const chainId = await deployer.getChainId();
  console.log(`${pad}· Chain ID: ${chainId}`);
  console.log(`${pad}· Deployer: ${chalk.underline(deployer.address)}`);
  console.log(`${pad}·· Proxy Admin: ${chalk.underline(params.proxyAdmin)}`);
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
  console.log(`${pad}· l2TokenNonRebasableDomainVersion: ${chalk.underline(params.l2TokenNonRebasableDomainVersion)}`);
  console.log(`${pad}· l2TokenRebasableDomainVersion: ${chalk.underline(params.l2TokenRebasableDomainVersion)}`);

  if (scratchDeploy) {
    console.log(`${pad}· Optimism Bridge`);
    console.log(`${pad}·· Admin: ${chalk.underline(params.bridgeAdmin)}`);
    console.log(`${pad}·· Deposits Enabled: ${params.depositsEnabled}`);
    console.log(
      `${pad}·· Withdrawals Enabled: ${JSON.stringify(params.withdrawalsEnabled)}`
    );
    console.log(
      `${pad}·· Deposits Enablers: ${JSON.stringify(params.depositsEnablers)}`
    );
    console.log(
      `${pad}·· Deposits Disablers: ${JSON.stringify(params.depositsDisablers)}`
    );
    console.log(
      `${pad}·· Withdrawals Enablers: ${JSON.stringify(
        params.withdrawalsEnablers
      )}`
    );
    console.log(
      `${pad}·· Withdrawals Disablers: ${JSON.stringify(
        params.withdrawalsDisablers
      )}`
    );
  }
}

export async function printMultiChainStETHDeploymentConfig(
  title: string,
  l1Deployer: Wallet,
  l2Deployer: Wallet,
  deploymentParams: MultiChainStETHDeploymentConfig,
  l1DeployScript: DeployScript,
  l2DeployScript: DeployScript,
) {
  const { l1, l2 } = deploymentParams;
  console.log(chalk.bold(`${title}\n`));

  console.log(chalk.bold("  · Deployment Params:"));
  await printDeploymentConfig();
  console.log();

  console.log(chalk.bold("  · L1 StETH Deployment Params:"));
  await printL1StETHConfig(l1Deployer, l1);
  console.log();
  console.log(chalk.bold("  · L1 Deployment Actions:"));
  l1DeployScript.print({ padding: 6 });

  console.log(chalk.bold("  · L2 StETH Deployment Params:"));
  await printL2StETHConfig(l2Deployer, l2);
  console.log();
  console.log(chalk.bold("  · L2 Deployment Actions:"));
  l2DeployScript.print({ padding: 6 });
}

async function printL1StETHConfig(
  deployer: Wallet,
  params: L1StETHDeploymentConfig
) {
  const pad = " ".repeat(4);
  const chainId = await deployer.getChainId();
  console.log(`${pad}· Chain ID: ${chainId}`);
  console.log(`${pad}· Deployer: ${chalk.underline(deployer.address)}`);

  // Print base config
  await printL1DeploymentConfig(deployer, params, false);
  
  // Print StETH specific fields
  console.log(`${pad}· L1 Token Bridge: ${chalk.underline(params.l1TokenBridge)}`);
  console.log(`${pad}· Lido: ${chalk.underline(params.lido)}`);
  console.log(`${pad}· Token Rate Notifier Owner: ${chalk.underline(params.tokenRateNotifierOwner)}`);
}

async function printL2StETHConfig(
  deployer: Wallet,
  params: L2StETHDeploymentConfig
) {
  const pad = " ".repeat(4);
  const chainId = await deployer.getChainId();
  console.log(`${pad}· Chain ID: ${chainId}`);
  console.log(`${pad}· Deployer: ${chalk.underline(deployer.address)}`);

  // Print base config
  await printL2DeploymentConfig(deployer, params, false);
  
  // Print StETH specific fields
  console.log(`${pad}· L2 Token Bridge: ${chalk.underline(params.l2TokenBridge)}`);
  console.log(`${pad}· L2 Token Non-Rebasable: ${chalk.underline(params.l2TokenNonRebasable)}`);
}

export async function printMultiChainScratchDeploymentConfig(
  title: string,
  l1Deployer: Wallet,
  l2Deployer: Wallet,
  deploymentParams: MultiChainScratchDeploymentConfig,
  l1DeployScript: DeployScript,
  l2DeployScript: DeployScript,
) {
  const { l1, l2 } = deploymentParams;
  console.log(chalk.bold(`${title}\n`));

  console.log(chalk.bold("  · Deployment Params:"));
  await printDeploymentConfig();
  console.log();

  console.log(chalk.bold("  · L1 Scratch Deployment Params:"));
  await printL1ScratchConfig(l1Deployer, l1);
  console.log();
  console.log(chalk.bold("  · L1 Deployment Actions:"));
  l1DeployScript.print({ padding: 6 });

  console.log(chalk.bold("  · L2 Scratch Deployment Params:"));
  await printL2ScratchConfig(l2Deployer, l2);
  console.log();
  console.log(chalk.bold("  · L2 Deployment Actions:"));
  l2DeployScript.print({ padding: 6 });
}

async function printL1ScratchConfig(
  deployer: Wallet,
  params: L1ScratchDeploymentConfig
) {
  const pad = " ".repeat(4);
  const chainId = await deployer.getChainId();
  console.log(`${pad}· Chain ID: ${chainId}`);
  console.log(`${pad}· Deployer: ${chalk.underline(deployer.address)}`);

  // Print base config with scratch deploy enabled
  await printL1DeploymentConfig(deployer, params, true);
  
  // Print Scratch specific fields
  console.log(`${pad}· Lido: ${chalk.underline(params.lido)}`);
  console.log(`${pad}· Token Rate Notifier Owner: ${chalk.underline(params.tokenRateNotifierOwner)}`);
}

async function printL2ScratchConfig(
  deployer: Wallet,
  params: L2ScratchDeploymentConfig
) {
  const pad = " ".repeat(4);
  const chainId = await deployer.getChainId();
  console.log(`${pad}· Chain ID: ${chainId}`);
  console.log(`${pad}· Deployer: ${chalk.underline(deployer.address)}`);

  // Print base config with scratch deploy enabled
  await printL2DeploymentConfig(deployer, params, true);
}

export default {
  loadMultiChainDeploymentConfig,
  loadMultiChainStETHDeploymentConfig,
  loadMultiChainScratchDeploymentConfig,
  printMultiChainDeploymentConfig,
  printMultiChainStETHDeploymentConfig,
  printMultiChainScratchDeploymentConfig,
};
