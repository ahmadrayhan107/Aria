/**
 * Maps a card's place in the visible (possibly filtered) column to an index in the full column.
 * `visible` contains `id` at its new spot; `full` is the full target column without `id`.
 * A lone card dropped into an empty visible column goes to the top when `atTop`, else the end.
 */
export function fullIndex(visible: number[], id: number, full: number[], atTop = false): number {
  const i = visible.indexOf(id);
  let index = -1;
  if (i + 1 < visible.length) index = full.indexOf(visible[i + 1]!);
  else if (i > 0) {
    const prev = full.indexOf(visible[i - 1]!);
    index = prev < 0 ? -1 : prev + 1;
  } else index = atTop ? 0 : full.length;
  return index < 0 ? full.length : index;
}
