<div align="center">

<img src="./apps/web/src/app/icon.svg" alt="LiveEarth" width="104" />

<h1>LiveEarth</h1>

<p><strong>此刻，地球最好一幕。</strong><br/><sub>The best view on Earth, right now.</sub></p>

<p>
  <img src="https://img.shields.io/badge/status-MVP-EF6E58" alt="Status: MVP" />
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16.3-000000?logo=next.js&logoColor=white" alt="Next.js 16.3" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black" alt="React 19.2" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0" /></a>
  <a href="https://threejs.org/"><img src="https://img.shields.io/badge/Three.js-0.185-101010?logo=threedotjs&logoColor=white" alt="Three.js 0.185" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-RLS-3FCF8E?logo=supabase&logoColor=white" alt="Supabase with RLS" /></a>
</p>

<p><strong>快速导航</strong>：
  <a href="#为什么做-liveearth">项目定位</a> ·
  <a href="#核心能力">核心能力</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#架构">架构</a> ·
  <a href="#api-速览">API</a> ·
  <a href="#生产部署">部署</a>
</p>

</div>

LiveEarth 把分散在全球的授权直播与开放准实时画面，收拢成一份实时频道。开箱即用的公共源模式会核验运营方时间戳并生成来源说明；连接 Supabase / Worker 后，还可以持续探测私有授权流、理解画面并生成 AI 排名理由。

用户不需要搜索下一站。打开首页，AI Director 已经在替你看地球。

---

## 为什么做 LiveEarth

**雷暴有空窗、极光有季节、海浪和城市夜景也各有自己的时间。地球没有。**

把 Storm、Ocean、Night 等主题拆成孤立产品，每个频道都会遇到内容低谷；LiveEarth 用一个总榜承接所有频道，让最值得看的画面自然接力。

| 找到 | 看懂 | 编排 |
|:---|:---|:---|
| 持续探测全球授权直播源 | 用实时画面与天气证据理解正在发生什么 | 综合质量、罕见性、新鲜度与多样性生成节目单 |
| 自动剔除离线、降级和过期镜头 | 输出中英双语标签、分数与一句话理由 | 控制频道与国家重复，避免 Top 10 变成同类画面堆叠 |

> **`Live` 不是一个 UI 标签。** 连续流最近画面超过 90 秒、分析超过 10 分钟，或流状态不再健康，场景就会退出公开榜单。开放快照会明确标成 `Near live / 准实时`：常规源最长保留 15 分钟；NOAA 区域卫星循环考虑运营方生成延迟使用一小时上限，NDBC 周期性日间相机使用两小时上限。两者都显示实际时间且不会冒充连续直播。

---

## 核心能力

- **Earth Top 10**：公共源模式每 30 秒重建当前榜，完整 Supabase / Worker 管线每 5 分钟发布不可变榜单快照。
- **零密钥公共源模式**：直接接入已允许嵌入的运营方 YouTube 直播，以及香港、多伦多、NOAA/NDBC、Fintraffic 的开放准实时数据；任一来源失败时独立降级。
- **四个 MVP 频道**：`Earth` 总榜，以及 `Storm`、`Ocean`、`Night` 专题榜。
- **AI Director**：FFmpeg 抽取当前 3 × 2 联系表，结合 Open-Meteo 天气证据，通过 OpenAI 结构化输出完成画面评分与中英双语解说。
- **实时性门禁**：FFprobe 检查可播放性、码率与延迟；健康状态和分析新鲜度共同决定场景能否发布。
- **全球地球视图**：Three.js 地球按需加载，可从榜单飞往目标地点，并尊重系统的 reduced-motion 设置。
- **45 秒自动巡游**：首页自动切换当期精选场景，支持暂停、前后切换、键盘控制和用户触发后的原声播放。
- **场景档案**：展示直播、地理位置、AI 标签、上榜理由、评分拆解、24 小时趋势与相似场景。
- **账号与运营**：Supabase Magic Link / Google 登录、收藏与观看历史云同步、完整账户删除，以及受 allowlist 与 RLS 双重约束的直播源登记后台。
- **中英双语**：产品界面、场景标题和 AI 排名理由均支持 `/zh` 与 `/en`。

### 产品入口

| 页面 | 路径 | 作用 |
|:---|:---|:---|
| Top Now | `/zh` · `/en` | 当前 Earth Top 10、主舞台与自动巡游 |
| 频道榜 | `/zh/channel/storm` | Storm / Ocean / Night 独立排名 |
| 场景档案 | `/zh/scene/[slug]` | 直播、证据、分数历史与相似推荐 |
| 收藏 | `/zh/favorites` | 本地收藏；登录后与 Supabase 同步 |
| 运营后台 | `/zh/admin` | 校验授权合同并登记直播源 |

---

## 快速开始

### 前置要求

- Node.js `22+`
- Corepack（仓库固定使用 pnpm `10.26.0`）
- Docker 与 Docker Compose（仅在运行 Redis / Worker 时需要）

### 启动 Web

```bash
git clone https://github.com/skygazer42/LiveEarth.git
cd LiveEarth

corepack enable
corepack pnpm install --frozen-lockfile
cp apps/web/.env.local.example apps/web/.env.local
corepack pnpm dev
```

启动后访问：

| 入口 | 地址 |
|:---|:---|
| 中文界面 | [http://localhost:3000/zh](http://localhost:3000/zh) |
| English | [http://localhost:3000/en](http://localhost:3000/en) |
| 健康检查 | [http://localhost:3000/api/health](http://localhost:3000/api/health) |

本地开发默认使用 `LIVE_EARTH_DATA_MODE=public`，无需云服务凭据即可拉取真实外部画面。若想查看原来的静态样例，将该变量改成 `demo`（生产环境拒绝 Demo）；已有 Supabase 管线则使用 `supabase`。

### 已接入的公共来源

| 来源 | 形态与更新 | 费用 / 注册 | 项目中的合规处理 |
|:---|:---|:---|:---|
| 运营方 / explore.org 合作方 YouTube Live | 连续直播 | 免费、无需 Key | 仅使用原始 YouTube iframe；运行时同时要求 `isLiveNow=true` 与 `playableInEmbed=true`，不下载、不代理视频内容、不录像 |
| [香港运输署 / DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-td-tis_2-traffic-snapshot-images) | JPEG，约 2 分钟 | 免费、无需注册；允许商业及非商业使用 | 展示 Government、运输署与 DATA.GOV.HK 归属，并保留原图 |
| [City of Toronto](https://open.toronto.ca/dataset/traffic-cameras/) | JPEG，约 2–3 分钟 | 免费、无需注册；Open Government Licence – Toronto | 使用许可要求的 attribution，不暗示官方背书 |
| [CIRA / NOAA GOES](https://www.star.nesdis.noaa.gov/goes/) | GeoColor JPEG + MP4 卫星帧循环，约 10 分钟 | 免费、无需注册；美国公共领域资料 | 标注 `CIRA/NOAA`，动态素材明确称为准实时帧循环，并注明仅供信息展示、不可用于业务预报或应急决策 |
| [NOAA NDBC BuoyCAM](https://www.ndbc.noaa.gov/buoycams.shtml) | 海上全景照片，日间周期拍摄 | 免费、无需注册；美国公共领域资料 | 使用 NDBC 官方“最新图片”链接、核验文件名时间戳并明确标成准实时，展示 NOAA/NDBC 署名 |
| [Fintraffic Digitraffic](https://www.digitraffic.fi/en/road-traffic/) | 道路天气快照，约 10 分钟 | 免费、无需 Key；CC BY 4.0 | 使用其指定署名 `Source: Fintraffic / digitraffic.fi, license CC 4.0 BY` |
| [TfL JamCam](https://tfl.gov.uk/info-for/open-data-users/our-open-data) | JPEG + 约 11 秒 MP4 片段，约 2–3 分钟 | 已发布素材免费直连；Unified API 匿名 50 次/分钟、邮箱注册后 500 次/分钟 | 默认核验 TfL 已发布的稳定素材地址；配置 `TFL_API_KEY` 后再通过 API 刷新元数据；完整显示、不裁切品牌与时间戳 |

默认八个 TfL 镜头无需 Key。若要通过 Unified API 动态扩充镜头或提高额度，可在 [TfL API Portal](https://api-portal.tfl.gov.uk/signup) 用邮箱注册、激活账户、订阅 `500 Requests per min` 产品，再把 Key 填入 `apps/web/.env.local`：

```bash
TFL_API_KEY=your-free-email-registration-key
DIGITRAFFIC_USER=LiveEarth/0.1 your-email@example.com
```

内置公共适配器一次最多核验 **74 个候选槽位**：YouTube 11、NOAA 13、NDBC 6、香港 8、多伦多 20、Fintraffic 8、TfL 8。候选容量不等于伪造的固定在线数：离线、过期、不允许嵌入或尚未进入当地夜间的镜头会实时退出；产品页面按设计只展示每个频道的前 10 名，因此“看到 10 条”不代表后台只有 10 个候选源。

YouTube 运营方偶尔会轮换直播视频 ID；三个锚点 ID 可用 `LIVE_EARTH_YOUTUBE_EARTH_VIDEO_ID`、`LIVE_EARTH_YOUTUBE_OCEAN_VIDEO_ID` 与 `LIVE_EARTH_YOUTUBE_SHARK_VIDEO_ID` 覆盖，另外八个海洋候选来自 explore.org 合作方公开直播目录。所有候选仍会经过“正在直播 + 允许嵌入”双重检查。Storm 频道除 GOES-18 / GOES-19 全圆盘图外，还会核验 NOAA STAR 发布的加勒比、南佛罗里达、夏威夷、墨西哥湾岸、美国东北部、太平洋西北部、南加州、中部平原、纽约都会区、中大西洋与北落基山脉十一个区域 MP4 动态循环；这些素材明确标成准实时卫星帧循环，不会冒充连续摄像机。

### 服务端出站代理

当运行机器无法直连部分来源时，可在 `apps/web/.env.local` 配置公共源探测所使用的代理，然后重启 Web 服务：

```bash
LIVE_EARTH_PROXY_URL=http://127.0.0.1:7890
```

也支持省略协议的 `127.0.0.1:7890`，以及带认证信息的 HTTP、HTTPS、SOCKS / SOCKS5 URL。`/api/health` 的 `outboundProxy` 只会报告 `direct`、`proxy` 或 `invalid`，不会回传代理地址或凭据。请勿把该变量改成 `NEXT_PUBLIC_` 前缀。

此配置只代理 Next.js 服务端对 YouTube、NOAA、交通开放数据等来源的状态与元数据请求；页面里的 YouTube iframe、原始图片和视频仍由访客浏览器直连来源方，因此浏览器也需要具备相应网络访问能力。在 Docker 容器内，`127.0.0.1` 指向容器自身，访问宿主机代理通常应改用 `host.docker.internal:端口`（Linux 还需按部署方式添加 host gateway）。

### 启动实时分析 Worker

```bash
docker compose up -d redis
cp apps/worker/.env.example apps/worker/.env

# 填写 Supabase、OpenAI、Open-Meteo 与 Cloudflare 凭据后启动
corepack pnpm dev:worker
```

Worker 会按配置周期执行直播探测、联系表抽帧、视觉分析和榜单发布。`apps/worker/.env` 中的云服务字段当前均为必填项。

---

## 架构

```mermaid
flowchart LR
    Public["公共授权来源<br/>YouTube embed · Open Data"] --> PublicGate["来源状态 / Last-Modified<br/>直播与准实时分级"]
    PublicGate --> Web
    Feed["授权直播源<br/>RTSP · RTMPS · SRT · HLS"] --> Probe["FFprobe<br/>健康检查"]
    Feed --> Frames["FFmpeg<br/>3 × 2 实时联系表"]
    Frames --> Vision["OpenAI Vision<br/>结构化画面分析"]
    Weather["Open-Meteo<br/>当前天气证据"] --> Director["AI Director"]
    Vision --> Director
    Probe --> Gate{"实时性门禁"}
    Director --> Gate
    Gate --> Ranking["频道评分<br/>Earth 多样性编排"]
    Ranking --> Snapshot["5 分钟<br/>不可变榜单快照"]
    Snapshot --> Web["Next.js Web<br/>HLS.js · Three.js"]
```

### 排名规则

频道分由六个可解释维度组成：画面冲击力 `30%`、事件强度 `20%`、运动感 `15%`、可见度 `15%`、技术质量 `10%`、罕见性 `10%`。

| 榜单 | 额外规则 |
|:---|:---|
| `Earth` | 使用编辑分：频道分 `50%` + 罕见性 `20%` + 新鲜度 `15%` + 时间相关性 `15%`；每个频道最多 4 个、每个国家最多 2 个，并尽量避免相邻同频道 |
| `Storm` | 必须有强天气代码，或从画面中识别到 lightning / thunder / storm 等证据 |
| `Ocean` | 按频道分排序，保留前一期排名作为轻量稳定性信号 |
| `Night` | 只有当地进入民用曙暮光后的镜头才有资格入榜 |

### 数据与权限

- 私有拉流地址只保存在 Supabase 服务端表中；浏览器只获取公开 HLS、海报和派生元数据。
- 公共源适配器在 Next.js 服务端聚合元数据；原始图片和运营方播放器仍由浏览器向来源方读取，项目不建立盗链录像库。
- 公共源使用运营方时间戳或 HTTP `Last-Modified` 作为 `lastFrameAt`，并按实际发布周期决定准实时有效期。
- 新直播源登记后先创建为未发布场景，只有通过健康检查并获得新鲜 AI 分析后才进入榜单。
- 排名快照按 `channel + version` 唯一保存，客户端每 30 秒检查新一期，不在浏览器内临时重排。
- 用户只能访问自己的收藏和历史；运营写操作同时经过 `ADMIN_EMAILS` allowlist 与数据库 RLS。

---

## API 速览

| 方法 | 端点 | 说明 |
|:---|:---|:---|
| `GET` | `/api/health` | Web 服务健康检查 |
| `GET` | `/api/v1/rankings/:channel` | 获取 Earth / Storm / Ocean / Night 最新榜单快照 |
| `GET` | `/api/v1/scenes/:slug` | 获取单个场景档案 |
| `GET` | `/api/v1/globe?channel=earth` | 获取地球视图标记 |
| `GET` · `POST` · `DELETE` | `/api/v1/me/favorites` | 收藏查询、写入与删除 |
| `GET` · `POST` · `DELETE` | `/api/v1/me/history` | 观看历史查询、写入与清空 |
| `DELETE` | `/api/v1/me` | 删除当前账户及其个人数据 |
| `POST` | `/api/v1/admin/feeds` | 校验授权字段并登记直播源 |

公开读取接口带有 CDN 缓存与 stale-while-revalidate 策略；个人与运营接口要求有效 Supabase 会话。

---

## 技术栈

| 层 | 主要技术 |
|:---|:---|
| Web | Next.js 16 · React 19 · TypeScript 6 · HLS.js · YouTube Embed · React Three Fiber · Three.js |
| Domain | Zod 契约 · 纯函数评分 / 排序 · Vitest |
| Data & Auth | Supabase · PostgreSQL · Row Level Security · SSR Session |
| Worker | Node.js 22 · BullMQ · Redis · FFmpeg · FFprobe |
| AI & Evidence | OpenAI Responses API 结构化输出 · Open-Meteo Customer API |
| Deployment | Vercel · Docker · Fly.io 示例配置 |

---

## 目录结构

```text
.
├── apps/
│   ├── web/                 # Next.js 产品界面、认证与 Route Handlers
│   └── worker/              # 直播探测、抽帧、AI 分析与榜单调度
├── packages/
│   └── domain/              # 共享类型、Zod 契约、评分规则与测试
├── supabase/
│   └── migrations/          # 数据表、索引、触发器与 RLS 策略
├── docker-compose.yml       # 本地 Redis
├── vercel.json              # Web 部署配置
└── .env.example             # 生产环境变量总览
```

---

## 配置

| 文件 | 使用者 | 内容 |
|:---|:---|:---|
| `apps/web/.env.local.example` | Next.js | 数据模式、公共源可选 Key、Supabase 公钥 / 服务端密钥、管理员邮箱 |
| `apps/worker/.env.example` | Worker | Redis、Supabase Service Role、OpenAI、Open-Meteo、Cloudflare 与调度周期 |
| `.env.example` | 部署者 | 两个进程所需变量的合并检查表 |

`SUPABASE_SERVICE_ROLE_KEY`、`OPENAI_API_KEY`、`OPEN_METEO_API_KEY`、`LIVE_EARTH_PROXY_URL` 中可能包含的认证信息、Redis 和 Cloudflare 凭据只能注入服务端或 Worker，不能暴露给浏览器。

---

## 验证

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:run
corepack pnpm build
docker compose config
```

提交前应让以上检查全部通过，并对中英文首页、频道、场景和外部来源降级状态做开发与生产烟测。

---

## 生产部署

1. 仅使用公共源时设置 `LIVE_EARTH_DATA_MODE=public` 即可；完整管线则依次执行 `supabase/migrations/001_liveearth.sql` 与 `002_earth_scene_channel.sql`，配置 Magic Link / Google OAuth 回调，并把首位运营者同时加入 `admin_users` 和 `ADMIN_EMAILS`。
2. 将 Web 变量配置到 Vercel；使用 `apps/worker/Dockerfile` 部署常驻 Worker，并连接持久化 Redis。`apps/worker/fly.toml.example` 提供 Fly.io 起点。
3. 逐条登记拥有明确展示、转码、抽帧分析、派生元数据和有限技术帧留存权的直播源。每条源都需要私有拉流地址、公开 HTTPS HLS 地址、HTTPS 海报和权利到期时间。
4. 拉流源不能直接公开播放时，在你有权使用的前提下，通过 Cloudflare Live Input 或自管 FFmpeg relay 转成公开 HLS。
5. 公开上线前，建议准备至少 12 条稳定授权源并完成 7 天稳定性观察，让 Top 10 和多样性约束有足够选择空间；这不是代码启动的硬条件。

仓库不会自动创建 Supabase、OpenAI、Open-Meteo、Cloudflare、Redis、TfL 账户或 Vercel 资源。内置公共适配器只覆盖表中列出的使用边界；自行添加的摄像头仍需逐条确认授权。

---

## 当前范围

当前版本交付 `Earth`、`Storm`、`Ocean`、`Night` 四个频道。Snow、Aurora、Train、Rain 与 Sunset 仍属于后续频道方向，尚未作为真实数据管线交付。

欢迎通过 [Issue](https://github.com/skygazer42/LiveEarth/issues) 反馈问题或提交 Pull Request。提交前请运行上面的完整验证命令。
