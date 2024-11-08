import env from "../../utils/env";
import prompt from "../../utils/prompt";
import network from "../../utils/network";
import deployment from "../../utils/deployment";
import { BridgingManagement } from "../../utils/bridging-management";
import deploymentAll from "../../utils/optimism/deploymentForAutomaton";
import { TokenRateOracleManagement } from "../../utils/tokenRateOracle-management";
import * as fs from 'fs';

async function main() {
  const networkName = env.network();
  const ethOptNetwork = network.multichain(["eth", "opt"], networkName);

  const [ethDeployer] = ethOptNetwork.getSigners(env.privateKey(), {
    forking: env.forking()
  });

  const [, optDeployer] = ethOptNetwork.getSigners(
    env.string("OPT_DEPLOYER_PRIVATE_KEY"),
    {
      forking: env.forking()
    }
  );

  const deploymentConfig = deployment.loadMultiChainDeploymentConfig();

  const [l1DeployScript, l2DeployScript] = await deploymentAll({ logger: console })
    .deployAllScript(
      {
        l1CrossDomainMessenger: deploymentConfig.ethereum.l1CrossDomainMessenger,
        l1TokenNonRebasable: deploymentConfig.ethereum.l1TokenNonRebasable,
        l1TokenRebasable: deploymentConfig.ethereum.l1RebasableToken,
        accountingOracle: deploymentConfig.ethereum.accountingOracle,
        l2GasLimitForPushingTokenRate: deploymentConfig.ethereum.l2GasLimitForPushingTokenRate,

        deployer: ethDeployer,
        admins: {
          proxy: deploymentConfig.ethereum.proxyAdmin,
          bridge: ethDeployer.address
        },
        deployOffset: 0,
      },
      {
        l2CrossDomainMessenger: deploymentConfig.optimism.l2CrossDomainMessenger,
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
          name: deploymentConfig.optimism.l2TokenNonRebasableName,
          symbol: deploymentConfig.optimism.l2TokenNonRebasableSymbol,
          version: deploymentConfig.optimism.l2TokenNonRebasableDomainVersion
        },
        l2TokenRebasable: {
          name: deploymentConfig.optimism.l2TokenRebasableName,
          symbol: deploymentConfig.optimism.l2TokenRebasableSymbol,
          version: deploymentConfig.optimism.l2TokenRebasableDomainVersion
        },

        deployer: optDeployer,
        admins: {
          proxy: deploymentConfig.optimism.proxyAdmin,
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

  const tokenRateOracleManagement = new TokenRateOracleManagement(
    l2DeployScript.tokenRateOracleProxyAddress,
    optDeployer,
    { logger: console }
  );

  await l1BridgingManagement.setup(deploymentConfig.ethereum);
  await l2BridgingManagement.setup(deploymentConfig.optimism);
  await tokenRateOracleManagement.setup({
    tokenRateOracleAdmin: deploymentConfig.optimism.tokenRateOracleAdmin,
    initialTokenRateValue: deploymentConfig.optimism.initialTokenRateValue,
    initialTokenRateL1Timestamp: deploymentConfig.optimism.initialTokenRateL1Timestamp,
    rateUpdatesEnabled: deploymentConfig.optimism.tokenRateUpdateEnabled,
    rateUpdatesDisablers: deploymentConfig.optimism.tokenRateUpdateDisablers,
    rateUpdatesEnablers: deploymentConfig.optimism.tokenRateUpdateEnablers
  });

  l1DeployScript.saveResultToFile("l1DeployArgs.json");
  l2DeployScript.saveResultToFile("l2DeployArgs.json");

  const deployResult = JSON.stringify({
    ethereum: l1DeployScript,
    optimism: l2DeployScript
  }, null, 2);

  const fileName = 'deployResult.json';
  try {
    fs.writeFileSync(fileName, `${deployResult}\n`, { encoding: "utf8", flag: "w" });
  } catch (error) {
    throw new Error(`Failed to write network state file ${fileName}: ${(error as Error).message}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
