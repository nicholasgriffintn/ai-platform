import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Recraft";

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
      <path d="M12 1.8 22.2 12 12 22.2 1.8 12z" fill="currentColor" fillOpacity="0.25" />
      <path d="M12 6.7 17.3 12 12 17.3 6.7 12z" fill="currentColor" />
    </svg>
  );
});

export default Icon;
