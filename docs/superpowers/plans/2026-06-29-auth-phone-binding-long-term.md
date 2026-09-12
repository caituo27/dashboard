# Auth Phone Binding Long-Term Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the long-term login design where SMS sending requires a server-side image challenge, phone is the C-side primary credential, and Alipay/Wechat scan login requires verified phone binding before issuing a token.

**Architecture:** Backend owns all security decisions: challenge generation/validation, SMS issuance, phone account resolution, third-party bind tickets, and token issuance. Frontend only renders the current auth state returned by backend and never verifies CAPTCHA locally.

**Tech Stack:** Spring Boot/JPA/Sa-Token/MockMvc on `SprixServer`; React/TypeScript/Ant Design/Vitest on `SprixPortal`.

---

### Task 1: Backend Account Model

**Files:**
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/account/UserAccount.java`
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/account/IdentityService.java`
- Modify: `SprixServer/backend/src/test/java/ai/sprix/server/AuthSmsLoginTests.java`

- [ ] Write tests proving SMS login creates a `phoneVerified=true` account and a `PHONE` identity.
- [ ] Make `UserAccount.phone` nullable and add `phoneVerified`.
- [ ] Remove all `"未绑定"` writes from identity creation.
- [ ] Update phone-account resolution to mark verified phone accounts and maintain `PHONE` identity.
- [ ] Run `./mvnw test -Dtest=AuthSmsLoginTests`.

### Task 2: Backend Safety Challenge

**Files:**
- Create: `SprixServer/backend/src/main/java/ai/sprix/server/auth/SafetyChallenge.java`
- Create: `SprixServer/backend/src/main/java/ai/sprix/server/auth/SafetyChallengeRepository.java`
- Create: `SprixServer/backend/src/main/java/ai/sprix/server/auth/SafetyChallengeService.java`
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/auth/AuthDtos.java`
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/auth/AuthController.java`
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/auth/AuthService.java`
- Modify: `SprixServer/backend/src/test/java/ai/sprix/server/AuthSmsLoginTests.java`

- [ ] Write tests that `/sms-codes` rejects missing, wrong, expired, or reused challenge.
- [ ] Add `POST /api/v1/auth/safety-challenges`.
- [ ] Generate `IMAGE_ALPHANUMERIC` PNG data URLs and store answer hash only.
- [ ] Require `SMS_LOGIN` challenge for login SMS sending.
- [ ] Run `./mvnw test -Dtest=AuthSmsLoginTests`.

### Task 3: Backend Third-Party Phone Binding

**Files:**
- Create: `SprixServer/backend/src/main/java/ai/sprix/server/auth/PhoneBindTicket.java`
- Create: `SprixServer/backend/src/main/java/ai/sprix/server/auth/PhoneBindTicketRepository.java`
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/auth/AuthDtos.java`
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/auth/AuthController.java`
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/auth/AuthService.java`
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/auth/WechatScanLoginSession.java`
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/auth/AlipayLoginSession.java`
- Modify: `SprixServer/backend/src/main/java/ai/sprix/server/account/IdentityService.java`
- Modify: `SprixServer/backend/src/test/java/ai/sprix/server/AuthAlipayLoginTests.java`
- Modify: `SprixServer/backend/src/test/java/ai/sprix/server/AuthWechatScanLoginTests.java`

- [ ] Write tests that new Alipay/Wechat identities return `PHONE_BIND_REQUIRED` without token.
- [ ] Write tests that phone-bind SMS requires `PHONE_BIND` challenge.
- [ ] Write tests that `phone-bind/confirm` binds the provider identity and returns a token.
- [ ] Implement bind ticket creation, expiry, one-time use, and status responses.
- [ ] Run `./mvnw test -Dtest=AuthAlipayLoginTests,AuthWechatScanLoginTests,AuthSmsLoginTests`.

### Task 4: Frontend Server Challenge

**Files:**
- Modify: `SprixPortal/apps/sprix-agent/src/auth/SafetyChallengeModal.tsx`
- Modify: `SprixPortal/apps/sprix-agent/src/auth/useSmsLogin.ts`
- Modify: `SprixPortal/apps/sprix-agent/src/services/sprixApi.ts`
- Modify: `SprixPortal/apps/sprix-agent/src/components/LoginRegisterModal.test.tsx`

- [ ] Write tests that phone login requests a server challenge and sends `challengeId/challengeAnswer`.
- [ ] Replace local arithmetic challenge with server image challenge rendering.
- [ ] Update `sendSmsCode` signature.
- [ ] Run `pnpm --filter @sprix-ai/agent exec vitest run src/components/LoginRegisterModal.test.tsx`.

### Task 5: Frontend Phone Bind Panel

**Files:**
- Create: `SprixPortal/apps/sprix-agent/src/auth/PhoneBindPanel.tsx`
- Modify: `SprixPortal/apps/sprix-agent/src/auth/QrLoginPanel.tsx`
- Modify: `SprixPortal/apps/sprix-agent/src/auth/useQrLoginSession.ts`
- Modify: `SprixPortal/apps/sprix-agent/src/auth/authTypes.ts`
- Modify: `SprixPortal/apps/sprix-agent/src/services/sprixApi.ts`
- Modify: `SprixPortal/apps/sprix-agent/src/components/LoginRegisterModal.test.tsx`

- [ ] Write tests that `PHONE_BIND_REQUIRED` shows the bind phone form for Alipay and Wechat.
- [ ] Add `sendPhoneBindSmsCode` and `confirmPhoneBind`.
- [ ] Reuse `SafetyChallengeModal` with `PHONE_BIND` scene.
- [ ] Store token after bind confirmation and call `onAuthenticated`.
- [ ] Run the focused login modal tests.

### Task 6: Verification, Commit, Push

**Files:**
- Verify both repos and only stage files needed for this feature.

- [ ] Run backend focused tests.
- [ ] Run backend full test suite if focused tests pass.
- [ ] Run frontend focused tests.
- [ ] Run frontend typecheck.
- [ ] Inspect `git diff` in both repos.
- [ ] Commit `SprixServer` and push `main`.
- [ ] Commit `SprixPortal` and push `main`.
