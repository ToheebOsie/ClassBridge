/** A few line icons. Add more here rather than pulling in a whole icon library. */
const paths = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  invoice: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 2.7-5 6-5s6 2 6 5M16 11a2.5 2.5 0 1 0 0-5M18 15c2 .5 3 2 3 5',
  up: 'M12 19V5M6 11l6-6 6 6',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-2-3-2 .5-1.5-1L15 5h-4l-.5 2.5-1.5 1L7 8l-2 3 2 1v2l-2 1 2 3 2-.5 1.5 1L11 21h4l.5-2.5 1.5-1 2 .5 2-3-2-1z',
};

export function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
