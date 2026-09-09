# kuro.cafe 静态资源迁移

本仓库使用 **vinext 1.0.0-beta.5、Vite 8、React 19、Three.js 0.185**。`next.config.ts` 指定静态导出；`scripts/serve-local.mjs` 在 Railway 提供 `dist/client` 和原有座位 API，Dockerfile 构建镜像。本次没有引入 Next.js 图片服务器、资源代理或浏览器签名 URL。

**当前发布状态：代码和本地迁移工具已实现；R2 上线仍待 Bucket、凭证、域名和模型权利确认。** 未设置公开资源变量时仍读取本地 `/assets`。本次没有删除原模型、原贴图、Blender 工程，未切换线上资源来源。

## 目录与清单

```text
Railway / kuro.cafe
  HTML、JS、CSS、favicon、原有 API
  /assets/                       本地生产衍生资源，保留回滚能力
Cloudflare R2 / assets.kuro.cafe
  kuro/manifests/assets.json      可公开清单，缓存 300 秒
  kuro/manifests/assets.<hash>.json  每次发布的不可变清单快照
  kuro/models/characters/<角色>/<姿势>.<hash>.glb
  kuro/models/rooms/gallery/crowned-rabbit.<hash>.glb
  kuro/textures/shared/<材质>/<贴图>.<hash>.(jpg|webp)
  kuro/textures/rooms/cafe/<材质>/<贴图>.<hash>.(jpg|webp)
  kuro/decoders/{draco,basis,meshopt}/<文件>.<hash>.(js|wasm)
  kuro/licenses/<解码器>.<hash>.txt
```

角色和王冠兔在授权未确认前不会出现在 R2 清单中。它们保留在本地生产目录，URL 工具明确选择本地来源，不会先尝试 R2 再回退。未来 GLTF/BIN、KTX2、AVIF、PNG、HDR、OGG、MP3、运行时 JSON 可通过生产 catalog 登记；没有为当前并不存在的音频、HDRI 或房间 GLB 伪造条目。

- `config/asset-catalog.json` 是明确审核过的输入清单。禁止自动上传整个 public、assets、下载目录或素材包。
- `scripts/prepare-assets.mjs` 扫描现有资源，验证授权、来源哈希、格式、路径、纹理尺寸以及 GLTF 依赖，生成 `public/assets/`、`app/generated/asset-manifest.json`、Credits 和 `docs/assets-inventory.json`。
- 颜色 JPG 转 WebP quality 85；法线和粗糙度只使用更小的无损 WebP，否则保留原有 1K JPG。源文件不变。
- GLB 保留当前已优化的约 10 万三角面与不超过 2K 的纹理；不再对人物几何二次减面，以免破坏现有姿态、面部和材质分区。
- GLTF 的外部依赖必须在 catalog 的 `dependencies` 中逐个声明；依赖先哈希，GLTF 的 URI 重写后再哈希，因此依赖变化也会改变模型文件名。GLB 必须自包含，或先转换为带完整声明的 GLTF。
- 远端资源构建会比对仓库中已审核的清单：若不同平台/依赖版本产生不同生产字节，构建会停止，要求在对应构建环境重新 prepare、上传和验证；不会静默引用尚未上传的哈希。
- 文件名使用最终字节 SHA-256 的前 16 位，清单记录完整 SHA-256 与 size；稳定排序、不含构建时间，因此相同输入不会产生无意义新版本。
- 浏览器使用与构建绑定的清单，避免新清单与旧前端混用。公共 `assets.json` 用于发布和验收，最后更新；不可变快照用于保留最近版本。
- `assetUrl(idOrPath)` 是唯一生产路径入口，支持逻辑 ID、相对路径、完整 HTTPS URL，拒绝目录穿越和 URL 中的凭证。

## Cloudflare 控制台操作

当前环境未提供 R2 凭证，以下账户配置需由有权限的用户完成。不同控制台语言下菜单名称可能略有区别。

1. **账户 → Storage & databases → R2 object storage → Overview → Create bucket**。建议 Bucket 名 `kuro-assets`（尚未创建，不是既有资源名）；Default storage class 选择 **Standard**。只放生产资源，不与私有文件、上传数据或备份共用 Bucket。
2. 进入 Bucket → **Settings → Custom Domains → Connect Domain**，填写 `assets.kuro.cafe`，确认 Cloudflare 将添加的 DNS 记录。`kuro.cafe` 域名区域须与 Bucket 属于同一 Cloudflare 账户。不要手工把 CNAME 指向 r2.dev。
3. 等待 Custom Domain 状态成为 **Active**，确认 HTTPS 证书有效。启用域名时不需要同时启用 r2.dev。
4. Bucket → **Settings → CORS Policy → Add / Edit CORS policy → JSON**，粘贴 `config/r2-cors.json` 的数组内容，然后 Save。它允许生产的 `https://kuro.cafe`、`https://www.kuro.cafe` 与开发的 `http://localhost:3000`、`http://localhost:5173`。不要误粘贴 Wrangler 的 `{rules: ...}` 格式，此文件使用控制台 / S3 规则字段格式。
5. 自定义域名的原生公开 R2 服务只提供对象读取，根路径不会列出对象。无需创建 Worker、目录 index.html、ListObjects API 或任何自动目录站点。不要上传目录占位页。清单本身是有意公开的资源目录数据，因此知道该清单的人仍可获知文件 URL；它不是保密机制。
6. 不提供匿名写入，不创建上传 Worker 或公开签名服务。CORS 只包含 **GET、HEAD**，不包含 PUT、POST、DELETE。CORS 控制浏览器跨域读取，不阻止用户直接下载公开模型。
7. **R2 Overview → Manage R2 API Tokens → Create Account API Token**（或 User API Token）。权限选择 **Object Read & Write**；Bucket 范围选择 **Apply to specific buckets only → 目标 Bucket**，不选账户管理权限。保存 Access Key ID、Secret Access Key 到本地 `.env.r2.local` 或 CI secrets，绝不提交 Git。
8. **前缀权限的重要限制**：普通长期 R2 API Token 的控制台权限范围是 Bucket，不能声称界面能设置对象前缀。本工具在可信 Node 进程内，用父凭证签发有效期 1 小时的 R2 temporary credentials：只允许目标 Bucket、`paths.prefixPaths: ["kuro/"]`，以及 GET/HEAD/PUT/ListObjectsV2；只有 `--prune` 才加入 DeleteObject。R2 校验该 scope，脚本每次操作也检查 `kuro/` 前缀。长期父密钥仍是 Bucket 级能力，须保存在可信机器；若 CI 也不能持有父密钥，由可信发行方颁发相同范围的三元组（Access Key / Secret / `R2_SESSION_TOKEN`）给 CI。本工具不会打印或传给浏览器这些凭证，也没有使用浏览器临时签名 URL。
9. Bucket → **Settings → Public Development URL → Disable**，确认 r2.dev 关闭，只保留自定义域名。控制台如显示 Enable，保持未启用。
10. 域名区域 `kuro.cafe` → **Caching → Cache Rules → Create rule**：表达式 `http.host eq "assets.kuro.cafe" and starts_with(http.request.uri.path, "/kuro/")`；Cache eligibility 选 **Eligible for cache**。Edge TTL 选择 **Use cache-control header if present, bypass cache if not**；Browser TTL 选择 **Respect origin**。不要配置覆盖所有文件的一年 Edge TTL，也不要忽略查询参数或 Origin 的默认缓存行为。确保 `.glb`、`.wasm` 等不限于默认缓存扩展名。可按套餐启用 Smart Tiered Cache。
11. 如此前缓存过资源，再修改 CORS，按官方文档清理 **assets.kuro.cafe 这个 hostname** 的缓存。不要清理主站或删除 Bucket 对象；本次工具不会自动执行缓存清理。

参考：[公开 Bucket 与自定义域名](https://developers.cloudflare.com/r2/buckets/public-buckets/)、[CORS 控制台步骤](https://developers.cloudflare.com/r2/buckets/cors/)、[长期令牌权限](https://developers.cloudflare.com/r2/api/tokens/)、[前缀与操作范围](https://developers.cloudflare.com/r2/api/s3/temporary-credentials/)、[本地签发凭证协议](https://developers.cloudflare.com/r2/examples/authenticate-r2-temp-credentials/)、[缓存规则选项](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)、[S3 条件上传与 Content-MD5 支持](https://developers.cloudflare.com/r2/api/s3/api/)。

## 环境变量与命令

仅有一个公开变量：

```dotenv
VITE_ASSET_BASE_URL=https://assets.kuro.cafe/kuro
```

它在 **构建时**被 Vite 写入前端。Dockerfile 显式声明同名 ARG；修改 Railway 变量后必须重新构建，重启旧容器不会改变编译后的 URL。未设置或留空使用 `/assets`。本地开发可在 `.env.local` 设置同名变量；不要创建 ASSET_BASE_URL / NEXT_PUBLIC_ASSET_BASE_URL 等未使用别名。

上传机器或 CI 需要：`R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME`。`R2_ENDPOINT` 可省略，自动使用 Cloudflare 账户的 S3 endpoint；EU / FedRAMP Bucket 按账户 endpoint 配置。`R2_SESSION_TOKEN` 仅用于外部颁发的受限上传会话。**Railway 运行服务只需 VITE_ASSET_BASE_URL，不需要 R2 写入凭证**。`.env.example` 只含占位值；上传命令自动读取 git-ignored 的 `.env.r2.local`。

首次上传前：

```sh
npm ci
npm run assets:prepare
npm run assets:check
npm run assets:upload -- --dry-run
```

离线 dry-run 不要求凭证，验证文件、内容哈希、路径、格式、授权与依赖；输出的是拟上传数量，不能判断远端新增 / 更新 / 跳过。配置凭证后相同命令会只读比较远端。首次实际上传及后续更新使用同一条命令：

```sh
npm run assets:upload
npm run assets:verify
```

脚本先检查全部准备文件，再逐个 HEAD / PUT；不变的对象按 SHA-256 metadata、大小、Content-Type、Cache-Control 跳过。上传带 Content-MD5 校验，并保留 R2 原生 ETag；不会错误地把 ETag 视为 SHA-256。失败返回非零退出码，并保持线上清单；所有对象成功后才更新清单。实际上传统计 added / updated / skipped / failed / excluded / pruned。

使用已准备并审核过的另一份生产目录：`npm run assets:upload -- --source /absolute/path/to/prepared-assets`，目录内容必须与本次生成的清单哈希完全一致，不能用原始素材目录替代。

默认**不删除任何远端对象**。显式清理流程：

```sh
npm run assets:upload -- --prune --dry-run
npm run assets:upload -- --prune
```

清理先列出完整对象 key，再删除：仅 `kuro/` 内、带内容哈希、metadata `managed-by=kuro-assets`、不在当前清单且不被最近 30 天发布快照引用的旧对象。默认保留 30 天，可显式 `--keep-days 60`；不能设为 0。未知对象和前缀外对象永不删除。不要并行运行上传与 prune；清理前还会复核线上清单的 ETag。长期开着旧标签页的用户可能超过保留期，需要按实际回滚窗口决定清理时间；本次未执行 prune。

## 无中断迁移与回滚

1. 在本地审核 `docs/assets-inventory.json` 和模型授权模板。确认 7 个模型的 R2 分发权后，补全 catalog 中的作者、许可、来源 / 授权证据，才设 `approval: "approved"`。未经确认不能批量改为 approved。
2. 运行 prepare、测试、dry-run，随后上传。整个阶段不改线上 VITE_ASSET_BASE_URL，不删除既有文件。
3. 自定义域名 Active 后运行 `npm run assets:verify`。必须确认清单与本次版本匹配、每个对象 HEAD、每种现有扩展名 GET 字节哈希和 Range、缓存、Origin 隔离、根目录无列表全部通过。结果写入 `output/r2-verification.json`。未通过则停止切换。
4. 设置本地 `.env.local` 的公开变量，重新 build，使用 `http://localhost:5173` 验收所有房间、角色颜色、休息、互动、相邻预加载、重试和移动端。回滚到本地模式只需清空变量并重新 build。
5. Railway 当前只存在既有 `my-3dhome` 服务的 production 环境，尚无预览环境。R2 验证后，在同一项目建立用户批准的隔离预览环境（不可连接 / 覆盖现有生产状态），使用相同 Dockerfile 和公开变量部署候选版本。预览临时域名不在生产 CORS 白名单：优先使用正式站点 Origin 的受控本地验收；若要在 Railway 临时域名直接验收，须临时添加该**确切**预览 Origin，验收后移除并按需清理该资源 hostname 的缓存，绝不使用 `*`。
6. 预览完整通过后再更新既有 production 服务的 VITE_ASSET_BASE_URL 并重新部署。保持 kuro.cafe 前端/API 在 Railway，不添加额外站点或外网隧道。
7. 如有问题，Railway Deployments 选择迁移前的成功部署 **Redeploy / Rollback**，或清空公开变量重新构建。旧文件保留，R2 旧 hash 也保留；不必在故障时重新上传旧大文件。切勿在回滚前 prune。
8. 生产稳定并经过回滚窗口后，才考虑将已迁移生产大文件从 Git 和 Railway 包移除。当前 prebuild 从原文件可重复生成，所以正式移除前需先建立可信的生产输入归档 / CI 恢复流程，并保留本地开发说明；不要简单删除文件导致下一次 build 失败。无需删除远端 Git 历史。本次没有进行这一步。

## 实际加载与资源所有权

房间结构、家具、庭院、画作和大部分表面均为本地程序几何 / Canvas；没有五个房间的 GLB 可以拆包。网络资源按房间安排：首屏书房和共享贴图，展厅使用程序化项目展品，咖啡厅的剩余专用贴图进入时加载。共享纹理只请求一次；当前房间成功后用 requestIdleCallback 预取相邻房间的字节，不解析非当前房间模型。节流 / Save-Data 网络不做空闲预取，快速切换会停止后续旧预取任务。

角色沿用既有共享几何缓存并按角色拆分：有角色出现在可见房间时，才取得该角色坐姿与站立休息两份模型；编辑器按需使用同一租约缓存。单个角色失败不妨碍其他角色与房屋显示。已加载的角色 / 展台在房间间往返不重复下载或解析。

下载进度来自 ReadableStream 字节数，按清单已知大小汇总，不使用计时模拟。下载完成到准备画面完成之间保留「正在准备画面」状态。失败显示可点击重试提示，重试只由用户触发，不在每次房间切换或座位轮询时无限重试，也不在 R2 与本地之间循环请求。

离开房间会释放没有可见消费者的 GPU Geometry / Material / Texture；仍保留程序结构与已加载模型的 CPU 数据以便回访。离开整屋场景、关闭最后一个模型租约时释放几何、材质、贴图及 ImageBitmap，移除失效 Blob 缓存。下载字节缓存上限 64 MiB，Three.js 与浏览器缓存保留。原程序场景仍一次创建五个房间的 CPU 几何，当前优化针对网络与 GPU；未声称已将所有程序几何构造延后。

用户上传画作、个人资料、外部视频和天气 API 不属于公开生产资源，不进入 catalog / R2。当前音乐由 Web Audio 合成，没有 MP3/OGG/WAV；视频使用用户选择的外链，因此没有本项目音视频对象可做公网 Range 验收。上传工具与本地服务器已支持 OGG/MP3 MIME，验证工具会在添加这类资源后自动抽查。

## 资源大小和验收记录

下表为生产 catalog 的归属统计上界，包含保留素材，并非当前页面必然下载量。室内改造取消了默认王冠兔、胡桃木／木桌／水磨石专用贴图以及未使用的细木色彩图请求，运行时仅加载已登记的当前房间任务。角色作为独立可见对象按需追加。

| 房间 | 独立进入时生产资源字节 | MiB | 文件数 |
| --- | ---: | ---: | ---: |
| 书房 | 4,493,340 | 4.29 | 10 |
| 客厅 | 2,759,834 | 2.63 | 7 |
| 卧室 | 2,759,834 | 2.63 | 7 |
| 展示区 | 6,331,930 | 6.04 | 8 |
| 咖啡厅 | 6,520,148 | 6.22 | 18 |

从书房继续访问客厅 / 卧室无需额外必需静态资源（空闲时仍会预取相邻房间）；当前展示区不再追加王冠兔模型；咖啡厅只追加仍使用的皮革专用贴图。三个角色双姿势合计 20,960,672 字节：熊 7,188,488；猫 6,454,584；狐狸 7,317,600。解码器仅在模型声明压缩扩展时加载；现有模型未使用这些扩展。

详细本地验收结果在 `docs/r2-assets-validation.md`，完整逐文件分类在 `docs/assets-inventory.json`。公网 R2 验收不能用本地测试通过替代。
