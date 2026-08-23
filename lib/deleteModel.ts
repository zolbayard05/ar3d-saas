"use client";

/**
 * Shared by the feed's failed-card "Delete" link (components/ModelCard.tsx)
 * and the detail screen's destructive action (components/ModelDetail.tsx) —
 * one confirm, one call, no separate copies of either. Irreversible (row +
 * R2 objects, app/api/models/delete/route.ts), so this always asks first;
 * there's no custom confirm dialog anywhere else in the app to reuse, and
 * building one just for this would be more than the task needs.
 */
export async function deleteModel(id: string): Promise<boolean> {
  if (!window.confirm("Delete this model? This can't be undone.")) return false;

  const res = await fetch(`/api/models/delete?id=${id}`, { method: "DELETE" });
  return res.ok;
}
