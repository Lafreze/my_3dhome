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
      <rect
        width="768"
        height="960"
        fill={['#e5e1d1', '#dd623f', '#d9dfda'][index % 3]}
      />
      <text x="64" y="78" fontSize="22" letterSpacing="4" fill="#252e27">
        STUDIO / SATORI
      </text>
      <path d="M64 100H704" stroke="#252e27" />
      {index % 3 === 0 ? (
        <>
          <path d="M130 750V460a254 254 0 0 1 508 0v290Z" fill="#b7bba0" />
          <clipPath id="mountains">
            <path d="M130 750V460a254 254 0 0 1 508 0v290Z" />
          </clipPath>
          <g clipPath="url(#mountains)">
            {[
              '#c8c5ac',
              '#a3aa89',
              '#828d70',
              '#65755e',
              '#405b48',
              '#294b3e',
            ].map((color, i) => (
              <path
                key={color}
                d={`M100 ${570 + i * 38}C220 ${330 + i * 55} 470 ${770 - i * 22} 670 ${420 + i * 60}V800H100Z`}
                fill={color}
              />
            ))}
          </g>
          <circle cx="470" cy="335" r="54" fill="#ede2b8" />
        </>
      ) : index % 3 === 1 ? (
        <>
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d={`M${107 + (i % 3) * 210} ${270 + Math.floor(i / 3) * 142}a67 67 0 1 1 134 0${i % 2 ? 'a67 67 0 1 1 -134 0' : 'Z'}`}
              fill={i % 2 ? '#ede5cd' : '#343d31'}
            />
          ))}
        </>
      ) : (
        <>
          {Array.from({ length: 9 }, (_, i) => (
            <path
              key={i}
              d={`M90 ${220 + i * 57}C280 ${60 + i * 64} 400 ${560 + i * 28} 680 ${230 + i * 55}`}
              fill="none"
              stroke={i % 2 ? '#648077' : '#365856'}
              strokeWidth="12"
            />
          ))}
          <circle cx="570" cy="305" r="75" fill="#d6a151" />
        </>
      )}
      <text
        x="64"
        y="850"
        fontSize="52"
        fontFamily="Georgia,serif"
        fill="#252e27"
      >
        {['Quiet terrain', 'Form & rhythm', 'Collected moments'][index % 3]}
      </text>
      <text x="64" y="900" fontSize="18" letterSpacing="2" fill="#252e27">
        EXPLORATIONS　　　　　　　　　0{index + 1} / 2026
      </text>
    </svg>
  );
}
