import expressions from './visitor-expressions.json';
import social from './visitor-social.json';
export type Expression = keyof typeof expressions;
export type SocialKind = keyof typeof social;
export { expressions, social };

export function paintSocial(
  ctx: CanvasRenderingContext2D,
  kind: string,
  incoming: boolean,
) {
  const spec = social[kind as SocialKind];
  if (!spec) return false;
  ctx.fillStyle = spec.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '36px system-ui';
  ctx.fillText(spec.symbol, 96, 38);
  ctx.font = '500 18px system-ui';
  ctx.fillText(incoming ? spec.received : spec.sent, 96, 78, 150);
  return true;
}

export function paintExpression(ctx: CanvasRenderingContext2D, kind: string) {
  const spec = expressions[kind as Expression];
  if (!spec) return false;
  ctx.strokeStyle = spec.color;
  ctx.fillStyle = spec.color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (kind === 'inspired') {
    ctx.font = '58px Georgia';
    ctx.fillText('✦', 96, 55);
  } else {
    for (const x of [70, 122]) {
      ctx.beginPath();
      if (kind === 'curious') {
        ctx.ellipse(x, 48, 3, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(x - 8, 51);
        ctx.quadraticCurveTo(x, kind === 'smile' ? 35 : 57, x + 8, 51);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.moveTo(83, 66);
    ctx.quadraticCurveTo(96, kind === 'smile' ? 83 : 68, 109, 66);
    ctx.stroke();
    if (kind === 'smile') {
      ctx.globalAlpha = 0.23;
      for (const x of [58, 134]) {
        ctx.beginPath();
        ctx.ellipse(x, 66, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.font = '24px Georgia';
      ctx.fillText(spec.symbol, 149, 27);
    }
  }
  return true;
}
