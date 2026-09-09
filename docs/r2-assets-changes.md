# 本次修改文件

完整代码保存在 `codex/r2-assets` 分支。默认资源来源仍为本地；未进行 R2 生产切换。

部署与上传步骤见 [部署文档](r2-assets-deployment.md)，验证结果见 [验收记录](r2-assets-validation.md)。

| 文件 |
| --- |
| [.dockerignore](../.dockerignore) |
| [.env.example](../.env.example) |
| [.gitignore](../.gitignore) |
| [.railwayignore](../.railwayignore) |
| [Dockerfile](../Dockerfile) |
| [README.md](../README.md) |
| [THIRD_PARTY_ASSETS.md](../THIRD_PARTY_ASSETS.md) |
| [app/asset-loading.ts](../app/asset-loading.ts) |
| [app/asset-url.ts](../app/asset-url.ts) |
| [app/cafe-room.ts](../app/cafe-room.ts) |
| [app/gallery-model.ts](../app/gallery-model.ts) |
| [app/generated/asset-credits.json](../app/generated/asset-credits.json) |
| [app/generated/asset-manifest.json](../app/generated/asset-manifest.json) |
| [app/globals.css](../app/globals.css) |
| [app/house-rooms.ts](../app/house-rooms.ts) |
| [app/page.tsx](../app/page.tsx) |
| [app/room-data.ts](../app/room-data.ts) |
| [app/room-materials.ts](../app/room-materials.ts) |
| [app/room-resources.ts](../app/room-resources.ts) |
| [app/room-scene.ts](../app/room-scene.ts) |
| [app/seat-scene.ts](../app/seat-scene.ts) |
| [app/visitor-model.ts](../app/visitor-model.ts) |
| [app/vite-env.d.ts](../app/vite-env.d.ts) |
| [config/asset-catalog.json](../config/asset-catalog.json) |
| [config/asset-licenses/basis.txt](../config/asset-licenses/basis.txt) |
| [config/asset-licenses/draco.txt](../config/asset-licenses/draco.txt) |
| [config/asset-licenses/meshopt.txt](../config/asset-licenses/meshopt.txt) |
| [config/r2-cors.json](../config/r2-cors.json) |
| [docs/assets-inventory.json](../docs/assets-inventory.json) |
| [docs/r2-assets-changes.md](../docs/r2-assets-changes.md) |
| [docs/r2-assets-deployment.md](../docs/r2-assets-deployment.md) |
| [docs/r2-assets-validation.md](../docs/r2-assets-validation.md) |
| [docs/third-party-model-license-template.md](../docs/third-party-model-license-template.md) |
| [package-lock.json](../package-lock.json) |
| [package.json](../package.json) |
| [scripts/check-assets.test.mjs](../scripts/check-assets.test.mjs) |
| [scripts/lib/asset-policy.mjs](../scripts/lib/asset-policy.mjs) |
| [scripts/lib/r2-client.mjs](../scripts/lib/r2-client.mjs) |
| [scripts/prepare-assets.mjs](../scripts/prepare-assets.mjs) |
| [scripts/serve-local.mjs](../scripts/serve-local.mjs) |
| [scripts/upload-r2-assets.mjs](../scripts/upload-r2-assets.mjs) |
| [scripts/verify-r2-assets.mjs](../scripts/verify-r2-assets.mjs) |

`public/assets/` 是构建时生成且已忽略的目录，未提交大体积衍生文件；原始 `public/models/`、`public/materials/` 和 `assets/models/` 没有被删除或改写。模型仍等待 R2 公开分发授权。
