import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Serper";

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
        d="M10.4 2.6a7.8 7.8 0 1 0 4.8 13.9l4.3 4.3a1.4 1.4 0 0 0 2-2l-4.3-4.3A7.8 7.8 0 0 0 10.4 2.6zm0 2.7a5.1 5.1 0 1 1 0 10.2 5.1 5.1 0 0 1 0-10.2z"
        fill="#17A34A"
      />
    </svg>
  );
});

export default Icon;
