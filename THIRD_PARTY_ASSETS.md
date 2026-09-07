# Local material sources

The furniture models, room layout, UI, artwork and animation code are original to this project. Four public material sets from Poly Haven supply selected albedo, OpenGL normal and roughness maps. The JPG files are stored in `public/materials/` and are served by the local application; the browser does not request them from a CDN.

| Material          | Source                                    | License | Use                                                             |
| ----------------- | ----------------------------------------- | ------- | --------------------------------------------------------------- |
| Fine Grained Wood | https://polyhaven.com/a/fine_grained_wood | CC0 1.0 | Wood furniture, edges and joinery                               |
| Brown Leather     | https://polyhaven.com/a/brown_leather     | CC0 1.0 | Reading chair upholstery                                        |
| Fabric Pattern 07 | https://polyhaven.com/a/fabric_pattern_07 | CC0 1.0 | Weave normal / roughness, with local solid-color textiles       |
| White Plaster 02  | https://polyhaven.com/a/white_plaster_02  | CC0 1.0 | Plaster normal / roughness, with a locally generated base color |

License statement: https://polyhaven.com/license

All four sets were obtained as 1K JPG maps on 2026-09-07. `public/materials/manifest.json` records the original download URL, byte count and SHA-256 hash for every stored file. Albedo maps that are not applied to the current solid-color textile/plaster finish remain in the corresponding source sets for later use.

No Poly Haven preview renders, website text, trademarks or user-submitted renders are used in the scene.

## Weather data and design references

Current weather and city search use Open-Meteo (https://open-meteo.com/), with attribution in the weather panel. Data license: https://open-meteo.com/en/terms (CC BY 4.0 attribution). Solar-position calculations implement the equations published by NOAA: https://gml.noaa.gov/grad/solcalc/solareqns.PDF.

Garden window proportions and joinery were visually studied using architectural reference photographs from a+u / Jutakutokushu, “Eaves & Windows” (https://au-magazine.com/shop/jutakutokushu/jt-201911/) and Sansoh (https://juutaku.co.jp/works/works_36.html). These photographs are references only: no photographs, building models or copyrighted texture files from them are included. The exterior site, plants, houses and hardware are original procedural geometry.

## 用户提供的展厅模型

- 原始文件：`Hi3D_Untitled_allparts_20260907_215458.glb`，由用户提供。未声称其属于公共授权素材。
- 本地衍生文件：`public/models/gallery-figure.glb`。使用本机 Blender 优化为 116,828 个三角面，修复白毛和黑色描边、沿原模型眼部曲面重新着色并去掉浮在面部外的额外眼球，修整鼻口细节，以顶点颜色和独立材质替代错误贴图，并将底部对齐、适配展台。原始下载文件未修改。
- 用户于 2026-09-07 明确授权随本次项目推送 GitHub 并部署 Railway。
- 处理脚本：`scripts/prepare-sculpture.py` 与 `scripts/refine-rabbit.py`；尺寸与处理统计：`public/models/gallery-figure.json`。
- 新增客厅、卧室、展厅纹理与展厅三联画由 `app/house-finishes.ts` 在本地生成，各房间使用不同纹理算法和种子，无运行时素材网络请求。
