# R2 迁移验收记录

> 历史验收：本文记录 `9b2cd59` 的 R2 接入阶段。后续室内改造已取消默认王冠兔与部分专用材质的运行时加载，并增加第 32 个座位；当前视觉验收见 `docs/interior-art-direction.md`。R2 公网配置仍需单独完成。
日期：2026-09-09。验收对象是本地候选代码，未以本地通过替代公网 R2 或 Railway 预览验收。

## 已完成

| 检查 | 结果 |
| --- | --- |
| 本地默认资源构建 | 成功；vinext 完成 5 阶段构建和静态预渲染 |
| 配置 `VITE_ASSET_BASE_URL=https://assets.kuro.cafe/kuro` 的候选构建 | 成功；仅本地测试，未部署 |
| TypeScript | `npm run typecheck` 成功 |
| 本次修改文件 lint | 成功，无新增问题 |
| 全仓库 lint | 未通过；19 个已有通用 UI / hook 问题，详见下文 |
| 上传 / 哈希 / 安全测试 | `npm run assets:check`：8 项通过 |
| 原有房屋检查 | 家具边界、路径、碰撞、电视布局及 11 项视频 URL 检查通过 |
| 原有角色休息检查 | 熊、猫、狐狸的站立原身、UV、法线、眼睑和双床定位通过 |
| 原有座位检查 | 31 个座位、原子休息/起床、隐私、互动冷却/过期、身份、容量与 HTTP 边界通过 |
| 原资源路径识别 | 识别全部 7 个在用 GLB、21 个在用 JPG，以及退役模型、未用贴图、资料 JSON 和 4 个 Blender 源工程 |
| 旧资源 URL | app/lib 没有剩余 `/models/`、`/materials/` 加载字符串，也没有硬编码 Railway 资源 URL |
| 用户内容 | data/blob 图片、个人上传、外部视频和天气 API 单独保留，不上传 R2 |
| 资源清单 | 完整清单 37 项；公开候选 30 项；7 个待授权模型排除。JSON 可解析、版本和依赖哈希稳定 |
| dry-run | 32 个拟上传对象（30 项 + 当前清单 + 不可变清单快照），failed=0、excluded=7、pruned=0；未配置凭证，因此没有远端对比，不把 32 声称为真实新增 |
| 本地对象 HTTP | 201 项检查通过，覆盖全部 37 项的 HEAD、MIME、ETag、大小、缓存及每种实际扩展名 GET 哈希 / Range |
| 缓存策略 | 哈希对象 `public, max-age=31536000, immutable`；assets.json `public, max-age=300, must-revalidate`；HTML 仍 `no-cache` |
| 目录列表 | 未实现目录列表 API 或页面；上传只接受明确 catalog；本地静态服务不列目录 |
| 凭证隔离 | dist/client 中没有 R2 账户/访问/秘密/会话凭证变量或 Cloudflare API Token；前端只引用公开资源变量 |

安全测试包括：路径穿越、原始 OBJ / >2K 纹理 / symlink 阻止，GLTF 依赖重写与内容变化传递、稳定版本、容器不含源工程目录仍能生成、生产构建发现字节偏离已审核清单时停止、上传失败保留清单、不变文件跳过、dry-run 无写入、prune 范围与保留期、受限凭证操作列表。

全仓库 lint 的已有错误位于未修改的 `components/ui/{button-group,input-group,breadcrumb,input-otp,pagination,carousel,label,item,spinner,field,chart}.tsx` 和 `hooks/use-mobile.ts`，主要为无障碍语义、effect 内 setState 和模板类型规则。未为让结果变绿而放宽规则。构建仍有原有大型 JS chunk 提示；本次没有宣称已把 Three.js 或程序家具代码完全拆为房间包。

## 浏览器实测

使用 Playwright 驱动本地 Chromium。桌面和 390 × 844、DPR 2 的手机模拟视口；不是实体手机测量。

- 首屏无访客时：只请求书房 10 个纹理，合计 **4,493,340 bytes**。不下载角色、展厅 GLB 或咖啡厅纹理。
- 手机冷启动总响应体（包括 HTML）：**6,199,961 bytes，约 6.20 MB / 5.91 MiB**；导航 HTML 为 15,042 bytes。最终检查确认生产纹理仍全部使用本地来源。
- 手机冷启动子资源：**6,184,919 bytes**（未压缩的本地服务器响应体合计，含应用代码/样式/纹理/API 等；不含导航 HTML）。对应 transferSize 合计 6,190,919 bytes。手机 viewport 和 scrollWidth 均为 390，无横向溢出。
- 手机再次访问：10 个纹理条目的 transferSize 全部为 **0**，encodedBodySize 与清单一致，表明浏览器缓存命中。
- 依次访问书房、客厅、卧室、展示区、咖啡厅并往返：最终只有 **22 个唯一纹理/模型 URL**。其中 21 个纹理 + 王冠兔；没有回访重复请求。相邻房间会在空闲时预取，因此进入客厅时可观察到预取展示区模型，进入卧室后可观察到预取咖啡厅纹理。
- 用隔离、拦截的本地 presence 数据验证角色：首屏只有可见熊的 2 个 GLB；进入卧室才追加猫的 2 个 GLB；进入咖啡厅才追加狐狸的 2 个 GLB；随后往返仍为 6 个角色请求。猫在床上保持休息姿态。未写入真实访客数据，页面异常数为 0。
- 故障测试：拦截全部模型/纹理请求，页面保留房间和可操作导航，显示「部分模型或纹理未能加载」及重试按钮。切换房间并等待后请求数维持 10，没有无限重试；解除拦截并点击重试后恢复。
- 资源域名构建模拟：请求精确指向 `https://assets.kuro.cafe/kuro/` 下的哈希资源。模拟失败显示「资源服务暂时不可用，部分模型或纹理未能加载。」；用本地文件模拟跨域成功响应后重试恢复，继续进入咖啡厅正常。21 个唯一远端对象、31 次请求（包含主动重试的 10 次）。这是 URL 与 UI 模拟验收，不是公网 R2 验收。
- 浏览器发现的占位图 GPU 尺寸警告已修复；最终五房间检查未出现该警告。测试服务重启期间出现的暂时 API 连接拒绝不计入稳定候选测试。

截图在 git-ignored `output/playwright/`：`r2-{study,living,bedroom,gallery,cafe}.png`、`r2-mobile-study.png`、`r2-error-mobile.png`、`r2-retry-mobile.png`、`r2-characters-{study,bedroom,cafe}.png`、`r2-domain-{error,recovered}.png`。本地 HTTP 逐项报告为 `output/local-assets-http.json`，dry-run 为 `output/r2-dry-run.txt`。

## 未完成的外部验收

`npm run assets:verify` 对 `https://assets.kuro.cafe/kuro` 的实际公网请求失败：**ENOTFOUND**。当前环境没有 R2 环境变量或 `.env.r2.local`，未取得 Bucket 配置；用户尚未确认 7 个衍生模型的 R2 公开分发权。

因此以下项目尚未验证：真实上传 / 远端跳过与 ETag、HTTPS、自定义域名 CORS（含非允许 Origin）、R2 GET / HEAD / Range、CDN HIT、目录根路径无列表、R2 公开只读和 r2.dev 关闭、Railway 预览及生产切换。没有假报通过。当前没有本项目音视频文件，音视频对象 Range 为不适用；Web Audio 合成音乐不需要下载音频文件。

现有模型不包含 Draco / Meshopt / KTX2 压缩扩展；解码器文件已检查本地内容和响应头，但没有用另行引入的压缩模型声称完成三类解码实测。当前机器没有 Docker CLI，未运行容器构建；已用测试覆盖 Docker 排除 authoring assets 目录后生产生成仍成功的情况。

既有 Railway `my-3dhome` 只存在 production 环境，未发现预览环境。本次未创建新服务、未执行远端 prune、未改生产变量、未删除原资源，kuro.cafe 继续使用原成功部署。
