// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {Script} from "forge-std/Script.sol";
import {OssifiableProxy} from "contracts/proxy/OssifiableProxy.sol";
import {ERC20BridgedPermit} from "contracts/token/ERC20BridgedPermit.sol";
import {ERC20RebasableBridgedPermit} from "contracts/token/ERC20RebasableBridgedPermit.sol";
import {TokenRateOracle} from "contracts/optimism/TokenRateOracle.sol";
import {L2ERC20ExtendedTokensBridge} from "contracts/optimism/L2ERC20ExtendedTokensBridge.sol";
import {OptimismBridgeExecutor} from "@bridge/contracts/bridges/OptimismBridgeExecutor.sol";
import {Address} from "./utils/Address.sol";
import {Broadcast} from "./utils/Broadcast.sol";

contract DeployL2Contracts is Script, Address, Broadcast {
    address public deployerAddress = vm.envAddress("DEPLOYER_ADDRESS");
    uint256 public deployerL1Nonce = vm.envUint("L1_NONCE");
    uint256 public deployerL2Nonce = vm.envUint("L2_NONCE");

    address public owner = vm.envAddress("L2_PROXY_ADMIN_ADDRESS");
    address public messenger = vm.envAddress("L2_OPTIMISM_MESSENGER");
    address public l1TokenRebasable = vm.envAddress("STETH_ADDRESS");
    address public l1TokenNonRebasable = vm.envAddress("WSTETH_ADDRESS");
    address public guardian = vm.envAddress("GUARDIAN_ADDRESS");

    uint256 public tokenRateOutdatedDelay = vm.envUint("RATE_OUTDATED_DELAY");
    uint256 public maxAllowedL2ToL1ClockLag = vm.envUint("MAX_L2_TO_L1_CLOCK_LAG");
    uint256 public maxAllowedTokenRateDeviationPerDayBp = vm.envUint("MAX_TOKEN_RATE_DEVIATION_PER_DAY_BP");
    uint256 public oldestRateAllowedInPauseTimeSpan = vm.envUint("OLDEST_RATE_IN_PAUSE_TIME_SPAN");
    uint256 public minTimeBetweenTokenRateUpdates = vm.envUint("MIN_TIME_BETWEEN_RATE_UPDATES");
    uint256 public tokenRate = vm.envUint("TOKEN_RATE"); /// wstETH/stETH (normalised for 27 decimals)
    uint256 public delay = vm.envUint("DELAY");
    uint256 public gracePeriod = vm.envUint("GRACE_PERIOD");
    uint256 public minimumDelay = vm.envUint("MINIMUM_DELAY");
    uint256 public maximumDelay = vm.envUint("MAXIMUM_DELAY");

    TokenRateOracle public oracleImpl;
    OssifiableProxy public oracleProxy;

    ERC20BridgedPermit public wstETHImpl;
    OssifiableProxy public wstETHProxy;

    ERC20RebasableBridgedPermit public stETHImpl;
    OssifiableProxy public stETHProxy;

    L2ERC20ExtendedTokensBridge public bridgeImpl;
    OssifiableProxy public bridgeProxy;

    OptimismBridgeExecutor public bridgeExecutor;

    function run() external broadcast {
        /// Get predicted L1 addresses
        address[] memory predictedL1Addresses = _getSetOfPredictedAddresses(deployerAddress, deployerL1Nonce, 4);

        address predictedL1Pusher = predictedL1Addresses[1];
        address predictedL1Bridge = predictedL1Addresses[3];

        /// Get predicted L2 addresses
        address[] memory predictedL2Addresses = _getSetOfPredictedAddresses(deployerAddress, deployerL2Nonce, 9);

        address predictedOracle = predictedL2Addresses[1];
        address predictedL2Bridge = predictedL2Addresses[7];

        oracleImpl = new TokenRateOracle(messenger, predictedL2Bridge,  predictedL1Pusher, tokenRateOutdatedDelay, maxAllowedL2ToL1ClockLag, maxAllowedTokenRateDeviationPerDayBp, oldestRateAllowedInPauseTimeSpan, minTimeBetweenTokenRateUpdates);
        oracleProxy = new OssifiableProxy(
            address(oracleImpl),
            owner,
            abi.encodeWithSelector(
                bytes4(keccak256("initialize(address,uint256,uint256)")),
                owner,
                tokenRate,
                block.timestamp
            )
        );

        wstETHImpl = new ERC20BridgedPermit("wstETH", "WSTETH", "0", 18, predictedL2Bridge);
        wstETHProxy = new OssifiableProxy(
            address(wstETHImpl),
            owner,
            abi.encodeWithSelector(
                bytes4(keccak256("initialize(string,string,string)")),
                "wstETH",
                "WSTETH",
                "0"
            )
        );

        stETHImpl = new ERC20RebasableBridgedPermit("stETH", "STETH", "0", 18, address(wstETHProxy), predictedOracle, predictedL2Bridge);
        stETHProxy = new OssifiableProxy(
            address(stETHImpl),
            owner,
            abi.encodeWithSelector(
                bytes4(keccak256("initialize(string,string,string)")),
                "stETH",
                "STETH",
                "0"
            )
        );

        bridgeImpl = new L2ERC20ExtendedTokensBridge(messenger, predictedL1Bridge, l1TokenNonRebasable, l1TokenRebasable, address(wstETHProxy), address(stETHProxy));
        bridgeProxy = new OssifiableProxy(
            address(bridgeImpl),
            owner,
            abi.encodeWithSelector(
                bytes4(keccak256("initialize(address)")),
                owner
            )
        );

        bridgeExecutor = new OptimismBridgeExecutor(messenger, owner, delay, gracePeriod, minimumDelay, maximumDelay, guardian);
    }
}
