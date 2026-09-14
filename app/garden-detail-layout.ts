/** Contact heights and reserved prop areas, in each furniture group's local coordinates. */
export const gardenDetails = {
  reading: {
    radius: 0.86,
    top: 0.8575,
    album: { x: -0.18, z: 0.06, yaw: -0.1, scale: 0.8 },
    guide: { x: -0.32, z: -0.47, width: 0.36, depth: 0.29, yaw: 0.08 },
    cup: { x: 0.44, z: 0.34, radius: 0.125 },
    plate: { x: 0.42, z: -0.38, radius: 0.18 },
    magnifier: { x: -0.57, z: 0.46, yaw: 0.65 },
  },
  bookcase: { top: 1.3275, plantX: -0.78, bookStart: -0.16, basketX: 0.72 },
  workcloth: { x: 0.99, y: 1.119, z: 0.674, width: 0.42, run: 0.3, drop: 0.32 },
  picnic: {
    width: 1.17,
    depth: 0.72,
    rim: 0.567,
    hingeZ: -0.393,
    angle: -1.86,
  },
  basin: { radius: 0.47, waterY: 0.73 },
} as const;
