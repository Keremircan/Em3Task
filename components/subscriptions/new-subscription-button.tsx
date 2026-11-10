"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { primaryButton } from "@/components/ui/styles";
import { SubscriptionDialog } from "./subscription-dialog";

// "Yeni abonelik" butonu ve penceresi. Her açılışta pencere sıfırdan kurulur (boş form).
export function NewSubscriptionButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRound((n) => n + 1);
          setOpen(true);
        }}
        className={`${primaryButton} ${className}`}
      >
        <Plus className="size-4" strokeWidth={2.4} /> Yeni abonelik
      </button>
      <SubscriptionDialog key={round} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
