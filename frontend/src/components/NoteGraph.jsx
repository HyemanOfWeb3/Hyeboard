import { memo, useMemo } from "react";
import { ExternalLink } from "lucide-react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getNoteHref } from "../lib/noteLinks";

const GraphNoteNode = memo(({ data }) => {
  const { navigate } = data;
  return (
    <button
      type="button"
      className={`graph-note-node ${data.isCurrent ? "graph-note-node--current" : ""}`}
      onClick={() => navigate(data.note)}
      title={`Open ${data.title}`}
    >
      <strong>{data.title}</strong>
      <span>
        {data.backlinkCount} in · {data.outgoingCount} out
      </span>
    </button>
  );
});

const GraphToolbar = ({
  onReset,
  scope,
  setScope,
  depth,
  setDepth,
  truncated,
}) => {
  const { fitView } = useReactFlow();
  return (
    <div className="graph-toolbar" aria-label="Graph controls">
      <div className="graph-toolbar__group">
        <label>
          <span>View</span>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value="local">Local neighborhood</option>
            <option value="full">Full graph</option>
          </select>
        </label>
        {scope === "local" && (
          <label>
            <span>Depth</span>
            <select
              value={depth}
              onChange={(event) => setDepth(Number(event.target.value))}
            >
              <option value={1}>1 hop</option>
              <option value={2}>2 hops</option>
            </select>
          </label>
        )}
      </div>
      <div className="graph-toolbar__group">
        {truncated && (
          <span className="graph-toolbar__note">Showing a limited graph</span>
        )}
        <button
          type="button"
          className="text-button"
          onClick={() => {
            fitView({ padding: 0.2, duration: 350 });
            onReset?.();
          }}
        >
          Reset view
        </button>
      </div>
    </div>
  );
};

const NoteGraph = ({
  graph,
  currentNoteId,
  navigate,
  scope,
  setScope,
  depth,
  setDepth,
}) => {
  const nodes = useMemo(() => {
    const center = graph.nodes.find((node) => node.id === currentNoteId);
    const ordered = center
      ? [center, ...graph.nodes.filter((node) => node.id !== currentNoteId)]
      : graph.nodes;
    const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
    return ordered.map((node, index) => ({
      id: node.id,
      type: "note",
      position: {
        x: (index % columns) * 230,
        y: Math.floor(index / columns) * 130,
      },
      data: {
        ...node,
        isCurrent: node.id === currentNoteId,
        navigate: (note) => navigate(getNoteHref(note)),
      },
    }));
  }, [currentNoteId, graph.nodes, navigate]);

  const edges = useMemo(
    () =>
      graph.edges.map((edge) => ({
        ...edge,
        animated: false,
        markerEnd: { type: "arrowclosed" },
        label: edge.count > 1 ? String(edge.count) : undefined,
      })),
    [graph.edges],
  );

  if (!graph.nodes.length) {
    return (
      <div className="graph-empty">
        <strong>No connected notes yet.</strong>
        <span>
          Create or link notes to see your workspace relationships here.
        </span>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="graph-shell">
        <GraphToolbar
          {...{ scope, setScope, depth, setDepth, truncated: graph.truncated }}
        />
        <div className="graph-canvas" aria-label="Knowledge graph">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={{ note: GraphNoteNode }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.25}
            maxZoom={1.8}
            nodesConnectable={false}
            nodesDraggable
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(126, 211, 154, 0.12)" gap={28} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) =>
                node.data?.isCurrent ? "#7ed39a" : "#496b55"
              }
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
        <div
          className="graph-accessible-list"
          aria-label="Graph note relationships"
        >
          <div className="eyebrow">Notes in view</div>
          {graph.nodes.map((node) => (
            <a
              key={node.id}
              href={getNoteHref(node.note)}
              onClick={(event) => {
                event.preventDefault();
                navigate(getNoteHref(node.note));
              }}
            >
              <span>{node.title}</span>
              <small>
                {node.backlinkCount} incoming · {node.outgoingCount} outgoing
              </small>
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </div>
    </ReactFlowProvider>
  );
};

export default NoteGraph;
