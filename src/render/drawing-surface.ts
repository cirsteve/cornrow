export interface Point { readonly x: number; readonly y: number }
export interface Size { readonly width: number; readonly height: number }
export interface Rect extends Point, Size {}
export interface Segment { readonly from: Point; readonly to: Point }

export interface DrawingSurface {
  size(): Size;
  clear(color: string): void;
  fillRect(rect: Rect, color: string): void;
  strokeLines(segments: readonly Segment[], color: string, width: number): void;
  fillCircle(center: Point, radius: number, color: string): void;
  polyline(points: readonly Point[], color: string, width: number): void;
}
