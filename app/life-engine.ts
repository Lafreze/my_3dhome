import { roomAt, type RoomId, type HouseView } from './house-data.ts';
import type { Environment } from './environment-data';
import { catRiseTime, catSettleTime } from './cat-gait.ts';
import { sampleRabbitHop } from './rabbit-motion.ts';
import {
  residentRoutines,
  quietPoses,
  momentRules,
  type ResidentRoutine,
} from './life-routines.ts';
import {
  navigationNodes,
  actorSpecs,
  eventRules,
  type ActorId,
  type ActorState,
  type Point,
  type NavigationNode,
  type CollectionId,
} from './life-data.ts';
import {
  NavigationGraph,
  OccupancyManager,
  distance,
  floorClear,
  segmentClear,
  worldPoint,
} from './life-navigation.ts';

export class SeededRandom {
  seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  between(a: number, b: number) {
    return a + (b - a) * this.next();
  }
  choose<T>(values: T[]): T | undefined {
    return values[Math.floor(this.next() * values.length)];
  }
}
export class AmbientEventScheduler {
  active: { kind: string; actor: ActorId; until: number } | null = null;
  cooldowns = new Map<string, number>();
  last = '';
  nextAutomatic = 0;
  start(
    kind: string,
    actor: ActorId,
    now: number,
    duration: number,
    cooldown: number,
    priority = false,
  ) {
    if (
      ((now < 10 || now < this.nextAutomatic) && !priority) ||
      (!priority && this.active && this.active.until > now) ||
      (this.cooldowns.get(kind) ?? 0) > now
    )
      return false;
    if (priority) this.active = null;
    this.active = { kind, actor, until: now + duration };
    this.cooldowns.set(kind, now + cooldown);
    this.last = kind;
    this.nextAutomatic = now + 110 + (Math.floor(now * 997) % 61);
    return true;
  }
  tick(now: number) {
    if (this.active && this.active.until <= now) this.active = null;
  }
  end(actor: ActorId) {
    if (this.active?.actor === actor) this.active = null;
  }
}
export class BehaviorStateMachine {
  state: ActorState = 'idle';
  elapsed = 0;
  set(state: ActorState) {
    if (this.state !== state) {
      this.state = state;
      this.elapsed = 0;
    }
  }
  update(dt: number) {
    this.elapsed += dt;
  }
}
export type LifeActor = {
  id: ActorId;
  node: string;
  target: string | null;
  position: Point;
  rotation: number;
  room: RoomId;
  active: boolean;
  visible: boolean;
  fsm: BehaviorStateMachine;
  path: Point[];
  stayUntil: number;
  seated: boolean;
  blockedFor: number;
  expires: number;
  animationTime: number;
  battery: number;
  actionUntil: number;
  travelDistance: number;
  turnDistance: number;
  hopTime: number;
};
type Hooks = {
  collect: (id: CollectionId, actor: ActorId, room: RoomId) => void;
  bubble: (actor: ActorId, text: string) => void;
  sound: (kind: string, position: Point) => void;
  coffee: (pickup?: boolean) => void;
  moment?: (
    kind: 'coffeeAroma' | 'windowMotes',
    room: RoomId,
    seed: number,
  ) => void;
};
const nearby: Record<RoomId, RoomId[]> = {
  study: ['living', 'bedroom'],
  living: ['study', 'gallery'],
  bedroom: ['study', 'gallery', 'cafe'],
  gallery: ['living', 'bedroom', 'cafe'],
  cafe: ['bedroom', 'gallery'],
};
const rabbitRooms: RoomId[] = ['gallery', 'cafe', 'bedroom', 'study'];
export const birdAllowed = (e: Environment) =>
  e.time !== 'night' &&
  ['clear', 'cloudy'].includes(e.weather) &&
  (!e.solar || e.solar.altitude > 0) &&
  (!e.precipitation || e.precipitation < 0.2);
export class LifeEngine {
  readonly occupancy = new OccupancyManager();
  readonly navigation = new NavigationGraph();
  readonly events = new AmbientEventScheduler();
  readonly random: SeededRandom;
  actors: Record<ActorId, LifeActor>;
  clock = 0;
  paused = false;
  reduced = false;
  view: HouseView = 'study';
  environment: Environment = { time: 'sunset', weather: 'clear' };
  nextCheck = 15;
  rabbitEligible: boolean;
  rabbitSeen = false;
  residentRoutine: ResidentRoutine = 'work';
  private routineUntil = 0;
  private rabbitPoseAt = 0;
  birdWitness = false;
  birdRoomCooldown = new Map<RoomId, number>();
  private lastView: HouseView = 'study';
  private visitorGreetings = new Set<string>();
  private offscreen = new Map<ActorId, number>();
  private catRide: {
    phase: 'mount' | 'aboard' | 'dismount';
    from: Point;
    to: Point;
    elapsed: number;
  } | null = null;
  private hooks: Hooks;
  readonly sessionSeed: number;
  constructor(
    seed: number,
    hooks: Hooks,
    previous: Partial<Record<ActorId, string>> = {},
    visitors: { id: string; seatId: string; position: Point }[] = [],
  ) {
    this.hooks = hooks;
    this.occupancy.setVisitors(visitors);
    this.sessionSeed = seed >>> 0;
    this.random = new SeededRandom(seed);
    this.residentRoutine = this.random.choose(
      Object.keys(residentRoutines) as ResidentRoutine[],
    )!;
    this.routineUntil = this.random.between(180, 300);
    this.rabbitEligible = this.random.next() < eventRules.rabbit.visitChance;
    this.nextCheck = this.random.between(14, 28);
    this.actors = {} as Record<ActorId, LifeActor>;
    // Select active actors first, registering each footprint before selecting the next.
    // Room-first sampling avoids bias toward the café's larger number of nodes.
    for (const id of ['resident', 'cat', 'robot', 'rabbit', 'bird'] as const) {
      let candidates = navigationNodes.filter(
        (n) =>
          n.allowedActors.includes(id) &&
          (id !== 'rabbit' || rabbitRooms.includes(n.room)) &&
          (id === 'bird' || floorClear(worldPoint(n), id)) &&
          this.occupancy.available(n, id),
      );
      const different = candidates.filter((n) => n.id !== previous[id]);
      if (different.length) candidates = different;
      const room = this.random.choose([
        ...new Set(candidates.map((n) => n.room)),
      ]);
      const n = this.random.choose(candidates.filter((n) => n.room === room));
      if (!n) throw new Error(`No safe starting node for ${id}`);
      const fsm = new BehaviorStateMachine();
      const active = ['resident', 'cat', 'robot'].includes(id);
      const seated = id === 'resident' && !!n.seatId;
      fsm.set(
        id === 'cat'
          ? this.random.choose<ActorState>(['sleep', 'sit'])!
          : id === 'robot'
            ? n.id === 'robot.dock'
              ? 'charging'
              : 'idle'
            : seated
              ? ['type', 'read'].includes(n.posture)
                ? n.posture
                : 'sit'
              : 'idle',
      );
      this.actors[id] = {
        id,
        node: n.id,
        target: null,
        position: worldPoint(n),
        rotation: n.rotation,
        room: n.room,
        active,
        visible: false,
        fsm,
        path: [],
        stayUntil: this.random.between(id === 'robot' ? 16 : 20, 60),
        seated,
        blockedFor: 0,
        expires: 0,
        animationTime: this.random.between(0, 30),
        battery: id === 'robot' ? this.random.between(45, 95) : 100,
        actionUntil: 0,
        travelDistance: 0,
        turnDistance: 0,
        hopTime: 0,
      };
      this.occupancy.actors.set(id, {
        position: this.actors[id].position,
        radius: actorSpecs[id].radius,
        active: active && id !== 'bird',
      });
      if (active) this.occupancy.reserve(n, id);
    }
  }
  node(id: string) {
    const n = navigationNodes.find((n) => n.id === id);
    if (!n) throw new Error(`Unknown life node ${id}`);
    return n;
  }
  visibleRoom(room: RoomId) {
    return (
      this.view === 'overview' || this.view === 'plan' || this.view === room
    );
  }
  relevant(room: RoomId) {
    return (
      this.visibleRoom(room) ||
      (this.view !== 'overview' &&
        this.view !== 'plan' &&
        nearby[this.view].includes(room))
    );
  }
  eligible(id: ActorId, room?: RoomId) {
    return navigationNodes.filter(
      (n) =>
        n.allowedActors.includes(id) &&
        (!room || n.room === room) &&
        floorClear(worldPoint(n), id) &&
        this.occupancy.available(n, id),
    );
  }
  private yieldedUntil = new Map<ActorId, number>();
  yieldToVisitor(ahead: { position: Point }[]) {
    for (const a of Object.values(this.actors)) {
      if (
        !a.active ||
        a.id === 'bird' ||
        a.seated ||
        (this.yieldedUntil.get(a.id) || 0) > this.clock
      )
        continue;
      if (!ahead.some((v) => distance(v.position, a.position) < 1.7)) continue;
      const candidates = this.eligible(a.id, a.room).filter(
        (n) =>
          distance(worldPoint(n), a.position) > 0.7 &&
          !ahead.some((v) => distance(v.position, worldPoint(n)) < 2),
      );
      candidates.sort(
        (x, y) =>
          distance(worldPoint(x), a.position) -
          distance(worldPoint(y), a.position),
      );
      if (candidates.some((n) => this.go(a, n, false)))
        this.yieldedUntil.set(a.id, this.clock + 5);
    }
  }
  setVisitors(people: { id: string; seatId: string; position: Point }[]) {
    this.occupancy.setVisitors(people);
    const resident = this.actors.resident;
    const rabbit = this.actors.rabbit;
    if (
      rabbit.active &&
      people.some((p) => distance(p.position, rabbit.position) < 1.45) &&
      (this.events.cooldowns.get('rabbit.near') ?? 0) < this.clock
    ) {
      rabbit.fsm.set('lookAround');
      rabbit.path = [];
      rabbit.stayUntil = this.clock + 8;
      this.events.cooldowns.set('rabbit.near', this.clock + 20);
      if (this.random.next() < 0.35)
        rabbit.expires = Math.min(rabbit.expires, this.clock + 10);
    }
    if (
      resident.seated &&
      this.occupancy.seatOccupied(this.node(resident.node).seatId)
    ) {
      // Real visitors always win: release the seat immediately and stand at its clear approach.
      resident.seated = false;
      resident.position = worldPoint(this.node(resident.node));
      resident.fsm.set('idle');
      resident.stayUntil = this.clock + 3;
      this.occupancy.release('resident');
      if (!this.occupancy.clear(resident.position, 'resident'))
        resident.active = false;
    }
    for (const v of people)
      if (
        !v.id.endsWith('/route') &&
        !this.visitorGreetings.has(v.id) &&
        this.visibleRoom(resident.room) &&
        distance(v.position, resident.position) < 2.6
      ) {
        if (
          this.clock >= 10 &&
          this.events.start('visitorGreeting', 'resident', this.clock, 3, 30)
        ) {
          this.visitorGreetings.add(v.id);
          resident.fsm.set('wave');
          resident.stayUntil = this.clock + 24;
          this.hooks.bubble('resident', '欢迎，找个舒服的位置坐坐。');
          break;
        }
      }
  }
  go(actor: LifeActor, target: NavigationNode, obvious = true) {
    if (this.reduced || !this.occupancy.available(target, actor.id))
      return false;
    const from = actor.seated
      ? worldPoint(this.node(actor.node))
      : actor.position;
    const path = this.navigation.path(
      from,
      worldPoint(target),
      actor.id,
      this.occupancy,
    );
    if (!path) return false;
    if (
      obvious &&
      !this.events.start(
        `move.${actor.id}`,
        actor.id,
        this.clock,
        Math.max(
          8,
          path.reduce(
            (sum, p, i) => sum + distance(i ? path[i - 1] : from, p),
            0,
          ) /
            actorSpecs[actor.id].speed +
            5,
        ),
        8,
      )
    )
      return false;
    if (!this.occupancy.reserve(target, actor.id)) {
      this.events.end(actor.id);
      return false;
    }
    actor.seated = false;
    actor.position = [...from];
    actor.path = path;
    actor.target = target.id;
    actor.blockedFor = 0;
    if (actor.id === 'rabbit') actor.hopTime = 0;
    actor.fsm.set(
      actor.id === 'cat'
        ? 'rise'
        : actor.id === 'rabbit'
          ? 'hop'
          : actor.id === 'robot'
            ? actor.battery < 25
              ? 'returnToDock'
              : 'cleaning'
            : 'walk',
    );
    return true;
  }
  private arrive(a: LifeActor) {
    if (a.target) a.node = a.target;
    a.target = null;
    a.path = [];
    const n = this.node(a.node);
    if (this.occupancy.seatOccupied(n.seatId)) {
      this.occupancy.release(a.id);
      a.fsm.set('idle');
      a.stayUntil = this.clock + 5;
      this.events.end(a.id);
      return;
    }
    a.seated = !!n.seatId;
    if (a.id !== 'cat') a.rotation = n.rotation;
    a.fsm.set(n.posture);
    a.stayUntil =
      this.clock + 12 + this.random.between(n.minStayTime, n.maxStayTime);
    if (a.id === 'robot') {
      a.fsm.set(a.node === 'robot.dock' ? 'charging' : 'turn');
      a.stayUntil = this.clock + (a.node === 'robot.dock' ? 90 : 4);
    }
    if (a.id === 'cat') a.fsm.set('settle');
    if (a.id === 'rabbit')
      a.fsm.set(
        this.random.choose<ActorState>([
          'lookAround',
          'groom',
          'sniff',
          'sit',
          'sleep',
        ])!,
      );
    this.events.end(a.id);
    if (
      a.fsm.state === 'brewCoffee' &&
      this.events.start('coffee', 'resident', this.clock, 12, 35)
    )
      this.hooks.coffee(n.id === 'cafe.pickup');
    else if (
      a.id === 'resident' &&
      ['cleanCup', 'inspectArtwork', 'drinkCoffee'].includes(a.fsm.state)
    )
      this.events.start('residentAction', 'resident', this.clock, 12, 12);
  }
  private move(a: LifeActor, dt: number) {
    const next = a.path[0];
    if (!next) return;
    if (a.id === 'cat' || a.id === 'rabbit' || a.id === 'resident') {
      // Rise on the spot before taking a step. Face a corner before advancing.
      if (a.fsm.state === 'rise' && a.fsm.elapsed < catRiseTime) return;
      const heading = Math.atan2(
        -(next[0] - a.position[0]),
        -(next[2] - a.position[2]),
      );
      const angle = Math.atan2(
        Math.sin(heading - a.rotation),
        Math.cos(heading - a.rotation),
      );
      const turn = Math.sign(angle) * Math.min(Math.abs(angle), dt * 2.4);
      a.rotation += turn;
      a.turnDistance += Math.abs(turn) * 0.1;
      if (Math.abs(angle - turn) > 0.04) {
        a.fsm.set('turn');
        return;
      }
    }
    const oldHop = sampleRabbitHop(a.hopTime);
    if (a.id === 'rabbit') a.hopTime += dt;
    const advance =
      a.id === 'rabbit'
        ? sampleRabbitHop(a.hopTime).distance - oldHop.distance
        : actorSpecs[a.id].speed * dt;
    const d = distance(a.position, next),
      step = Math.min(d, advance),
      k = d ? step / d : 1;
    const p: Point = [
      a.position[0] + (next[0] - a.position[0]) * k,
      0.085,
      a.position[2] + (next[2] - a.position[2]) * k,
    ];
    if (
      !floorClear(p, a.id) ||
      (a.id === 'robot' &&
        this.actors.cat.fsm.state === 'ride' &&
        !floorClear(p, 'cat')) ||
      !this.occupancy.clear(p, a.id, 0.015)
    ) {
      a.blockedFor += dt;
      a.fsm.set(a.id === 'robot' ? 'avoid' : 'idle');
      if (a.blockedFor > 2.5) {
        const target = a.target && this.node(a.target);
        const replanned =
          target &&
          this.navigation.path(
            a.position,
            worldPoint(target),
            a.id,
            this.occupancy,
          );
        a.path = replanned || [];
        a.blockedFor = 0;
        if (!a.path.length) {
          a.target = null;
          this.occupancy.release(a.id);
          this.events.end(a.id);
          a.stayUntil = this.clock + 8;
        }
      }
      return;
    }
    a.blockedFor = 0;
    a.fsm.set(
      a.id === 'robot'
        ? a.battery < 25
          ? 'returnToDock'
          : 'cleaning'
        : a.id === 'rabbit'
          ? 'hop'
          : 'walk',
    );
    if (d > 0.01 && !['cat', 'rabbit', 'resident'].includes(a.id))
      a.rotation = Math.atan2(
        -(next[0] - a.position[0]),
        -(next[2] - a.position[2]),
      );
    a.travelDistance += distance(a.position, p);
    a.position = p;
    a.room = roomAt(p[0], p[2]) ?? a.room;
    if (step >= d - 0.001) a.path.shift();
    if (!a.path.length) this.arrive(a);
  }
  interact(id: ActorId, camera: Point) {
    const a = this.actors[id];
    if (
      !a.active ||
      !a.visible ||
      (this.events.cooldowns.get(`click.${id}`) ?? 0) > this.clock
    )
      return;
    // Bird land/takeoff is critical: acknowledge without replacing its event.
    if (id === 'bird') {
      this.hooks.bubble(id, '轻一点，让它安心停一会儿。');
      return;
    }
    if (id === 'cat' && a.fsm.state === 'ride') {
      // Do not interrupt a jump or detach a rider in mid-air.
      this.hooks.bubble(id, '小黑猫正搭着便车，等它稳稳落地。');
      this.events.cooldowns.set('click.cat', this.clock + 4);
      return;
    }
    if (
      !this.events.start(
        `click.${id}`,
        id,
        this.clock,
        4,
        eventRules.greeting.cooldown,
        true,
      )
    )
      return;
    // Pause every automatic path while the user's gesture owns the event.
    a.path = [];
    a.target = null;
    if (!a.seated) this.occupancy.release(id);
    a.rotation = Math.atan2(
      -(camera[0] - a.position[0]),
      -(camera[2] - a.position[2]),
    );
    a.stayUntil = this.clock + this.random.between(20, 60);
    a.actionUntil = this.clock + 3;
    if (id === 'resident') {
      a.fsm.set(
        this.random.choose<ActorState>(['wave', 'lookAround', 'drinkCoffee'])!,
      );
      this.hooks.bubble(
        id,
        this.random.choose([
          '欢迎来到小屋，咖啡刚刚好。',
          '正在把一个小小的灵感，做成可以体验的作品。',
          '今天想多留一点空白，给新的想法。',
        ])!,
      );
      this.hooks.collect('resident.firstGreeting', id, a.room);
      this.hooks.sound('cup', a.position);
    } else if (id === 'cat') {
      a.fsm.set('lookAround');
      this.hooks.bubble(id, '小黑猫朝你眨了眨眼。');
      this.hooks.sound('cat', a.position);
    } else if (id === 'rabbit') {
      a.fsm.set('lookAround');
      a.stayUntil = this.clock + 5;
      this.hooks.bubble(id, '白兔竖起耳朵，安静地看着你。');
      this.discoverRabbit();
      if (this.random.next() < 0.45)
        a.expires = Math.min(a.expires, this.clock + 8);
    } else {
      a.fsm.set('avoid');
      a.stayUntil = this.clock + 5;
      this.hooks.bubble(id, '借过一下，我慢慢来。');
    }
  }
  private discoverRabbit() {
    const a = this.actors.rabbit;
    if (!a.active || !a.visible) return;
    this.hooks.collect('visitor.rabbit.first', 'rabbit', a.room);
    if (['gallery', 'cafe', 'bedroom'].includes(a.room))
      this.hooks.collect(
        `visitor.rabbit.${a.room}` as CollectionId,
        'rabbit',
        a.room,
      );
  }
  startRabbit(room: RoomId) {
    const a = this.actors.rabbit;
    if (a.active || !rabbitRooms.includes(room)) return false;
    const candidates = this.eligible('rabbit', room);
    const n =
      candidates.find((n) => n.id === a.node) ?? this.random.choose(candidates);
    if (
      !n ||
      !this.events.start(
        'rabbit',
        'rabbit',
        this.clock,
        4,
        eventRules.rabbit.cooldown,
      )
    )
      return false;
    a.active = true;
    a.node = n.id;
    a.position = worldPoint(n);
    a.room = room;
    a.rotation = n.rotation;
    a.fsm.set('lookAround');
    a.animationTime = 0;
    a.hopTime = 0;
    a.stayUntil = this.clock + this.random.between(20, 38);
    this.rabbitPoseAt = this.clock + this.random.between(8, 16);
    a.expires = this.clock + this.random.between(60, 180);
    a.path = [];
    this.occupancy.reserve(n, 'rabbit');
    this.rabbitSeen = true;
    return true;
  }
  startBird(room: RoomId) {
    if (
      this.reduced ||
      !birdAllowed(this.environment) ||
      this.actors.bird.active ||
      (this.birdRoomCooldown.get(room) ?? 0) > this.clock
    )
      return false;
    const n = navigationNodes.find(
      (n) => n.room === room && n.allowedActors.includes('bird'),
    );
    if (!n) return false;
    const duration = this.random.between(10, 30);
    if (
      !this.events.start(
        'bird',
        'bird',
        this.clock,
        duration + 6,
        eventRules.bird.cooldown,
      )
    )
      return false;
    const a = this.actors.bird;
    a.active = true;
    a.node = n.id;
    a.room = room;
    a.position = worldPoint(n);
    a.position[1] = room === 'cafe' ? 0.94 : 0.86;
    a.fsm.set('land');
    a.expires = this.clock + duration + 6;
    a.stayUntil = this.clock + 3;
    this.birdWitness = this.visibleRoom(room);
    this.birdRoomCooldown.set(room, this.clock + eventRules.bird.roomCooldown);
    this.hooks.sound('wings', a.position);
    return true;
  }
  private interactions() {
    const cat = this.actors.cat,
      rabbit = this.actors.rabbit,
      resident = this.actors.resident,
      robot = this.actors.robot,
      bird = this.actors.bird;
    if (bird.active && cat.room === bird.room) {
      cat.path = [];
      cat.fsm.set('watchBird');
      cat.stayUntil = this.clock + 5;
      return;
    }
    if (
      rabbit.active &&
      cat.room === rabbit.room &&
      distance(cat.position, rabbit.position) < 1.2 &&
      !this.events.active
    ) {
      if (
        this.events.start(
          'animalMeeting',
          'rabbit',
          this.clock,
          6,
          eventRules.animalMeeting.cooldown,
        )
      ) {
        cat.path = [];
        rabbit.path = [];
        cat.fsm.set('watchRabbit');
        rabbit.fsm.set('lookAround');
        cat.rotation = Math.atan2(
          -(rabbit.position[0] - cat.position[0]),
          -(rabbit.position[2] - cat.position[2]),
        );
        rabbit.rotation = cat.rotation + Math.PI;
        cat.stayUntil = rabbit.stayUntil = this.clock + 26;
        if (this.random.next() < eventRules.animalMeeting.chance) {
          cat.fsm.set('sleep');
          rabbit.fsm.set('sleep');
        }
        return;
      }
    }
    if (
      !resident.seated &&
      cat.room === resident.room &&
      distance(cat.position, resident.position) < 1.3 &&
      !this.events.active &&
      this.random.next() < eventRules.petCat.chance
    ) {
      if (
        this.events.start(
          'petCat',
          'resident',
          this.clock,
          6,
          eventRules.petCat.cooldown,
        )
      ) {
        resident.path = [];
        cat.path = [];
        resident.fsm.set('petCat');
        resident.actionUntil = this.clock + 6;
        cat.fsm.set('lookAround');
        resident.stayUntil = cat.stayUntil = this.clock + 30;
        return;
      }
    }
    if (
      !rabbit.active &&
      cat.room === robot.room &&
      robot.path.length &&
      distance(cat.position, robot.position) < 0.85 &&
      segmentClear(cat.position, robot.position, 'cat') &&
      !this.events.active &&
      this.random.next() < eventRules.robotRide.chance
    ) {
      if (
        this.events.start(
          'robotRide',
          'cat',
          this.clock,
          12,
          eventRules.robotRide.cooldown,
        )
      ) {
        cat.path = [];
        cat.fsm.set('ride');
        cat.stayUntil = this.clock + 12;
        this.catRide = {
          phase: 'mount',
          from: [...cat.position],
          to: [robot.position[0], 0.285, robot.position[2]],
          elapsed: 0,
        };
      }
    }
  }
  update(
    dt: number,
    input: {
      view: HouseView;
      environment: Environment;
      reduced: boolean;
      paused: boolean;
    },
  ) {
    this.view = input.view;
    this.environment = input.environment;
    this.reduced = input.reduced;
    this.paused = input.paused;
    if (this.paused) return;
    this.clock += dt;
    const movingEvent = this.events.active;
    if (
      movingEvent?.kind.startsWith('move.') &&
      this.actors[movingEvent.actor].path.length
    )
      movingEvent.until = Math.max(movingEvent.until, this.clock + 1);
    this.events.tick(this.clock);
    if (this.lastView !== this.view) {
      this.birdWitness = false;
      this.lastView = this.view;
      this.actors.cat.stayUntil = Math.min(
        this.actors.cat.stayUntil,
        this.clock + 3,
      );
    }
    const bird = this.actors.bird,
      rabbit = this.actors.rabbit,
      cat = this.actors.cat,
      resident = this.actors.resident,
      robot = this.actors.robot;
    const secondary = bird.active ? 'bird' : rabbit.active ? 'rabbit' : 'robot';
    for (const a of Object.values(this.actors)) {
      a.visible =
        a.active &&
        this.view !== 'plan' &&
        this.visibleRoom(a.room) &&
        (a.id === 'resident' || a.id === 'cat' || a.id === secondary);
      this.occupancy.actors.set(a.id, {
        position: a.position,
        radius: actorSpecs[a.id].radius,
        active: a.active && a.id !== 'bird' && a.fsm.state !== 'ride',
      });
      if (!a.active || !this.relevant(a.room)) continue;
      // Adjacent rooms advance at 4 Hz; the visible actors use the shared render clock.
      let step = dt;
      if (!a.visible) {
        const accumulated = (this.offscreen.get(a.id) ?? 0) + dt;
        if (accumulated < 0.25) {
          this.offscreen.set(a.id, accumulated);
          continue;
        }
        step = accumulated;
        this.offscreen.set(a.id, 0);
      }
      a.animationTime += step;
      a.fsm.update(step);
      const owner = this.events.active?.actor;
      const canMove = !owner || owner === a.id || a.id === 'robot';
      const waitingForCat =
        a.id === 'robot' && this.catRide && this.catRide.phase !== 'aboard';
      if (a.path.length && !this.reduced && canMove && !waitingForCat) {
        this.move(a, Math.min(step, 0.3));
      }
      if (a.actionUntil && this.clock >= a.actionUntil) {
        a.actionUntil = 0;
        a.fsm.set(a.id === 'cat' ? 'sleep' : a.seated ? 'sit' : 'idle');
      }
      if (
        a.id === 'resident' &&
        a.fsm.elapsed > 12 &&
        !a.path.length &&
        !['idle', 'sit'].includes(a.fsm.state)
      )
        a.fsm.set(a.seated ? 'sit' : 'idle');
      if (
        a.id === 'cat' &&
        a.fsm.state === 'settle' &&
        a.fsm.elapsed >= catSettleTime
      )
        a.fsm.set(
          this.random.choose<ActorState>(['sleep', 'groom', 'stretch'])!,
        );
      if (
        a.id === 'cat' &&
        a.fsm.elapsed > 8 &&
        !a.path.length &&
        !['sleep', 'ride', 'watchBird'].includes(a.fsm.state)
      )
        a.fsm.set('sleep');
    }
    if (!resident.active) {
      const n = this.eligible('resident', resident.room)[0];
      if (n) {
        resident.active = true;
        resident.node = n.id;
        resident.position = worldPoint(n);
        resident.seated = false;
      }
    }
    if (bird.active) {
      if (this.events.active && this.events.active.actor !== 'bird') {
        bird.expires += dt;
        bird.stayUntil += dt;
        bird.animationTime -= dt;
        bird.fsm.elapsed = Math.max(0, bird.fsm.elapsed - dt);
      }
      if (this.reduced || !birdAllowed(this.environment)) {
        bird.active = false;
        this.birdWitness = false;
        this.events.end('bird');
        cat.fsm.set('sleep');
      } else if (!this.events.active || this.events.active.actor === 'bird') {
        if (!this.visibleRoom(bird.room)) this.birdWitness = false;
        if (this.clock >= bird.expires) {
          if (this.birdWitness)
            this.hooks.collect('visitor.bird.window', 'bird', bird.room);
          bird.active = false;
          this.events.end('bird');
          cat.fsm.set('sleep');
        } else if (this.clock > bird.expires - 3) bird.fsm.set('takeOff');
        else if (this.clock > bird.stayUntil) {
          if (bird.fsm.state === 'land')
            this.hooks.sound('bird', bird.position);
          bird.fsm.set(
            ['perch', 'lookAround', 'peck', 'preen', 'hopShort'][
              Math.floor((this.clock - bird.stayUntil) / 4) % 5
            ] as ActorState,
          );
        }
      }
      if (bird.active && cat.room === bird.room && cat.fsm.state !== 'ride') {
        cat.path = [];
        cat.fsm.set('watchBird');
        cat.stayUntil = this.clock + 8;
      }
    }
    if (rabbit.active) {
      if (
        !rabbit.path.length &&
        this.clock > this.rabbitPoseAt &&
        this.clock < rabbit.expires - 5 &&
        !rabbit.actionUntil &&
        (!this.events.active || this.events.active.actor === 'rabbit')
      ) {
        rabbit.fsm.set(
          this.random.choose<ActorState>(
            ['lookAround', 'sniff', 'groom', 'sit', 'sleep'].filter(
              (s) => s !== rabbit.fsm.state,
            ) as ActorState[],
          )!,
        );
        this.rabbitPoseAt = this.clock + this.random.between(8, 16);
      }
      if (rabbit.visible && rabbit.fsm.elapsed > 1.5) this.discoverRabbit();
      if (this.clock > rabbit.expires) {
        rabbit.active = false;
        rabbit.path = [];
        this.occupancy.release('rabbit');
        this.events.end('rabbit');
      } else if (this.clock > rabbit.expires - 4) {
        rabbit.path = [];
        rabbit.fsm.set('hide');
      }
    }
    if (cat.fsm.state !== 'ride') this.catRide = null;
    if (cat.fsm.state === 'ride' && this.catRide && !this.reduced) {
      const ride = this.catRide;
      if (ride.phase === 'aboard') {
        // Once aboard, attach to the robot exactly; no lagging floor interpolation.
        cat.position = [robot.position[0], 0.285, robot.position[2]];
        cat.room = robot.room;
        cat.rotation = robot.rotation;
        if (cat.fsm.elapsed > 2 && cat.visible)
          this.hooks.collect('cat.robotRide', 'cat', robot.room);
        if (this.clock >= cat.stayUntil) {
          const candidates: Point[] = [
            [robot.position[0] + 0.6, 0.085, robot.position[2]],
            [robot.position[0] - 0.6, 0.085, robot.position[2]],
            [robot.position[0], 0.085, robot.position[2] + 0.6],
            [robot.position[0], 0.085, robot.position[2] - 0.6],
          ];
          const point = candidates.find(
            (p) =>
              floorClear(p, 'cat') &&
              segmentClear(cat.position, p, 'cat') &&
              this.occupancy.clear(p, 'cat'),
          );
          robot.stayUntil = this.clock + 5;
          if (point) {
            ride.phase = 'dismount';
            ride.from = [...cat.position];
            ride.to = point;
            ride.elapsed = 0;
            cat.rotation = Math.atan2(
              -(point[0] - cat.position[0]),
              -(point[2] - cat.position[2]),
            );
          }
        }
      } else {
        // A brief crouch, then a fixed hop arc onto/off the stationary robot.
        ride.elapsed += dt;
        const phase = Math.min(1, Math.max(0, (ride.elapsed - 0.25) / 0.65));
        cat.position = [
          ride.from[0] + (ride.to[0] - ride.from[0]) * phase,
          ride.from[1] +
            (ride.to[1] - ride.from[1]) * phase +
            Math.sin(phase * Math.PI) * 0.2,
          ride.from[2] + (ride.to[2] - ride.from[2]) * phase,
        ];
        if (phase === 1) {
          if (ride.phase === 'mount') ride.phase = 'aboard';
          else {
            cat.fsm.set('settle');
            cat.stayUntil = this.clock + 30;
            this.catRide = null;
          }
        }
      }
    }
    if (this.clock >= 10 && !this.reduced) {
      if (this.clock >= this.routineUntil) {
        this.residentRoutine = this.random.choose(
          (Object.keys(residentRoutines) as ResidentRoutine[]).filter(
            (mode) => mode !== this.residentRoutine,
          ),
        )!;
        this.routineUntil = this.clock + this.random.between(180, 300);
      }
      if (
        resident.active &&
        this.relevant(resident.room) &&
        !resident.path.length &&
        this.clock > resident.stayUntil &&
        !this.events.active
      ) {
        const wanted =
          this.view !== 'overview' && this.view !== 'plan'
            ? this.view
            : undefined;
        const all = this.eligible('resident').filter(
            (n) => n.id !== resident.node,
          ),
          routine = all.filter((n) =>
            (
              residentRoutines[this.residentRoutine] as readonly string[]
            ).includes(n.id),
          ),
          preferred = routine.filter((n) => n.room === wanted);
        const goal = this.random.choose(
          this.random.next() < 0.7 && preferred.length
            ? preferred
            : routine.length
              ? routine
              : all,
        );
        resident.stayUntil = this.clock + 10;
        if (goal) this.go(resident, goal);
      }
      if (
        !cat.path.length &&
        cat.fsm.state !== 'ride' &&
        this.clock > cat.stayUntil &&
        !this.events.active &&
        this.relevant(cat.room)
      ) {
        const room =
          this.view === 'overview' || this.view === 'plan'
            ? cat.room
            : this.view;
        const goal = this.random.choose(
          this.eligible('cat', room).filter((n) => n.id !== cat.node),
        );
        cat.stayUntil = this.clock + 30;
        if (goal) this.go(cat, goal);
      }
      if (
        rabbit.active &&
        !rabbit.path.length &&
        this.clock > rabbit.stayUntil &&
        !this.events.active
      ) {
        const neighbors = this.node(rabbit.node).neighbors;
        const goal = this.random.choose(
          this.eligible('rabbit', rabbit.room).filter(
            (n) =>
              neighbors.includes(n.id) &&
              distance(worldPoint(n), rabbit.position) < 3,
          ),
        );
        rabbit.stayUntil = this.clock + 25;
        if (goal) {
          this.go(rabbit, goal);
          this.hooks.sound('hop', rabbit.position);
        }
      }
      if (robot.visible) {
        robot.battery = Math.max(
          0,
          Math.min(
            100,
            robot.battery +
              (robot.fsm.state === 'charging'
                ? dt * 0.65
                : robot.path.length
                  ? -dt * 0.18
                  : 0),
          ),
        );
        if (!robot.path.length && this.clock > robot.stayUntil) {
          const goal =
            robot.battery < 25
              ? this.node('robot.dock')
              : this.random.choose(
                  this.eligible('robot').filter((n) => n.id !== robot.node),
                );
          robot.stayUntil = this.clock + 10;
          if (goal) {
            robot.fsm.set('start');
            this.go(robot, goal, false);
          }
        }
      }
      if (this.clock > this.nextCheck) {
        this.nextCheck = this.clock + this.random.between(24, 40);
        this.interactions();
        if (!this.events.active) {
          const room =
            this.view === 'overview' || this.view === 'plan'
              ? this.random.choose<RoomId>([
                  'study',
                  'living',
                  'bedroom',
                  'gallery',
                  'cafe',
                ])!
              : this.view;
          const rabbitStarted =
            this.rabbitEligible &&
            !this.rabbitSeen &&
            this.clock > 45 &&
            this.startRabbit(rabbit.room);
          const birdStarted =
            !rabbitStarted &&
            this.random.next() <
              eventRules.bird.chance[this.environment.time] &&
            this.startBird(room);
          if (!rabbitStarted && !birdStarted) this.quietMoment(room);
        }
      }
    }
  }
  private quietMoment(room: RoomId) {
    if (this.events.active || this.reduced || this.clock < 10) return false;
    const resident = this.actors.resident;
    const rule = momentRules.residentQuiet;
    if (
      resident.active &&
      resident.visible &&
      !resident.path.length &&
      !resident.actionUntil &&
      this.random.next() < rule.chance &&
      this.events.start(
        'residentQuiet',
        'resident',
        this.clock,
        rule.duration,
        rule.cooldown,
      )
    ) {
      resident.fsm.set(this.random.choose(quietPoses(resident.node))!);
      resident.actionUntil = this.clock + rule.duration;
      resident.stayUntil = Math.max(
        resident.stayUntil,
        this.clock + rule.duration + 20,
      );
      return true;
    }
    const coffee = momentRules.coffeeAroma;
    if (
      ['study', 'living', 'cafe'].includes(room) &&
      this.random.next() < coffee.chance &&
      this.events.start(
        'coffeeAroma',
        'resident',
        this.clock,
        coffee.duration,
        coffee.cooldown,
      )
    ) {
      this.hooks.moment?.('coffeeAroma', room, this.random.next());
      return true;
    }
    const dust = momentRules.windowMotes;
    if (
      this.environment.time !== 'night' &&
      ['clear', 'cloudy'].includes(this.environment.weather) &&
      this.random.next() < dust.chance &&
      this.events.start(
        'windowMotes',
        'resident',
        this.clock,
        dust.duration,
        dust.cooldown,
      )
    ) {
      this.hooks.moment?.('windowMotes', room, this.random.next());
      return true;
    }
    return false;
  }
  snapshot() {
    return {
      clock: this.clock,
      seed: this.sessionSeed,
      residentRoutine: this.residentRoutine,
      event: this.events.active,
      paused: this.paused,
      rabbitEligible: this.rabbitEligible,
      actors: Object.fromEntries(
        Object.values(this.actors).map((a) => [
          a.id,
          {
            node: a.node,
            target: a.target,
            state: a.fsm.state,
            room: a.room,
            position: a.position,
            active: a.active,
            visible: a.visible,
            seated: a.seated,
            path: a.path.length,
            battery: a.battery,
          },
        ]),
      ),
    };
  }
}
