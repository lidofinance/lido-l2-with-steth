import { Signer } from "ethers";
import { JsonRpcProvider } from "@ethersproject/providers";
import { BigNumber } from "ethers";
import {
  IERC20,
  ERC20Bridged,
  IStETH__factory,
  L1LidoTokensBridge,
  L2ERC20ExtendedTokensBridge,
  ERC20BridgedPermit__factory,
  WstETHStub__factory,
  TokenRateOracle__factory,
  L1LidoTokensBridge__factory,
  L2ERC20ExtendedTokensBridge__factory,
  CrossDomainMessengerStub__factory,
  ERC20RebasableBridgedPermit__factory,
  AccountingOracleStub__factory,
  TokenRateNotifier__factory,
  StETHStub__factory,
  OpStackTokenRatePusher__factory
} from "../../typechain";
import addresses from "./addresses";
import contracts from "./contracts";
import deploymentAll from "./deployment";
import testingUtils from "../testing";
import { BridgingManagement } from "../bridging-management";
import network, { NetworkName, SignerOrProvider } from "../network";

export default function testing(networkName: NetworkName) {
  const optAddresses = addresses(networkName);
  const ethOptNetworks = network.multichain(["eth", "opt"], networkName);

  return {
    async getAcceptanceTestSetup() {
      const [ethProvider, optProvider] = ethOptNetworks.getProviders({
        forking: true,
      });

      const bridgeContracts = await loadDeployedBridges(
        ethProvider,
        optProvider
      );

      await printLoadedTestConfig(networkName, bridgeContracts);

      return {
        l1Provider: ethProvider,
        l2Provider: optProvider,
        ...bridgeContracts,
      };
    },
    async getIntegrationTestSetup() {
      const hasDeployedContracts = testingUtils.env.USE_DEPLOYED_CONTRACTS(false);
      const [ethProvider, optProvider] = ethOptNetworks.getProviders({ forking: true });

      var totalPooledEther = BigNumber.from('9309904612343950493629678');
      var totalShares = BigNumber.from('7975822843597609202337218');

      const bridgeContracts = hasDeployedContracts
        ? await loadDeployedBridges(ethProvider, optProvider)
        : await deployTestBridge(networkName, totalPooledEther, totalShares, ethProvider, optProvider);

      if (hasDeployedContracts) {
        totalPooledEther = await bridgeContracts.l1TokenRebasable.getTotalPooledEther();
        totalShares = await bridgeContracts.l1TokenRebasable.getTotalShares();
      }

      const [l1ERC20ExtendedTokensAdminAddress] =
        await BridgingManagement.getAdmins(bridgeContracts.l1LidoTokensBridge);

      const [l2ERC20ExtendedTokensBridgeAdminAddress] =
        await BridgingManagement.getAdmins(bridgeContracts.l2ERC20ExtendedTokensBridge);

      const l1TokensHolder = hasDeployedContracts
        ? await testingUtils.impersonate(
            testingUtils.env.L1_TOKENS_HOLDER(),
            ethProvider
          )
        : testingUtils.accounts.deployer(ethProvider);

      if (hasDeployedContracts) {
        await printLoadedTestConfig(
          networkName,
          bridgeContracts,
          l1TokensHolder
        );
      }

      const optContracts = contracts(networkName, { forking: true });

      return {
        totalPooledEther: totalPooledEther,
        totalShares: totalShares,
        l1Provider: ethProvider,
        l2Provider: optProvider,
        l1TokensHolder,
        ...bridgeContracts,
        l1CrossDomainMessenger: optContracts.L1CrossDomainMessengerStub,
        l2CrossDomainMessenger: optContracts.L2CrossDomainMessenger,
        l1ERC20ExtendedTokensBridgeAdmin: await testingUtils.impersonate(
            l1ERC20ExtendedTokensAdminAddress,
          ethProvider
        ),
        l2ERC20ExtendedTokensBridgeAdmin: await testingUtils.impersonate(
          l2ERC20ExtendedTokensBridgeAdminAddress,
          optProvider
        )
      };
    },
    async getE2ETestSetup() {
      const testerPrivateKey = testingUtils.env.TESTING_PRIVATE_KEY();
      const [ethProvider, optProvider] = ethOptNetworks.getProviders({
        forking: false,
      });
      const [l1Tester, l2Tester] = ethOptNetworks.getSigners(testerPrivateKey, {
        forking: false,
      });

      const bridgeContracts = await loadDeployedBridges(l1Tester, l2Tester);

      await printLoadedTestConfig(networkName, bridgeContracts, l1Tester);

      return {
        l1Tester,
        l2Tester,
        l1Provider: ethProvider,
        l2Provider: optProvider,
        ...bridgeContracts,
      };
    },
    async stubL1CrossChainMessengerContract() {
      const [ethProvider] = ethOptNetworks.getProviders({ forking: true });
      const deployer = testingUtils.accounts.deployer(ethProvider);
      const stub = await new CrossDomainMessengerStub__factory(
        deployer
      ).deploy();
      const stubBytecode = await ethProvider.send("eth_getCode", [
        stub.address,
      ]);

      await ethProvider.send("hardhat_setCode", [
        optAddresses.L1CrossDomainMessenger,
        stubBytecode,
      ]);
    },
  };
}

async function loadDeployedBridges(
  l1SignerOrProvider: SignerOrProvider,
  l2SignerOrProvider: SignerOrProvider
) {
  return {
    l1Token: WstETHStub__factory.connect(
      testingUtils.env.OPT_L1_NON_REBASABLE_TOKEN(),
      l1SignerOrProvider
    ),
    l1TokenRebasable: IStETH__factory.connect(
      testingUtils.env.OPT_L1_REBASABLE_TOKEN(),
      l1SignerOrProvider
    ),
    accountingOracle: AccountingOracleStub__factory.connect(
      testingUtils.env.OPT_L1_ACCOUNTING_ORACLE(),
      l1SignerOrProvider
    ),

    ...connectBridgeContracts(
      {
        tokenRateNotifier: testingUtils.env.OPT_L1_TOKEN_RATE_NOTIFIER(),
        opStackTokenRatePusher: testingUtils.env.OPT_L1_OP_STACK_TOKEN_RATE_PUSHER(),
        tokenRateOracle: testingUtils.env.OPT_L2_TOKEN_RATE_ORACLE(),
        l2Token: testingUtils.env.OPT_L2_NON_REBASABLE_TOKEN(),
        l2TokenRebasable: testingUtils.env.OPT_L2_REBASABLE_TOKEN(),
        l1LidoTokensBridge: testingUtils.env.OPT_L1_ERC20_TOKEN_BRIDGE(),
        l2ERC20ExtendedTokensBridge: testingUtils.env.OPT_L2_ERC20_TOKEN_BRIDGE(),
      },
      l1SignerOrProvider,
      l2SignerOrProvider
    ),
  };
}

async function deployTestBridge(
  networkName: NetworkName,
  totalPooledEther: BigNumber,
  totalShares: BigNumber,
  ethProvider: JsonRpcProvider,
  optProvider: JsonRpcProvider
) {
  // stETH config
  const l1TokenRebasableName = "Test Token Rebasable";
  const l1TokenRebasableSymbol = "TTR";

  // wstETH config
  const l1TokenNonRebasableName = "Test Non Rebasable Token";
  const l1TokenNonRebasableSymbol = "TT";

  // Notifier Config
  const lido = testingUtils.env.OPT_L1_LIDO();

  // OpStackPusher
  const l2GasLimitForPushingTokenRate = BigNumber.from(300_000);

  // Accounting oracle config
  const genesisTime = 1;
  const secondsPerSlot = 2;
  const lastProcessingRefSlot = 3;

  // Token rate oracle config
  const maxAllowedL2ToL1ClockLag = BigNumber.from(86400);
  const maxAllowedTokenRateDeviationPerDay = BigNumber.from(500);
  const oldestRateAllowedInPauseTimeSpan = BigNumber.from(86400 * 3);
  const minTimeBetweenTokenRateUpdates = BigNumber.from(3600);
  const tokenRateOutdatedDelay = BigNumber.from(86400);
  const tokenRate = BigNumber.from(10).pow(27).mul(totalPooledEther).div(totalShares);
  const l1TokenRateUpdate = BigNumber.from(genesisTime + (secondsPerSlot * lastProcessingRefSlot));

  // L2 Non-Rebasable Token
  const l2TokenNonRebasable = {
    name: "wstETH",
    symbol: "WST",
    version: "1",
    decimals: 18
  };

  // L2 Rebasable Token
  const l2TokenRebasable = {
    name: "stETH",
    symbol: "ST",
    version: "1",
    decimals: 18
  };

  const ethDeployer = testingUtils.accounts.deployer(ethProvider);
  const optDeployer = testingUtils.accounts.deployer(optProvider);

  const l1TokenRebasable = await new StETHStub__factory(ethDeployer).deploy(
    l1TokenRebasableName,
    l1TokenRebasableSymbol
  );

  const l1TokenNonRebasable = await new WstETHStub__factory(ethDeployer).deploy(
    l1TokenRebasable.address,
    l1TokenNonRebasableName,
    l1TokenNonRebasableSymbol,
    totalPooledEther,
    totalShares
  );

  const accountingOracle = await new AccountingOracleStub__factory(ethDeployer).deploy(
    genesisTime,
    secondsPerSlot,
    lastProcessingRefSlot
  );

  const [ethDeployScript, optDeployScript] = await deploymentAll(
    networkName
  ).deployAllScript(
    {
      l1TokenNonRebasable: l1TokenNonRebasable.address,
      l1TokenRebasable: l1TokenRebasable.address,
      accountingOracle: accountingOracle.address,
      l2GasLimitForPushingTokenRate: l2GasLimitForPushingTokenRate,
      lido: lido,

      deployer: ethDeployer,
      admins: { proxy: ethDeployer.address, bridge: ethDeployer.address },
      deployOffset: 0
    },
    {
      tokenRateOracle: {
        tokenRateOutdatedDelay: tokenRateOutdatedDelay,
        maxAllowedL2ToL1ClockLag: maxAllowedL2ToL1ClockLag,
        maxAllowedTokenRateDeviationPerDayBp: maxAllowedTokenRateDeviationPerDay,
        oldestRateAllowedInPauseTimeSpan: oldestRateAllowedInPauseTimeSpan,
        minTimeBetweenTokenRateUpdates: minTimeBetweenTokenRateUpdates,
        tokenRate: tokenRate,
        l1Timestamp: l1TokenRateUpdate
      },
      l2TokenNonRebasable: {
        name: l2TokenNonRebasable.name,
        symbol: l2TokenNonRebasable.symbol,
        version: l2TokenNonRebasable.version,
        decimals: l2TokenNonRebasable.decimals
      },
      l2TokenRebasable: {
        name: l2TokenRebasable.name,
        symbol: l2TokenRebasable.symbol,
        version: l2TokenRebasable.version,
        decimals: l2TokenRebasable.decimals
      },

      deployer: optDeployer,
      admins: { proxy: optDeployer.address, bridge: optDeployer.address },
      deployOffset: 0,
    }
  );

  await ethDeployScript.run();
  await optDeployScript.run();

  const tokenRateNotifier = TokenRateNotifier__factory.connect(
    ethDeployScript.tokenRateNotifierImplAddress,
    ethProvider
  );
  await tokenRateNotifier
    .connect(ethDeployer)
    .addObserver(ethDeployScript.opStackTokenRatePusherImplAddress);

  const l1BridgingManagement = new BridgingManagement(
    ethDeployScript.bridgeProxyAddress,
    ethDeployer
  );

  const l2BridgingManagement = new BridgingManagement(
    optDeployScript.tokenBridgeProxyAddress,
    optDeployer
  );

  await l1BridgingManagement.setup({
    bridgeAdmin: ethDeployer.address,
    depositsEnabled: true,
    withdrawalsEnabled: true,
  });

  await l2BridgingManagement.setup({
    bridgeAdmin: optDeployer.address,
    depositsEnabled: true,
    withdrawalsEnabled: true,
  });

  return {
    l1Token: l1TokenNonRebasable.connect(ethProvider),
    l1TokenRebasable: l1TokenRebasable.connect(ethProvider),
    accountingOracle: accountingOracle.connect(ethProvider),
    ...connectBridgeContracts(
      {
        tokenRateNotifier: ethDeployScript.tokenRateNotifierImplAddress,
        opStackTokenRatePusher: ethDeployScript.opStackTokenRatePusherImplAddress,
        tokenRateOracle: optDeployScript.tokenRateOracleProxyAddress,
        l2Token: optDeployScript.tokenProxyAddress,
        l2TokenRebasable: optDeployScript.tokenRebasableProxyAddress,
        l1LidoTokensBridge: ethDeployScript.bridgeProxyAddress,
        l2ERC20ExtendedTokensBridge: optDeployScript.tokenBridgeProxyAddress
      },
      ethProvider,
      optProvider
    ),
  };
}

function connectBridgeContracts(
  addresses: {
    tokenRateNotifier: string;
    opStackTokenRatePusher: string;
    tokenRateOracle: string;
    l2Token: string;
    l2TokenRebasable: string;
    l1LidoTokensBridge: string;
    l2ERC20ExtendedTokensBridge: string;
  },
  ethSignerOrProvider: SignerOrProvider,
  optSignerOrProvider: SignerOrProvider
) {
  const tokenRateNotifier = TokenRateNotifier__factory.connect(
    addresses.tokenRateNotifier,
    ethSignerOrProvider
  );
  const opStackTokenRatePusher = OpStackTokenRatePusher__factory.connect(
    addresses.opStackTokenRatePusher,
    ethSignerOrProvider
  );
  const l1LidoTokensBridge = L1LidoTokensBridge__factory.connect(
    addresses.l1LidoTokensBridge,
    ethSignerOrProvider
  );
  const l2ERC20ExtendedTokensBridge = L2ERC20ExtendedTokensBridge__factory.connect(
    addresses.l2ERC20ExtendedTokensBridge,
    optSignerOrProvider
  );
  const l2Token = ERC20BridgedPermit__factory.connect(
    addresses.l2Token,
    optSignerOrProvider
  );
  const l2TokenRebasable = ERC20RebasableBridgedPermit__factory.connect(
    addresses.l2TokenRebasable,
    optSignerOrProvider
  );
  const tokenRateOracle = TokenRateOracle__factory.connect(
    addresses.tokenRateOracle,
    optSignerOrProvider
  );
  return {
    tokenRateNotifier,
    opStackTokenRatePusher,
    tokenRateOracle,
    l2Token,
    l2TokenRebasable,
    l1LidoTokensBridge,
    l2ERC20ExtendedTokensBridge
  };
}

async function printLoadedTestConfig(
  networkName: NetworkName,
  bridgeContracts: {
    l1Token: IERC20;
    l1TokenRebasable: IERC20;
    l2Token: ERC20Bridged;
    l1LidoTokensBridge: L1LidoTokensBridge;
    l2ERC20ExtendedTokensBridge: L2ERC20ExtendedTokensBridge;
  },
  l1TokensHolder?: Signer
) {
  console.log("Using the deployed contracts for testing");
  console.log(
    "In case of unexpected fails, please, make sure that you are forking correct Ethereum/Optimism networks"
  );
  console.log(`  · Network Name: ${networkName}`);
  console.log(`  · L1 Token: ${bridgeContracts.l1Token.address}`);
  console.log(`  · L2 Token: ${bridgeContracts.l2Token.address}`);
  if (l1TokensHolder) {
    const l1TokensHolderAddress = await l1TokensHolder.getAddress();
    console.log(`  · L1 Tokens Holder: ${l1TokensHolderAddress}`);
    const holderBalance = await bridgeContracts.l1Token.balanceOf(
      l1TokensHolderAddress
    );
    console.log(`  · L1 Tokens Holder Non-Rebasable Balance: ${holderBalance.toString()}`);

    const holderBalanceRebasable = await bridgeContracts.l1TokenRebasable.balanceOf(
      l1TokensHolderAddress
    );
    console.log(`  · L1 Tokens Holder Rebasable Balance: ${holderBalanceRebasable.toString()}`);
  }
  console.log(
    `  · L1 ERC20 Token Bridge: ${bridgeContracts.l1LidoTokensBridge.address}`
  );
  console.log(
    `  · L2 ERC20 Token Bridge: ${bridgeContracts.l2ERC20ExtendedTokensBridge.address}`
  );
  console.log();
}
