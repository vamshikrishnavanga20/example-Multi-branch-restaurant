export function cleanQuery(query: string): string {
  return query
    .replace(/```sql/gi, "")
    .replace(/```postgresql/gi, "")
    .replace(/```/g, "")
    .trim()
    .replace(/;\s*$/, "")
    .trim();
}

export function isReadOnlyQuery(query: string): boolean {
  const normalized = query.trim().toLowerCase();

  if (!normalized.startsWith("select")) {
    return false;
  }
  if (normalized.includes("--") || normalized.includes("/*") || normalized.includes("*/")) {
    return false;
  }

  const forbiddenKeywords = [
    "insert ",
    "update ",
    "delete ",
    "drop ",
    "alter ",
    "truncate ",
    "create ",
    "grant ",
    "revoke ",
    "execute ",
    "call ",
    "merge ",
    "replace ",
    "upsert ",
  ];

  return !forbiddenKeywords.some((keyword) => normalized.includes(keyword));
}

export function isAllowedTableQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  const allowedTables = new Set(["ledger_entries", "menu_items"]);

  const matches = [...normalized.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_]*)/gi)];

  for (const match of matches) {
    const tableName = match[1]?.toLowerCase();
    if (tableName && !allowedTables.has(tableName)) {
      return false;
    }
  }

  return true;
}

export function containsCreatedAtFilter(query: string): boolean {
  return /\bcreated_at\b/i.test(query);
}

export function containsRequiredRange(
  query: string,
  startDate: string,
  endDate: string
): boolean {
  const normalized = query.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedStart = startDate.toLowerCase();
  const normalizedEnd = endDate.toLowerCase();

  const startWithoutMilliseconds = normalizedStart.replace(".000z", "z");
  const endWithoutMilliseconds = normalizedEnd.replace(".000z", "z");

  const hasStart =
    normalized.includes(normalizedStart) || normalized.includes(startWithoutMilliseconds);
  const hasEnd =
    normalized.includes(normalizedEnd) || normalized.includes(endWithoutMilliseconds);

  return containsCreatedAtFilter(query) && hasStart && hasEnd;
}
