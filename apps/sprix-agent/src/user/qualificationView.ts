import type { Account } from "../types";
import type { FaceVerificationSession } from "../apis/sprix";

export type QualificationRecordRow = {
  label: string;
  value: string;
  variant?: "status" | "text";
};

export type FaceVerificationStartState =
  | {
      kind: "redirect";
      url: string;
      message: string;
    }
  | {
      kind: "pending";
      message: string;
    };

const pending = "待后端返回";

export type QualificationStep = 0 | 1 | 2;

export function getQualificationStep(account: Pick<Account, "realPersonVerified" | "freelancerAgreementSigned">): QualificationStep {
  if (!account.realPersonVerified) {
    return 0;
  }
  if (!account.freelancerAgreementSigned) {
    return 1;
  }
  return 2;
}

export function getQualificationRecordRows(account: Account): QualificationRecordRow[] {
  return [
    { label: "接单资格", value: account.qualificationStatus },
    { label: "支付宝人脸核验", value: account.realPersonVerified ? "已完成" : "未完成" },
    { label: "服务协议", value: account.freelancerAgreementSigned ? "已签署" : "未签署" },
    { label: "签署时间", value: account.freelancerAgreementSignedAt || "-", variant: "text" }
  ];
}

export function getFaceVerificationStartState(session: FaceVerificationSession | undefined): FaceVerificationStartState {
  const webUrl = session?.webUrl?.trim();

  if (webUrl) {
    return {
      kind: "redirect",
      url: webUrl,
      message: "请在打开的支付宝人脸核验页面完成认证，完成后返回 Sprix 查看资格状态。"
    };
  }

  return {
    kind: "pending",
    message: "支付宝人脸核验页面地址待后端返回。"
  };
}
