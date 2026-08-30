import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Standard Compute";

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
        d="M4 4h16v6.6H4zm0 9.4h16V20H4zm2.4-7.2v2.6h2.6V6.2zm0 9.4v2.6h2.6v-2.6z"
        fill="#3F4550"
      />
    </svg>
  );
});

export default Icon;
