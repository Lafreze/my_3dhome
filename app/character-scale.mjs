// Scene units, measured from the intact standing exports, including headwear.
// Apply once at the actor root so all authored body proportions are preserved.
export const humanHeight = 1.3;
export const sourceHeights = {
  bear: 1.26996961236,
  cat: 1.459973990917,
  fox: 1.150250583887,
  noir: 1.299999952316,
  rose: 1.135127723217,
  resident: 1.649999976158,
};
export const humanScale = (character) => humanHeight / sourceHeights[character];
