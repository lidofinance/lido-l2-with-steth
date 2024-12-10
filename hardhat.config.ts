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
      url: env.string("L1_PRC_URL", "")
    },
    l2: {
      url: env.string("L2_PRC_URL", "")
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
      "l1": env.string("L1_BLOCK_EXPLORER_API_KEY", ""),
      "l2": env.string("L2_BLOCK_EXPLORER_API_KEY", ""),
    },
    customChains: [
        {
          network: 'l1',
          chainId: env.number("L1_CHAIN_ID"),
          urls: {
            apiURL: `${env.string("L1_BLOCK_EXPLORER_URL")}/api`,
            browserURL: env.string("L1_BLOCK_EXPLORER_URL"),
          },
        },
        {
          network: 'l2',
          chainId: env.number("L2_CHAIN_ID"),
          urls: {
            apiURL: `${env.string("L2_BLOCK_EXPLORER_URL")}/api`,
            browserURL: env.string("L2_BLOCK_EXPLORER_URL"),
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
