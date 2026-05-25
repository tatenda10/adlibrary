const FACE_KEYS = ['front', 'back', 'right', 'left', 'top', 'bottom'];

function CubeFace({ faceKey }) {
  return (
    <div className={`cube__face cube__face--${faceKey}`} id={`cube__face--${faceKey}`}>
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className="faceBox" />
      ))}
    </div>
  );
}

function CubeLoader({
  size = 100,
  label = '',
  className = '',
  interactive = false,
}) {
  const cubeClass = ['cube', interactive ? 'cube--interactive' : ''].filter(Boolean).join(' ');

  return (
    <div
      className={`cube-loader ${className}`.trim()}
      style={{ '--cube-size': `${size}px` }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label || 'Loading'}
    >
      <div className={cubeClass}>
        {FACE_KEYS.map((faceKey) => (
          <CubeFace key={faceKey} faceKey={faceKey} />
        ))}
      </div>
      {label ? <p className="cube-loader__label">{label}</p> : null}
    </div>
  );
}

export function CubeLoaderOverlay({
  label = '',
  className = '',
  minHeight,
  fullscreen = false,
  size = 100,
}) {
  const overlayClass = [
    'cube-loader-overlay',
    fullscreen ? 'cube-loader-overlay--fullscreen' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={overlayClass}
      style={minHeight ? { minHeight } : undefined}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <CubeLoader size={size} label={label} />
    </div>
  );
}

export { CubeLoader };
export default CubeLoader;
