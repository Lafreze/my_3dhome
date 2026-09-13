# 展示区与三维藏品室 · 2026-09-13

三个主展台替换为用户提供的机甲模型：圣翼守望者、暗夜收割者、鎏金圣辉。说明根据实际模型外观编写；保留原始配色、贴图和造型。原始下载文件未修改，派生模型位于 `public/models/exhibits/`。

每件模型提供两级细节：房间版本约 45,000 三角面 / 1K 贴图，独立查看版本约 160,000 三角面 / 2K 贴图，均使用 Draco 压缩。三个房间版本合计 1,885,936 字节；近看版本按所选藏品加载。构建统计见 `gallery-model-build.json`，可复现脚本为 `scripts/prepare-gallery-models.py`。

展示区的西墙加入浅木作展柜，内部三层模型展示、灯带、滑动玻璃和铭牌均位于柜体范围。三个展台调整位置，原皇冠兔展台撤出陈列，原文件保留。盆栽移入西南角；避障数据、观展停留点与实际摆放同步，展柜前留出超过 80 厘米宽的通道。新增四幅独立挂画，避开现有门洞、便签及翻页轮。

北墙三联画采用连续的富士暮樱画面。三个独立画框保留约 16 厘米间隔，各自使用相邻的三分之一图像区域；可在各自画框中独立更换图片，不互相覆盖。

点击展柜进入 `/models`。所有访客可以选择模型、拖动旋转、滚轮或按钮缩放、平移和复位。支持方向键、加减号和 R 键。提供可关闭的缓慢旋转，尊重系统减少动态设置。每次切换释放上一件模型的几何、材质和贴图；加载错误可重试。返回展示区会打开对应房间。

管理者在藏品页输入既有管理暗号后，可以上传包含几何和贴图的单文件 GLB，并填写名称与说明。模型与目录保存到现有 Railway 数据卷的 `model-library` 目录；重启后恢复，所有访客均可查看。限制为每件 80 MB、最多 50 件或 1 GB，管理员身份和 CSRF 验证沿用小屋设置机制。文件验证拒绝损坏容器、外部贴图/文件引用和越界数据；保存采用串行、原子目录更新。没有新增服务或更改管理暗号。

## 图像生成记录

使用内置 image_gen 工具生成，参考用户附图的题材与三联画构图。最终资产：`public/artwork/fuji-dusk-panorama.webp`。它是一张完整连续画面，分幅通过三维贴图坐标实现，不生成连接画框。

最终提示词：

> Use case: illustration-story. Asset type: continuous fine-art panorama texture for three physically separate framed paintings in a warm 3D home gallery. Use the attached reference only for subject and composition mood. Create ONE seamless wide landscape, aspect ratio about 2.1:1, edge-to-edge art with no frames, no panel divisions, no wall, no room, no shadows from external objects, no text or watermark. A tranquil Japanese lake at sunset: Mount Fuji centered with finely detailed snow ridges, its blue reflection in calm water; delicate pink cherry blossoms from upper left, a small traditional vermilion pagoda among dark pines near the left shore; luminous pale gold dusk sky on right, layered blue hills and reflected light. Artful painterly realism with precise natural detail, deep indigo and teal balanced by soft coral and warm ivory, elegant gallery print. All three equal vertical thirds must share the exact same horizon and continuous landscape; key Fuji peak belongs to center third, pagoda left, sunset right. The panorama will be mapped with three adjacent UV ranges onto three independent canvases with small physical gaps.

藏品缩略图来自实际 Three.js 渲染，未用生成图片替代用户模型。

## 验证

- 6 个模型的容器、三角面数量和大小检查。
- 展台/展柜不相交，入口、出口和展柜前停留位置之间的角色通路检查。
- 上传权限、CSRF、异常模型拒绝、重启后列表恢复、公开模型读取。
- 浏览器实际切换三个模型，检查旋转、缩放、复位、模型资源释放；执行一次隔离的本地上传并刷新恢复。
- 桌面与手机页面、三联画及侧墙挂画的截图保存在本地 `output/playwright/`。

最终检查：31 项相关自动检查通过，类型检查、静态检查及生产构建通过；手机藏品页可独立滚动，选择藏品后回到模型画面；最终本地场景浏览器控制台无错误。正式发布仅使用既有 Git 仓库及 Railway 服务。
