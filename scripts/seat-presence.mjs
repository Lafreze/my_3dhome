import {
  createVisitorJourney,
  sampleVisitorJourney,
} from '../app/visitor-travel.mjs';
import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import catalog from '../app/seat-catalog.json' with { type: 'json' };
import appearanceCatalog from '../app/visitor-appearance.json' with { type: 'json' };

export function validateAppearance(
  value,
  previous = appearanceCatalog.defaults,
) {
  if (value === undefined)
    return { ...appearanceCatalog.defaults, ...previous };
  const invalid = () => {
    throw Object.assign(new Error('外观设置无效，请重新选择'), { status: 400 });
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const result = { ...appearanceCatalog.defaults, ...previous };
  if (
    value.character &&
    value.character !== previous.character &&
    Object.hasOwn(appearanceCatalog.characterColors, value.character)
  )
    Object.assign(result, appearanceCatalog.characterColors[value.character]);
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(appearanceCatalog.defaults, key)) invalid();
    if (key === 'character') {
      if (!appearanceCatalog.characters.some((c) => c.id === value[key]))
        invalid();
    } else if (key === 'gender' || key === 'hairStyle') {
      const choices =
        key === 'gender'
          ? appearanceCatalog.genders
          : appearanceCatalog.hairStyles;
      if (!choices.some((choice) => choice.id === value[key])) invalid();
    } else if (key === 'bearHood') {
      if (typeof value[key] !== 'boolean') invalid();
    } else if (
      typeof value[key] !== 'string' ||
      !/^#[0-9a-f]{6}$/i.test(value[key])
    )
      invalid();
    result[key] =
      typeof value[key] === 'string' ? value[key].toLowerCase() : value[key];
  }
  return result;
}

export const normalizeIP = (ip) =>
  (ip || '').replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
export function visitorIP(req, trustRailwayProxy = false) {
  // Railway's edge sets X-Real-IP. Local development never trusts forwarded headers.
  const real = req.headers['x-real-ip'];
  if (trustRailwayProxy && typeof real === 'string' && isIP(real.trim()))
    return normalizeIP(real.trim());
  return normalizeIP(req.socket.remoteAddress);
}
export function createPresenceStore({
  now = Date.now,
  ttl = 150_000,
  secret = randomBytes(32),
} = {}) {
  const ids = new Set(catalog.map((seat) => seat.id));
  const beds = new Set(
    catalog.filter((seat) => seat.kind === 'bed').map((seat) => seat.id),
  );
  const people = new Map();
  let revision = 0;
  const identity = (ip) =>
    createHmac('sha256', secret)
      .update(normalizeIP(ip))
      .digest('hex')
      .slice(0, 24);
  function prune() {
    for (const [id, person] of people)
      if (now() - person.seen > ttl) {
        people.delete(id);
        revision++;
      }
    for (const person of people.values())
      if (person.gesture && now() > person.gesture.expiresAt)
        delete person.gesture;
  }
  function snapshot(ip) {
    prune();
    return {
      me: identity(ip),
      capacity: ids.size,
      revision,
      serverTime: now(),
      visitors: [...people.values()].map(
        ({ seen: _seen, lastGesture: _lastGesture, ...person }) => ({
          ...person,
          appearance: { ...person.appearance },
        }),
      ),
    };
  }
  function mutate(ip, data) {
    prune();
    const id = identity(ip),
      current = people.get(id);
    if (data.action === 'heartbeat') {
      if (current) current.seen = now();
      return snapshot(ip);
    }
    if (data.action === 'leave') {
      if (people.delete(id)) revision++;
      return snapshot(ip);
    }
    if (
      current?.journey &&
      now() < current.journey.at + current.journey.duration &&
      !['heartbeat', 'leave'].includes(data.action)
    )
      throw Object.assign(new Error('正在走向新位置，等入座后再操作。'), {
        status: 409,
      });
    if (data.action === 'wake') {
      if (!current || current.posture !== 'rest')
        throw Object.assign(new Error('你现在没有躺下休息'), { status: 409 });
      current.journey = createVisitorJourney(
        current.seatId,
        current.seatId,
        'rest',
        'sit',
        now(),
      );
      current.posture = 'sit';
      current.seen = now();
      delete current.gesture;
      revision++;
      return snapshot(ip);
    }
    if (data.action === 'gesture') {
      if (!current)
        throw Object.assign(new Error('先点击椅子或床放置自己的角色'), {
          status: 409,
        });
      if (current.posture === 'rest')
        throw Object.assign(new Error('先醒来再打招呼吧'), { status: 409 });
      if (!['hello', 'heart', 'phone', 'coffee'].includes(data.kind))
        throw Object.assign(new Error('不支持的互动'), { status: 400 });
      if (
        current.lastGesture !== undefined &&
        now() - current.lastGesture < 2500
      )
        throw Object.assign(new Error('稍等一下再互动'), { status: 429 });
      if (data.targetId !== undefined) {
        const target = people.get(data.targetId);
        if (!target || target.id === id)
          throw Object.assign(new Error('这位访客已经离开了'), { status: 409 });
        if (target.posture === 'rest')
          throw Object.assign(new Error('对方正在休息，让 TA 安静睡一会儿'), {
            status: 409,
          });
      }
      current.lastGesture = now();
      current.seen = now();
      revision++;
      current.gesture = {
        id: `${id}-${revision}`,
        kind: data.kind,
        ...(data.targetId ? { targetId: data.targetId } : {}),
        at: now(),
        expiresAt:
          now() + (['phone', 'coffee'].includes(data.kind) ? 10000 : 6500),
      };
      return snapshot(ip);
    }
    if (!['sit', 'rest'].includes(data.action))
      throw Object.assign(new Error('不支持的座位操作'), { status: 400 });
    if (!ids.has(data.seatId))
      throw Object.assign(new Error('这个座位不存在'), { status: 400 });
    if (data.action === 'rest' && !beds.has(data.seatId))
      throw Object.assign(new Error('请在床上休息'), { status: 400 });
    const name =
      typeof data.name === 'string'
        ? data.name.normalize('NFKC').trim().replace(/\s+/g, ' ')
        : '';
    if (!name || [...name].length > 16 || /[\p{Cc}\p{Cf}<>]/u.test(name))
      throw Object.assign(new Error('请输入 1–16 个字的名字'), { status: 400 });
    const appearance = validateAppearance(data.appearance, current?.appearance);
    // No await between checking and committing: competing requests cannot double-book.
    if (
      [...people.values()].some(
        (p) =>
          p.id !== id &&
          (p.seatId === data.seatId ||
            (p.journey &&
              now() < p.journey.at + p.journey.duration &&
              p.journey.fromSeat === data.seatId)),
      )
    )
      throw Object.assign(new Error('这个位置正在使用，请选择另一个空位'), {
        status: 409,
      });
    if (!current && people.size >= ids.size)
      throw Object.assign(new Error('座位已满，稍后再来坐坐'), { status: 409 });
    let journey;
    if (
      current &&
      (current.seatId !== data.seatId || current.posture !== data.action)
    ) {
      // One transfer uses the narrow shared passages at a time; seats remain independently usable.
      if (
        [...people.values()].some(
          (p) =>
            p.id !== id &&
            p.journey &&
            now() < p.journey.at + p.journey.duration,
        )
      )
        throw Object.assign(new Error('通道上有人正在换座，稍等片刻再走。'), {
          status: 409,
        });
      journey = createVisitorJourney(
        current.seatId,
        data.seatId,
        current.posture || 'sit',
        data.action,
        now(),
      );
      if (!journey)
        throw Object.assign(new Error('暂时没有安全路线，请选择附近的位置。'), {
          status: 409,
        });
      // Check both furniture approaches against other seated visitors, including the shared banquette.
      for (let t = 0; t <= journey.duration; t += 100) {
        const sample = sampleVisitorJourney(
          journey,
          journey.at + t,
          appearance.character,
        );
        if (
          [...people.values()].some(
            (p) =>
              p.id !== id &&
              (() => {
                const other = createVisitorJourney(
                  p.seatId,
                  p.seatId,
                  p.posture,
                  p.posture,
                  now(),
                );
                const point = sampleVisitorJourney(
                  other,
                  now(),
                  p.appearance.character,
                ).position;
                return (
                  Math.hypot(
                    point[0] - sample.position[0],
                    point[2] - sample.position[2],
                  ) < 0.53
                );
              })(),
          )
        )
          throw Object.assign(
            new Error('这条路线有人，请选择另一处空位或稍后再走。'),
            { status: 409 },
          );
      }
    }
    people.set(id, {
      id,
      name,
      seatId: data.seatId,
      appearance,
      posture: data.action === 'rest' ? 'rest' : 'sit',
      seen: now(),
      lastGesture: current?.lastGesture,
      ...(journey ? { journey } : {}),
    });
    revision++;
    return snapshot(ip);
  }
  return { snapshot, mutate };
}

export function createPresenceHandler(options) {
  const store = createPresenceStore(options);
  return async function handlePresence(req, res) {
    if (new URL(req.url, 'http://localhost').pathname !== '/api/presence')
      return false;
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    const respond = (status, value) => {
      res.writeHead(status, headers);
      res.end(JSON.stringify(value));
    };
    try {
      const ip = visitorIP(req, options?.trustRailwayProxy);
      if (req.method === 'GET') {
        respond(200, store.snapshot(ip));
        return true;
      }
      if (req.method !== 'POST') {
        respond(405, { error: '不支持的请求' });
        return true;
      }
      if (
        req.headers['sec-fetch-site'] === 'cross-site' ||
        (req.headers.origin &&
          new URL(req.headers.origin).host !== req.headers.host)
      ) {
        respond(403, { error: '请从工作室页面操作' });
        return true;
      }
      if (!req.headers['content-type']?.startsWith('application/json')) {
        respond(415, { error: '需要 JSON 数据' });
        return true;
      }
      let body = '',
        bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 2048) {
          respond(413, { error: '内容过长' });
          return true;
        }
        body += chunk;
      }
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        throw Object.assign(new Error('请求内容无效'), { status: 400 });
      }
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw Object.assign(new Error('请求内容无效'), { status: 400 });
      respond(200, store.mutate(ip, data));
    } catch (error) {
      respond(error.status || 500, {
        error: error.status ? error.message : '座位暂时无法更新，请重试',
      });
    }
    return true;
  };
}
