/**
 * Pure diff helper for the "Plan updated" overlay (F7.6 / DESIGN-SPEC §3.5).
 *
 * Kept free of server-only imports and timezone logic so it is trivially
 * testable and can be imported for its types from client components. The
 * caller pre-formats each session into a DiffEntry (label + human `when`
 * string in the user's timezone); this module only compares them.
 */

export type PlanChange = {
  kind: "moved" | "added" | "removed";
  label: string; // "Biology · Cellular respiration"
  detail: string; // "Mon 16:00 → Tue 16:00" | "Wed 16:00"
};

export type PlanWarning = {
  subjectName: string;
  topicName: string;
  message: string;
};

export type DiffEntry = {
  /** Identity of the "kind of session": subject|topic|instruction. */
  key: string;
  /** Human label for display, e.g. "Biology · Cellular respiration". */
  label: string;
  /** Human time slot for display, e.g. "Mon 16:00". */
  when: string;
};

export type PlanDiff = {
  changes: PlanChange[];
  movedCount: number;
  addedCount: number;
  removedCount: number;
};

const MAX_CHANGES_SHOWN = 6;

/**
 * Compare the old scheduled sessions with the new ones and describe what
 * changed. A session is "the same slot" when both its key and its `when`
 * match. Same key at a different `when` is reported as a move; leftover old
 * entries are removals, leftover new entries are additions.
 */
export function diffSessionsForOverlay(
  oldEntries: readonly DiffEntry[],
  newEntries: readonly DiffEntry[],
): PlanDiff {
  const slot = (e: DiffEntry) => `${e.key}@@${e.when}`;
  const newSlots = new Set(newEntries.map(slot));
  const oldSlots = new Set(oldEntries.map(slot));

  const removed = oldEntries.filter((e) => !newSlots.has(slot(e)));
  const added = newEntries.filter((e) => !oldSlots.has(slot(e)));

  // Pair removed + added that share the same key → a move.
  const addedByKey = new Map<string, DiffEntry[]>();
  for (const e of added) {
    const list = addedByKey.get(e.key) ?? [];
    list.push(e);
    addedByKey.set(e.key, list);
  }

  const changes: PlanChange[] = [];
  const leftoverRemoved: DiffEntry[] = [];
  let movedCount = 0;

  for (const r of removed) {
    const candidates = addedByKey.get(r.key);
    if (candidates && candidates.length > 0) {
      const a = candidates.shift()!;
      changes.push({
        kind: "moved",
        label: r.label,
        detail: `${r.when} → ${a.when}`,
      });
      movedCount++;
    } else {
      leftoverRemoved.push(r);
    }
  }

  const leftoverAdded = [...addedByKey.values()].flat();

  for (const a of leftoverAdded) {
    changes.push({ kind: "added", label: a.label, detail: a.when });
  }
  for (const r of leftoverRemoved) {
    changes.push({ kind: "removed", label: r.label, detail: r.when });
  }

  return {
    changes: changes.slice(0, MAX_CHANGES_SHOWN),
    movedCount,
    addedCount: leftoverAdded.length,
    removedCount: leftoverRemoved.length,
  };
}
