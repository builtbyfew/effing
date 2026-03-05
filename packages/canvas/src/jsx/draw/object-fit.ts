/**
 * Shared cover/contain sizing logic used by both `<img>` objectFit
 * and `backgroundImage` + `backgroundSize`.
 */

export interface FitRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Compute source and destination rectangles for "cover" sizing.
 * The image fills the box completely, cropping the excess.
 */
export function computeCover(
  imgW: number,
  imgH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): FitRect {
  const imgRatio = imgW / imgH;
  const boxRatio = boxW / boxH;

  let sx: number, sy: number, sw: number, sh: number;

  if (imgRatio > boxRatio) {
    sh = imgH;
    sw = imgH * boxRatio;
    sx = (imgW - sw) / 2;
    sy = 0;
  } else {
    sw = imgW;
    sh = imgW / boxRatio;
    sx = 0;
    sy = (imgH - sh) / 2;
  }

  return { sx, sy, sw, sh, dx: boxX, dy: boxY, dw: boxW, dh: boxH };
}

/**
 * Compute destination rectangle for "contain" sizing.
 * The image fits entirely within the box, centered, with no cropping.
 */
export function computeContain(
  imgW: number,
  imgH: number,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): FitRect {
  const imgRatio = imgW / imgH;
  const boxRatio = boxW / boxH;

  let dw: number, dh: number;

  if (imgRatio > boxRatio) {
    dw = boxW;
    dh = boxW / imgRatio;
  } else {
    dh = boxH;
    dw = boxH * imgRatio;
  }

  const dx = boxX + (boxW - dw) / 2;
  const dy = boxY + (boxH - dh) / 2;

  return { sx: 0, sy: 0, sw: imgW, sh: imgH, dx, dy, dw, dh };
}
