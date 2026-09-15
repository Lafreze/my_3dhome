'use client';
import { useEffect, useState } from 'react';
import { rooms, type RoomId } from './house-data';
import { objects, type ObjectId } from './room-data';
type Report = {
  views: number;
  visitors: number;
  sessions: number;
  activeSeconds: number;
  online: number;
  total: number;
  daily: { day: string; views: number; visitors: number }[];
  devices: { device: string; count: number }[];
  rooms: { room: string; count: number }[];
  interactions: { target: string; count: number }[];
  recent: {
    id: number;
    visitor: string;
    at: number;
    page: string;
    source: string;
    device: string;
    browser: string;
    visits: number;
  }[];
  activity: {
    visitor: string;
    started: number;
    seen: number;
    active: number;
    room: string;
    mode: string;
    interactions: number;
  }[];
};
const stamp = (at: number) =>
  new Date(at).toLocaleString('zh-CN', {
    timeZone: 'Asia/Tokyo',
    hour12: false,
  });
const duration = (s: number) =>
  s < 60
    ? `${Math.round(s)} 秒`
    : `${Math.floor(s / 60)} 分 ${Math.round(s % 60)} 秒`;
export default function VisitorAnalytics() {
  const [days, setDays] = useState(30),
    [page, setPage] = useState(0),
    [refresh, setRefresh] = useState(0);
  const [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setReport(null);
        setError('');
      }
    });
    void fetch(`/api/admin/visits?days=${days}&page=${page}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || '无法读取访问记录');
        return data;
      })
      .then(setReport)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [days, page, refresh]);
  return (
    <section className="visitor-analytics" aria-label="访客数据">
      <div className="analytics-heading">
        <div>
          <small>仅管理员可见</small>
          <h3>小屋来访簿</h3>
        </div>
        <select
          aria-label="统计时间范围"
          value={days}
          onChange={(e) => {
            setDays(Number(e.target.value));
            setPage(0);
          }}
        >
          <option value={7}>最近 7 天</option>
          <option value={30}>最近 30 天</option>
          <option value={90}>最近 90 天</option>
          <option value={0}>全部记录</option>
        </select>
        <button disabled={loading} onClick={() => setRefresh((v) => v + 1)}>
          刷新
        </button>
      </div>
      {loading && <output>正在翻阅来访簿…</output>}
      {error && <p role="alert">{error}</p>}
      {report && (
        <>
          <div className="analytics-metrics">
            {[
              ['访问次数', report.views],
              ['独立访客', report.visitors],
              ['当前在线', report.online],
              [
                '平均停留',
                duration(
                  report.sessions ? report.activeSeconds / report.sessions : 0,
                ),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="analytics-note">
            匿名浏览器编号用于识别回访；清除 Cookie
            或更换设备会视为新访客。停留仅累计页面可见时间。时间以日本时区显示。
          </p>
          <details open>
            <summary>每日来访</summary>
            <div className="analytics-trend">
              {report.daily.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day} · ${d.views} 次访问 / ${d.visitors} 位访客`}
                >
                  <i
                    style={{
                      height: `${Math.max(3, (d.views / Math.max(...report.daily.map((v) => v.views), 1)) * 70)}px`,
                    }}
                  />
                  <small>{d.day.slice(5)}</small>
                  <span>{d.views}</span>
                </div>
              ))}
            </div>
            {!report.daily.length && <p>还没有来访记录。</p>}
          </details>
          <div className="analytics-breakdowns">
            <div>
              <h4>常去的房间</h4>
              {report.rooms.map((r) => (
                <p key={r.room}>
                  {rooms[r.room as RoomId]?.name || r.room}
                  <b>{r.count}</b>
                </p>
              ))}
            </div>
            <div>
              <h4>设备</h4>
              {report.devices.map((d) => (
                <p key={d.device}>
                  {d.device}
                  <b>{d.count}</b>
                </p>
              ))}
              <h4>热门互动</h4>
              {report.interactions.slice(0, 8).map((i) => (
                <p key={i.target}>
                  {objects[i.target as ObjectId]?.name ||
                    (i.target === 'resident' ? '主理人' : i.target)}
                  <b>{i.count}</b>
                </p>
              ))}
            </div>
          </div>
          <details>
            <summary>最近的停留与互动</summary>
            <div className="analytics-table">
              <table>
                <thead>
                  <tr>
                    <th>访客</th>
                    <th>到访时间</th>
                    <th>停留</th>
                    <th>最近房间</th>
                    <th>模式</th>
                    <th>互动</th>
                  </tr>
                </thead>
                <tbody>
                  {report.activity.map((a) => (
                    <tr key={`${a.visitor}-${a.started}`}>
                      <td>{a.visitor}</td>
                      <td>{stamp(a.started)}</td>
                      <td>{duration(a.active)}</td>
                      <td>{rooms[a.room as RoomId]?.name || '模型展览'}</td>
                      <td>{a.mode === 'roam' ? '漫游' : '浏览'}</td>
                      <td>{a.interactions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <h4>全部访问记录</h4>
          <div className="analytics-table">
            <table>
              <thead>
                <tr>
                  <th>访问时间</th>
                  <th>访客 / 累计来访</th>
                  <th>页面</th>
                  <th>设备</th>
                  <th>来源</th>
                </tr>
              </thead>
              <tbody>
                {report.recent.map((v) => (
                  <tr key={v.id}>
                    <td>{stamp(v.at)}</td>
                    <td>
                      {v.visitor}
                      <small>累计 {v.visits} 次来访</small>
                    </td>
                    <td>{v.page}</td>
                    <td>
                      {v.device}
                      <small>{v.browser}</small>
                    </td>
                    <td>{v.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="analytics-pagination">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              上一页
            </button>
            <span>
              {page + 1} / {Math.max(1, Math.ceil(report.total / 30))}
            </span>
            <button
              disabled={(page + 1) * 30 >= report.total}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        </>
      )}
    </section>
  );
}
