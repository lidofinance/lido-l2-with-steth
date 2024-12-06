import contracts from "./contracts";
import network from "../network";
import { CommonOptions } from "./types";
import { CrossChainMessenger, MessageStatus } from "@eth-optimism/sdk";

interface ContractsOptions extends CommonOptions {
  forking: boolean;
}

interface MessageData {
  sender: string;
  recipient: string;
  calldata: string;
  gasLimit?: number;
}

export default function messaging(
  options: ContractsOptions
) {
  const [ethProvider, optProvider] = network
    .getProviders(options);

  const optContracts = contracts(options);
  const crossChainMessenger = new CrossChainMessenger({
    l1ChainId: network.chainId("l1"),
    l2ChainId: network.chainId("l2"),
    l1SignerOrProvider: ethProvider,
    l2SignerOrProvider: optProvider,
  });
  return {
    prepareL2Message(msg: MessageData) {
      const calldata =
        optContracts.L1CrossDomainMessenger.interface.encodeFunctionData(
          "sendMessage",
          [msg.recipient, msg.calldata, msg.gasLimit || 1_000_000]
        );
      return { calldata, callvalue: 0 };
    },
    async waitForL2Message(txHash: string) {
      await crossChainMessenger.waitForMessageStatus(
        txHash,
        MessageStatus.RELAYED
      );
    },
  };
}
