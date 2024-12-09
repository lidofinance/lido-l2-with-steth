import env from "../../utils/env";
import prompt from "../../utils/prompt";
import network from "../../utils/network";
import deployment from "../../utils/deployment";
import { TokenRateNotifierManagement } from "../../utils/tokenRateNotifier-management";
import { TokenRateOracleManagement } from "../../utils/tokenRateOracle-management";
import deploy from "../../utils/optimism/deploymentStETH";

async function main() {

  const [l1Deployer] = network.getSigners(env.privateKey(), {
    forking: env.forking(),
  });
  const [ethProvider] = network.getProviders({
    forking: env.forking()
  });

  const [, l2Deployer] = network.getSigners(
    env.string("OPT_DEPLOYER_PRIVATE_KEY"),
    {
      forking: env.forking(),
    }
  );

  const deploymentConfig = deployment.loadMultiChainStETHDeploymentConfig();

  const [l1DeployScript, l2DeployScript] = await deploy({ logger: console })
    .deployScript(
      {
        l1CrossDomainMessenger: deploymentConfig.l1.l1CrossDomainMessenger,
        l1TokenNonRebasable: deploymentConfig.l1.l1TokenNonRebasable,
        l1TokenRebasable: deploymentConfig.l1.l1RebasableToken,
        accountingOracle: deploymentConfig.l1.accountingOracle,
        l2GasLimitForPushingTokenRate: deploymentConfig.l1.l2GasLimitForPushingTokenRate,

        l1TokenBridge: deploymentConfig.l1.l1TokenBridge,
        lido: deploymentConfig.l1.lido,
        tokenRateNotifierOwner: l1Deployer.address,

        deployer: l1Deployer,
        admins: {
          proxy: deploymentConfig.l1.proxyAdmin,
          bridge: l1Deployer.address
        },
        deployOffset: 0,
      },
      {
        l2CrossDomainMessenger: deploymentConfig.l2.l2CrossDomainMessenger,
        l2TokenBridge: deploymentConfig.l2.l2TokenBridge,

        tokenRateOracle: {
          admin: l2Deployer.address,
          tokenRateOutdatedDelay: deploymentConfig.l2.tokenRateOutdatedDelay,
          maxAllowedL2ToL1ClockLag: deploymentConfig.l2.maxAllowedL2ToL1ClockLag,
          maxAllowedTokenRateDeviationPerDayBp: deploymentConfig.l2.maxAllowedTokenRateDeviationPerDayBp,
          oldestRateAllowedInPauseTimeSpan: deploymentConfig.l2.oldestRateAllowedInPauseTimeSpan,
          minTimeBetweenTokenRateUpdates: deploymentConfig.l2.minTimeBetweenTokenRateUpdates,
          tokenRate: deploymentConfig.l2.initialTokenRateValue,
          l1Timestamp: deploymentConfig.l2.initialTokenRateL1Timestamp
        },
        l2TokenNonRebasable: {
          address: deploymentConfig.l2.l2TokenNonRebasableAddress,
          name: deploymentConfig.l2.l2TokenNonRebasableName,
          symbol: deploymentConfig.l2.l2TokenRebasableSymbol,
          version: deploymentConfig.l2.l2TokenNonRebasableDomainVersion
        },
        l2TokenRebasable: {
          proxyAdmin: deploymentConfig.l2.l2TokenRebasableProxyAdmin,
          name: deploymentConfig.l2.l2TokenRebasableName,
          symbol: deploymentConfig.l2.l2TokenRebasableSymbol,
          version: deploymentConfig.l2.l2TokenRebasableDomainVersion
        },

        deployer: l2Deployer,
        admins: {
          proxy: deploymentConfig.l2.proxyAdmin,
          bridge: l2Deployer.address,
        },
        deployOffset: 0,
      }
    );

  await deployment.printMultiChainDeploymentConfig(
    "Deploy new contracts for Optimism Bridge",
    l1Deployer,
    l2Deployer,
    deploymentConfig,
    l1DeployScript,
    l2DeployScript,
    false
  );

  await prompt.proceed();

  await l1DeployScript.run();
  await l2DeployScript.run();

  /// Setup TokenRateNotifier
  const tokenRateNotifierManagement = new TokenRateNotifierManagement(
    l1DeployScript.tokenRateNotifierImplAddress,
    l1Deployer,
    { logger: console }
  );
  await tokenRateNotifierManagement.setup({
    tokenRateNotifier: l1DeployScript.tokenRateNotifierImplAddress,
    opStackTokenRatePusher: l1DeployScript.opStackTokenRatePusherImplAddress,
    ethDeployer: l1Deployer,
    ethProvider: ethProvider,
    notifierOwner: deploymentConfig.l1.tokenRateNotifierOwner
  });

  /// Setup TokenRateOracle
  const tokenRateOracleManagement = new TokenRateOracleManagement(
    l2DeployScript.tokenRateOracleProxyAddress,
    l2Deployer,
    { logger: console }
  );
  await tokenRateOracleManagement.setup({
    tokenRateOracleAdmin: deploymentConfig.l2.tokenRateOracleAdmin,
    initialTokenRateValue: deploymentConfig.l2.initialTokenRateValue,
    initialTokenRateL1Timestamp: deploymentConfig.l2.initialTokenRateL1Timestamp,
    rateUpdatesEnabled: deploymentConfig.l2.tokenRateUpdateEnabled,
    rateUpdatesDisablers: deploymentConfig.l2.tokenRateUpdateDisablers,
    rateUpdatesEnablers: deploymentConfig.l2.tokenRateUpdateEnablers
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
