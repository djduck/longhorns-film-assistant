export function parseSignedYardLine(input: string): number | null {
  const s = (input || "").trim();
  if (!s) return null;
  const m = s.match(/^([+-]?)(\d{1,2})$/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const n = parseInt(m[2], 10);
  if (n === 0) return 0;
  if (n < 1 || n > 50) return null;
  return sign * n;
}

export function signedToAbs(y: number): number {
  if (y === 0) return 50;
  if (y > 0) return y;
  return 100 - Math.abs(y);
}

export function computeGnls(
  currY: number,
  nextY: number,
  currOdk: "O"|"D"|"K",
  nextOdk: "O"|"D"|"K",
  sameQuarter: boolean,
  currPenalty: boolean,
  nextPenalty: boolean
): number | null {
  if (!sameQuarter) return null;
  if (currPenalty || nextPenalty) return null;
  if (currOdk === "K" || nextOdk === "K") return null;
  if (currOdk !== nextOdk) return null;

  const currAbs = signedToAbs(currY);
  const nextAbs = signedToAbs(nextY);

  let gain = 0;
  if (currOdk === "O") gain = nextAbs - currAbs;
  else gain = currAbs - nextAbs;

  if (Math.abs(gain) > 80) return null;
  return Math.round(gain);
}
