import { useMemo } from 'react';
import { useProject } from '../state/ProjectContext';
import { pertExpected, pertStdDev } from '../utils/scheduling';
import { formatDateID } from '../utils/dates';
import { formatNumber } from '../utils/format';

const NODE_W = 178;
const NODE_H = 68;
const GAP_X = 72;
const GAP_Y = 24;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function PertDiagram() {
  const { data, schedule } = useProject();

  const layout = useMemo(() => {
    const byId = new Map(data.tasks.map((t) => [t.id, t]));
    const layer = new Map<string, number>();
    for (const id of schedule.order) {
      const task = byId.get(id);
      if (!task) continue;
      let depth = 0;
      for (const dep of task.dependencies) {
        const predLayer = layer.get(dep.taskId);
        if (predLayer !== undefined) depth = Math.max(depth, predLayer + 1);
      }
      layer.set(id, depth);
    }

    const columns = new Map<number, string[]>();
    for (const [id, depth] of layer) {
      const column = columns.get(depth) ?? [];
      column.push(id);
      columns.set(depth, column);
    }
    for (const [depth, ids] of columns) {
      ids.sort(
        (a, b) => (schedule.items[a]?.earlyStart ?? 0) - (schedule.items[b]?.earlyStart ?? 0),
      );
      columns.set(depth, ids);
    }

    const maxLayer = columns.size === 0 ? 0 : Math.max(...Array.from(columns.keys()));
    const position = new Map<string, { x: number; y: number }>();
    let maxRows = 0;
    for (let depth = 0; depth <= maxLayer; depth += 1) {
      const ids = columns.get(depth) ?? [];
      maxRows = Math.max(maxRows, ids.length);
      ids.forEach((id, index) => {
        position.set(id, {
          x: 16 + depth * (NODE_W + GAP_X),
          y: 16 + index * (NODE_H + GAP_Y),
        });
      });
    }

    return {
      layer,
      position,
      maxLayer,
      width: 32 + (maxLayer + 1) * NODE_W + maxLayer * GAP_X,
      height: 32 + Math.max(1, maxRows) * NODE_H + Math.max(0, maxRows - 1) * GAP_Y,
    };
  }, [data.tasks, schedule]);

  const edges = useMemo(() => {
    const list: {
      key: string;
      d: string;
      label: string;
      lx: number;
      ly: number;
      critical: boolean;
    }[] = [];
    for (const task of data.tasks) {
      const to = layout.position.get(task.id);
      if (!to) continue;
      for (const dep of task.dependencies) {
        const from = layout.position.get(dep.taskId);
        if (!from) continue;
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const dx = Math.max(36, ((x2 - x1) * 0.6) || 36);
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
        const critical =
          Boolean(schedule.items[dep.taskId]?.critical) && Boolean(schedule.items[task.id]?.critical);
        list.push({
          key: `${task.id}:${dep.taskId}:${dep.type}`,
          d,
          label: dep.lag > 0 ? `${dep.type}+${dep.lag}` : dep.type,
          lx: (x1 + x2) / 2,
          ly: (y1 + y2) / 2 - 6,
          critical,
        });
      }
    }
    return list;
  }, [data.tasks, layout, schedule]);

  if (data.tasks.length === 0) {
    return <p className="empty-state">Belum ada tugas untuk dianalisis.</p>;
  }

  return (
    <div className="pert-scroll">
      <svg
        width={layout.width}
        height={layout.height}
        className="pert-svg"
        role="img"
        aria-label="Diagram PERT jaringan tugas"
      >
        <defs>
          <marker
            id="pert-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#64748b" />
          </marker>
          <marker
            id="pert-arrow-critical"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#dc2626" />
          </marker>
        </defs>

        {edges.map((edge) => (
          <g key={edge.key}>
            <path
              d={edge.d}
              fill="none"
              className={`pert-edge${edge.critical ? ' is-critical' : ''}`}
              markerEnd={`url(#${edge.critical ? 'pert-arrow-critical' : 'pert-arrow'})`}
            />
            <text x={edge.lx} y={edge.ly} className={`pert-edge-label${edge.critical ? ' is-critical' : ''}`}>
              {edge.label}
            </text>
          </g>
        ))}

        {data.tasks.map((task) => {
          const pos = layout.position.get(task.id);
          if (!pos) return null;
          const item = schedule.items[task.id];
          const expected = pertExpected(task.pert);
          const sigma = pertStdDev(task.pert);
          const critical = Boolean(item?.critical);
          return (
            <g
              key={task.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className={`pert-node${critical ? ' is-critical' : ''}`}
            >
              <rect className="pert-node-bg" width={NODE_W} height={NODE_H} rx={10} />
              <rect className="pert-node-accent" width={6} height={NODE_H} rx={3} fill={task.color} />
              <text x={16} y={22} className="pert-title">
                {truncate(task.name, 23)}
              </text>
              <text x={16} y={42} className="pert-meta">
                E {formatNumber(expected, 1)} · σ {formatNumber(sigma, 1)} hr
              </text>
              <text x={16} y={58} className="pert-meta">
                {item ? `${formatDateID(item.start)} → ${formatDateID(item.finish)}` : '—'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
