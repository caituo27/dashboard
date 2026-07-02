import freelancerAgreementMarkdown from "./agreements/freelancer-service-agreement.md?raw";
import privacyPolicyMarkdown from "./agreements/privacy-policy.md?raw";
import userAgreementMarkdown from "./agreements/user-agreement.md?raw";

export type AgreementDocumentKey = "user" | "privacy" | "freelancer";

export type AgreementDocument = {
  key: AgreementDocumentKey;
  title: string;
  tabLabel: string;
  markdown: string;
};

export const userAgreementDocument: AgreementDocument = {
  key: "user",
  title: "Sprix AI 用户协议",
  tabLabel: "用户协议",
  markdown: userAgreementMarkdown
};

export const privacyPolicyDocument: AgreementDocument = {
  key: "privacy",
  title: "Sprix AI 隐私政策",
  tabLabel: "隐私政策",
  markdown: privacyPolicyMarkdown
};

export const freelancerAgreementDocument: AgreementDocument = {
  key: "freelancer",
  title: "Sprix AI 自由职业者服务框架协议",
  tabLabel: "自由职业者协议",
  markdown: freelancerAgreementMarkdown
};

export const agreementDocuments = [
  userAgreementDocument,
  privacyPolicyDocument,
  freelancerAgreementDocument
] as const;

export function getAgreementDocument(key: AgreementDocumentKey) {
  return agreementDocuments.find((document) => document.key === key) ?? userAgreementDocument;
}
