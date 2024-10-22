// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {TestUtils} from "./utils/TestUtils.t.sol";
import {DeployL1Contracts} from "@scripts/DeployL1Contracts.s.sol";

contract DeployL1ContractsTest is TestUtils {
    address public deployer = vm.envAddress("DEPLOYER_ADDRESS");
    uint256 public l1Nonce = vm.envUint("L1_NONCE");

    DeployL1Contracts public deployL1;

    function setUp() public override {
        forkNetwork("L1_RPC_URL");
        super.setUp();
        deployL1 = new DeployL1Contracts();
        deployL1.run();
    }

    function testInit() public prank(deployer) {
        assertEq(address(deployL1.notifier()), _addressFrom(deployer, l1Nonce));
        assertEq(address(deployL1.pusher()), _addressFrom(deployer, ++l1Nonce));
        assertEq(address(deployL1.l1BridgeImpl()), _addressFrom(deployer, ++l1Nonce));
        assertEq(address(deployL1.l1BridgeProxy()), _addressFrom(deployer, ++l1Nonce));
    }
}
