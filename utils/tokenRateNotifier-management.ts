
import { Signer, Wallet } from "ethers";
import { TokenRateNotifier, TokenRateNotifier__factory } from "../typechain";
import { JsonRpcProvider } from "@ethersproject/providers";
import chalk from "chalk";

interface Logger {
  log(message: string): void;
}

export interface TokenRateNotifierSetupConfig {
  tokenRateNotifier: string;
  opStackTokenRatePusher: string;
  ethDeployer: Wallet;
  ethProvider: JsonRpcProvider;
  notifierOwner: string;
}

export class TokenRateNotifierManagement {

  public readonly tokenRateNotifier: TokenRateNotifier;
  private readonly logger: TokenRateNotifierManagementLogger;

  constructor(
    address: string,
    admin: Wallet | Signer,
    options: { logger?: Logger } = {}
  ) {
    this.tokenRateNotifier = TokenRateNotifier__factory.connect(address, admin);
    this.logger = new TokenRateNotifierManagementLogger(options?.logger);
  }

  async setup(config: TokenRateNotifierSetupConfig) {
    const tokenRateNotifier = TokenRateNotifier__factory.connect(
      config.tokenRateNotifier,
      config.ethProvider
    );
    await tokenRateNotifier
      .connect(config.ethDeployer)
      .addObserver(config.opStackTokenRatePusher);

    this.logger.logAddObserver(config);
    this.logger.logStepDone();

    await this.tokenRateNotifier.transferOwnership(config.notifierOwner);

    this.logger.logTransferOwnership(config);
    this.logger.logStepDone();
  }
}

class TokenRateNotifierManagementLogger {
  private readonly logger?: Logger;
  constructor(logger?: Logger) {
    this.logger = logger;
  }

  logAddObserver(config: TokenRateNotifierSetupConfig) {
    this.logger?.log(`Add observer to Notifier:`);
    this.logger?.log(
      `  ${chalk.cyan.italic("· notifier")} ${chalk.green(config.tokenRateNotifier)}`
    );
    this.logger?.log(
      `  ${chalk.cyan.italic("· observer")} ${chalk.green(config.opStackTokenRatePusher)}`
    );
  }

  logTransferOwnership(config: TokenRateNotifierSetupConfig) {
    this.logger?.log(`Transfer Notifier ownership:`);
    this.logger?.log(
      `  ${chalk.cyan.italic("· from")} ${chalk.green(config.ethDeployer.address)}`
    );
    this.logger?.log(
      `  ${chalk.cyan.italic("· to")} ${chalk.green(config.notifierOwner)}`
    );
  }

  logStepDone() {
    this.logger?.log(`[${chalk.greenBright("DONE")}]\n`);
  }
}
