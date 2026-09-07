export const objects = {
  bed: { name: '柔软的角落', kind: '休息区', description: '亚麻床品，蓬松枕头。把忙碌留在门外，今天也可以慢一点。', action: '换一套床品' },
  desk: { name: '窗边工作台', kind: '工作区', description: '一张橡木桌，一束穿过窗户的光。灵感从这里开始。', action: '打开电脑' },
  computer: { name: '灵感工作站', kind: '工作区', description: '收集想法，写下小事。在这里，让思绪自由生长。', action: '打开电脑' },
  lamp: { name: '一盏暖光', kind: '照明', description: '小小的蘑菇台灯，给每个安静的夜晚留一盏灯。', action: '切换台灯' },
  frame: { name: '山间来信', kind: '回忆', description: '把远方的山和日落，装进一只小小的木相框。', action: '看看相框' },
  shelf: { name: '日常收藏', kind: '阅读区', description: '喜欢的书和旅行带回的小物，慢慢填满生活的空隙。', action: '翻开一本书' },
  chair: { name: '阅读一刻', kind: '阅读区', description: '坐进柔软的椅子里，读几页书，或者只是发一会儿呆。', action: '换一个颜色' },
  coffee: { name: '午后的咖啡', kind: '休闲区', description: '一杯手冲，一本没读完的书。美好的下午不需要太多安排。', action: '续一杯咖啡' },
  plant: { name: '会呼吸的绿意', kind: '绿植', description: '一株向着窗外生长的绿植。给它一点水，也给自己一点耐心。', action: '浇一点水' },
  rug: { name: '脚下的温柔', kind: '软装', description: '柔软的编织地毯，把休息、阅读和发呆的角落连接起来。', action: '更换地毯' },
  record: { name: '慢半拍电台', kind: '音乐', description: '唱针落下，时间也跟着慢下来。一段轻柔的原创合成旋律。', action: '播放 / 暂停' },
  window: { name: '窗外好时光', kind: '窗景', description: '白天看远山，夜晚等星星。这里的时间，由你决定。', action: '切换昼夜' },
  stool: { name: '小小的陪伴', kind: '家具', description: '圆润的小木凳，刚好接住一个放松的午后。', action: '转动小凳' },
  floor: { name: '温润木地板', kind: '空间', description: '一块块温暖的橡木，托起一整间小小的生活。', action: '回到全景' },
  wall: { name: '森林的颜色', kind: '空间', description: '森林绿和奶油白，给小屋一个平静的拥抱。', action: '回到全景' },
} as const;
export type ObjectId = keyof typeof objects;
export type RoomApi = { reset: () => void; zoom: (direction: number) => void; focus: (id: ObjectId) => void; setNight: (value: boolean) => void; setLamp: (value: boolean) => void; setMusic: (value: boolean) => void; interact: (id: ObjectId) => void; dispose: () => void };
