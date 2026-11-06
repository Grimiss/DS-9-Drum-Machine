const WIDTH = 1754;
const HEIGHT = 886;
export type VisibleArea = {
  width: number;
  height: number;
  left?: number;
  top?: number;
  insetLeft?: number;
  insetRight?: number;
  insetTop?: number;
  insetBottom?: number;
};
/** One uniform hardware canvas, fitted inside the visible browser area. */
export function fitHardware(area: VisibleArea) {
  const gutter = 4;
  const left = (area.left ?? 0) + (area.insetLeft ?? 0) + gutter;
  const top = (area.top ?? 0) + (area.insetTop ?? 0) + gutter;
  const width = Math.max(1, area.width - (area.insetLeft ?? 0) - (area.insetRight ?? 0) - gutter * 2);
  const height = Math.max(1, area.height - (area.insetTop ?? 0) - (area.insetBottom ?? 0) - gutter * 2);
  const scale = Math.min(width / WIDTH, height / HEIGHT);
  return {scale, width: WIDTH * scale, height: HEIGHT * scale,
    left: left + (width - WIDTH * scale) / 2,
    top: top + (height - HEIGHT * scale) / 2};
}
export function mountHardwareViewport(root: HTMLElement) {
  const machine = root.querySelector<HTMLElement>('.machine')!;
  let frame = 0;
  let fitted = false;
  const resize = () => {
    frame = 0;
    const viewport = window.visualViewport;
    // Let deliberate pinch zoom enlarge/pan the instrument. Fit again on zoom reset.
    if (viewport && viewport.scale > 1.01 && fitted) return;
    const padding = getComputedStyle(document.body);
    const fit = fitHardware({
      width: viewport?.width ?? window.innerWidth,
      height: viewport?.height ?? window.innerHeight,
      left: viewport?.offsetLeft ?? 0,
      top: viewport?.offsetTop ?? 0,
      insetLeft: parseFloat(padding.paddingLeft) || 0,
      insetRight: parseFloat(padding.paddingRight) || 0,
      insetTop: parseFloat(padding.paddingTop) || 0,
      insetBottom: parseFloat(padding.paddingBottom) || 0,
    });
    Object.assign(root.style, {width: `${fit.width}px`, height: `${fit.height}px`,
      left: `${fit.left}px`, top: `${fit.top}px`});
    machine.style.transform = `scale(${fit.scale})`;
    fitted = true;
  };
  const queue = () => {if (!frame) frame = requestAnimationFrame(resize);};
  window.addEventListener('resize', queue);
  window.addEventListener('orientationchange', queue);
  window.visualViewport?.addEventListener('resize', queue);
  window.visualViewport?.addEventListener('scroll', queue);
  resize();
  return () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener('resize', queue);
    window.removeEventListener('orientationchange', queue);
    window.visualViewport?.removeEventListener('resize', queue);
    window.visualViewport?.removeEventListener('scroll', queue);
  };
}
