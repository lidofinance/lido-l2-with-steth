import env from "../../utils/env";
import prompt from "../../utils/prompt";
import network from "../../utils/network";
import deployment from "../../utils/deployment";
import { TokenRateNotifierManagement } from "../../utils/tokenRateNotifier-management";
import { TokenRateOracleManagement } from "../../utils/tokenRateOracle-management";
import deploy from "../../utils/optimism/deploymentStETH";

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

  const [l1DeployScript, l2DeployScript] = await deploy(networkName, { logger: console })
    .deployScript(
      {
        l1TokenNonRebasable: deploymentConfig.ethereum.l1TokenNonRebasable,
        l1TokenRebasable: deploymentConfig.ethereum.l1RebasableToken,
        accountingOracle: deploymentConfig.ethereum.accountingOracle,
        l2GasLimitForPushingTokenRate: deploymentConfig.ethereum.l2GasLimitForPushingTokenRate,
        l1TokenBridge: deploymentConfig.ethereum.l1TokenBridge,
        lido: deploymentConfig.ethereum.lido,

        deployer: ethDeployer,
        admins: {
          proxy: deploymentConfig.ethereum.bridgeProxyAdmin,
          bridge: ethDeployer.address
        },
        deployOffset: 0,
      },
      {
        tokenRateOracle: {
          proxyAdmin: deploymentConfig.optimism.tokenRateOracleProxyAdmin,
          admin: deploymentConfig.optimism.tokenRateOracleAdmin,
          constructor: {
            tokenRateOutdatedDelay: deploymentConfig.optimism.tokenRateOutdatedDelay,
            maxAllowedL2ToL1ClockLag: deploymentConfig.optimism.maxAllowedL2ToL1ClockLag,
            maxAllowedTokenRateDeviationPerDayBp: deploymentConfig.optimism.maxAllowedTokenRateDeviationPerDayBp,
            oldestRateAllowedInPauseTimeSpan: deploymentConfig.optimism.oldestRateAllowedInPauseTimeSpan,
            minTimeBetweenTokenRateUpdates: deploymentConfig.optimism.minTimeBetweenTokenRateUpdates
          },
          initialize: {
            tokenRate: deploymentConfig.optimism.initialTokenRateValue,
            l1Timestamp: deploymentConfig.optimism.initialTokenRateL1Timestamp
          }
        },
        l2TokenBridge: deploymentConfig.optimism.l2TokenBridge,
        l2TokenNonRebasable: {
          address: deploymentConfig.optimism.l2TokenNonRebasableAddress,
          version: deploymentConfig.optimism.l2TokenNonRebasableDomainVersion
        },
        l2TokenRebasable: {
          proxyAdmin: deploymentConfig.optimism.l2TokenRebasableProxyAdmin,
          version: deploymentConfig.optimism.l2TokenRebasableDomainVersion
        },

        deployer: optDeployer,
        admins: {
          proxy: deploymentConfig.optimism.bridgeProxyAdmin,
          bridge: optDeployer.address,
        },
        deployOffset: 0,
      }
    );

  await deployment.printMultiChainDeploymentConfig(
    "Deploy new contracts for Optimism Bridge",
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
    notifierOwner: deploymentConfig.ethereum.tokenRateNotifierOwner
  });

  /// Setup TokenRateOracle
  const tokenRateOracleManagement = new TokenRateOracleManagement(
    l2DeployScript.tokenRateOracleProxyAddress,
    optDeployer,
    { logger: console }
  );
  await tokenRateOracleManagement.setup({
    tokenRateOracleAdmin: deploymentConfig.optimism.tokenRateOracleAdmin,
    initialTokenRateValue: deploymentConfig.optimism.initialTokenRateValue,
    initialTokenRateL1Timestamp: deploymentConfig.optimism.initialTokenRateL1Timestamp,
    rateUpdatesEnabled: deploymentConfig.optimism.tokenRateUpdateEnabled,
    rateUpdatesDisablers: deploymentConfig.optimism.tokenRateUpdateDisablers,
    rateUpdatesEnablers: deploymentConfig.optimism.tokenRateUpdateEnablers
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
