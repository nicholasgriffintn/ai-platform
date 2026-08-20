import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Vectorize";

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
      <circle cx="4.8" cy="19.2" r="2.8" fill="#F97316" />
      <path
        d="M7.2 16.8 15 9"
        fill="none"
        stroke="#F97316"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M13.4 3.6H21v7.6z" fill="#F97316" />
    </svg>
  );
});

export default Icon;
