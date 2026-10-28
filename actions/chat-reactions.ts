"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getUserId } from "@/lib/auth";
import { isUuid } from "@/lib/tasks";
import { isEmoji, type ReactionTarget } from "@/lib/reactions";

export type ReactionResult = { error: string | null };

// Tepki aç/kapat: kullanıcı bu emojiyi daha önce bırakmışsa geri alınır,
// bırakmamışsa eklenir. Kullanıcı kimliği her zaman oturumdan gelir.
export async function toggleReaction(input: {
  target: ReactionTarget;
  messageId: string;
  emoji: string;
}): Promise<ReactionResult> {
  const userId = await getUserId();
  const { target, messageId, emoji } = input ?? {};
  if (target !== "general" && target !== "comment") return { error: "Geçersiz istek." };
  if (!isUuid(messageId)) return { error: "Geçersiz mesaj." };
  if (!isEmoji(emoji)) return { error: "Geçersiz emoji." };

  const column = target === "general" ? "message_id" : "comment_id";
  const supabase = await createClient();

  const { data: removed, error: deleteError } = await supabase
    .from("message_reactions")
    .delete()
    .eq(column, messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .select("id");
  if (deleteError) return { error: "Tepki güncellenemedi." };

  if (!removed.length) {
    const { error } = await supabase
      .from("message_reactions")
      .insert(
        target === "general"
          ? { message_id: messageId, user_id: userId, emoji }
          : { comment_id: messageId, user_id: userId, emoji },
      );
    // 23505: aynı anda iki kez basıldı; tepki zaten var
    if (error && error.code !== "23505") {
      return { error: error.code === "23503" ? "Mesaj bulunamadı (silinmiş olabilir)." : "Tepki eklenemedi." };
    }
  }

  revalidatePath(target === "general" ? "/genel" : "/gorevler/[id]", "page");
  return { error: null };
}
