/**
 * Given a subject name (from a coursework item) and the student's subject list,
 * return the ID of the first topic in the matching subject.
 *
 * Returns null when no match is found — mastery updates are then skipped
 * gracefully. Case-insensitive to handle minor capitalisation divergence
 * between the coursework extraction and the subject table.
 */
export function resolveTopicId(
  subjectName: string | null | undefined,
  subjects: Array<{ name: string; topics: Array<{ id: string }> }>,
): string | null {
  if (!subjectName) return null;
  const lower = subjectName.toLowerCase();
  const match = subjects.find((s) => s.name.toLowerCase() === lower);
  return match?.topics[0]?.id ?? null;
}
