import env from "../../utils/env";
import prompt from "../../utils/prompt";
import network from "../../utils/network";
import deployment from "../../utils/deployment";
import { BridgingManagement } from "../../utils/bridging-management";
import deploymentAll from "../../utils/optimism/deployment";
import { TokenRateNotifierManagement } from "../../utils/tokenRateNotifier-management";

async function main() {

  const [ethDeployer] = network.getSigners(env.privateKey(), {
    forking: env.forking()
  });

  const [ethProvider] = network.getProviders({
    forking: env.forking()
  });

  const [, optDeployer] = network.getSigners(
    env.string("OPT_DEPLOYER_PRIVATE_KEY"),
    {
      forking: env.forking()
    }
  );

  const deploymentConfig = deployment.loadMultiChainDeploymentConfig();

  const [l1DeployScript, l2DeployScript] = await deploymentAll({ logger: console })
    .deployAllScript(
      {
        l1TokenNonRebasable: deploymentConfig.ethereum.l1TokenNonRebasable,
        l1TokenRebasable: deploymentConfig.ethereum.l1RebasableToken,
        accountingOracle: deploymentConfig.ethereum.accountingOracle,
        l2GasLimitForPushingTokenRate: deploymentConfig.ethereum.l2GasLimitForPushingTokenRate,
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
          tokenRateOutdatedDelay: deploymentConfig.optimism.tokenRateOutdatedDelay,
          maxAllowedL2ToL1ClockLag: deploymentConfig.optimism.maxAllowedL2ToL1ClockLag,
          maxAllowedTokenRateDeviationPerDayBp: deploymentConfig.optimism.maxAllowedTokenRateDeviationPerDayBp,
          oldestRateAllowedInPauseTimeSpan: deploymentConfig.optimism.oldestRateAllowedInPauseTimeSpan,
          minTimeBetweenTokenRateUpdates: deploymentConfig.optimism.minTimeBetweenTokenRateUpdates,
          tokenRate: deploymentConfig.optimism.initialTokenRateValue,
          l1Timestamp: deploymentConfig.optimism.initialTokenRateL1Timestamp
        },
        l2TokenNonRebasable: {
          version: deploymentConfig.optimism.l2TokenNonRebasableDomainVersion
        },
        l2TokenRebasable: {
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
    "Deploy Optimism Bridge",
    ethDeployer,
    optDeployer,
    deploymentConfig,
    l1DeployScript,
    l2DeployScript,
    true
  );

  await prompt.proceed();

  await l1DeployScript.run();
  await l2DeployScript.run();

  const tokenRateNotifierManagement = new TokenRateNotifierManagement(
    l1DeployScript.tokenRateNotifierImplAddress,
    ethDeployer
  );
  await tokenRateNotifierManagement.setup({
    tokenRateNotifier: l1DeployScript.tokenRateNotifierImplAddress,
    opStackTokenRatePusher: l1DeployScript.opStackTokenRatePusherImplAddress,
    ethDeployer: ethDeployer,
    ethProvider: ethProvider,
    notifierOwner: deploymentConfig.ethereum.tokenRateNotifierOwner
  });

  const l1BridgingManagement = new BridgingManagement(
    l1DeployScript.bridgeProxyAddress,
    ethDeployer,
    { logger: console }
  );

  const l2BridgingManagement = new BridgingManagement(
    l2DeployScript.tokenBridgeProxyAddress,
    optDeployer,
    { logger: console }
  );

  await l1BridgingManagement.setup(deploymentConfig.ethereum);
  await l2BridgingManagement.setup(deploymentConfig.optimism);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
