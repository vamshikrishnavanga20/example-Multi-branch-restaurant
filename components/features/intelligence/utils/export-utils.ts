export function exportTableToCsv(
  title: string,
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[]
) {
  if (!rows || rows.length === 0) return;

  const header = columns.map((col) => `"${col.label.replace(/"/g, '""')}"`).join(",");
  const csvRows = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col.key] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(",")
  );

  const csvContent = "data:text/csv;charset=utf-8," + [header, ...csvRows].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${title.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
