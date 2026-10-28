// Mesaj tepkileri için ortak tipler ve yardımcılar (sunucu ve tarayıcı)

export type ReactionTarget = "general" | "comment";

// Sorgudan gelen ham satır
export type ReactionRow = {
  emoji: string;
  user_id: string;
  created_at?: string;
  profile: { full_name: string | null } | null;
};

// Arayüzde gösterilen grup: "👍 2" ve tepki bırakanlar
export type ReactionGroup = { emoji: string; users: { id: string; name: string }[] };

// WhatsApp'taki gibi hızlı tepki çubuğu
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// Sadece emoji kabul edilir (bayraklar, ten rengi ve birleşik emojiler dahil)
const EMOJI_RE = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Component}|‍|️)+$/u;

export function isEmoji(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 16 && EMOJI_RE.test(value);
}

// Ham satırları emoji başına gruplar; ilk bırakılan emoji önde
export function groupReactions(rows: ReactionRow[] | null | undefined): ReactionGroup[] {
  const map = new Map<string, ReactionGroup>();
  const sorted = [...(rows ?? [])].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  for (const r of sorted) {
    const g = map.get(r.emoji) ?? { emoji: r.emoji, users: [] };
    g.users.push({ id: r.user_id, name: r.profile?.full_name || "Eski üye" });
    map.set(r.emoji, g);
  }
  return [...map.values()];
}

// Tepkileri mesaj/yorum sorgusuna gömmek için seçim parçası
export const REACTIONS_SELECT =
  "reactions:message_reactions(emoji, user_id, created_at, profile:profiles!message_reactions_user_id_fkey(full_name))";
