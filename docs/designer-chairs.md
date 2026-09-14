# 椅子升级 · 2026-09-14

此次替换 14 把椅子，保留原有房间布局、座位锚点和互动：

- 书房：菱格软包工作椅、干邑色皮革实木扶手阅读椅。阅读椅原有换色和座上书本继续可用。
- 咖啡厅：7 把菱格软包餐椅、2 把曲木高背休闲椅。
- 卧室：暖米色亚麻实木扶手椅。
- 藏书室：软包书桌椅、曲木高背休闲椅。

## 素材来源

以下模型均由 Poly Haven 以 [CC0](https://polyhaven.com/license) 提供，可随应用分发。出处、作者、修改和最终文件 SHA-256 同时登记在 `config/asset-catalog.json`，项目素材鸣谢会自动收录。

| 模型 | 作者 | 用途 |
| --- | --- | --- |
| [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) | Vibrant Nordic | 实木扶手椅 |
| [Dining Chair 02](https://polyhaven.com/a/dining_chair_02) | James Ray Cock | 菱格餐椅与工作椅 |
| [Mid Century Lounge Chair](https://polyhaven.com/a/mid_century_lounge_chair) | Kuutti Siitonen | 曲木高背休闲椅 |

保留原始轮廓、UV 和烘焙细节；去重、压缩 1K JPEG 贴图并封装自包含 GLB。三款共约 3 MB。运行时柔化法线强度与环境反光，扶手椅软包使用房间配色。高背椅按坐垫高度调整底座，避免整体纵向拉长椅背。餐椅收窄深度以保留通道。

素材随现有 Railway 应用部署，目录使用 `delivery: "origin"`，由原有内容哈希和校验加载器读取。进入对应房间才解析，同款模型共享资源；加载前或失败时保留旧造型，成功后整体隐藏旧造型及旧附加木作。关闭场景时释放加载资源。

## 重建素材

从 `https://api.polyhaven.com/files/<素材ID>` 的 `gltf.1k.gltf` 项下载主文件及 `include` 全部依赖；保持依赖相对路径，将主文件保存为：

- `output/chair-upgrade/modern/source.gltf`
- `output/chair-upgrade/dining/source.gltf`
- `output/chair-upgrade/lounge/source.gltf`

执行 `node scripts/prepare-designer-chairs.mjs` 后，重新确认模型及授权记录，更新 catalog 中三个 `sourceSha256`，执行 `npm run assets:prepare`。生产构建直接使用已提交的 GLB，不访问素材网站。

## 验证

`check-designer-chairs.test.mjs` 从真正的 GLB 几何测量 14 个坐垫，验证坐垫与座位误差小于 0.006、椅脚落地、椅背高度和通道尺寸，并验证自包含贴图、本地来源 URL 和总体积。配合咖啡厅、藏书室、材质及素材管线检查，以及桌面和手机浏览器实测。
