import env from "../../utils/env";
import network from "../../utils/network";
import { GovBridgeExecutor__factory } from "../../typechain";
import testing from "../../utils/testing";

async function main() {

  const isForking = true;

  const GOV_BRIDGE_EXECUTOR = testing.env.OPT_GOV_BRIDGE_EXECUTOR();

  const [, optRunner] = network.getSigners(env.privateKey(), {
    forking: isForking,
  });

  const govBridgeExecutor = GovBridgeExecutor__factory.connect(
    GOV_BRIDGE_EXECUTOR,
    optRunner
  );

  const voteId = (await govBridgeExecutor.getActionsSetCount()).toNumber() - 1;
  console.log(`New vote id ${voteId.toString()}`);

  const executeTx = await govBridgeExecutor.execute(voteId, {
    gasLimit: 2000000,
  });
  await executeTx.wait();
  console.log("executeTx=",executeTx);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
