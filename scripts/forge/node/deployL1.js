require("dotenv").config();
const { execSync } = require("child_process");

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const rpcUrl = process.env.L1_RPC_URL;
const etherscanApiKey = process.env.ETHERSCAN_API_KEY_ETH;

const command = `forge script scripts/forge/DeployL1Contracts.s.sol:DeployL1Contracts --private-key ${privateKey} --rpc-url ${rpcUrl} --broadcast --verify --etherscan-api-key ${etherscanApiKey} -vvvv`;
execSync(command, { stdio: "inherit" });
