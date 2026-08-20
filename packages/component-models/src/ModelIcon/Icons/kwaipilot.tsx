import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Kwaipilot";

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
        d="M4 3h3.4v7.1L14.3 3h4.4l-7.3 7.6L19.4 21h-4.3l-5.4-7.6-2.3 2.4V21H4z"
        fill="#FF6A00"
      />
    </svg>
  );
});

export default Icon;
