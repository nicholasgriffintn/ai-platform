import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Voyage AI";

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
        d="M12 1.6a10.4 10.4 0 1 0 0 20.8 10.4 10.4 0 0 0 0-20.8zm0 2.7a7.7 7.7 0 1 1 0 15.4 7.7 7.7 0 0 1 0-15.4z"
        fill="#1F6FEB"
      />
      <path d="m16.4 7.6-2.5 6.3-6.3 2.5 2.5-6.3z" fill="#1F6FEB" />
    </svg>
  );
});

export default Icon;
