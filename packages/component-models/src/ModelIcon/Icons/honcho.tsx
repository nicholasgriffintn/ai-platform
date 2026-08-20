import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Honcho";

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
      <circle cx="9.2" cy="9.2" r="6.6" fill="#6D4AFF" />
      <circle cx="15.6" cy="15.2" r="5.4" fill="#6D4AFF" fillOpacity="0.55" />
    </svg>
  );
});

export default Icon;
