import { assert } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";
import "../../utils/testing";

const NAME = "Test signing domain";
const VERSION = "1";
const SYMBOL = "TEST";

async function domainOf(token: Contract) {
  const { fields, name, version, chainId, verifyingContract, salt, extensions } = await token.eip712Domain();
  assert.equal(fields, "0x0f");
  assert.equal(verifyingContract, token.address);
  assert.equal(salt, ethers.constants.HashZero);
  assert.isEmpty(extensions);
  const domain = { name, version, chainId, verifyingContract };
  assert.equal(ethers.utils._TypedDataEncoder.hashDomain(domain), await token.DOMAIN_SEPARATOR());
  return domain;
}

for (const contractName of ["ERC20BridgedPermit", "ERC20RebasableBridgedPermit"]) {
  describe(`${contractName} domain consistency`, () => {
    async function deployImplementation() {
      const [admin] = await ethers.getSigners();
      const factory = await ethers.getContractFactory(contractName);
      if (contractName === "ERC20BridgedPermit") {
        return factory.deploy(NAME, SYMBOL, VERSION, 18);
      }
      // The constructor only needs decimals() from the oracle for these permit tests.
      const metadata = await (await ethers.getContractFactory("ERC20BridgedPermit"))
        .deploy(NAME, SYMBOL, VERSION, 18);
      return factory.deploy(NAME, SYMBOL, VERSION, 18, metadata.address, metadata.address, admin.address);
    }

    for (const [name, version] of [["Wrong name", VERSION], [NAME, "Wrong version"]]) {
      it(`rejects initialization with domain ${name}/${version} and allows retry`, async () => {
        const [admin] = await ethers.getSigners();
        const implementation = await deployImplementation();
        const proxy = await (await ethers.getContractFactory("OssifiableProxy"))
          .deploy(implementation.address, admin.address, "0x");
        const token = implementation.attach(proxy.address);

        await assert.revertsWith(token.initialize(name, SYMBOL, version), "ErrorEIP712DomainMismatch()");
        assert.equal((await token.getContractVersion()).toString(), "0");
        await token.initialize(NAME, SYMBOL, VERSION);
        await domainOf(token);
      });
    }

    it("preserves the domain, nonce and pending permit across a matching implementation upgrade", async () => {
      const [admin, spender] = await ethers.getSigners();
      const implementation = await deployImplementation();
      await domainOf(implementation);
      const proxy = await (await ethers.getContractFactory("OssifiableProxy"))
        .deploy(implementation.address, admin.address,
          implementation.interface.encodeFunctionData("initialize", [NAME, SYMBOL, VERSION]));
      const token = implementation.attach(proxy.address);
      const domain = await domainOf(token);
      const types = { Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ] };
      const message = {
        owner: admin.address, spender: spender.address, value: 42,
        nonce: 0, deadline: ethers.constants.MaxUint256,
      };
      const signature = await admin._signTypedData(domain, types, message);
      const permit = token["permit(address,address,uint256,uint256,bytes)"];
      await permit(admin.address, spender.address, message.value, message.deadline, signature);
      const pending = await admin._signTypedData(domain, types, { ...message, nonce: 1 });

      const replacement = await deployImplementation();
      await proxy.proxy__upgradeTo(replacement.address);
      assert.deepEqual(await domainOf(token), domain);
      assert.equal((await token.nonces(admin.address)).toString(), "1");
      await permit(admin.address, spender.address, message.value, message.deadline, pending);
      assert.equal((await token.nonces(admin.address)).toString(), "2");
      assert.equal((await token.allowance(admin.address, spender.address)).toString(), "42");
    });
  });
}

describe("ERC20BridgedPermit upgrade finalization domain consistency", () => {
  for (const [name, version] of [["Wrong name", VERSION], [NAME, "Wrong version"]]) {
    it(`rejects finalization with domain ${name}/${version} atomically`, async () => {
      const [admin] = await ethers.getSigners();
      const oldImplementation = await (await ethers.getContractFactory("ERC20BridgedWithInitializerStub"))
        .deploy(NAME, SYMBOL, 18);
      const proxy = await (await ethers.getContractFactory("OssifiableProxy"))
        .deploy(oldImplementation.address, admin.address,
          oldImplementation.interface.encodeFunctionData("initializeERC20Metadata", [NAME, SYMBOL]));
      const implementation = await (await ethers.getContractFactory("ERC20BridgedPermit"))
        .deploy(NAME, SYMBOL, VERSION, 18);

      await assert.revertsWith(proxy.proxy__upgradeToAndCall(implementation.address,
        implementation.interface.encodeFunctionData("finalizeUpgrade_v2", [name, version]), false),
      "ErrorEIP712DomainMismatch()");
      assert.equal(await proxy.proxy__getImplementation(), oldImplementation.address);

      await proxy.proxy__upgradeToAndCall(implementation.address,
        implementation.interface.encodeFunctionData("finalizeUpgrade_v2", [NAME, VERSION]), false);
      const token = implementation.attach(proxy.address);
      assert.equal((await token.getContractVersion()).toString(), "2");
      await domainOf(token);
    });
  }
});
