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

## 咖啡厅（2026-09-08）

独立使用 Poly Haven 的 CC0 纹理：

- [Walnut Veneer 02](https://polyhaven.com/a/walnut_veneer_02)：主要木作与桌面。
- [Wood Table 001](https://polyhaven.com/a/wood_table_001)：深色木边、框架与柜体。
- [Terrazzo Tiles](https://polyhaven.com/a/terrazzo_tiles)：水磨石地面。
- [Leather White](https://polyhaven.com/a/leather_white)：独立染色皮革的法线与粗糙度。

每项 1K 本地贴图的来源、字节数与 SHA-256 记录在 `public/materials/manifest.json`，下载时验证原始 MD5。台面细矿物纹理、菜单、植物画和全部咖啡厅几何由项目原创。设计参考 [Starbucks 官方咖啡厅设计介绍](https://about.starbucks.com/stories/2025/starbucks-coffeehouse-designs-enter-a-new-era-take-a-look/)，未复制品牌标识或使用其照片作为贴图。

### Studio visitor

`public/models/studio-visitor.glb` is an original seated character authored in the local Blender application through [Blender MCP](https://github.com/ahujasid/blender-mcp) (MIT integration). The user's supplied image guided the warm palette and stylized proportions; no third-party character mesh or reference-image texture is included. Cotton knit/twill and subtle hair textures are generated locally. Editable source: `assets/models/studio-visitor.blend`. Modeling stages: `scripts/model-visitor.py`, `scripts/refine-visitor.py`, `scripts/finalize-visitor.py`, `scripts/polish-visitor.py`, `scripts/fit-visitor.py`. The integration ran with telemetry disabled and did not upload project data.


### Studio visitor v2 — supplied bear-girl reference

`public/models/studio-visitor-v2.glb` is a local derivative of the user-supplied `Hi3D_Stylized Chibi Bear Girl 3D Character_allparts_20260908_150541.glb`. It retains the supplied face and bow-boot geometry and UV textures. The seated body, wardrobe silhouettes, four modular hairstyles, bear hood, knitted fabric and fitted sock bands were authored in the local Blender application through Blender MCP. The reference's original file was left untouched; no mesh or texture was uploaded to an external processor or hosting service.

Editable source: `assets/models/studio-visitor-v2.blend`. Reproducible modeling script: `scripts/remodel-visitor.py` (set `STUDIO_VISITOR_REFERENCE` when rebuilding from the original GLB at another path). The source model was supplied by the user for this local project; no public redistribution license is asserted for it.

### Studio visitors v3 — intact source characters, seated locally

Seated source assets: `public/models/studio-visitor-bear-v3.glb` and `public/models/studio-visitor-cat-v3.glb`. Both are local derivatives of user-provided files:

- `Hi3D_Stylized Chibi Bear Girl 3D Character_allparts_20260908_150541.glb`
- `Hi3D_Stylized Chibi Punk Catgirl 3D Figurine_allparts_20260908_163305.glb`

The complete source geometry, facial surfaces, clothing, accessories and UV artwork were retained. A continuous pelvis/knee deformation and a separate drape correction create the seated pose shown in the user's reference. The source files were not overwritten. Blender MCP ran locally with telemetry disabled. The exported characters have about 102k triangles each and 2048 px texture derivatives, with material regions for optional color changes. The original palette uses the unchanged base-color artwork.

Editable source: `assets/models/studio-visitors-v3.blend`; reproducible authoring: `scripts/pose-source-visitors.py`. The earlier v1/v2 models remain local historical files and are not included in this publication. No independent public redistribution license is asserted for these supplied characters. The user explicitly authorized publishing the current project to the existing GitHub repository and Railway service on 2026-09-08.

### Third visitor — user-supplied nine-tailed kitsune

`public/models/studio-visitor-fox-v3.glb` is a local derivative of `Hi3D_Chibi Nine-Tailed Fox Kitsune 3D Figurine_allparts_20260908_174023.glb`, supplied by the user on 2026-09-08. The 5-million-triangle source was processed in the local Blender application through Blender MCP with telemetry disabled. Its entire mesh, face, floral ornament, embroidered kimono and all nine tails were retained; continuous body deformation creates the seated pose, while a compact upright fan keeps the tails clear of the cushion and neighboring seats. No external processing or hosting was used, and the original file was not overwritten.

The seated derivative contains 100,799 triangles and 2048 px local texture copies, about 3.7 MB. The optional kimono tint protects the warm gold embroidery; tails retain their original white material. Editable source: `assets/models/studio-visitor-fox-v3.blend`. Reproducible authoring: `scripts/pose-fox-visitor.py`. No independent public redistribution license is asserted; the user authorized this project's GitHub/Railway publication on 2026-09-08.

### Studio visitors v4 — retired resting derivative

The earlier inverse-pose derivatives and `assets/models/studio-visitors-rest-v4.blend` remain historical artifacts. They are no longer loaded or included in the deployment package, because reconstructing standing limbs from the seated surfaces distorted clothing.

### Studio visitors v5 — original standing bodies laid down rigidly

`public/models/studio-visitor-{bear,cat,fox}-standing-v5.glb` derive from the original standing surfaces saved in the v3 Blender projects, themselves derivatives of the three user-supplied files listed above. Local Blender exports preserve the complete body, clothing, accessories, tails and original UV artwork, with approximately 101k triangles and 2048 px textures. Each entire figure is rotated and translated onto its back without an inverse seated deformation or added joints. Original v3 seated models remain in use separately. The matching texture images share GPU resources. Live procedural eyelids and a small chest movement supply closed eyes and breathing.

Editable source: `assets/models/studio-standing-rest-v5.blend`. Rebuild with local Blender: `scripts/export-standing-visitors.py`; the older `scripts/pose-rest-visitors.py` entry point now forwards to it. No external model processing service was used. Original downloads and existing source projects were not overwritten. These project derivatives are included under the user's explicit publication authorization; no independent third-party redistribution license is asserted.

## R2 production derivatives (2026-09-09)

The original files and source records above remain intact. `config/asset-catalog.json` now selects the 21 material maps actually used by the website and records source hashes, authors, licenses, and modifications. Production albedo uses WebP quality 85; normal/roughness maps use lossless WebP only when smaller, otherwise retain the existing 1K JPG. Generated files live in `public/assets/`; their URL base is controlled by `VITE_ASSET_BASE_URL`, defaulting to local service. No R2 migration has been declared complete merely by generating these files.

Draco and Basis Universal runtime decoders use Apache-2.0, and Meshoptimizer uses MIT; official license texts are retained in `config/asset-licenses/` and included as hashed production license objects. Decoder runtimes are copied from the installed, lockfile-pinned Three.js package and are requested only for assets using those compression extensions. Sources and license links appear in the generated Credits data and the About panel.

The six character pose GLBs and the gallery sculpture remain `pending` for R2 public redistribution. Prior GitHub/Railway publication authorization is recorded above, but is not represented as an independent public model license or silently extended to R2. They continue to load from the local origin and are excluded from R2 upload until the rights holder's authorization is confirmed. See `docs/third-party-model-license-template.md`.

## Room details (2026-09-11)

[Book Pattern](https://polyhaven.com/a/book_pattern), by Rob Tuytel / Poly Haven, is used under [CC0](https://polyhaven.com/license) on the study archive box, listening journal, portable console pouch, library blotter and garden seed wallet. The 1K color, OpenGL normal and roughness maps are stored locally; source URLs, sizes and SHA-256 hashes are recorded in `public/materials/manifest.json` and the production catalog. No third-party image host is required at runtime. New door geometry, flower arrangements, paper labels and room props are original procedural models.

The 2026-09-12 miniature house map, bound-book construction, book covers, page edges, furniture joinery and end-grain graphics are original code-authored assets. Existing wood, cloth and leather materials retain their recorded licenses; no additional remote assets or runtime image hosts were introduced.
