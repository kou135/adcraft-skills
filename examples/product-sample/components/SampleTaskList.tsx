import type { CSSProperties } from "react";

export interface SampleTask {
  id: string;
  title: string;
  project: string;
  projectColor: string;
  due: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "med" | "high";
}

export interface SampleTaskListProps {
  projectName?: string;
  tasks?: SampleTask[];
}

const DEFAULT_TASKS: SampleTask[] = [
  {
    id: "t1",
    title: "Wireframe を Figma で起こす",
    project: "Acme Inc.",
    projectColor: "#2563eb",
    due: "Today",
    status: "in_progress",
    priority: "high",
  },
  {
    id: "t2",
    title: "API スキーマレビュー",
    project: "Delta Labs",
    projectColor: "#a855f7",
    due: "Today",
    status: "todo",
    priority: "high",
  },
  {
    id: "t3",
    title: "ロゴカラー A/B 比較",
    project: "Gamma Co.",
    projectColor: "#f59e0b",
    due: "Tomorrow",
    status: "todo",
    priority: "med",
  },
  {
    id: "t4",
    title: "デプロイ手順ドキュメント化",
    project: "Beta Studio",
    projectColor: "#16a34a",
    due: "Fri",
    status: "todo",
    priority: "low",
  },
  {
    id: "t5",
    title: "OG 画像差し替え",
    project: "Acme Inc.",
    projectColor: "#2563eb",
    due: "Done",
    status: "done",
    priority: "low",
  },
];

export const SampleTaskList: React.FC<SampleTaskListProps> = ({
  projectName = "All Tasks",
  tasks = DEFAULT_TASKS,
}) => {
  const containerStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    backgroundColor: "#ffffff",
    color: "#0a0a0a",
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    overflow: "hidden",
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{projectName}</div>
        <div
          style={{
            backgroundColor: "#2563eb",
            color: "#ffffff",
            padding: "8px 14px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          + Add task
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, fontSize: 13, color: "#71717a" }}>
        <span style={{ color: "#0a0a0a", fontWeight: 600 }}>All</span>
        <span>·</span>
        <span>Today</span>
        <span>·</span>
        <span>Upcoming</span>
        <span>·</span>
        <span>Done</span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
};

const TaskRow: React.FC<{ task: SampleTask }> = ({ task }) => {
  const isDone = task.status === "done";
  const checkbox = isDone ? (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: "#16a34a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#ffffff",
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      ✓
    </div>
  ) : (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        border: "2px solid #d4d4d8",
      }}
    />
  );

  const priorityChip =
    task.priority === "high" ? (
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: 99,
          backgroundColor: "#fee2e2",
          color: "#b91c1c",
        }}
      >
        HIGH
      </span>
    ) : task.priority === "med" ? (
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: "2px 8px",
          borderRadius: 99,
          backgroundColor: "#fef3c7",
          color: "#a16207",
        }}
      >
        MED
      </span>
    ) : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        backgroundColor: "#fafafa",
        borderRadius: 10,
        border: "1px solid #f1f5f9",
      }}
    >
      {checkbox}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: isDone ? "#a1a1aa" : "#0a0a0a",
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {task.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: task.projectColor,
              }}
            />
            <span style={{ color: "#71717a" }}>{task.project}</span>
          </div>
          <span style={{ color: "#d4d4d8" }}>·</span>
          <span style={{ color: "#71717a" }}>{task.due}</span>
        </div>
      </div>
      {priorityChip}
    </div>
  );
};
