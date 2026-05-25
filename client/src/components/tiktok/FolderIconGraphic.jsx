export function FolderIconGraphic({ className = 'h-[92px] w-[112px]' }) {
  return (
    <svg
      viewBox="0 0 112 92"
      className={className}
      aria-hidden
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 18c0-3.3 2.7-6 6-6h22l8 10h54c3.3 0 6 2.7 6 6v44c0 3.3-2.7 6-6 6H14c-3.3 0-6-2.7-6-6V18z"
        fill="#facc15"
        stroke="#ca8a04"
        strokeWidth="2"
      />
      <path
        d="M8 28h96v44c0 3.3-2.7 6-6 6H14c-3.3 0-6-2.7-6-6V28z"
        fill="#fde047"
      />
      <path d="M36 12h22l8 10H14c-3.3 0-6 2.7-6 6v2h26l-8-10z" fill="#eab308" />
    </svg>
  );
}
