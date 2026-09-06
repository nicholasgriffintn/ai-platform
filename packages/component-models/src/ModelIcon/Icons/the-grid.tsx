import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "The Grid AI";

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
        d="M3.5 3.5h6.2v6.2H3.5zm10.8 0h6.2v6.2h-6.2zM3.5 14.3h6.2v6.2H3.5zm10.8 0h6.2v6.2h-6.2z"
        fill="currentColor"
      />
      <path
        d="M9.7 6h4.6v1.2H9.7zm0 10.8h4.6V18H9.7zM6 9.7h1.2v4.6H6zm10.8 0H18v4.6h-1.2z"
        fill="currentColor"
        opacity=".55"
      />
    </svg>
  );
});

export default Icon;
