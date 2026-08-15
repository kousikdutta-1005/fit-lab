export type StorageLike = Pick<Storage, "getItem" | "setItem">

export function checklistDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `fitlab-workout-${year}-${month}-${day}`
}

export function toggleCompleted(completed: ReadonlySet<string>, itemId: string): Set<string> {
  const next = new Set(completed)
  if (next.has(itemId)) next.delete(itemId)
  else next.add(itemId)
  return next
}

export function loadCompleted(storage: StorageLike, key: string, validIds: ReadonlySet<string>): Set<string> {
  const raw = storage.getItem(key)
  if (!raw) return new Set()
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) return new Set()
  return new Set(parsed.filter((id): id is string => typeof id === "string" && validIds.has(id)))
}

export function saveCompleted(storage: StorageLike, key: string, completed: ReadonlySet<string>): void {
  storage.setItem(key, JSON.stringify([...completed].sort()))
}
