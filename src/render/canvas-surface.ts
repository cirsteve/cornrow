import type { DrawingSurface, Size } from './drawing-surface';

export interface CanvasResize extends Size { readonly dpr: number }
export interface CanvasSurface extends DrawingSurface { resize(size: CanvasResize): void }

/** All geometry is in CSS pixels; no browser globals are accessed here. */
export function createCanvasSurface(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, dpr: number): CanvasSurface {
  let dimensions: Size = { width: canvas.width / dpr, height: canvas.height / dpr };
  function resize(size: CanvasResize): void {
    if (!Number.isFinite(size.dpr) || size.dpr <= 0 || !Number.isFinite(size.width)
      || !Number.isFinite(size.height) || size.width < 0 || size.height < 0) {
      throw new RangeError('canvas resize: invalid size or device pixel ratio');
    }
    dimensions = { width: size.width, height: size.height };
    canvas.width = Math.round(size.width * size.dpr);
    canvas.height = Math.round(size.height * size.dpr);
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  }
  resize({ ...dimensions, dpr });
  return {
    size: () => ({ ...dimensions }), resize,
    clear(color) {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    },
    fillRect(rect, color) { ctx.fillStyle = color; ctx.fillRect(rect.x, rect.y, rect.width, rect.height); },
    strokeLines(segments, color, width) {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
      for (const { from, to } of segments) { ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); }
      ctx.stroke();
    },
    fillCircle(center, radius, color) {
      ctx.beginPath(); ctx.fillStyle = color; ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.fill();
    },
    polyline(points, color, width) {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      points.forEach((point, index) => index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
      ctx.stroke();
    },
  };
}
