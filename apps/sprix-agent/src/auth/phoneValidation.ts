export const mainlandPhonePattern = /^1[3-9]\d{9}$/;
export const verificationCodeMaxLength = 6;

export const phoneNumberRules = [
  { required: true, message: "请输入手机号" },
  { pattern: mainlandPhonePattern, message: "请输入正确的手机号" }
];

export const smsCodeRules = [
  { required: true, message: "请输入验证码" },
  { pattern: /^\d{4,6}$/, message: "请输入 4-6 位数字验证码" }
];
