import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Poolside";

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
      <path
        d="M2.4 8.6c2.2-2.5 4.5-2.5 6.7 0s4.5 2.5 6.7 0 4.5-2.5 5.8-.6"
        fill="none"
        stroke="#0EA5E9"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M2.4 15.4c2.2-2.5 4.5-2.5 6.7 0s4.5 2.5 6.7 0 4.5-2.5 5.8-.6"
        fill="none"
        stroke="#0EA5E9"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </svg>
  );
});

export default Icon;
