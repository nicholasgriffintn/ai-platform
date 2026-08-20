import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Cartesia";

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
      <rect x="3" y="8.4" width="3.2" height="7.2" rx="1.6" fill="#12B5C9" />
      <rect x="10.4" y="3.6" width="3.2" height="16.8" rx="1.6" fill="#12B5C9" />
      <rect x="17.8" y="6.8" width="3.2" height="10.4" rx="1.6" fill="#12B5C9" />
    </svg>
  );
});

export default Icon;
