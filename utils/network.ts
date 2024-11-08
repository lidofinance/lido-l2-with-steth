import hre from "hardhat";
import { providers, Signer, Wallet } from "ethers";
import { getContractAddress } from "ethers/lib/utils";
import { Provider } from "@ethersproject/providers";
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";

import env from "./env";

type ChainNameShort = "opt" | "eth";
export type NetworkName = "sepolia" | "mainnet";
export type SignerOrProvider = Signer | Provider;

const HARDHAT_NETWORK_NAMES = {
  eth: {
    sepolia: "eth_sepolia",
    mainnet: "eth_mainnet",
  },
  opt: {
    sepolia: "opt_sepolia",
    mainnet: "opt_mainnet",
  },
  uni: {
    sepolia: "uni_sepolia",
    mainnet: "uni_mainnet",
  }
};

const HARDHAT_NETWORK_NAMES_FORK = {
  eth: {
    sepolia: "eth_sepolia_fork",
    mainnet: "eth_mainnet_fork",
  },
  opt: {
    sepolia: "opt_sepolia_fork",
    mainnet: "opt_mainnet_fork",
  },
  uni: {
    sepolia: "uni_sepolia_fork",
    mainnet: "uni_mainnet_fork",
  },
};

export function getConfig(networkName: string, hre: HardhatRuntimeEnvironment) {
  const config = hre.config.networks[networkName];
  if (!config) {
    throw new Error(
      `Network with name ${networkName} not found. Check your hardhat.config.ts file contains network with given name`
    );
  }
  return config as HttpNetworkConfig;
}

export function getProvider(rpcURL: string) {
  return new providers.JsonRpcProvider(rpcURL);
}

export function getDeployer(rpcURL: string) {
  const PRIVATE_KEY = env.string("PRIVATE_KEY");
  return new Wallet(PRIVATE_KEY, getProvider(rpcURL));
}

// predicts future addresses of the contracts deployed by account
export async function predictAddresses(account: Wallet, txsCount: number) {
  const currentNonce = await account.getTransactionCount();

  const res: string[] = [];
  for (let i = 0; i < txsCount; ++i) {
    res.push(
      getContractAddress({
        from: account.address,
        nonce: currentNonce + i,
      })
    );
  }
  return res;
}

function loadAccount(rpcURL: string, accountPrivateKeyName: string) {
  const privateKey = env.string(accountPrivateKeyName);
  return new Wallet(privateKey, getProvider(rpcURL));
}

export function multichain(
  chainNames: ChainNameShort[],
  networkName: NetworkName
) {
  return {
    getNetworks(options: { forking: boolean }) {
      const hardhatNetworkNames = options.forking
        ? HARDHAT_NETWORK_NAMES_FORK
        : HARDHAT_NETWORK_NAMES;

      const res: HttpNetworkConfig[] = [];
      for (const chainName of chainNames) {
        const hardhatNetworkName = hardhatNetworkNames[chainName][networkName];
        if (hardhatNetworkName === "NOT_DEPLOYED") {
          throw new Error(
            `Chain "${chainName}" doesn't support "${hardhatNetworkName}" network`
          );
        }
        res.push(getConfig(hardhatNetworkName, hre));
      }
      return res;
    },
    getProviders(options: { forking: boolean }) {
      return this.getNetworks(options).map((network) =>
        getProvider(network.url)
      );
    },
    getSigners(privateKey: string, options: { forking: boolean }) {
      return this.getProviders(options).map(
        (provider) => new Wallet(privateKey, provider)
      );
    },
  };
}

function getChainId(protocol: ChainNameShort, networkName: NetworkName) {
  const chainIds = {
    eth: {
      mainnet: 1,
      sepolia: 11155111,
    },
    opt: {
      mainnet: 10,
      sepolia: 11155420,
    },
  };
  const chainId = chainIds[protocol][networkName];
  if (!chainId) {
    throw new Error(`Network for ${protocol} ${networkName} doesn't declared`);
  }
  return chainId;
}

function getBlockExplorerBaseUrlByChainId(chainId: number) {
  const baseUrlByChainId: Record<number, string> = {
    // ethereum
    1: "https://etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    // optimism
    10: "https://optimistic.etherscan.io",
    11155420: "https://blockscout.com/optimism/sepolia",
    // forked node
    31337: "https://etherscan.io",
  };
  return baseUrlByChainId[chainId];
}

export default {
  blockExplorerBaseUrl: getBlockExplorerBaseUrlByChainId,
  chainId: getChainId,
  multichain,
  getConfig,
  getProvider,
  loadAccount,
  getDeployer,
  predictAddresses,
};
