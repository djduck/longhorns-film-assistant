import React, { useEffect, useRef, useState } from "react";
import type { Project, RowData } from "./App";
import { parseSignedYardLine } from "../core/yardline";
import { OFF_FORMATION_PRESETS, DEF_FRONT_PRESETS } from "../core/presets";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ReviewView(props: {
  project: Project;
  onUpdateProject: (updater: (p: Project) => Project) => Promise<void>;
  onExit: () => void;
}) {
  const { project, onUpdateProject, onExit } = props;
  const [index, setIndex] = useState<number>(project.lastViewedIndex || 0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const row = project.rows[index];

  useEffect(() => {
    onUpdateProject((p) => ({ ...p, lastViewedIndex: index }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    // Auto-apply series defaults on entering a row
    applySeriesDefaultsToRow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, series.enabled]);


  const setRow = async (patch: Partial<RowData>) => {
    await onUpdateProject((p) => {
      const rows = [...p.rows];
      rows[index] = { ...rows[index], ...patch };
      return { ...p, rows };
    });
    if (series.enabled) {
      await updateSeriesDefaults(patch);
    }
  };


  const series = project.series || { enabled: false, defaults: {} };

  const updateSeriesDefaults = async (patch: Partial<RowData>) => {
    // Only track a subset of fields as "series defaults"
    const keys: (keyof RowData)[] = ["odk", "playType", "dn", "dist", "hash", "offFormation", "defFront", "blitz"];
    const defaultsPatch: any = {};
    for (const k of keys) {
      if (k in patch) defaultsPatch[k] = (patch as any)[k];
    }
    if (Object.keys(defaultsPatch).length === 0) return;

    await onUpdateProject((p) => ({
      ...p,
      series: {
        ...(p.series || { enabled: false, defaults: {} }),
        defaults: { ...(p.series?.defaults || {}), ...defaultsPatch },
      },
    }));
  };

  const applySeriesDefaultsToRow = async () => {
    if (!series.enabled) return;
    const d = series.defaults || {};

    const isBlankRow =
      (row.yardLn || "").trim() === "" &&
      row.playType === "" &&
      row.dn == null &&
      row.dist == null &&
      (row.hash || "") === "" &&
      (row.offFormation || "") === "" &&
      (row.defFront || "") === "" &&
      (row.blitz || "") === "" &&
      row.penalty === false &&
      (row.notes || "") === "";

    // Apply defaults only to fields that are still blank/unset.
    // For ODK, we apply only when the row is still essentially blank (so we don't overwrite prior work).
    const patch: Partial<RowData> = {};
    if (isBlankRow && d.odk) patch.odk = d.odk;
    if (!row.playType && d.playType) patch.playType = d.playType;
    if ((row.dn == null) && (d.dn != null)) patch.dn = d.dn;
    if ((row.dist == null) && (d.dist != null)) patch.dist = d.dist;
    if (!row.hash && d.hash) patch.hash = d.hash;
    if (!row.offFormation && d.offFormation) patch.offFormation = d.offFormation;
    if (!row.defFront && d.defFront) patch.defFront = d.defFront;
    if (!row.blitz && d.blitz) patch.blitz = d.blitz;
    if (Object.keys(patch).length === 0) return;
    await setRow(patch);
  };

  const findNextMissingYard = (from: number) => {
    const n = project.rows.length;
    for (let step = 1; step <= n; step++) {
      const i = (from + step) % n;
      const y = project.rows[i].yardLn?.trim() || "";
      if (!y || parseSignedYardLine(y) == null) return i;
    }
    return null;
  };

  const findNextFlagged = (from: number) => {
    const n = project.rows.length;
    for (let step = 1; step <= n; step++) {
      const i = (from + step) % n;
      if ((project.rows[i].flags || []).length > 0) return i;
    }
    return null;
  };

  const markQuarter = async (q: 2 | 3 | 4) => {
    await onUpdateProject((p) => {
      const qm = { ...p.quarterMarkers };
      if (q === 2) qm.q2StartIndex = index;
      if (q === 3) qm.q3StartIndex = index;
      if (q === 4) qm.q4StartIndex = index;
      return { ...p, quarterMarkers: qm };
    });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // navigation
      if (e.key === "n" || e.key === "N") setIndex((i) => clamp(i + 1, 0, project.rows.length - 1));
      if (e.key === "p" || e.key === "P") setIndex((i) => clamp(i - 1, 0, project.rows.length - 1));

      // ODK
      if (e.key === "o" || e.key === "O") setRow({ odk: "O" });
      if (e.key === "d" || e.key === "D") setRow({ odk: "D" });
      if (e.key === "k" || e.key === "K") setRow({ odk: "K" });

      // Run/Pass: R = Run, S = Pass (avoid clash with Prev)
      if (e.key === "r" || e.key === "R") setRow({ playType: "Run" });
      if (e.key === "s" || e.key === "S") setRow({ playType: "Pass" });

      // Down
      if (["1", "2", "3", "4"].includes(e.key)) setRow({ dn: parseInt(e.key, 10) as any });

      // Hash: L/M/Shift+R (R alone is Run)
      if (e.key === "l" || e.key === "L") setRow({ hash: "L" });
      if (e.key === "m" || e.key === "M") setRow({ hash: "M" });
      if (e.key === "R" && e.shiftKey) setRow({ hash: "R" });
      if (e.key === "x" || e.key === "X") setRow({ hash: "" });

      // Save+Next
      if (e.key === "Enter") setIndex((i) => clamp(i + 1, 0, project.rows.length - 1));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, project.rows.length]);

  if (!row) return <div className="card">No row.</div>;

  const yardParsed = parseSignedYardLine(row.yardLn);
  const yardOk = row.yardLn.trim() === "" || yardParsed !== null;

  return (
    <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h2">Clip</div>
            <div style={{ marginTop: 4 }}>
              <span className="badge">{index + 1}/{project.rows.length}</span>{" "}
              <span className="small">{row.clipFile}</span>
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <label className="small" style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 8 }}>
              <input
                type="checkbox"
                checked={series.enabled}
                onChange={(e) =>
                  onUpdateProject((p) => ({ ...p, series: { ...(p.series || { enabled: false, defaults: {} }), enabled: e.target.checked } }))
                }
              />
              Series Mode
            </label>
            <button
              className="secondary"
              onClick={() => {
                const i = findNextMissingYard(index);
                if (i != null) setIndex(i);
              }}
            >
              Next Missing YARD LN
            </button>
            <button
              className="secondary"
              onClick={() => {
                const i = findNextFlagged(index);
                if (i != null) setIndex(i);
              }}
              title="Jump to next row with flags (e.g., GNLS needs review)"
            >
              Next Flag
            </button>

            <button className="secondary" onClick={() => setIndex((i) => clamp(i - 1, 0, project.rows.length - 1))}>
              Prev <span className="kbd">P</span>
            </button>
            <button className="secondary" onClick={() => setIndex((i) => clamp(i + 1, 0, project.rows.length - 1))}>
              Next <span className="kbd">N</span>
            </button>
            <button className="danger" onClick={onExit}>Exit</button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <video
            ref={videoRef}
            src={row.clipPath}
            controls
            style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)", background: "#000" }}
          />
        </div>

        <div style={{ marginTop: 10 }} className="small">
          Hotkeys: Next <span className="kbd">N</span>, Prev <span className="kbd">P</span>, O/D/K, Run <span className="kbd">R</span>, Pass <span className="kbd">S</span>, Down 1–4, Hash L/M/<span className="kbd">Shift+R</span>, Save+Next <span className="kbd">Enter</span>.
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="h2">Row Fields</div>
            <div className="small" style={{ marginTop: 4 }}>
              QTR auto-fills from markers. GN/LS computed from consecutive YARD LN values.
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="secondary" onClick={() => markQuarter(2)}>Mark Q2</button>
            <button className="secondary" onClick={() => markQuarter(3)}>Mark Q3</button>
            <button className="secondary" onClick={() => markQuarter(4)}>Mark Q4</button>
          </div>
        </div>

        <div className="grid three" style={{ marginTop: 12 }}>
          <div>
            <div className="small">QTR</div>
            <input value={row.qtr} readOnly />
          </div>
          <div>
            <div className="small">ODK</div>
            <select value={row.odk} onChange={(e) => setRow({ odk: e.target.value as any })}>
              <option value="O">O (Offense)</option>
              <option value="D">D (Defense)</option>
              <option value="K">K (Kick)</option>
            </select>
          </div>
          <div>
            <div className="small">Play Type</div>
            <select value={row.playType} onChange={(e) => setRow({ playType: e.target.value as any })}>
              <option value="">—</option>
              <option value="Run">Run</option>
              <option value="Pass">Pass</option>
            </select>
          </div>

          <div>
            <div className="small">Down (DN)</div>
            <select value={row.dn ?? ""} onChange={(e) => setRow({ dn: e.target.value ? (parseInt(e.target.value, 10) as any) : null })}>
              <option value="">—</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>

          <div>
            <div className="small">Distance (DIST)</div>
            <input value={row.dist ?? ""} placeholder="e.g. 10" onChange={(e) => setRow({ dist: e.target.value ? parseInt(e.target.value, 10) : null })} />
          </div>

          <div>
            <div className="small">Hash (HASHI)</div>
            <select value={row.hash} onChange={(e) => setRow({ hash: e.target.value as any })}>
              <option value="">—</option>
              <option value="L">L</option>
              <option value="M">M</option>
              <option value="R">R</option>
            </select>
          </div>

          <div>
            <div className="small">YARD LN (+/-)</div>
            <input
              value={row.yardLn}
              placeholder="+25, 0, -25"
              onChange={(e) => setRow({ yardLn: e.target.value })}
              style={{ borderColor: yardOk ? "var(--border)" : "var(--danger)" }}
            />
            {!yardOk && <div className="small" style={{ color: "var(--danger)" }}>Use +1..+50, 0, or -1..-50</div>}
          </div>

          <div>
            <div className="small">GN/LS (computed)</div>
            <input value={row.gnls ?? ""} readOnly />
            {row.flags?.includes("GNLS_NEEDS_REVIEW") && (
              <div className="small" style={{ color: "var(--warn)" }}>
                GN/LS needs review (yard line / quarter / ODK / penalty).
              </div>
            )}
          </div>

          <div>
            <div className="small">Penalty / No-Play</div>
            <select value={row.penalty ? "Y" : ""} onChange={(e) => setRow({ penalty: e.target.value === "Y" })}>
              <option value="">No</option>
              <option value="Y">Yes</option>
            </select>
          </div>
        </div>

        <div className="grid two" style={{ marginTop: 12 }}>
          <div>
            <div className="small">OFF Formation</div>
            <input list="offFormationList" value={row.offFormation} onChange={(e) => setRow({ offFormation: e.target.value })} placeholder="Start typing (e.g. Gun Trips Right)..." />
            <datalist id="offFormationList">
              {OFF_FORMATION_PRESETS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div>
            <div className="small">DEF Front</div>
            <input list="defFrontList" value={row.defFront} onChange={(e) => setRow({ defFront: e.target.value })} placeholder="Start typing (e.g. Even Front, Over Front)..." />
            <datalist id="defFrontList">
              {DEF_FRONT_PRESETS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
          <div>
            <div className="small">Blitz</div>
            <select value={row.blitz} onChange={(e) => setRow({ blitz: e.target.value as any })}>
              <option value="">—</option>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
          </div>
          <div>
            <div className="small">Notes</div>
            <textarea value={row.notes} onChange={(e) => setRow({ notes: e.target.value })} placeholder="Optional notes…" />
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="small">
          Quarter markers: Q2={project.quarterMarkers.q2StartIndex ?? "—"}, Q3={project.quarterMarkers.q3StartIndex ?? "—"}, Q4={project.quarterMarkers.q4StartIndex ?? "—"}.
        </div>

        <div style={{ marginTop: 12 }}>
          <details>
            <summary className="small" style={{ cursor: "pointer" }}>Show All Rows (quick audit)</summary>
            <div style={{ marginTop: 10, maxHeight: 260, overflow: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th><th>Q</th><th>ODK</th><th>DN</th><th>DIST</th><th>HASH</th><th>YARD</th><th>TYPE</th><th>GN/LS</th><th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {project.rows.map((r) => (
                    <tr key={r.clipIndex} style={{ cursor: "pointer" }} onClick={() => setIndex(r.clipIndex)}>
                      <td>{r.clipIndex + 1}</td>
                      <td>{r.qtr}</td>
                      <td>{r.odk}</td>
                      <td>{r.dn ?? ""}</td>
                      <td>{r.dist ?? ""}</td>
                      <td>{r.hash}</td>
                      <td>{r.yardLn}</td>
                      <td>{r.playType}</td>
                      <td>{r.gnls ?? ""}</td>
                      <td className="small">{(r.flags || []).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
