# Local material sources

The furniture models, room layout, UI, artwork and animation code are original to this project. Four public material sets from Poly Haven supply selected albedo, OpenGL normal and roughness maps. The JPG files are stored in `public/materials/` and are served by the local application; the browser does not request them from a CDN.

| Material | Source | License | Use |
| --- | --- | --- | --- |
| Fine Grained Wood | https://polyhaven.com/a/fine_grained_wood | CC0 1.0 | Wood furniture, edges and joinery |
| Brown Leather | https://polyhaven.com/a/brown_leather | CC0 1.0 | Reading chair upholstery |
| Fabric Pattern 07 | https://polyhaven.com/a/fabric_pattern_07 | CC0 1.0 | Weave normal / roughness, with local solid-color textiles |
| White Plaster 02 | https://polyhaven.com/a/white_plaster_02 | CC0 1.0 | Plaster normal / roughness, with a locally generated base color |

License statement: https://polyhaven.com/license

All four sets were obtained as 1K JPG maps on 2026-09-07. `public/materials/manifest.json` records the original download URL, byte count and SHA-256 hash for every stored file. Albedo maps that are not applied to the current solid-color textile/plaster finish remain in the corresponding source sets for later use.

No Poly Haven preview renders, website text, trademarks or user-submitted renders are used in the scene.
