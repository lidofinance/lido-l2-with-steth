import env from "../env";

export default function addresses() {
  return {
    L1CrossDomainMessenger: env.string("L1_CROSSDOMAIN_MESSENGER", ""),
    L2CrossDomainMessenger: env.string("L2_CROSSDOMAIN_MESSENGER", "")
  };
}

