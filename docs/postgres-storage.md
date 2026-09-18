# 小屋持久数据

生产环境使用既有 `my-3dhome` Railway 项目内的 PostgreSQL，通过私网 `DATABASE_URL` 引用连接。保留 `/data` 卷，因此仍是单实例应用；在线座位、管理登录会话和实时角色行为继续在内存中运行。

## 保存范围

- `page_views`：页面访问、浏览器编号、来源、设备、IP、大致归属地。
- `visits` / `visit_events`：访问会话、可见停留时长、房间和物品互动。
- `studio_documents`：屋内编辑设置（包含家具颜色、材质/图片引用及上传图片）、便签、模型目录（含对象地址、私有分享权限和删除状态）。
- 模型和材质二进制文件继续使用原有 R2 / 持久卷；公开内置素材目录仍在 Git 中，不重复写入数据库。
- 随机住客只存在于当前场景，不写入访客记录或真实在线人数。

## 首次迁移与回退

应用启动、接收流量之前执行 `legacy-v1` 迁移：在 PostgreSQL 事务和 advisory lock 内导入 SQLite 三张表及三个 JSON 文档，核对行数与文档内容、修复 ID 序列后写入迁移标记。失败会回滚并阻止启动；已配置 PostgreSQL 时不会静默退回本地存储。原文件不删除、不再写入。

Railway 的持久卷不允许新旧部署同时挂载，因此迁移在旧版本停止写入后执行。迁移前快照位于 `/data/backup-before-postgres-20260918`；切换时最后完整的 SQLite/JSON 仍保留在原路径。`studio_migrations.summary` 保存实际导入数量。

后续发布保留 `DATABASE_URL`；不要直接撤掉连接设置或回滚到只支持 SQLite 的旧版本，否则新写入的数据不会出现在旧文件中。需要回退时先备份 PostgreSQL，再从数据库导出最新数据，或部署仍支持 PostgreSQL 的修复版本。

数据库文档使用版本条件写入，防止覆盖并发修改。不要在未改造会话、座位协调和文档缓存前扩展多实例。

## IP 与归属地

仅管理员会话可读 `/api/admin/visits`。Railway 环境只信任平台的 `X-Real-IP`，本地只使用连接地址；忽略用户提供的 `X-Forwarded-For` 和请求体中的 IP。旧记录未采集的 IP 保持为空。

归属地使用服务器内的 DB-IP Lite City（CC BY 4.0），不将访客 IP 发往外部服务。IPv4/IPv6 均支持；私网、未知地址有单独说明。结果仅代表网络位置，不能当作人员的精确位置。界面提供 DB-IP 署名链接。

数据库版本及校验和在 `config/geolocation.json`。构建时下载、验证并封装，更新时需一并更新下载地址与两份 SHA-256，保留界面署名。构建产物不进入 Git。本地可不下载并显示“归属地未知”；生产显式路径缺失会阻止启动。

## 验证

- `npm run typecheck`、`npm run build`
- `node --test scripts/check-visitor-analytics.test.mjs scripts/check-admin.test.mjs scripts/check-private-models.test.mjs`
- 对专用测试 PostgreSQL 设置 `TEST_POSTGRES_URL` 后运行 `node --test scripts/check-postgres.test.mjs`。测试使用随机独立 schema 并清理，只针对测试数据库运行。
- 线上检查：迁移日志、管理员报表 `storage`、导入数量、编辑文档版本、未登录访客报表返回 401。
