import env from "../../utils/env";
import prompt from "../../utils/prompt";
import network from "../../utils/network";
import deployment from "../../utils/deployment";
import { BridgingManagement } from "../../utils/bridging-management";
import deploymentAll from "../../utils/optimism/deploymentForAutomaton";
import { TokenRateOracleManagement } from "../../utils/tokenRateOracle-management";
import * as fs from 'fs';

async function main() {

  const [l1Deployer] = network.getSigners(env.privateKey(), {
    forking: env.forking()
  });

  const [, l2Deployer] = network.getSigners(
    env.string("OPT_DEPLOYER_PRIVATE_KEY"),
    {
      forking: env.forking()
    }
  );

  const deploymentConfig = deployment.loadMultiChainAutomatonDeploymentConfig();

  const [l1DeployScript, l2DeployScript] = await deploymentAll({ logger: console })
    .deployAllScript(
      {
        l1CrossDomainMessenger: deploymentConfig.l1.l1CrossDomainMessenger,
        l1TokenNonRebasable: deploymentConfig.l1.l1TokenNonRebasable,
        l1TokenRebasable: deploymentConfig.l1.l1RebasableToken,
        accountingOracle: deploymentConfig.l1.accountingOracle,
        l2GasLimitForPushingTokenRate: deploymentConfig.l1.l2GasLimitForPushingTokenRate,

        deployer: l1Deployer,
        admins: {
          proxy: deploymentConfig.l1.proxyAdmin,
          bridge: l1Deployer.address,
        },
        deployOffset: 0,
      },
      {
        l2CrossDomainMessenger: deploymentConfig.l2.l2CrossDomainMessenger,
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
          name: deploymentConfig.l2.l2TokenNonRebasableName,
          symbol: deploymentConfig.l2.l2TokenNonRebasableSymbol,
          version: deploymentConfig.l2.l2TokenNonRebasableDomainVersion
        },
        l2TokenRebasable: {
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
    "Deploy Optimism Bridge",
    l1Deployer,
    l2Deployer,
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
    l1Deployer,
    { logger: console }
  );

  const l2BridgingManagement = new BridgingManagement(
    l2DeployScript.tokenBridgeProxyAddress,
    l2Deployer,
    { logger: console }
  );

  const tokenRateOracleManagement = new TokenRateOracleManagement(
    l2DeployScript.tokenRateOracleProxyAddress,
    l2Deployer,
    { logger: console }
  );

  await l1BridgingManagement.setup(deploymentConfig.l1);
  await l2BridgingManagement.setup(deploymentConfig.l2);
  await tokenRateOracleManagement.setup({
    tokenRateOracleAdmin: deploymentConfig.l2.tokenRateOracleAdmin,
    initialTokenRateValue: deploymentConfig.l2.initialTokenRateValue,
    initialTokenRateL1Timestamp: deploymentConfig.l2.initialTokenRateL1Timestamp,
    rateUpdatesEnabled: deploymentConfig.l2.tokenRateUpdateEnabled,
    rateUpdatesDisablers: deploymentConfig.l2.tokenRateUpdateDisablers,
    rateUpdatesEnablers: deploymentConfig.l2.tokenRateUpdateEnablers
  });

  await l1DeployScript.saveResultToFile("l1DeployArgs.json");
  await l2DeployScript.saveResultToFile("l2DeployArgs.json");

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
