import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "TwelveLabs";

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
        d="M4.4 2.8h15.2a2.4 2.4 0 0 1 2.4 2.4v13.6a2.4 2.4 0 0 1-2.4 2.4H4.4A2.4 2.4 0 0 1 2 18.8V5.2a2.4 2.4 0 0 1 2.4-2.4zm5.4 5.6v7.2L16 12z"
        fill="#1DB9A8"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
});

export default Icon;
