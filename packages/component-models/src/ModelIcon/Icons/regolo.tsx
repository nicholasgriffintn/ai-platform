import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Regolo AI";

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
        d="M4 4h7.5a4.8 4.8 0 012.3 9l3.2 7H14l-2.9-6.4H7.2V20H4zm3.2 2.9v3.8h4.1a1.9 1.9 0 100-3.8zM17 4h3v3h-3zm0 5h3v3h-3z"
        fill="#0EA5A5"
      />
    </svg>
  );
});

export default Icon;
