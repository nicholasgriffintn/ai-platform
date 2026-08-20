import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "LongCat";

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
        d="M3.4 3 7.6 6.3a9.3 9.3 0 0 1 8.8 0L20.6 3l-1 5.6a9.1 9.1 0 1 1-15.2 0z"
        fill="#F2A33C"
      />
      <circle cx="9.3" cy="13.4" r="1.5" fill="#1C1917" />
      <circle cx="14.7" cy="13.4" r="1.5" fill="#1C1917" />
    </svg>
  );
});

export default Icon;
