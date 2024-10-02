import { BigNumber } from 'ethers'
import { wei } from "../../utils/wei";
import { scenario } from "../../utils/testing";
import { bridgingTestsSuit, ctxFactory } from "./_bridging-non-rebasable";

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging X non-rebasable token integration test",
    ctxFactory(
      true,
      false,
      wei.toBigNumber(wei`0.001 ether`),
      wei.toBigNumber(wei`0.001 ether`)
    )
  )
);

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging 1 wei non-rebasable token integration test",
    ctxFactory(
      true,
      false,
      wei.toBigNumber(wei`1 wei`),
      wei.toBigNumber(wei`1 wei`)
    )
  )
);

bridgingTestsSuit(
  scenario(
    "Optimism :: Bridging zero non-rebasable token integration test",
    ctxFactory(
      true,
      false,
      BigNumber.from('0'),
      BigNumber.from('0')
    )
  )
);
