export function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="animate-spin"
      style={{ animationDuration: "500ms" }}
      aria-label="Loading"
      role="status"
    >
      <circle
        cx="9"
        cy="9"
        r="7"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.25"
      />
      <path
        d="M16 9A7 7 0 0 1 9 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
