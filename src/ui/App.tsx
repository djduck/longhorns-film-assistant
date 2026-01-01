import React, { useEffect, useState } from "react";
import SetupView from "./SetupView";
import ReviewView from "./ReviewView";
import { computeGnls, parseSignedYardLine } from "../core/yardline";

export type Clip = { fileName: string; filePath: string };

export type RowData = {
  clipIndex: number;
  clipFile: string;
  clipPath: string;

  qtr: 1 | 2 | 3 | 4;
  odk: "O" | "D" | "K";
  dn: 1 | 2 | 3 | 4 | null;
  dist: number | null;
  hash: "L" | "M" | "R" | "";
  yardLn: string;
  playType: "Run" | "Pass" | "";
  offFormation: string;
  defFront: string;
  blitz: "No" | "Yes" | "";
  penalty: boolean;
  notes: string;

  gnls: number | null;
  flags: string[];
};

export type QuarterMarkers = {
  q2StartIndex: number | null;
  q3StartIndex: number | null;
  q4StartIndex: number | null;
};

export type Project = {
  projectId: string;
  projectName: string;
  createdAt: string;
  clipsFolder: string;
  clips: Clip[];
  rows: RowData[];
  quarterMarkers: QuarterMarkers;
  lastViewedIndex: number;
  series: {
    enabled: boolean;
    defaults: {
      odk?: RowData['odk'];
      playType?: RowData['playType'];
      dn?: RowData['dn'];
      dist?: RowData['dist'];
      hash?: RowData['hash'];
      offFormation?: RowData['offFormation'];
      defFront?: RowData['defFront'];
      blitz?: RowData['blitz'];
    };
  };
};

function makeProjectId() {
  return "proj_" + Math.random().toString(36).slice(2, 10);
}
function nowIso() {
  return new Date().toISOString();
}

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<{ id: string; filePath: string }[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await window.lhfa.listProjects();
        setProjects(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const autosave = async (p: Project) => {
    setStatus("Saving…");
    await window.lhfa.saveProjectJson(p.projectId, p);
    setStatus("Saved");
    setTimeout(() => setStatus(""), 800);
  };

  const recompute = (p: Project): Project => {
    const rows = [...p.rows];

    // Apply quarter markers
    const qm = p.quarterMarkers;
    const q2 = qm.q2StartIndex ?? Infinity;
    const q3 = qm.q3StartIndex ?? Infinity;
    const q4 = qm.q4StartIndex ?? Infinity;

    for (const r of rows) {
      let q: 1 | 2 | 3 | 4 = 1;
      if (r.clipIndex >= q4) q = 4;
      else if (r.clipIndex >= q3) q = 3;
      else if (r.clipIndex >= q2) q = 2;
      r.qtr = q;
    }

    // Reset GN/LS and flags
    for (const r of rows) {
      r.gnls = null;
      r.flags = (r.flags || []).filter((f) => !f.startsWith("GNLS"));
    }

    // Compute GN/LS for each row based on next row LOS
    for (let i = 0; i < rows.length - 1; i++) {
      const curr = rows[i];
      const next = rows[i + 1];
      const currY = parseSignedYardLine(curr.yardLn);
      const nextY = parseSignedYardLine(next.yardLn);

      const sameQuarter = curr.qtr === next.qtr;
      if (currY == null || nextY == null) continue;

      const g = computeGnls(currY, nextY, curr.odk, next.odk, sameQuarter, curr.penalty, next.penalty);
      if (g == null) {
        if (curr.odk !== "K" && next.odk !== "K" && curr.odk === next.odk && sameQuarter) {
          curr.flags.push("GNLS_NEEDS_REVIEW");
        }
      } else {
        curr.gnls = g;
        if (Math.abs(g) > 25) curr.flags.push("GNLS_BIG_PLAY");
      }
    }

    return { ...p, rows };
  };

  const refreshProjects = async () => {
    const list = await window.lhfa.listProjects();
    setProjects(list);
  };

  const startNewProject = async () => {
    const sel = await window.lhfa.selectClipsFolder();
    if (sel.canceled) return;

    const clips = sel.files || [];
    const rows: RowData[] = clips.map((c, idx) => ({
      clipIndex: idx,
      clipFile: c.fileName,
      clipPath: c.filePath,

      qtr: 1,
      odk: "O",
      dn: null,
      dist: null,
      hash: "",
      yardLn: "",
      playType: "",
      offFormation: "",
      defFront: "",
      blitz: "",
      penalty: false,
      notes: "",

      gnls: null,
      flags: [],
    }));

    const p0: Project = recompute({
      projectId: makeProjectId(),
      projectName: "Game",
      createdAt: nowIso(),
      clipsFolder: sel.folder || "",
      clips,
      rows,
      quarterMarkers: { q2StartIndex: null, q3StartIndex: null, q4StartIndex: null },
      lastViewedIndex: 0,
      series: { enabled: false, defaults: {} },
    });

    setProject(p0);
    await autosave(p0);
    await refreshProjects();
  };

  const openProject = async (projectId: string) => {
    const res = await window.lhfa.loadProjectJson(projectId);
    if (!res.ok || !res.data) return;
    const p = recompute(res.data as Project);
    setProject(p);
  };

  const updateProject = async (updater: (p: Project) => Project) => {
    if (!project) return;
    const next = recompute(updater(project));
    setProject(next);
    await autosave(next);
  };

  const exportXlsx = async () => {
    if (!project) return;
    const res = await window.lhfa.exportXlsx(project);
    if (!res.canceled && res.filePath) {
      setStatus("Exported XLSX");
      await window.lhfa.openInFolder(res.filePath);
      setTimeout(() => setStatus(""), 1200);
    }
  };

  const exportCsv = async () => {
    if (!project) return;
    const res = await window.lhfa.exportCsv(project);
    if (!res.canceled && res.filePath) {
      setStatus("Exported CSV");
      await window.lhfa.openInFolder(res.filePath);
      setTimeout(() => setStatus(""), 1200);
    }
  };

  if (loading) return <div style={{ padding: 16 }} className="small">Loading…</div>;

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: "0 auto" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div className="h1">Longhorns Film Assistant</div>
          <div className="small">Offline breakdown. Import Hudl clips, fill rows, export XLSX/CSV.</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge">{status || (project ? "Project loaded" : "No project")}</span>
          {project && (
            <>
              <button className="secondary" onClick={exportCsv}>Export CSV</button>
              <button onClick={exportXlsx}>Export XLSX</button>
            </>
          )}
          <button onClick={startNewProject}>New Project</button>
        </div>
      </div>

      {!project ? (
        <SetupView projects={projects} onOpenProject={openProject} onNewProject={startNewProject} />
      ) : (
        <ReviewView project={project} onUpdateProject={updateProject} onExit={() => setProject(null)} />
      )}
    </div>
  );
}
