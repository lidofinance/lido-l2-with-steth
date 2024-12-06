import hre from "hardhat";
import { providers, Signer, Wallet } from "ethers";
import { getContractAddress } from "ethers/lib/utils";
import { Provider } from "@ethersproject/providers";
import { HardhatRuntimeEnvironment, HttpNetworkConfig } from "hardhat/types";

import env from "./env";

type ChainNameShort = "l1" | "l2";
export type SignerOrProvider = Signer | Provider;

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

export function getProviders(options: { forking: boolean }) {
  if (options.forking) {
    return [getProvider(getConfig("l1_fork", hre).url), getProvider(getConfig("l2_fork", hre).url)];
  }
  return [getProvider(getConfig("l1", hre).url), getProvider(getConfig("l2", hre).url)];
}

export function getSigners(privateKey: string, options: { forking: boolean }) {
  return getProviders(options).map(
    (provider) => new Wallet(privateKey, provider)
  );
}

function getChainId(protocol: ChainNameShort) {
  if (protocol == "l1") {
    return env.number("L1_CHAIN_ID");
  }
  return env.number("L2_CHAIN_ID");
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
  getProviders,
  getSigners,
  getConfig,
  getProvider,
  loadAccount,
  getDeployer,
  predictAddresses,
};
