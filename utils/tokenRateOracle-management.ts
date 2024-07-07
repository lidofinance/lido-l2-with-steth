import hre from "hardhat";
import chalk from "chalk";
import { ContractTransaction, Signer, Wallet, BigNumber } from "ethers";
import { getRoleHolders } from "./testing";
import network from "./network";
import { TokenRateOracle, TokenRateOracle__factory } from "../typechain";

interface Logger {
  log(message: string): void;
}

export interface TokenRateOracleSetupConfig {
  tokenRateOracleAdmin: string;
  initialTokenRateValue: BigNumber;
  initialTokenRateL1Timestamp: BigNumber;
  rateUpdatesEnabled: boolean;
  rateUpdatesEnablers?: string[];
  rateUpdatesDisablers?: string[];
}

type TokenRateOracleRoleName =
  | "DEFAULT_ADMIN_ROLE"
  | "RATE_UPDATE_DISABLER_ROLE"
  | "RATE_UPDATE_ENABLER_ROLE";

export class TokenRateOracleRole {
  public static get DEFAULT_ADMIN_ROLE() {
    return new TokenRateOracleRole("DEFAULT_ADMIN_ROLE");
  }

  public static get RATE_UPDATE_DISABLER_ROLE() {
    return new TokenRateOracleRole("RATE_UPDATE_DISABLER_ROLE");
  }

  public static get RATE_UPDATE_ENABLER_ROLE() {
    return new TokenRateOracleRole("RATE_UPDATE_ENABLER_ROLE");
  }

  public readonly name: TokenRateOracleRoleName;
  public readonly hash: string;

  private constructor(name: TokenRateOracleRoleName) {
    this.name = name;

    if (name === "DEFAULT_ADMIN_ROLE") {
      this.hash = "0x0000000000000000000000000000000000000000000000000000000000000000";
    } else if (name === "RATE_UPDATE_ENABLER_ROLE") {
      this.hash = hre.ethers.utils.id(`TokenRafteOracle.${name}`);
    } else {
      this.hash = hre.ethers.utils.id(`TokenRateOracle.${name}`);
    }
  }
}
export class TokenRateOracleManagement {

  private readonly admin: Wallet | Signer;
  public readonly tokenRateOracle: TokenRateOracle;
  private readonly logger: TokenRateOracleManagementLogger;

  static async getAdmins(tokenRateOracle: TokenRateOracle) {
    const adminAddresses = await getRoleHolders(
      tokenRateOracle,
      TokenRateOracleRole.DEFAULT_ADMIN_ROLE.hash
    );
    return Array.from(adminAddresses);
  }

  constructor(
    address: string,
    admin: Wallet | Signer,
    options: { logger?: Logger } = {}
  ) {
    this.tokenRateOracle = TokenRateOracle__factory.connect(address, admin);
    this.logger = new TokenRateOracleManagementLogger(options?.logger);
    this.admin = admin;
  }

  async setup(config: TokenRateOracleSetupConfig) {

    const adminAddress = await this.admin.getAddress();

    await this.grantTokenRateOracleRoles({
      ...config,
      rateUpdatesEnablers: config.rateUpdatesEnabled
        ? [adminAddress, ...(config.rateUpdatesEnablers || [])]
        : config.rateUpdatesEnablers,
    });

    if (config.rateUpdatesEnabled) {
      const isPaused = await this.tokenRateOracle.isTokenRateUpdatesPaused();
      if (isPaused) {
        await this.unpauseTokenRateUpdates(config);
      }
      await this.renounceRole(TokenRateOracleRole.RATE_UPDATE_ENABLER_ROLE);
    }

    if (config.tokenRateOracleAdmin !== adminAddress) {
      await this.grantRole(TokenRateOracleRole.DEFAULT_ADMIN_ROLE, [
        config.tokenRateOracleAdmin,
      ]);
      await this.renounceRole(TokenRateOracleRole.DEFAULT_ADMIN_ROLE);
    }
  }

  async grantTokenRateOracleRoles(params: TokenRateOracleSetupConfig) {
    await this.grantRole(
      TokenRateOracleRole.RATE_UPDATE_DISABLER_ROLE,
      params.rateUpdatesDisablers || []
    );

    await this.grantRole(
      TokenRateOracleRole.RATE_UPDATE_ENABLER_ROLE,
      params.rateUpdatesEnablers || []
    );
  }

  async grantRole(role: TokenRateOracleRole, accounts: string[]) {
    for (const account of accounts) {
      this.logger.logGrantRole(role, account);
      const tx = await this.tokenRateOracle.grantRole(role.hash, account);
      this.logger.logTxWaiting(tx);
      await tx.wait();
      this.logger.logStepDone();
    }
  }

  async renounceRole(role: TokenRateOracleRole) {
    const adminAddress = await this.admin.getAddress();
    this.logger.logRenounceRole(role, adminAddress);
    const tx = await this.tokenRateOracle.renounceRole(role.hash, adminAddress);
    this.logger.logTxWaiting(tx);
    await tx.wait();
    this.logger.logStepDone();
  }

  async unpauseTokenRateUpdates(params: TokenRateOracleSetupConfig) {
    this.logger.logEnableUpdates();
    const tx = await this.tokenRateOracle.resumeTokenRateUpdates(
      params.initialTokenRateValue,
      params.initialTokenRateL1Timestamp
    );
    this.logger.logTxWaiting(tx);
    await tx.wait();
    this.logger.logStepDone();
  }
}

class TokenRateOracleManagementLogger {
  private readonly logger?: Logger;
  constructor(logger?: Logger) {
    this.logger = logger;
  }

  logRenounceRole(role: TokenRateOracleRole, account: string) {
    this.logger?.log(`Renounce role ${chalk.yellowBright(role.name)}:`);
    this.logger?.log(
      `  ${chalk.cyan.italic("· role")} ${chalk.green(role.hash)}`
    );
    this.logger?.log(
      `  ${chalk.cyan.italic("· account")} ${chalk.green.underline(account)}`
    );
  }

  logGrantRole(role: TokenRateOracleRole, account: string) {
    this.logger?.log(`Grant role ${chalk.yellowBright(role.name)}:`);
    this.logger?.log(
      `  ${chalk.cyan.italic("· role")} ${chalk.green(role.hash)}`
    );
    this.logger?.log(
      `  ${chalk.cyan.italic("· account")} ${chalk.green.underline(account)}`
    );
  }

  logTxWaiting(tx: ContractTransaction) {
    this.logger?.log(`Waiting for tx: ${getBlockExplorerTxLinkByChainId(tx)}`);
  }

  logStepDone() {
    this.logger?.log(`[${chalk.greenBright("DONE")}]\n`);
  }

  logSetupTitle(bridgingManagerAddress: string) {
    this.logger?.log(
      chalk.bold(`Setup TokenRateOracle Manager :: ${bridgingManagerAddress}`)
    );
  }

  logEnableUpdates() {
    this.logger?.log(`Enable updates`);
  }
}

function getBlockExplorerTxLinkByChainId(tx: ContractTransaction) {
  const baseURL = network.blockExplorerBaseUrl(tx.chainId);
  return baseURL ? chalk.gray.underline(`${baseURL}/tx/${tx.hash}`) : tx.hash;
}

