import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Cortecs";

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
        d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21zm0 2.7a7.8 7.8 0 1 1 0 15.6 7.8 7.8 0 0 1 0-15.6z"
        fill="#2F6BFF"
      />
      <circle cx="12" cy="7.6" r="1.9" fill="#2F6BFF" />
      <circle cx="8" cy="14.4" r="1.9" fill="#2F6BFF" />
      <circle cx="16" cy="14.4" r="1.9" fill="#2F6BFF" />
    </svg>
  );
});

export default Icon;
