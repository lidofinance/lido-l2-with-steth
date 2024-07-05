import env from "../../utils/env";
import prompt from "../../utils/prompt";
import network from "../../utils/network";
import deployment from "../../utils/deployment";
import { TokenRateNotifierManagement } from "../../utils/tokenRateNotifier-management";
import { TokenRateOracleManagement } from "../../utils/tokenRateOracle-management";
import upgrade from "../../utils/optimism/upgrade";

async function main() {
  const networkName = env.network();
  const ethOptNetwork = network.multichain(["eth", "opt"], networkName);

  const [ethDeployer] = ethOptNetwork.getSigners(env.privateKey(), {
    forking: env.forking(),
  });
  const [ethProvider] = ethOptNetwork.getProviders({
    forking: env.forking()
  });

  const [, optDeployer] = ethOptNetwork.getSigners(
    env.string("OPT_DEPLOYER_PRIVATE_KEY"),
    {
      forking: env.forking(),
    }
  );

  const deploymentConfig = deployment.loadMultiChainDeploymentConfig();

  const [l1DeployScript, l2DeployScript] = await upgrade (networkName, { logger: console })
    .upgradeScript(
      {
        l1TokenNonRebasable: deploymentConfig.l1TokenNonRebasable,
        l1TokenRebasable: deploymentConfig.l1RebasableToken,
        accountingOracle: deploymentConfig.accountingOracle,
        l2GasLimitForPushingTokenRate: deploymentConfig.l2GasLimitForPushingTokenRate,
        l1TokenBridge: deploymentConfig.l1TokenBridge,
        lido: deploymentConfig.lido,

        deployer: ethDeployer,
        admins: {
          proxy: deploymentConfig.l1.proxyAdmin,
          bridge: ethDeployer.address
        },
        deployOffset: 0,
      },
      {
        tokenRateOracle: {
          constructor: {
            tokenRateOutdatedDelay: deploymentConfig.tokenRateOutdatedDelay,
            maxAllowedL2ToL1ClockLag: deploymentConfig.maxAllowedL2ToL1ClockLag,
            maxAllowedTokenRateDeviationPerDayBp: deploymentConfig.maxAllowedTokenRateDeviationPerDayBp,
            oldestRateAllowedInPauseTimeSpan: deploymentConfig.oldestRateAllowedInPauseTimeSpan,
            minTimeBetweenTokenRateUpdates: deploymentConfig.minTimeBetweenTokenRateUpdates
          },
          initialize: {
            tokenRate: deploymentConfig.initialTokenRateValue,
            l1Timestamp: deploymentConfig.initialTokenRateL1Timestamp
          }
        },
        l2TokenBridge: deploymentConfig.l2TokenBridge,
        l2TokenNonRebasable: {
          address: deploymentConfig.l2TokenNonRebasableAddress,
          version: deploymentConfig.l2TokenNonRebasableVersion
        },
        l2TokenRebasable: {
          version: deploymentConfig.l2TokenRebasableVersion
        },

        deployer: optDeployer,
        admins: {
          proxy: deploymentConfig.l2.proxyAdmin,
          bridge: optDeployer.address,
        },
        deployOffset: 0,
      }
    );

  await deployment.printMultiChainDeploymentConfig(
    "Upgrade Optimism Bridge",
    ethDeployer,
    optDeployer,
    deploymentConfig,
    l1DeployScript,
    l2DeployScript
  );

  await prompt.proceed();

  await l1DeployScript.run();
  await l2DeployScript.run();

  /// Setup TokenRateNotifier
  const tokenRateNotifierManagement = new TokenRateNotifierManagement(
    l1DeployScript.tokenRateNotifierImplAddress,
    ethDeployer,
    { logger: console }
  );
  await tokenRateNotifierManagement.setup({
    tokenRateNotifier: l1DeployScript.tokenRateNotifierImplAddress,
    opStackTokenRatePusher: l1DeployScript.opStackTokenRatePusherImplAddress,
    ethDeployer: ethDeployer,
    ethProvider: ethProvider,
    notifierOwner: deploymentConfig.tokenRateNotifierOwner
  });

  /// Setup TokenRateOracle
  const tokenRateOracleManagement = new TokenRateOracleManagement(
    l2DeployScript.tokenRateOracleProxyAddress,
    optDeployer,
    { logger: console }
  );
  await tokenRateOracleManagement.setup({
    tokenRateOracleAdmin: deploymentConfig. tokenRateOracleAdmin,
    initialTokenRateValue: deploymentConfig.initialTokenRateValue,
    initialTokenRateL1Timestamp: deploymentConfig.initialTokenRateL1Timestamp,
    rateUpdatesEnabled: deploymentConfig.tokenRateUpdateEnabled,
    rateUpdatesDisablers: deploymentConfig.tokenRateUpdateDisablers,
    rateUpdatesEnablers: deploymentConfig.tokenRateUpdateEnablers
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
