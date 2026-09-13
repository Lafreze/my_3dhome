// Local gallery coordinates. Keep the west door at z=1.85 and the north/south aisles open.
export const galleryPlinths = [
  {
    id: 'gallerySculpture',
    x: 0.1,
    z: -1.05,
    width: 1.15,
    depth: 1.15,
    height: 0.94,
  },
  {
    id: 'galleryGame',
    x: -1.85,
    z: -0.05,
    width: 1.15,
    depth: 1.15,
    height: 0.94,
  },
  {
    id: 'galleryCase',
    x: 2.35,
    z: -0.05,
    width: 1.15,
    depth: 1.15,
    height: 0.94,
  },
] as const;
export const galleryCabinet = {
  x: -3.56,
  z: -0.25,
  width: 0.62,
  depth: 1.8,
  height: 2.62,
};
export const galleryTriptych = {
  centers: [-0.65, 0.78, 2.21],
  y: 2.12,
  z: -3.1,
  frameWidth: 1.27,
  frameHeight: 1.76,
  imageWidth: 1.15,
  imageHeight: 1.64,
};
