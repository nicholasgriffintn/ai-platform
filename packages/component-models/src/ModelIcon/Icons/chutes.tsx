import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Chutes";

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
      <path d="M12 2.4a9.6 9.6 0 0 0-9.6 9.6h19.2A9.6 9.6 0 0 0 12 2.4z" fill="#7C5CFF" />
      <path d="M4.5 13.4h3.6l3.9 4.7 3.9-4.7h3.6l-6 7.2a1.9 1.9 0 0 1-3 0z" fill="#7C5CFF" />
    </svg>
  );
});

export default Icon;
