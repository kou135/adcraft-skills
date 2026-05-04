import type { CSSProperties } from "react";

/**
 * TaskFlow サンプル商品のダッシュボード画面。
 * 純粋なプレゼンテーショナルコンポーネント：API 呼び出しなし、props でダミーデータを受け取る。
 *
 * 注：OSS サンプルとしての可搬性を優先し、Tailwind ではなく inline style で実装。
 * 利用者が実プロダクトを Skill A で抽出する際は元プロジェクトの Tailwind 設定を引き継ぐ想定。
 */

export interface ProjectSummary {
  id: string;
  name: string;
  taskCount: number;
  doneCount: number;
  color: string;
}

export interface SampleDashboardProps {
  userName?: string;
  projects?: ProjectSummary[];
  todayCount?: number;
  weekCount?: number;
}

const DEFAULT_PROJECTS: ProjectSummary[] = [
  { id: "p1", name: "Acme Inc. — LP Renewal", taskCount: 12, doneCount: 8, color: "#2563eb" },
  { id: "p2", name: "Beta Studio — Mobile App", taskCount: 18, doneCount: 5, color: "#16a34a" },
  { id: "p3", name: "Gamma Co. — Brand Refresh", taskCount: 7, doneCount: 7, color: "#f59e0b" },
  { id: "p4", name: "Delta Labs — API v2", taskCount: 24, doneCount: 11, color: "#a855f7" },
];

export const SampleDashboard: React.FC<SampleDashboardProps> = ({
  userName = "Kota",
  projects = DEFAULT_PROJECTS,
  todayCount = 6,
  weekCount = 23,
}) => {
  const containerStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundColor: "#fafafa",
    color: "#0a0a0a",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    padding: "24px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, color: "#71717a", marginBottom: 2 }}>
            Good morning,
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
            {userName} 👋
          </div>
        </div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "#2563eb",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 12 }}>
        <StatCard label="Today" value={todayCount} accent="#2563eb" />
        <StatCard label="This week" value={weekCount} accent="#16a34a" />
        <StatCard label="Projects" value={projects.length} accent="#a855f7" />
      </div>

      {/* Projects */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 600 }}>Active Projects</div>
          <div style={{ fontSize: 13, color: "#71717a" }}>{projects.length} total</div>
        </div>
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; accent: string }> = ({
  label,
  value,
  accent,
}) => {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: "#ffffff",
        borderRadius: 14,
        border: "1px solid #e5e7eb",
        padding: "14px 16px",
      }}
    >
      <div style={{ fontSize: 12, color: "#71717a", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
};

const ProjectRow: React.FC<{ project: ProjectSummary }> = ({ project }) => {
  const pct = Math.round((project.doneCount / project.taskCount) * 100);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "14px 16px",
        backgroundColor: "#ffffff",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: project.color,
          }}
        />
        <div style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{project.name}</div>
        <div style={{ fontSize: 13, color: "#71717a" }}>
          {project.doneCount}/{project.taskCount}
        </div>
      </div>
      <div
        style={{
          height: 6,
          backgroundColor: "#f1f5f9",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            backgroundColor: project.color,
            transition: "width 0.3s",
          }}
        />
      </div>
    </div>
  );
};
