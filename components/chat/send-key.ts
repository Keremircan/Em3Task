import type { KeyboardEvent } from "react";

// Yazma kutularında Enter yeni satır açar; mesajı Shift + Enter gönderir
// (Ctrl / ⌘ + Enter de aynı işi görür). Klavye birleşimi (IME) sürerken göndermez.
export function isSendKey(e: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return e.key === "Enter" && (e.shiftKey || e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing;
}
