import { useMemo } from 'react';

type CADRulerProps = {
  orientation: 'horizontal' | 'vertical';
  size: number;
  cameraOffset: number;
  cameraScale: number;
  scaleRatio: number; // pixels por metro
  isDark?: boolean;
};

export function CADRuler({
  orientation,
  size,
  cameraOffset,
  cameraScale,
  scaleRatio,
  isDark = true,
}: CADRulerProps) {
  // Intervalo em metros adaptativo conforme o zoom
  const { stepMeters, ticks } = useMemo(() => {
    const safeScale = Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1;
    const safeRatio = Number.isFinite(scaleRatio) && scaleRatio > 0 ? scaleRatio : 20;
    const safeOffset = Number.isFinite(cameraOffset) ? cameraOffset : 0;
    const safeSize = Number.isFinite(size) && size > 0 ? size : 0;

    const pixelsPerMeter = safeRatio * safeScale;
    let step = 1;
    if (pixelsPerMeter < 10) step = 10;
    else if (pixelsPerMeter < 25) step = 5;
    else if (pixelsPerMeter < 60) step = 2;
    else step = 1;

    // Converte o viewport visível em metros
    const startMeters = Math.floor((-safeOffset) / pixelsPerMeter) - 1;
    const endMeters = Math.ceil((safeSize - safeOffset) / pixelsPerMeter) + 1;

    const tickList: { meter: number; pos: number; isMajor: boolean }[] = [];
    const minM = Math.max(0, startMeters);
    const maxM = endMeters;

    for (let m = minM; m <= maxM; m += step) {
      const pos = safeOffset + m * pixelsPerMeter;
      if (pos >= -20 && pos <= safeSize + 20) {
        tickList.push({
          meter: m,
          pos,
          isMajor: m % (step * 5) === 0 || m === 0,
        });
      }
    }

    return { stepMeters: step, ticks: tickList };
  }, [size, cameraOffset, cameraScale, scaleRatio]);

  const textColor = isDark ? '#94a3b8' : '#64748b';
  const tickColor = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(100, 116, 139, 0.3)';
  const majorTickColor = isDark ? 'rgba(249, 115, 22, 0.6)' : 'rgba(217, 119, 6, 0.7)';

  if (orientation === 'horizontal') {
    return (
      <svg
        className="w-full h-5 pointer-events-none select-none"
        style={{ width: size, height: 20 }}
      >
        <line x1={0} y1={19} x2={size} y2={19} stroke={tickColor} strokeWidth={1} />
        {ticks.map(({ meter, pos, isMajor }) => (
          <g key={meter} transform={`translate(${pos}, 0)`}>
            <line
              x1={0}
              y1={isMajor ? 4 : 12}
              x2={0}
              y2={19}
              stroke={isMajor ? majorTickColor : tickColor}
              strokeWidth={isMajor ? 1.5 : 1}
            />
            {isMajor && (
              <text
                x={2}
                y={11}
                fill={textColor}
                fontSize={9}
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                className="tabular-nums"
              >
                {meter}m
              </text>
            )}
          </g>
        ))}
      </svg>
    );
  }

  return (
    <svg
      className="w-5 h-full pointer-events-none select-none"
      style={{ width: 20, height: size }}
    >
      <line x1={19} y1={0} x2={19} y2={size} stroke={tickColor} strokeWidth={1} />
      {ticks.map(({ meter, pos, isMajor }) => (
        <g key={meter} transform={`translate(0, ${pos})`}>
          <line
            x1={isMajor ? 4 : 12}
            y1={0}
            x2={19}
            y2={0}
            stroke={isMajor ? majorTickColor : tickColor}
            strokeWidth={isMajor ? 1.5 : 1}
          />
          {isMajor && (
            <text
              x={2}
              y={-3}
              fill={textColor}
              fontSize={9}
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              className="tabular-nums"
            >
              {meter}m
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
