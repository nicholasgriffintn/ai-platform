import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Parallel";

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
      <path d="M9.9 3h3.6L8.3 21H4.7zM17.7 3h3.6L16.1 21h-3.6z" fill="currentColor" />
    </svg>
  );
});

export default Icon;
