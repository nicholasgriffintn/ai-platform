import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Hetzner";

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
      <path d="M3 3h4.3v6.8h9.4V3H21v18h-4.3v-6.8H7.3V21H3z" fill="#D50C2D" />
    </svg>
  );
});

export default Icon;
