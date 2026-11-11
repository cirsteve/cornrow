import type { DrawingSurface, Point, Rect, Segment, Size } from './drawing-surface.js';

export type DrawingCall =
  | { readonly method: 'clear'; readonly color: string }
  | { readonly method: 'fillRect'; readonly rect: Rect; readonly color: string }
  | { readonly method: 'strokeLines'; readonly segments: readonly Segment[]; readonly color: string; readonly width: number }
  | { readonly method: 'fillCircle'; readonly center: Point; readonly radius: number; readonly color: string }
  | { readonly method: 'polyline'; readonly points: readonly Point[]; readonly color: string; readonly width: number };

export class RecordingSurface implements DrawingSurface {
  readonly calls: DrawingCall[] = [];
  constructor(private readonly dimensions: Size = { width: 500, height: 500 }) {}
  size(): Size { return { ...this.dimensions }; }
  clear(color: string): void { this.calls.push({ method: 'clear', color }); }
  fillRect(rect: Rect, color: string): void { this.calls.push({ method: 'fillRect', rect: { ...rect }, color }); }
  strokeLines(segments: readonly Segment[], color: string, width: number): void {
    this.calls.push({ method: 'strokeLines', segments: segments.map(segment => ({ from: { ...segment.from }, to: { ...segment.to } })), color, width });
  }
  fillCircle(center: Point, radius: number, color: string): void {
    this.calls.push({ method: 'fillCircle', center: { ...center }, radius, color });
  }
  polyline(points: readonly Point[], color: string, width: number): void {
    this.calls.push({ method: 'polyline', points: points.map(point => ({ ...point })), color, width });
  }
}
