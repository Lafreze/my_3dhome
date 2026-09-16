# Relaxed seated poses and bedroom finishes — 2026-09-16

## Behavior

- All six visitor figures use individually weighted, relaxed seated arms. Bear's held bag follows the hand; fox's clasped forearms are lowered independently of the skirt and tail fan. Original standing/rest artwork, faces, hair, UVs and textures remain intact.
- Arm and leg influence are bound against the intact standing surface. Hanging hands no longer inherit the low-leg walking offset. Roaming adds restrained counter-swing and fades stride amplitude at the current phase when stopping.
- The existing resident skeleton now eases walking transitions and includes small shin/foot articulation. The original hands-in-pockets silhouette is retained.
- Head, breathing, leg and arm weights share one vec4 vertex attribute. This keeps instanced eyelids within the WebGL attribute limit; color and shadow passes use the same motion and rotated normals/tangents.
- These supplied visitor GLBs contain no source skeleton or animation clips. This revision improves the existing continuous-surface deformation system; it does not invent or replace the user's source rig.

## Bedroom

- Independent white-oak finishes on floor boards, bed frame, cabinetry, window trim and bedroom doors, using the existing reviewed photographic oak textures. Five floor batches and floor height are unchanged.
- Mineral plaster uses the reviewed white-plaster normal/roughness maps, with consistent physical texture scale.
- Cotton, linen, wool, curtains and the bound rug use fine fibre normals, soft sheen and varied roughness. Duvet and pillows gain restrained edge gathers without exceeding the existing sleeping surface envelope.
- Bedside cabinets now have travertine tops; bedroom hardware uses brushed metal. Existing bed color controls still mutate the original live material instances.
- No extra services, asset downloads or production data changes are needed. Existing CC0 texture provenance remains in `config/asset-catalog.json`.

## Validation

Passed:

- `npm run typecheck`
- Targeted `oxlint` on all changed source and validation files
- `npm run build` (existing large-chunk advisory only)
- `node scripts/check-relaxed-arms.ts`: all six actual GLB pairs; standing data unchanged, finite vertices, unchanged faces/hair, relaxed arm targets, hands excluded from leg stride and no newly stretched triangle edges
- `node --test scripts/check-character-polish.test.mjs`: resident seated volume, legacy static tailoring and normal continuity
- `node scripts/check-visitor-motion.mjs`: 29 identities over 120 seconds each
- `node scripts/check-visitor-rest.mjs`: intact standing/rest surfaces and both bed fits
- `node --test scripts/check-roaming.test.mjs`: seven movement, doorway, camera and dialogue checks
- `npm exec --yes --package=tsx -- tsx scripts/check-interiors.mjs`: finite geometry, planar pillow UVs, bounded duvet hems and floor batching
- Local production build at port 3008: bedroom, keyboard roaming, stopped pose, shadows and material rendering; no console warnings/errors in the fresh production tab.
- Blender comparison of all six original and revised seated figures. Reproducible derived GLBs: `node scripts/check-relaxed-arms.ts --export`; ignored QA output is in `output/pose-bedroom-review/`.

Browser review caught an additional vertex attribute exceeding the eyelid shader limit during development. Limb weights were packed into the existing attribute before the passing production check.
