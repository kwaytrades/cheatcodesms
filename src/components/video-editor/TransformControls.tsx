import React, { useState, useRef, useEffect } from "react";
import { Overlay } from "@/lib/video-editor/types";
import { RotateCw } from "lucide-react";

interface TransformControlsProps {
  overlay: Overlay;
  onChange: (updates: Partial<Overlay>) => void;
  containerWidth: number;
  containerHeight: number;
  playerScale: number;
  playerOffsetX: number;
  playerOffsetY: number;
}

export const TransformControls: React.FC<TransformControlsProps> = ({
  overlay,
  onChange,
  containerWidth,
  containerHeight,
  playerScale,
  playerOffsetX,
  playerOffsetY,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number; left: number; top: number } | null>(null);
  const rotateStartRef = useRef<{ angle: number; centerX: number; centerY: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragStartRef.current) {
        const deltaX = e.clientX - dragStartRef.current.x;
        const deltaY = e.clientY - dragStartRef.current.y;
        
        // Convert screen delta to composition coordinates
        const compositionDeltaX = deltaX / playerScale;
        const compositionDeltaY = deltaY / playerScale;
        
        // Apply constraints to keep within bounds
        const newLeft = Math.max(0, Math.min(containerWidth - overlay.width, dragStartRef.current.left + compositionDeltaX));
        const newTop = Math.max(0, Math.min(containerHeight - overlay.height, dragStartRef.current.top + compositionDeltaY));
        
        onChange({
          left: newLeft,
          top: newTop,
        });
      } else if (isResizing && resizeStartRef.current) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        
        // Convert screen delta to composition coordinates
        const compositionDeltaX = deltaX / playerScale;
        const compositionDeltaY = deltaY / playerScale;
        
        let newWidth = resizeStartRef.current.width;
        let newHeight = resizeStartRef.current.height;
        let newLeft = resizeStartRef.current.left;
        let newTop = resizeStartRef.current.top;

        if (isResizing.includes("right")) {
          newWidth = Math.max(50, resizeStartRef.current.width + compositionDeltaX);
        }
        if (isResizing.includes("left")) {
          newWidth = Math.max(50, resizeStartRef.current.width - compositionDeltaX);
          newLeft = resizeStartRef.current.left + compositionDeltaX;
        }
        if (isResizing.includes("bottom")) {
          newHeight = Math.max(50, resizeStartRef.current.height + compositionDeltaY);
        }
        if (isResizing.includes("top")) {
          newHeight = Math.max(50, resizeStartRef.current.height - compositionDeltaY);
          newTop = resizeStartRef.current.top + compositionDeltaY;
        }

        // Apply constraints
        newWidth = Math.min(newWidth, containerWidth - newLeft);
        newHeight = Math.min(newHeight, containerHeight - newTop);

        onChange({
          width: newWidth,
          height: newHeight,
          left: newLeft,
          top: newTop,
        });
      } else if (isRotating && rotateStartRef.current) {
        const centerX = rotateStartRef.current.centerX;
        const centerY = rotateStartRef.current.centerY;
        
        const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const degrees = angle * (180 / Math.PI) + 90;
        
        onChange({
          rotation: Math.round(degrees),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
      setIsRotating(false);
      dragStartRef.current = null;
      resizeStartRef.current = null;
      rotateStartRef.current = null;
    };

    if (isDragging || isResizing || isRotating) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, isRotating, onChange]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      left: overlay.left,
      top: overlay.top,
    };
  };

  const handleResizeStart = (corner: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(corner);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: overlay.width,
      height: overlay.height,
      left: overlay.left,
      top: overlay.top,
    };
  };

  const handleRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRotating(true);
    
    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (rect) {
      rotateStartRef.current = {
        angle: overlay.rotation || 0,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      };
    }
  };

  const boxStyle: React.CSSProperties = {
    position: "absolute",
    left: overlay.left * playerScale + playerOffsetX,
    top: overlay.top * playerScale + playerOffsetY,
    width: overlay.width * playerScale,
    height: overlay.height * playerScale,
    transform: `rotate(${overlay.rotation || 0}deg)`,
    transformOrigin: "center center",
    border: "2px solid hsl(var(--primary))",
    pointerEvents: "all",
    zIndex: 1000,
  };

  const handleStyle: React.CSSProperties = {
    position: "absolute",
    width: "12px",
    height: "12px",
    background: "hsl(var(--primary))",
    border: "2px solid white",
    borderRadius: "50%",
    cursor: "pointer",
  };

  return (
    <div style={boxStyle}>
      {/* Center drag area */}
      <div
        className="absolute inset-0 cursor-move bg-primary/10 hover:bg-primary/20 transition-colors"
        onMouseDown={handleDragStart}
      />

      {/* Corner resize handles */}
      <div
        style={{ ...handleStyle, top: "-6px", left: "-6px", cursor: "nwse-resize" }}
        onMouseDown={handleResizeStart("top-left")}
      />
      <div
        style={{ ...handleStyle, top: "-6px", right: "-6px", cursor: "nesw-resize" }}
        onMouseDown={handleResizeStart("top-right")}
      />
      <div
        style={{ ...handleStyle, bottom: "-6px", left: "-6px", cursor: "nesw-resize" }}
        onMouseDown={handleResizeStart("bottom-left")}
      />
      <div
        style={{ ...handleStyle, bottom: "-6px", right: "-6px", cursor: "nwse-resize" }}
        onMouseDown={handleResizeStart("bottom-right")}
      />

      {/* Rotation handle */}
      <div
        style={{
          ...handleStyle,
          top: "-30px",
          left: "50%",
          transform: "translateX(-50%)",
          cursor: "grab",
        }}
        onMouseDown={handleRotateStart}
      >
        <RotateCw className="h-3 w-3 text-white absolute inset-0 m-auto" style={{ pointerEvents: "none" }} />
      </div>
    </div>
  );
};
