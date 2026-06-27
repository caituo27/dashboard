import type { SprixState } from "../types";

function hasInitialAuthToken() {
  if (typeof localStorage === "undefined") return false;
  return Boolean(localStorage.getItem("sprix-auth-token"));
}

export function createInitialSprixState(): SprixState {
  return {
    account: {
      isLoggedIn: hasInitialAuthToken(),
      nickname: "",
      email: "",
      maskedPhone: "",
      phone: "",
      phoneVerified: false,
      qualificationStatus: "未开通",
      realPersonVerified: false,
      freelancerAgreementSigned: false,
      alipayBound: false,
      alipayAccountMasked: "",
      alipayRealNameMatched: false,
      withdrawAccountStatus: "未绑定",
      withdrawableAmount: 0
    },
    agents: [],
    tasks: [],
    myTasks: [],
    adminExecutionRecords: {},
    adminAppeals: [],
    settlements: [],
    withdrawals: [],
    payouts: [],
    fundExceptions: [],
    fundFlows: [],
    signedAgreements: []
  };
}

export function logOut(state: SprixState): SprixState {
  const empty = createInitialSprixState();
  return {
    ...empty,
    account: {
      ...empty.account,
      isLoggedIn: false
    },
    tasks: state.tasks
  };
}
