import { ethers, Contract } from "ethers";
import env from "../../utils/env";
import network from "../../utils/network";
import addresses from "../../utils/optimism/addresses";
import { Bytes } from "@ethersproject/bytes";
import testing from "../../utils/testing";
import { wei } from "../../utils/wei";
import { L2CrossDomainMessenger__factory } from "../../typechain";

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

  const l1CrossDomainMessengerAliased = await testing.impersonate(
    testing.accounts.applyL1ToL2Alias(optAddresses.L1CrossDomainMessenger),
    optProvider
  );
  console.log('l1CrossDomainMessengerAliased=', l1CrossDomainMessengerAliased);

  await testing.setBalance(
    await l1CrossDomainMessengerAliased.getAddress(),
    wei.toBigNumber(wei`1 ether`),
    optProvider
  );

  // 1. Catch Event
  const optimismPortalAddress = "0x16Fc5058F25648194471939df75CF27A2fdC48BC";

  const l1MessngerAbi = [
    "event SentMessage(address indexed target, address sender, bytes message, uint256 messageNonce, uint256 gasLimit)"
  ];
  const contractZ = new Contract(optAddresses.L1CrossDomainMessenger, l1MessngerAbi, wsEthProvider);
  contractZ.on('SentMessage', (target, sender, message, messageNonce, gasLimit) => {
    console.log('SentMessage event triggered:', {
      target: target,
      sender: sender,
      message: message.toString(),
      messageNonce: messageNonce,
      gasLimit: gasLimit
    });
  });

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

    const relayMessageInterface = new ethers.utils.Interface(['function relayMessage(uint256 _nonce,address _sender,address _target,uint256 _value,uint256 _minGasLimit,bytes calldata _message)']);
    const decodedRelayMessageArgs = relayMessageInterface.decodeFunctionData('relayMessage', dataToSend)
    console.log('relayMessage function decodedArgs=', decodedRelayMessageArgs);

    const _target = decodedRelayMessageArgs['_target'];
    const _sender = decodedRelayMessageArgs['_sender'];
    const _value = decodedRelayMessageArgs['_value'];
    const _nonce = decodedRelayMessageArgs['_nonce'];
    const _minGasLimit = 300_000;
    const _message = decodedRelayMessageArgs['_message'];

    const queueInterface = new ethers.utils.Interface(['function queue(address[] memory targets, uint256[] memory values,string[] memory signatures,bytes[] memory calldatas,bool[] memory withDelegatecalls)']);
    const decodedQueueArgs = queueInterface.decodeFunctionData('queue', _message)
    console.log('queue function decodedArgs=', decodedQueueArgs);


    // 3. Send data
    const l2CrossDomainMessenger = L2CrossDomainMessenger__factory.connect(
      optAddresses.L2CrossDomainMessenger,
      optProvider
    );
    void (async () => {
      const tx = await l2CrossDomainMessenger.connect(l1CrossDomainMessengerAliased).relayMessage(
        _nonce,
        _sender,
        _target,
        _value,
        _minGasLimit,
        _message,
        { gasLimit: 5_000_000 }
      );
      console.log("tx=",tx);
    })();
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
  contractM.on('FailedRelayedMessage', (target) => {
    console.log('FailedRelayedMessage event triggered:', {
      target: target
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
