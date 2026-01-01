import React from "react";

export default function SetupView(props: {
  projects: { id: string; filePath: string }[];
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
}) {
  const { projects, onOpenProject, onNewProject } = props;

  return (
    <div className="grid two">
      <div className="card">
        <div className="h2">Start</div>
        <div style={{ marginTop: 8 }} className="small">
          Create a new project by selecting a folder of Hudl MP4 clips (chronological order).
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={onNewProject}>Select Clips Folder</button>
        </div>

        <div style={{ marginTop: 18 }} className="small">
          Tips:
          <ul>
            <li>Clips must be MP4 and in chronological order.</li>
            <li>Use signed yard line input: +25, 0, -25.</li>
            <li>Mark Q2/Q3/Q4 once while reviewing.</li>
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="h2">Existing Projects</div>
        <div style={{ marginTop: 8 }} className="small">
          Autosaved projects stored locally on this computer.
        </div>

        <div style={{ marginTop: 12 }}>
          {projects.length === 0 ? (
            <div className="small">No projects yet.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: "ui-monospace" }}>{p.id}</td>
                    <td>
                      <button className="secondary" onClick={() => onOpenProject(p.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
