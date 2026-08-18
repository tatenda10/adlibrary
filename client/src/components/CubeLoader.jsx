function CubeLoader({
  size = 40,
  label = '',
  className = '',
}) {
  return (
    <div
      className={`spiral-loader ${className}`.trim()}
      style={{ '--spiral-size': `${size}px` }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label || 'Loading'}
    >
      <span className="spiral-loader__ring" aria-hidden="true" />
      {label ? <p className="spiral-loader__label">{label}</p> : null}
    </div>
  );
}

export function CubeLoaderOverlay({
  label = '',
  className = '',
  minHeight,
  fullscreen = false,
  size = 40,
}) {
  const overlayClass = [
    'spiral-loader-overlay',
    fullscreen ? 'spiral-loader-overlay--fullscreen' : '',
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
