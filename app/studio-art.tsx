/* Local uploads are pre-sized data URLs. SVG needs an image role for accessible artwork. */
/* oxlint-disable next/no-img-element, jsx-a11y/prefer-tag-over-role */
export default function StudioArt({
  index = 0,
  image = '',
  title = '作品',
}: {
  index?: number;
  image?: string;
  title?: string;
}) {
  if (image) return <img className="art-image" src={image} alt={title} />;
  return (
    <svg
      viewBox="0 0 768 960"
      role="img"
      aria-label={title}
      className="studio-art"
    >
      <rect width="768" height="960" fill="#e8e1d2" />
      <text x="64" y="78" fontSize="22" letterSpacing="4" fill="#343d3c">
        STUDIO / SATORI
      </text>
      <rect x="64" y="125" width="640" height="640" fill="#343d3c" />
      {index % 3 === 0 ? (
        <g fill="none" stroke="#c4b18a" strokeWidth="3">
          {Array.from({ length: 7 }, (_, i) => (
            <g key={i}>
              <rect
                x={210 + i * 19}
                y={265 + i * 19}
                width={348 - i * 38}
                height={348 - i * 38}
              />
              <path d={`M90 ${313 + i * 41}H200M568 ${313 + i * 41}H678`} />
            </g>
          ))}
        </g>
      ) : index % 3 === 1 ? (
        <g>
          {Array.from({ length: 7 }, (_, i) => (
            <rect
              key={i}
              x={130 + (i % 3) * 165}
              y={235 + Math.floor(i / 3) * 148}
              width="130"
              height="126"
              fill={i % 2 ? '#879a80' : '#d9ccb0'}
            />
          ))}
        </g>
      ) : (
        <g stroke="#c4b18a" strokeWidth="3">
          {Array.from({ length: 3 }, (_, i) => (
            <g
              key={i}
              transform={`translate(${260 + i * 125},445) rotate(${(i - 1) * 13})`}
            >
              <rect x="-95" y="-175" width="190" height="350" fill="#343d3c" />
              <ellipse rx="52" ry="74" fill="none" />
              <circle cy="-113" r="12" fill="#ede7db" stroke="none" />
            </g>
          ))}
        </g>
      )}
      <text
        x="64"
        y="850"
        fontSize="34"
        textLength={title.length > 27 ? 640 : undefined}
        lengthAdjust="spacingAndGlyphs"
        fontFamily="Georgia,serif"
        fill="#252e27"
      >
        {title}
      </text>
      <text x="64" y="900" fontSize="18" letterSpacing="2" fill="#252e27">
        PROJECT COVER / 项目概念封面
      </text>
    </svg>
  );
}
