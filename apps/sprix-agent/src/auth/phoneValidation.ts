export const mainlandPhonePattern = /^1[3-9]\d{9}$/;
export const phoneNumberMaxLength = 11;
export const verificationCodeLength = 4;
export const verificationCodeMaxLength = verificationCodeLength;

export function normalizePhoneNumber(value: unknown) {
  return String(value ?? "").trim();
}

export function isValidPhoneNumber(value: unknown) {
  return mainlandPhonePattern.test(normalizePhoneNumber(value));
}

export function getPhoneNumberValidationMessage(value: unknown) {
  const phone = normalizePhoneNumber(value);
  if (!phone) return "请输入手机号";
  if (!isValidPhoneNumber(phone)) return "请输入正确的手机号";
  return "";
}

export const phoneNumberRules = [
  { required: true, message: "请输入手机号" },
  {
    validator: async (_: unknown, value: unknown) => {
      if (!normalizePhoneNumber(value)) return;
      const message = getPhoneNumberValidationMessage(value);
      if (message) throw new Error(message);
    }
  }
];

export const smsCodeRules = [
  { required: true, message: "请输入验证码" },
  { len: verificationCodeLength, message: "请输入完整验证码" },
  { pattern: /^\d+$/, message: "验证码只能输入数字" }
];
