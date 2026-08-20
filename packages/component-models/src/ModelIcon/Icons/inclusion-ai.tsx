import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "InclusionAI";

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
        d="M12 1.6a10.4 10.4 0 1 0 0 20.8 10.4 10.4 0 0 0 0-20.8zm0 2.8a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1 0-15.2z"
        fill="#3F6BFF"
      />
      <circle cx="12" cy="12" r="3.8" fill="#3F6BFF" />
    </svg>
  );
});

export default Icon;
