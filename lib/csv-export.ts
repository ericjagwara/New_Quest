export interface ExportableData {
  [key: string]: string | number | boolean | null | undefined
}

export function exportToCSV<T extends ExportableData>(
  data: T[],
  filename: string,
  headers?: { [K in keyof T]?: string },
): void {
  if (data.length === 0) {
    console.warn("No data to export")
    return
  }

  // Get all unique keys from the data
  const allKeys = Array.from(new Set(data.flatMap((item) => Object.keys(item))))

  // Create header row using provided headers or default keys
  const headerRow = allKeys.map((key) => headers?.[key as keyof T] || key).join(",")

  // Create data rows
  const dataRows = data.map((item) =>
    allKeys
      .map((key) => {
        const value = item[key]
        // Handle values that might contain commas or quotes
        if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value ?? ""
      })
      .join(","),
  )

  // Combine header and data
  const csvContent = [headerRow, ...dataRows].join("\n")

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${filename}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

export function formatAttendanceDataForExport(data: any[]) {
  return data.map((record) => ({
    "Teacher Name": record.teacher_name || "Unknown",
    School: record.school || "Unknown",
    District: record.district || "Unknown",
    Phone: record.phone || "",
    "Topic Covered": record.topic_covered || "",
    "Students Present": record.students_present || 0,
    "Students Absent": record.students_absent || 0,
    "Absence Reason": record.absence_reason || "",
    Date: record.created_at ? new Date(record.created_at).toLocaleDateString() : "",
    Time: record.created_at ? new Date(record.created_at).toLocaleTimeString() : "",
  }))
}
