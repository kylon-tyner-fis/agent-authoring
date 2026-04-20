import {
  BaseEdge,
  EdgeProps,
  getSmoothStepPath,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import { useCallback } from "react";

export function ShiftEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data,
    selected,
  } = props;

  const { setEdges } = useReactFlow();
  const { zoom } = useViewport();

  const shift = (data?.shift as number) || 0;
  const isLoop = sourceX >= targetX;

  const customCenterX = !isLoop ? (sourceX + targetX) / 2 + shift : undefined;
  const customCenterY = isLoop
    ? Math.min(sourceY, targetY) - 100 + shift
    : undefined;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 20,
    centerX: customCenterX,
    centerY: customCenterY,
  });

  // --- NATIVE DRAG LOGIC ON THE GROUP ---
  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGGElement>) => {
      // Only react to the left mouse button
      if (event.button !== 0) return;

      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);

      const startMouseX = event.clientX;
      const startMouseY = event.clientY;
      const initialShift = shift;

      const onPointerMove = (e: PointerEvent) => {
        const rawDelta = isLoop
          ? (e.clientY - startMouseY) / zoom
          : (e.clientX - startMouseX) / zoom;

        const snappedDelta = Math.round(rawDelta / 10) * 10;

        setEdges((edges) =>
          edges.map((edge) =>
            edge.id === id
              ? {
                  ...edge,
                  data: { ...edge.data, shift: initialShift + snappedDelta },
                }
              : edge,
          ),
        );
      };

      const onPointerUp = (e: PointerEvent) => {
        target.releasePointerCapture(e.pointerId);
        target.removeEventListener("pointermove", onPointerMove);
        target.removeEventListener("pointerup", onPointerUp);
      };

      target.addEventListener("pointermove", onPointerMove);
      target.addEventListener("pointerup", onPointerUp);
    },
    [id, isLoop, shift, zoom, setEdges],
  );

  return (
    <g
      onPointerDown={onPointerDown}
      className="cursor-grab active:cursor-grabbing nodrag"
    >
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        // Tell React Flow to generate a thick 30px invisible hit-area
        interactionWidth={30}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          stroke: selected ? "#3b82f6" : "#94a3b8",
        }}
      />
    </g>
  );
}
