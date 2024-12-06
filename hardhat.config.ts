import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-verify";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

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
    l1: {
      url: env.string("L1_PRC", ""),
    },
    l2: {
      url: env.string("L2_PRC", ""),
    },
    l1_fork: {
      url: "http://localhost:8545"
    },
    l2_fork: {
      url: "http://localhost:9545"
    }
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
      "uni_sepolia": env.string("ETHERSCAN_API_KEY_OPT", ""),
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
        {
          network: 'uni_sepolia',
          chainId: 1301,
          urls: {
            apiURL: 'https://unichain-sepolia.blockscout.com/api',
            browserURL: 'https://unichain-sepolia.blockscout.com/',
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
