import { ethers, Contract } from "ethers";
import env from "../../utils/env";
import network from "../../utils/network";
import addresses from "../../utils/optimism/addresses";
import { Bytes } from "@ethersproject/bytes";
import testing from "../../utils/testing";

// 1. monitor L1 for TransactionDeposited event
// 2. decode calldata
// 3. send it to L2
async function main() {
  console.log("Run Relayer");

  const networkName = env.network();
  const ethOptNetwork = network.multichain(["eth", "opt"], networkName);
  const [, optProvider] = ethOptNetwork.getProviders({ forking: true });
  const optAddresses = addresses(networkName);

  const ethProviderUrl = 'ws://localhost:8545';
  const wsEthProvider = new ethers.providers.WebSocketProvider(ethProviderUrl);

  // 1. Catch Event
  const optimismPortalAddress = "0x16Fc5058F25648194471939df75CF27A2fdC48BC";

  const l1OptimismPortalAbi = [
    "event TransactionDeposited(address indexed from, address indexed to, uint256 indexed version, bytes opaqueData)"
  ];
  const contract = new Contract(optimismPortalAddress, l1OptimismPortalAbi, wsEthProvider);
  contract.on('TransactionDeposited', (from, to, version, opaqueData) => {
    console.log('TransactionDeposited event triggered:', {
      from: from,
      to: to,
      version: version.toString(),
      opaqueData: opaqueData,
    });

    // 2. fetch message from event
    // 2.1 opaqueData -> _data
    const opaqueDataBytes: Bytes = opaqueData;
    console.log('opaqueDataBytes=', opaqueDataBytes);

    const dataOffset = 32 + 32 + 8 + 1;
    const txDataLen = opaqueDataBytes.length - dataOffset;

    const dataToSend = ethers.utils.hexDataSlice(opaqueDataBytes, dataOffset, dataOffset + txDataLen);
    console.log('dataToSend=', dataToSend);

    // 3. Send data
    const l1CrossDomainMessengerAliased = testing.accounts.applyL1ToL2Alias(optAddresses.L1CrossDomainMessenger);
    console.log('l1CrossDomainMessengerAliased=', l1CrossDomainMessengerAliased);

    const txArg = {
      to: optAddresses.L2CrossDomainMessenger.toLowerCase(),
      from: l1CrossDomainMessengerAliased.toLowerCase(),
      data: dataToSend,
      gasLimit: ethers.utils.hexlify(1000000)
    }
    optProvider.getSigner(l1CrossDomainMessengerAliased).sendTransaction(txArg);
  });

  // 4. Listen to L2 RelayedMessage event
  const optProviderUrl = 'ws://localhost:9545';
  const wsOptProvider = new ethers.providers.WebSocketProvider(optProviderUrl);

  const messengerAbi = [
    "event RelayedMessage(bytes32 indexed msgHash)",
    "event FailedRelayedMessage(bytes32 indexed msgHash)"
  ];
  const contractM = new Contract(optAddresses.L2CrossDomainMessenger, messengerAbi, wsOptProvider);
  contractM.on('RelayedMessage', (target) => {
    console.log('RelayedMessage event triggered:', {
      target: target
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
