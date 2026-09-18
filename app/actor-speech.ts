import * as T from 'three';

/** A small DOM bubble follows the projected head, including while the camera moves. */
export function createActorSpeech(canvas: HTMLCanvasElement, camera: T.Camera) {
  const bubble = document.createElement('div');
  bubble.className = 'actor-speech';
  bubble.hidden = true;
  bubble.setAttribute('role', 'status');
  bubble.setAttribute('aria-live', 'polite');
  const text = document.createElement('span');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'actor-speech-close';
  close.textContent = '×';
  close.setAttribute('aria-label', '收起对话气泡');
  bubble.append(text, close);
  canvas.parentElement!.append(bubble);
  let expires = 0;
  close.onclick = () => {
    expires = 0;
    bubble.hidden = true;
  };
  for (const event of ['pointerdown', 'pointerup', 'click', 'wheel'])
    bubble.addEventListener(event, (e) => e.stopPropagation());
  return {
    get active() {
      return Date.now() < expires;
    },
    show(message: string) {
      text.textContent = message;
      expires =
        Date.now() + Math.min(12000, Math.max(5500, message.length * 160));
    },
    update(head: T.Vector3 | null, visible: boolean) {
      if (!head || !visible || Date.now() >= expires) {
        bubble.hidden = true;
        return;
      }
      const point = head.clone().project(camera);
      if (
        point.z < -1 ||
        point.z > 1 ||
        Math.abs(point.x) > 1 ||
        Math.abs(point.y) > 1
      ) {
        bubble.hidden = true;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      bubble.hidden = false;
      const half = bubble.offsetWidth / 2;
      const x = rect.left + ((point.x + 1) * rect.width) / 2;
      const center = Math.max(half + 12, Math.min(innerWidth - half - 12, x));
      const y = Math.max(
        bubble.offsetHeight + 16,
        rect.top + ((1 - point.y) * rect.height) / 2 - 12,
      );
      bubble.style.left = `${center}px`;
      bubble.style.top = `${y}px`;
      bubble.style.setProperty(
        '--speech-tail',
        `${Math.max(18, Math.min(half * 2 - 18, half + x - center))}px`,
      );
    },
    dispose: () => bubble.remove(),
  };
}
