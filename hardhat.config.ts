import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@foundry-rs/hardhat-forge";

import "./tasks/fork-node";
import env from "./utils/env";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100_000,
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      gasPrice: 0,
      initialBaseFeePerGas: 0,
      chains: {
        11155420: {
          hardforkHistory: {
            london: 13983909
          }
        }
      }
    },
    // Ethereum Public Chains
    eth_mainnet: {
      url: env.string("RPC_ETH_MAINNET", ""),
    },
    eth_sepolia: {
      url: env.string("RPC_ETH_SEPOLIA", ""),
    },

    // Ethereum Fork Chains
    eth_mainnet_fork: {
      url: "http://localhost:8545",
    },
    eth_sepolia_fork: {
      url: "http://localhost:8545",
    },

    // Optimism Public Chains
    opt_mainnet: {
      url: env.string("RPC_OPT_MAINNET", ""),
    },
    opt_sepolia: {
      url: env.string("RPC_OPT_SEPOLIA", ""),
    },

    // Optimism Fork Chains
    opt_mainnet_fork: {
      url: "http://localhost:9545",
    },
    opt_sepolia_fork: {
      url: "http://localhost:9545",
    },
  },
  gasReporter: {
    enabled: env.string("REPORT_GAS", "false") !== "false",
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      mainnet: env.string("ETHERSCAN_API_KEY_ETH", ""),
      sepolia: env.string("ETHERSCAN_API_KEY_ETH", ""),
      optimisticEthereum: env.string("ETHERSCAN_API_KEY_OPT", ""),
      "opt_sepolia": env.string("ETHERSCAN_API_KEY_OPT", ""),
    },

    customChains: [
        {
          network: 'sepolia',
          chainId: 11155111,
          urls: {
            apiURL: 'https://api-sepolia.etherscan.io/api',
            browserURL: 'https://sepolia.etherscan.io',
          },
        },
        {
            network: 'opt_sepolia',
            chainId: 11155420,
            urls: {
              apiURL: 'https://api-sepolia-optimism.etherscan.io/api',
              browserURL: 'https://sepolia-optimism.etherscan.io',
            },
          },
      ],
  },
  typechain: {
    externalArtifacts: [
      "./interfaces/**/*.json",
      "./utils/optimism/artifacts/*.json",
    ],
  },
  mocha: {
    timeout: 20 * 60 * 60 * 1000, // 20 minutes for e2e tests
  },
};

export default config;
