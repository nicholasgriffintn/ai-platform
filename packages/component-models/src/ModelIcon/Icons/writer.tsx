import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Writer";

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
      <path d="M18.3 2.2a2.1 2.1 0 0 1 3 3l-9.9 9.9-4 1 1-4z" fill="#5D3FD3" />
      <rect x="3" y="19.2" width="18" height="2.6" rx="1.3" fill="#5D3FD3" />
    </svg>
  );
});

export default Icon;
