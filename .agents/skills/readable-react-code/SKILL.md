---
name: readable-react-code
description: >-
  Write or refactor React and TypeScript code for human readability in this project.
  Use when creating or editing React components, TS/TSX files, Zustand stores,
  service modules, modals, forms, UI flows, or when the user asks for code to be
  easier to read, cleaner, less crowded, or more maintainable.
---

# Readable React Code

Use this skill whenever writing or refactoring React, TypeScript, or frontend application code in this project.

The goal is code that a teammate can scan, debug, and safely change later. Prefer readable structure over clever compactness.

## Recommended Prompt

When asking an agent to use this skill, prefer a direct prompt like:

```text
使用项目级 skill readable-react-code，重构这段 React/TypeScript 代码。
要求代码优先给人读：不要把 JSX 和 props 挤在一行；
复杂 footer/actions/handler 抽成有名字的变量或小组件；
避免在 JSX 里写复杂逻辑；保持行为不变。
```

Short version:

```text
用 readable-react-code 改一下这个组件，保持行为不变，但把 JSX、事件处理和 modal actions 写得更适合人读。
```

## Before Editing

Inspect nearby files first and follow the local style:

```bash
rg --files | rg "\\.(tsx|ts|css)$"
rg -n "function .*Modal|const .*Modal|useCandidateStore|create\\(" .
```

Check whether the current area uses:

- named function components or arrow components
- colocated modal/body/footer components
- Zustand selector patterns
- service modules for async calls
- CSS class naming conventions

## Readability Rules

- Do not compress large JSX trees into single lines.
- Break component props onto separate lines when a component has more than two meaningful props, a long title, or a complex child.
- Move complex `footer`, `actions`, `render*`, and conditional JSX into named constants or small components.
- Prefer named event handlers over inline async callbacks inside JSX.
- Prefer named selectors or grouped store reads when many values are read from the same store.
- Avoid calling `store.getState()` inside render JSX. Use a selector when the value participates in rendering.
- Keep each component responsible for one thing. A global modal switchboard may choose which
  modal to show, but each modal should own its body/actions.
- Keep async save/delete/confirm flows in named handlers with clear success and error branches.
- Use early returns for loading, empty, and missing-selection states.
- Do not introduce abstractions just to reduce line count. Extract only when it improves naming, scanability, or reuse.
- Preserve existing behavior unless the user asks for behavior changes.

## React Component Shape

Prefer this shape for non-trivial components:

```tsx
export function ExampleComponent() {
  const value = useStore((state) => state.value)
  const saveValue = useStore((state) => state.saveValue)

  const handleSave = async () => {
    await saveValue(value)
  }

  const footer = (
    <div className="modal-actions">
      <SecondaryButton onClick={onClose}>取消</SecondaryButton>
      <PrimaryButton onClick={handleSave}>保存</PrimaryButton>
    </div>
  )

  return (
    <Modal open={open} title="编辑内容" onClose={onClose} footer={footer}>
      <ExampleBody value={value} />
    </Modal>
  )
}
```

## JSX Formatting

Use multiline JSX once content stops being trivially short:

```tsx
<Modal
  open={modal === 'login'}
  title="登录后，让你的分身 Agent 先去工作"
  onClose={closeModal}
  footer={<LoginModalActions onLogin={handleWechatLogin} onClose={closeModal} />}
>
  <p>创建分身、派出任务、查看过程证据都需要账号状态。</p>
</Modal>
```

Avoid this style:

```tsx
<Modal
  open={modal === 'login'}
  title="登录后，让你的分身 Agent 先去工作"
  onClose={closeModal}
  footer={
    <div className="modal-actions">
      <PrimaryButton onClick={goWechatPhoneLogin}>去微信授权</PrimaryButton>
      <SecondaryButton onClick={closeModal}>稍后再说</SecondaryButton>
    </div>
  }
>
  <p>创建分身、派出任务、查看过程证据都需要账号状态。</p>
</Modal>
```

## Modal Guidance

For modal-heavy files:

- Extract repeated action rows into named components such as `LoginModalActions`, `ConfirmDispatchActions`, or `ShareCardActions`.
- Keep each modal block vertically readable.
- If a file contains many unrelated modals, split body/action components in the same file first.
  Move them to separate files only if the file remains hard to navigate.
- Keep modal copy close to the modal unless the copy is reused.

## Form Guidance

For forms and editors:

- Use named handlers for field changes when parsing is involved.
- Keep parser helpers outside the component if they are pure.
- Avoid `defaultValue` for fields that are expected to be saved unless intentionally uncontrolled.
- Use controlled values for editable persisted fields.
- Group related fields with small components only when it makes the editor easier to scan.

## Store And API Guidance

- Prefer selectors for values used by the component render path.
- Prefer service functions for network persistence rather than embedding request logic in components.
- In Zustand-heavy components, keep store reads near the top and handlers below them.
- Do not silently swallow async errors. Show the existing toast or error pattern.

## Verification

After editing:

- Re-read the changed file once for human scanability.
- Run formatter, linter, type-check, or build only when the change touches
  formatting rules, shared types, build config, or the user asks for that
  verification.
- Check for long single-line JSX with:

```bash
rg -n ".{140,}" path/to/changed/file.tsx
```

If long lines remain, they should be imports, URLs, data constants, or otherwise intentional.
