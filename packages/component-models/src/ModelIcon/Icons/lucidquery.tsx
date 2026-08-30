import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "LucidQuery";

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
        d="M11 3a8 8 0 105.3 14l3.4 3.4 1.6-1.7-3.4-3.4A8 8 0 0011 3zm0 2.4A5.6 5.6 0 115.4 11 5.6 5.6 0 0111 5.4zm0 2.2L9.6 11 6.2 12.4l3.4 1.4L11 17.2l1.4-3.4 3.4-1.4-3.4-1.4z"
        fill="#6C4BF6"
      />
    </svg>
  );
});

export default Icon;
