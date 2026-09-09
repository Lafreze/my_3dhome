# 小屋角色与动物生活系统

2026-09-10 验收。新增皇冠兔独立展台与建模手记；保留三个项目展位和既有房间布局。底部增加镜头平移和收藏入口，移除「关于」按钮；原有屋内名片仍可访问。黄昏光照、天气与窗影实现没有改动。

## 实现与文件

| 文件 | 职责 |
| --- | --- |
| `app/life-data.ts` | 角色、39 个命名节点、停留时间、概率和收藏定义 |
| `app/life-navigation.ts` | 家具及开合范围、门洞、安全路径、座位预约、动态圆形碰撞 |
| `app/life-engine.ts` | 行为状态机、独占事件调度、组合互动、有效活动时间 |
| `app/life-models.ts` | 程序化占位人物／动物／机器人；可替换 GLB 与 AnimationMixer 接口 |
| `app/life-scene.ts` | 连接现有渲染循环、真实访客锚点、可见性、点击、声音与资源释放 |
| `app/life-collections.ts` | 版本化本地收藏、去重、跨标签页合并、存储失败时内存回退 |
| `app/interior-atmosphere.ts` | 扩展现有同一只黑猫，保留原始模型和独立加载失败回退 |
| `app/house-data.ts`、`app/house-rooms.ts` | 新增皇冠兔展台、说明牌和按需模型加载 |
| `app/room-scene.ts`、`app/room-data.ts` | 镜头平移、角色拾取、异步生活模块和页面 API |
| `app/page.tsx`、`app/globals.css` | 轻量气泡、1.5 秒收藏提示、收藏册和建模手记 |
| `scripts/check-life.mjs` | 路径、碰撞、调度、天气、占位、收藏和暂停验证 |

## 行为

| 角色 | 状态与职责 | 互动 |
| --- | --- | --- |
| 主理人 | idle / walk / sit / type / read / brewCoffee / cleanCup / inspectArtwork / drinkCoffee / wave / petCat。工作、阅读、咖啡操作、观展、休息；一次动作约 12 秒，随后停留 20–60 秒 | 点击后转身、挥手／点头／举杯与轻量气泡；8 秒防连点；与在线访客相遇问候 |
| 原有黑猫 | sleep / idle / walk / groom / stretch / lookAround / watchBird / watchRabbit / ride。呼吸、耳尾微动、跟随当前房间选择附近安全休息目标 | 看向用户、观察小鸟、与兔子互看／一起趴下、主理人抚摸、短途乘坐机器人 |
| 稀有白兔 | idle / lookAround / hop / groom / sniff / sit / sleep / hide。相邻安全目标之间慢速跳跃，每次来访 60–180 秒 | 点击或在线访客接近时观察，可能提前躲藏；见到兔子按实际房间记入收藏 |
| 窗边小鸟 | land / perch / lookAround / peck / preen / hopShort / takeOff。固定窗台与窗外曲线 | 连续看到落下和飞离才获得收藏；中途切房间或窗墙被剖切隐藏不计完整观察 |
| 扫地机器人 | docked / start / cleaning / avoid / turn / returnToDock / charging | 慢速走主通道；动态阻挡时停下再规划；低电量回固定充电处；避开白兔与访客 |

主理人不是在线用户，不写入 `/api/presence`，不会增加访客计数。现有 32 个休息位置不变；NPC 使用实时座位锚点，真实访客占位后立即让出。

## 路径和占用

目的地全部来自命名节点，位置为房间局部坐标；完整数值与允许角色见 `app/life-data.ts`。节点含 position、rotation、allowedActors、posture、room、neighbors、occupancy、interactionTarget、minStayTime、maxStayTime，座位节点另含 seatId。高处休息／鸟窗台节点不用于普通地面寻路。

| 房间 | 节点 |
| --- | --- |
| 书房 | study.desk、study.chair、study.bookshelf、study.aisle、study.cat、study.window |
| 客厅 | living.sofa、living.recordPlayer、living.tvConsole、living.aisle、living.openFloor、living.cat、living.window |
| 卧室 | bedroom.window、bedroom.bedFoot、bedroom.cat、bedroom.bird |
| 展厅 | gallery.bench、gallery.benchUnder、gallery.leftPlinth、gallery.centerPlinth、gallery.rightPlinth、gallery.crownedRabbit、gallery.aisleWest、gallery.aisleNorth、gallery.aisleSouth、gallery.cat |
| 咖啡厅 | cafe.barInside、cafe.cups、cafe.pickup、cafe.window、cafe.booth、cafe.aisle1、cafe.aisle2、cafe.aisle3、cafe.aisle4、cafe.cat、cafe.bird、robot.dock |

路径用 0.14 场景单位的确定性可行走网格连接命名目标。每条边检查家具、墙与门洞，并增加连续移动余量；每帧再次检查下一步。1 场景单位 = 0.625 m。碰撞半径：主理人 0.29、黑猫 0.28、白兔 0.25、机器人 0.25。不同角色分别缓存导航图；机器人不经过书房、卧室与吧台内部。家具开合范围以最不利状态预留，白兔可进入长凳下方。

## 概率和调度

随机源使用每次访问的种子与最近事件／冷却记录，不是收藏抽卡。只有看见实际事件才会收集。

| 事件 | 触发条件与概率 | 冷却／持续 |
| --- | --- | --- |
| 自动事件检查 | 有效活动时间每 24–40 秒检查一次；前 10 秒禁用自动明显事件 | 作品／收藏弹窗和后台期间暂停 |
| 白兔 | 每次访问 42% 有资格；45 秒后在允许房间等到空闲事件窗口；每次访问最多一次 | 来访 60–180 秒；事件冷却 420 秒 |
| 小鸟 | 晴／阴，太阳在地平线上，无降水；清晨 65%、午后 30%、黄昏 14%、夜间 0%，概率按一次事件检查计 | 全局 150 秒、同房间 240 秒；停留 10–30 秒，起降各 3 秒 |
| 主理人自动动作 | 当前房间优先，目标必须空闲且可达；不连续选择同一目标 | 动作后停留 20–60 秒；无法到达则等待再选 |
| 主理人抚摸猫 | 同房间、距离小于 1.3 单位、主理人未坐下；符合条件时 20% | 180 秒／6 秒 |
| 兔猫相遇 | 同房间、距离小于 1.2；互相观察，25% 一起趴下 | 120 秒／6 秒 |
| 猫乘机器人 | 无白兔，机器人行进中，猫在 0.85 单位内；符合条件时 18% | 300 秒／12 秒 |
| 用户问候 | 用户点击优先；重复点击不重复通知 | 8 秒／约 3 秒 |

明显事件共用一个调度锁，机器人等低幅动作按次要角色处理。画面至多显示主理人、黑猫及另一只动物／机器人；小鸟优先于白兔，白兔优先于机器人。更远房间暂停，相邻房间逻辑降为 4 Hz；页面隐藏时现有主循环直接跳过渲染和 AI。减少动态效果模式关闭自动行走、跳跃与鸟飞行，仍可点击角色和查看收藏。

## 收藏与声音

localStorage key 为 `kuro-life-collection-v1`，结构 `{version:1,cards:{[id]:{collectedAt,sourceActor,sourceRoom,version:1}}}`。支持 visitor.rabbit.first、visitor.rabbit.gallery、visitor.rabbit.cafe、visitor.rabbit.bedroom、visitor.bird.window、resident.firstGreeting、cat.robotRide。不同房间的兔子收藏使用不同印章；未获得只显示含蓄提示。提示约 1.5 秒，不重复授予；存储不可用时说明仅记住本次访问。

声音复用用户主动开启唱片后创建的 AudioContext，以低音量合成猫叫、轻落地、鸟鸣／振翅、杯子声与机器人低鸣；按镜头距离衰减。没有自动开启声音，没有下载音频素材，关闭声音／隐藏页面后停止生活音效。

## 当前资源与待补资产

新角色为可运行的程序化占位资源，**尚未提供制作完成的 GLB 或骨骼动作资产**。已有访客使用自己的共享缓存和着色器姿态，不适合直接把坐姿网格当成通用行走骨架。主理人复用访客的配色系统；新角色用少量旋转关节和解析动画，骨骼数均为 0，不占移动端三个骨骼动画角色预算。旧小猫没有另建模型或控制器。

| 当前资源 | 三角面／大小 |
| --- | --- |
| 主理人占位模型 | 3,348 三角面；独立模型下载 0 B |
| 白兔占位模型 | 2,040 三角面；独立模型下载 0 B |
| 小鸟占位模型 | 1,872 三角面；独立模型下载 0 B |
| 机器人占位模型 | 480 三角面；独立模型下载 0 B |
| 黑猫 | 复用原有程序化几何；独立模型下载 0 B |
| 皇冠兔展品 | 116,828 三角面；3,572,096 B（3.41 MiB），只在展厅资源组需要时下载 |
| 既有访客 bear | 坐姿 3,590,200 B；休息 3,598,288 B |
| 既有访客 cat | 坐姿 3,226,320 B；休息 3,228,264 B |
| 既有访客 fox | 坐姿 3,650,860 B；休息 3,666,740 B |

本次生产构建的 `life-scene` 模块为 30,813 B（gzip 11,034 B）；共享收藏与数据块为 5,707 B（gzip 2,440 B）。所有新角色代码合并在延迟加载的生活模块及其共享依赖中，不能把「模型 0 B」理解为整个功能没有 JS 成本。模块在基础画面显示后再加载，失败时房屋、旧小猫和在线访客继续工作。

| 建议补充 GLB | 面数／骨骼 | 动画与循环 | 材质／纹理／大小 |
| --- | --- | --- | --- |
| resident.glb | 6k–12k 三角面，18–28 骨骼 | idle、walk、sit、type、read、brewCoffee、cleanCup、inspectArtwork、drinkCoffee 循环；wave、petCat 单次后回 idle/sit | 皮肤、头发、上装／围裙、下装分别 Mesh，杯子和笔记可拆；1 套 1024² PBR，建议 ≤1.5 MiB |
| rabbit.glb | 2k–4k 三角面，8–14 骨骼 | idle、lookAround、groom、sniff、sit、sleep 循环；hop、hide 单次 | 身体／耳内／眼睛可拆，512²，建议 ≤350 KiB |
| bird.glb | 1k–2k 三角面，6–10 骨骼 | perch、lookAround、peck、preen 循环；land、hopShort、takeOff 单次 | 身体与两翼分离，256–512²，建议 ≤200 KiB |
| robot.glb | 0.5k–1.5k 三角面，0–2 骨骼 | 无需骨骼动作；轮盘／状态灯由程序驱动 | 机身、轮盘、灯可拆，256–512²，建议 ≤150 KiB |

交付规范：glTF 标准米制，Y 向上，模型面向 -Z，原点在脚下／接地中心，缩放归一。导入小屋时米 → 场景单位乘 1.6；主理人按约 1.15 m 的 Q 版身高、兔 0.25 m、鸟 0.12 m、机器人直径 0.31 m 校准。动作应原地播放，位移由导航控制，不带 root motion。提供完整许可、来源与是否允许公开 GLB 分发的证明。

`attachActorAsset` 通过现有资源加载器读取登记的逻辑 ID，保留占位体直到成功，可按状态名选择 AnimationClip，已配置单次动作的 LoopOnce 和完成后回 idle；导入生产前仍需校准轴向／单位、坐姿锚点，并检查骨骼预算。没有登记未知来源下载地址或虚构可用模型。

## 验证与后续扩展

执行 `node scripts/check-life.mjs` 检查全部主理人／白兔／机器人节点的两两路线、连续地面边界、门洞、机器人禁区、访客占位、30 分钟模拟、事件锁与冷却、天气组合、完整小鸟观察、暂停、减少动态效果和收藏去重。另运行类型检查、生产构建及原有房屋、座位、天气、访客与资源检查。浏览器实际点击验证了主理人气泡和首次问候、白兔展厅收藏、皇冠兔手记、收藏册、平移镜头（拖动后投影位置改变约 34 px）及底部「关于」已移除。作品／收藏弹窗和模拟后台事件均冻结生活时钟。刻意阻断生活模块下载后，仍可切换房间和探索物件，原有房屋和黑猫回退画面继续显示。手机减少动态效果模式不生成鸟、不自动走动、没有横向溢出或页面错误。

### 性能结果与测量范围

Chrome，本机 WebGL，页面暖机后以 requestAnimationFrame 间隔采样约 4 秒；桌面 1440×1000，手机模拟 390×844。新角色模块在同一测试页面可关闭用于对照；这不是实体手机跑分，不能据此保证所有手机型号的帧率。

| 测试 | 平均帧率 | P95 帧间隔 | 说明 |
| --- | ---: | ---: | --- |
| 桌面，生活系统开启 | 57.1 FPS | 33.2 ms | 无页面错误；短样本受设备负载和场景影响 |
| 手机模拟，关闭生活系统 | 48.1 FPS | 34.0 ms | 相同尺寸，实际渲染 DPR 1.5 |
| 手机模拟，开启生活系统 | 46.1 FPS | 33.5 ms | 约 4.2% 帧率差；无横向溢出 |

原始手机 DPR 2 时测得约 43 FPS，关闭系统约 48 FPS，因此将触屏设备渲染 DPR 上限调整为 1.5。移动端新增角色使用 Blob Shadow；显示最多 3 个角色，当前新增角色骨骼数为 0。既有高面数访客仍使用原有渲染预算；真实手机和大量在线访客压力测试仍需补测。

可重复检查包括 986 条两两节点路线（主理人 576、白兔 289、机器人 121）、30 分钟状态模拟、强制安全位置的兔猫相遇和猫乘机器人／安全下车、实时座位优先、天气组合、收藏去重及减少动态效果。原有 32 个座位 API、访客休息／动作、家具间距、房屋、环境、窗墙剖切、咖啡厅、材质、资源测试及生产构建通过。截图保存在本机 `output/playwright/life-*.png`。

新增动物时：先在 life-data 登记 ActorId、状态、半径、速度与允许节点；在 life-models 提供占位体或有授权的 GLB；将一个低频事件接入同一调度锁，在 life-engine 中添加行为与互动；收藏仍经过同一个 store。补充路径与天气测试，复核三角色画面预算、模型轮廓与碰撞半径、退出释放和移动端帧率。不要增加第二条渲染循环或另写随机坐标漫游。
