import { fileLabels, fileModels, type FileKey } from "@/features/odoo/columns";
import type { DryRunReport } from "@/features/odoo/types";
import { Notice, PanelHeader, Readout, StatusPip } from "@/components/ui/hud";

// The check's report: a summary per file, then each finding with the spreadsheet line it is on.
export function OdooReport({ report, sent, source }: { report: DryRunReport; sent: FileKey[]; source: string }) {
  const files = Object.keys(report.files) as FileKey[];
  const review = files.reduce((sum, file) => sum + report.files[file].rows - report.files[file].ready, 0);
  return (
    <section className="mt-8 max-w-5xl space-y-5" aria-labelledby="odoo-report">
      <div>
        <h2 id="odoo-report" className="font-mono text-sm font-semibold">
          Results for {source}
        </h2>
        <p role="status" className="mt-2 text-sm">
          {review ? `${review} ${review === 1 ? "row needs" : "rows need"} review.` : "Every row is ready."} Nothing was
          written.
        </p>
        <p className="mt-1 text-xs text-muted">
          Compared with this project&apos;s staff, stages, categories and existing contacts, as your account can read
          them. Dates are read as Asia/Dhaka time.
        </p>
      </div>
      {files.map(file => {
        const summary = report.files[file],
          findings = report.findings.filter(f => f.file === file),
          left = summary.rows - summary.ready;
        return (
          <section key={file} className="panel p-5" aria-labelledby={`odoo-${file}`}>
            <PanelHeader id={`odoo-${file}`} title={fileLabels[file]} code={fileModels[file]}>
              {sent.includes(file) && !summary.missing.length && (
                <StatusPip tone={left ? "warning" : "nominal"} label={left ? "Needs review" : "Ready"} />
              )}
            </PanelHeader>
            {!sent.includes(file) ? (
              <p className="text-sm text-muted">No file provided.</p>
            ) : summary.missing.length ? (
              <Notice tone="warning">
                Not checked: missing columns {summary.missing.join(", ")}. Rename the headers to match the sample file.
              </Notice>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Readout label="Rows" value={summary.rows} />
                  <Readout label="Ready" value={summary.ready} />
                  <Readout label="Need review" value={left} />
                </div>
                {summary.ignored.length > 0 && (
                  <p className="mt-3 text-xs text-muted">Ignored columns: {summary.ignored.join(", ")}</p>
                )}
                {findings.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Line</th>
                          <th>Odoo ID</th>
                          <th>Finding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {findings.map((finding, i) => (
                          <tr key={`${finding.line}-${i}`}>
                            <td className="tabular-nums">{finding.line}</td>
                            <td className="whitespace-nowrap font-mono text-xs">{finding.odooId || "—"}</td>
                            <td className="wrap-anywhere">{finding.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}
    </section>
  );
}
