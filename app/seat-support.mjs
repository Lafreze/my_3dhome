// Hip clearance measured on the deformed, straight-legged production meshes.
// Seat anchors describe cushion tops, not the character's hip joint.
export const seatedHipHeight = {
  resident: 0.069,
  bear: 0.151,
  cat: 0.156,
  fox: 0.167,
  noir: 0.134,
  rose: 0.162,
  ivory: 0.137,
  dusk: 0.154,
  ribbon: 0.126,
};
export const seatedBackOffset = (seatId) =>
  seatId.includes('sofa') ? 0.12 : 0;
