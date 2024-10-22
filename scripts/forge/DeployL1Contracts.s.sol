// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {Script} from "forge-std/Script.sol";
import {TokenRateNotifier} from "contracts/lido/TokenRateNotifier.sol";
import {OpStackTokenRatePusher} from "contracts/optimism/OpStackTokenRatePusher.sol";
import {L1LidoTokensBridge} from "contracts/optimism/L1LidoTokensBridge.sol";
import {OssifiableProxy} from "contracts/proxy/OssifiableProxy.sol";
import {Address} from "./utils/Address.sol";
import {Broadcast} from "./utils/Broadcast.sol";

contract DeployL1Contracts is Script, Address, Broadcast {
    address public deployerAddress = vm.envAddress("DEPLOYER_ADDRESS");
    uint256 public deployerL2Nonce = vm.envUint("L2_NONCE");
    address public owner = vm.envAddress("L1_PROXY_ADMIN_ADDRESS");
    address public lidoCore = vm.envAddress("STETH_ADDRESS");
    address public l1TokenNonRebasable = vm.envAddress("WSTETH_ADDRESS");
    address public optimismMessenger = vm.envAddress("OPTIMISTIM_MESSENGER_ADDRESS");
    address public accountingOracle = vm.envAddress("ACCOUNTING_ORACLE_ADDRESS");
    uint32 public gaslimitForPushing = uint32(vm.envUint("GAS_LIMIT_FOR_PUSHING"));

    TokenRateNotifier public notifier;
    OpStackTokenRatePusher public pusher;
    L1LidoTokensBridge public l1BridgeImpl;
    OssifiableProxy public l1BridgeProxy;

    function run() external broadcast {
        /// Get predicted L2 addresses
        address[] memory predictedAddresses = _getSetOfPredictedAddresses(deployerAddress, deployerL2Nonce, 9);
        address predictedOracle = predictedAddresses[1];
        address predictedWstETH = predictedAddresses[3];
        address predictedStETH = predictedAddresses[5];
        address predictedBridge = predictedAddresses[7];

        /// Rate notifier
        notifier = new TokenRateNotifier(owner, lidoCore);

        /// Rate pusher
        pusher = new OpStackTokenRatePusher(optimismMessenger, l1TokenNonRebasable, accountingOracle, predictedOracle, gaslimitForPushing);

        /// Bridge Impl and Proxy
        l1BridgeImpl = new L1LidoTokensBridge(
            optimismMessenger,
            predictedBridge,
            l1TokenNonRebasable,
            lidoCore,
            predictedWstETH,
            predictedStETH,
            accountingOracle
        );
        l1BridgeProxy = new OssifiableProxy(
            address(l1BridgeImpl),
            owner,
            abi.encodeWithSelector(
                bytes4(keccak256("initialize(address)")),
                owner
            )
        );
    }
}
