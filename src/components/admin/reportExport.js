/**
 * Report export utilities supporting CSV, Excel (.xlsx/.xls), and PDF downloads.
 */

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Download tabular data as a CSV file.
 *
 * @param {string} filename - e.g. "sales-report-2026-11-16.csv"
 * @param {Array<{ label: string, key: string }>} columns
 * @param {Array<Object>} rows
 */
export function exportToCsv(filename, columns, rows) {
  if (typeof window === "undefined" || !document) return;

  const headerRow = columns.map((col) => escapeCsvCell(col.label)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCsvCell(row[col.key] ?? "")).join(",")
  );

  const csvContent = "\uFEFF" + [headerRow, ...dataRows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download tabular data as an Excel XML Spreadsheet (.xls compatible with MS Excel).
 *
 * @param {string} filename - e.g. "sales-report-2026-11-16.xls"
 * @param {string} sheetName - e.g. "Sales Report"
 * @param {Array<{ label: string, key: string }>} columns
 * @param {Array<Object>} rows
 */
export function exportToExcel(filename, sheetName, columns, rows) {
  if (typeof window === "undefined" || !document) return;

  const safeSheet = (sheetName || "Report").replace(/[\\/?*[\]]/g, "_").slice(0, 31);

  const headerCells = columns
    .map(
      (col) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(col.label)}</Data></Cell>`
    )
    .join("");

  const dataRowsXml = rows
    .map((row) => {
      const cells = columns
        .map((col) => {
          const val = row[col.key];
          const isNum = typeof val === "number" && !isNaN(val);
          const type = isNum ? "Number" : "String";
          const formatted = isNum ? String(val) : escapeXml(String(val ?? ""));
          return `<Cell ss:StyleID="${isNum ? "NumberCell" : "TextCell"}"><Data ss:Type="${type}">${formatted}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#94a3b8"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#ffffff" ss:Bold="1"/>
   <Interior ss:Color="#1e293b" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TextCell">
   <Alignment ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="NumberCell">
   <Alignment ss:Vertical="Center" ss:Horizontal="Right"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeXml(safeSheet)}">
  <Table>
   <Row ss:Height="24">${headerCells}</Row>
   ${dataRowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".xls") ? filename : `${filename}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe) {
  return String(unsafe ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Open a formatted printable PDF report view and trigger browser Print to PDF.
 *
 * @param {string} title - e.g. "Marvel Market - Platform Sales Report"
 * @param {Array<{ label: string, value: string }>} summaryCards
 * @param {Array<{ label: string, key: string }>} columns
 * @param {Array<Object>} rows
 */
export function exportToPdf(title, summaryCards, columns, rows) {
  if (typeof window === "undefined" || !document) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }

  const dateStr = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const cardsHtml =
    Array.isArray(summaryCards) && summaryCards.length > 0
      ? `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px;">
        ${summaryCards
          .map(
            (c) => `
          <div style="padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">${escapeXml(c.label)}</div>
            <div style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 4px;">${escapeXml(c.value)}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `
      : "";

  const tableHeaders = columns
    .map(
      (c) =>
        `<th style="padding: 10px 12px; background: #0f172a; color: #ffffff; text-align: left; font-size: 12px; font-weight: 700;">${escapeXml(c.label)}</th>`
    )
    .join("");

  const tableRows = rows
    .map(
      (r, idx) => `
      <tr style="background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"}; border-bottom: 1px solid #e2e8f0;">
        ${columns
          .map(
            (c) =>
              `<td style="padding: 9px 12px; font-size: 12px; color: #1e293b;">${escapeXml(r[c.key] ?? "")}</td>`
          )
          .join("")}
      </tr>
    `
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeXml(title)}</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; color: #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: 800; margin: 0; }
          .date { font-size: 12px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">${escapeXml(title)}</h1>
            <div class="date">Generated on ${escapeXml(dateStr)}</div>
          </div>
          <button class="no-print" onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Print / Save as PDF</button>
        </div>
        ${cardsHtml}
        <table>
          <thead><tr>${tableHeaders}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
