import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Requesty";

const Icon: IconType = memo(({ size = "1em", style, ...rest }) => {
  return (
    <svg
      height={size}
      style={{ flex: "none", lineHeight: 1, ...style }}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <title>{TITLE}</title>
      <circle cx="4.8" cy="12" r="2.8" fill="#7C5CFF" />
      <circle cx="19.2" cy="5.6" r="2.4" fill="#7C5CFF" />
      <circle cx="19.2" cy="18.4" r="2.4" fill="#7C5CFF" />
      <path
        d="M7.6 12h4.3m0 0 4.9-5.4m-4.9 5.4 4.9 5.4"
        fill="none"
        stroke="#7C5CFF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
});

export default Icon;
