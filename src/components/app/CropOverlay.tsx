import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CropOverlayProps {
  imageBlob: Blob;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
}

export function CropOverlay({
  imageBlob,
  onCrop,
  onCancel,
}: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageUrl] = useState(() => URL.createObjectURL(imageBlob));
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState<DragHandle | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, crop: crop });
  const [containerScale, setContainerScale] = useState(1);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  // Initialize crop to center 60%
  useEffect(() => {
    if (!imageUrl || !containerRef.current) return;
    const img = new Image();
    img.onload = () => {
      const cw = containerRef.current?.clientWidth ?? img.width;
      const ch = containerRef.current?.clientHeight ?? img.height;
      const scale = Math.min(cw / img.width, ch / img.height);
      setContainerScale(scale);
      const dispW = img.width * scale;
      const dispH = img.height * scale;
      const cropW = dispW * 0.6;
      const cropH = dispH * 0.6;
      setCrop({
        x: (dispW - cropW) / 2,
        y: (dispH - cropH) / 2,
        w: cropW,
        h: cropH,
      });
    };
    img.src = imageUrl;
  }, [imageUrl]);

type DragHandle = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, handle: DragHandle) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(handle);
      dragStart.current = { mx: e.clientX, my: e.clientY, crop: { ...crop } };
    },
    [crop],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      const c = dragStart.current.crop;
      const minSize = 30;

      if (dragging === "move") {
        setCrop({
          ...c,
          x: Math.max(0, Math.min(c.x + dx, containerRef.current?.clientWidth ?? 0 - c.w)),
          y: Math.max(0, Math.min(c.y + dy, containerRef.current?.clientHeight ?? 0 - c.h)),
        });
        return;
      }

      let nx = c.x, ny = c.y, nw = c.w, nh = c.h;
      if (dragging.includes("e")) { nw = Math.max(minSize, c.w + dx); }
      if (dragging.includes("w")) { nx = c.x + dx; nw = Math.max(minSize, c.w - dx); }
      if (dragging.includes("s")) { nh = Math.max(minSize, c.h + dy); }
      if (dragging.includes("n")) { ny = c.y + dy; nh = Math.max(minSize, c.h - dy); }

      // Clamp to container
      const maxW = containerRef.current?.clientWidth ?? 0;
      const maxH = containerRef.current?.clientHeight ?? 0;
      if (nx < 0) { nw += nx; nx = 0; }
      if (ny < 0) { nh += ny; ny = 0; }
      if (nx + nw > maxW) nw = maxW - nx;
      if (ny + nh > maxH) nh = maxH - ny;

      setCrop({ x: nx, y: ny, w: nw, h: nh });
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const handleCrop = useCallback(async () => {
    if (!containerRef.current || crop.w < 1 || crop.h < 1) return;
    const img = new Image();
    img.src = imageUrl;
    await new Promise((r) => (img.onload = r));

    // Map display coordinates back to image coordinates
    const sx = crop.x / containerScale;
    const sy = crop.y / containerScale;
    const sw = crop.w / containerScale;
    const sh = crop.h / containerScale;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob((b) => r(b), "image/jpeg", 0.9),
    );
    if (blob) onCrop(blob);
  }, [imageUrl, crop, containerScale, onCrop]);

  if (!imageUrl) return null;

  const handleStyle =
    "absolute w-4 h-4 bg-white border-2 border-primary rounded-full shadow cursor-pointer z-10";
  const edgeStyle = "absolute bg-transparent z-10";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="flex flex-col items-center gap-3 max-w-[90vw] max-h-[85vh]">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg border border-white/20 bg-black select-none"
          style={{ maxWidth: "80vw", maxHeight: "70vh" }}
        >
          <img
            src={imageUrl}
            className="block max-w-full max-h-[70vh] pointer-events-none"
            draggable={false}
          />
          {/* Dark overlay outside crop */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to right,
                rgba(0,0,0,0.6) ${crop.x}px,
                transparent ${crop.x}px,
                transparent ${crop.x + crop.w}px,
                rgba(0,0,0,0.6) ${crop.x + crop.w}px)`,
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to bottom,
                rgba(0,0,0,0.6) ${crop.y}px,
                transparent ${crop.y}px,
                transparent ${crop.y + crop.h}px,
                rgba(0,0,0,0.6) ${crop.y + crop.h}px)`,
            }}
          />
          {/* Crop region border */}
          <div
            className="absolute border-2 border-white/80 pointer-events-none"
            style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
          />
          {/* Move handle */}
          <div
            className="absolute cursor-move z-10"
            style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
            onMouseDown={(e) => handleMouseDown(e, "move")}
          />
          {/* Corner handles */}
          {([
            ["nw", crop.x - 6, crop.y - 6],
            ["ne", crop.x + crop.w - 6, crop.y - 6],
            ["sw", crop.x - 6, crop.y + crop.h - 6],
            ["se", crop.x + crop.w - 6, crop.y + crop.h - 6],
          ] as const).map(([dir, left, top]) => (
            <div
              key={dir}
              className={handleStyle}
              style={{ left, top, cursor: dir === "nw" || dir === "se" ? "nwse-resize" : "nesw-resize" }}
              onMouseDown={(e) => handleMouseDown(e, dir)}
            />
          ))}
          {/* Edge handles */}
          {([
            ["n", crop.x + crop.w / 2 - 12, crop.y - 4, 24, 8, "ns-resize"],
            ["s", crop.x + crop.w / 2 - 12, crop.y + crop.h - 4, 24, 8, "ns-resize"],
            ["w", crop.x - 4, crop.y + crop.h / 2 - 12, 8, 24, "ew-resize"],
            ["e", crop.x + crop.w - 4, crop.y + crop.h / 2 - 12, 8, 24, "ew-resize"],
          ] as const).map(([dir, left, top, width, height, cursor]) => (
            <div
              key={dir}
              className={`${edgeStyle} bg-white/40 rounded-sm hover:bg-white/60`}
              style={{ left, top, width, height, cursor }}
              onMouseDown={(e) => handleMouseDown(e, dir)}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="cursor-pointer gap-1.5 text-white/70 hover:text-white"
          >
            <X className="size-4" />
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleCrop()}
            className="cursor-pointer gap-1.5"
          >
            <Check className="size-4" />
            Capture
          </Button>
        </div>
      </div>
    </div>
  );
}
