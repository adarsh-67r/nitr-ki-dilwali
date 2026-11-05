/** clip-path polygon with zigzag (paper-tear) edges, like a printed slip. */
export function zigzag({ top = false, bottom = false, teeth = 36, depth = 10 } = {}) {
  const pts: string[] = [];
  const step = 100 / teeth;
  if (top) for (let i = 0; i <= teeth; i++) pts.push(`${(i * step).toFixed(3)}% ${i % 2 ? 0 : depth}px`);
  else pts.push("0 0", "100% 0");
  if (bottom) for (let i = teeth; i >= 0; i--) pts.push(`${(i * step).toFixed(3)}% calc(100% - ${i % 2 ? 0 : depth}px)`);
  else pts.push("100% 100%", "0 100%");
  return `polygon(${pts.join(", ")})`;
}

export const tab = "polygon(14% 0, 86% 0, 100% 100%, 0 100%)";
