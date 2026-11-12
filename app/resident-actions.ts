export const residentActions = {
  welcome: { label: '打个招呼', detail: '放下手边的事，向你挥手' },
  read: { label: '一起读书', detail: '分享主理人正在读的画册' },
  coffee: { label: '准备咖啡', detail: '走到咖啡吧，准备一杯热饮' },
  tour: { label: '带我看展', detail: '走向展厅，一起看看收藏' },
  stretch: { label: '休息一下', detail: '活动肩膀，伸个懒腰' },
} as const;
export type ResidentAction = keyof typeof residentActions;
