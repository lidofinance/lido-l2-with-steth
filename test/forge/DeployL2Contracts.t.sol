// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {TestUtils} from "./utils/TestUtils.t.sol";
import {DeployL2Contracts} from "@scripts/DeployL2Contracts.s.sol";

contract DeployL2ContractsTest is TestUtils {
    address public deployer = vm.envAddress("DEPLOYER_ADDRESS");
    uint256 public l2Nonce = vm.envUint("L2_NONCE");

    DeployL2Contracts public deployL2;

    function setUp() public override {
        forkNetwork("L2_RPC_URL");
        super.setUp();
        deployL2 = new DeployL2Contracts();
        deployL2.run();
    }

    function testInit() public {
        assertEq(address(deployL2.oracleImpl()), _addressFrom(deployer, l2Nonce));
        assertEq(address(deployL2.oracleProxy()), _addressFrom(deployer, ++l2Nonce));
        assertEq(address(deployL2.wstETHImpl()), _addressFrom(deployer, ++l2Nonce));
        assertEq(address(deployL2.wstETHProxy()), _addressFrom(deployer, ++l2Nonce));
        assertEq(address(deployL2.stETHImpl()), _addressFrom(deployer, ++l2Nonce));
        assertEq(address(deployL2.stETHProxy()), _addressFrom(deployer, ++l2Nonce));
        assertEq(address(deployL2.bridgeImpl()), _addressFrom(deployer, ++l2Nonce));
        assertEq(address(deployL2.bridgeProxy()), _addressFrom(deployer, ++l2Nonce));
        assertEq(address(deployL2.bridgeExecutor()), _addressFrom(deployer, ++l2Nonce));
    }
}
