# 第三方模型授权记录

新增素材必须先登记在 `config/asset-catalog.json`，确认许可后才设为 `approval: "approved"`。`pending` 模型继续本地加载并被公开上传清单排除；`denied` 会阻止生产资源生成，应先替换网页引用。

| 字段 | 填写内容 |
| --- | --- |
| 逻辑资源 ID | 例如 room.cafe.counter |
| 名称 | 素材的公开名称，不含用户隐私 |
| 作者 | 原作者 / 权利人 |
| 来源 URL | 原始发布页；用户直接提供的文件注明提供方式 |
| 许可证及 URL | 完整名称、版本、官方许可链接 |
| 公开分发许可 | 是否允许网页用户通过完整 URL 下载生产文件 |
| 修改情况 | 减面、姿态、贴图压缩、尺寸、颜色等 |
| 使用房间 | study / living / bedroom / gallery / cafe |
| 生产文件 | 网页衍生文件相对于仓库的路径 |
| 确认依据与日期 | 许可证证据，或权利人的明确授权记录 |
| 审核状态 | pending / approved / denied |

CC BY 的统一运行时记录由 catalog 生成到 `app/generated/asset-credits.json`：

```json
{
  "id": "room.cafe.counter",
  "name": "咖啡吧台",
  "author": "原作者",
  "sourceUrl": "https://example.org/original-asset",
  "license": "CC-BY-4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
  "modifications": "减面至网页版本，贴图缩小至 1K",
  "rooms": ["cafe"],
  "attributionRequired": true
}
```

在网页「关于 → 素材鸣谢」显示作者、来源、许可证及需要标注的修改。不同 CC BY 作品即使同一作者也应分别保留标题和链接。

当前待确认：展厅王冠兔，以及熊、猫、狐狸三种角色的坐姿和站立休息衍生 GLB（共 7 个）。仓库只记录此前 GitHub / Railway 发布授权，不自动扩展为 R2 公开分发权；未声明素材具有独立公共许可证。

如果无法获得许可：保留现有线上发布，在迁移前使用项目原创角色、取得公开网页分发授权的委托模型，或具有明确 CC0 / CC BY 许可的替代模型。替换时必须重新校准座位、休息姿态、眼睑及服装着色。不要将购买许可、可用于渲染或个人使用等同于允许公开提供模型文件。
