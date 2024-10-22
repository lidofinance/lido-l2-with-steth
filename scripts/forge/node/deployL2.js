require("dotenv").config();
const { execSync } = require("child_process");

const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
const rpcUrl = process.env.L2_RPC_URL;
const etherscanApiKey = process.env.OPTIMISM_API_KEY_ETH;

const command = `forge script scripts/forge/DeployL2Contracts.s.sol:DeployL2Contracts --private-key ${privateKey} --rpc-url ${rpcUrl} --broadcast --verify --etherscan-api-key ${etherscanApiKey} -vvvv`;
execSync(command, { stdio: "inherit" });
