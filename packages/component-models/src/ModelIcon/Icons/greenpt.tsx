import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "GreenPT";

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
        d="M12 21C7 21 3 17 3 12.2 3 6.6 7.6 3 15 3h6v5.4C21 15.6 17.1 21 12 21zm0-2.4c3.6 0 6.6-3.9 6.6-10.2V5.4H15C9 5.4 5.4 8 5.4 12.2c0 2.3 1.2 4.2 3 5.2l4.4-6.6 1.9 1.3-4.3 6.4c.5.1 1 .1 1.6.1z"
        fill="#1F9D55"
      />
    </svg>
  );
});

export default Icon;
