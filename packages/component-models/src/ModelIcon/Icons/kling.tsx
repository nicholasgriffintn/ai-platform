import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Kling";

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
      <path d="M9.6 4.7 20.4 12 9.6 19.3z" fill="#FF4D4F" />
      <rect x="2" y="6.4" width="2.6" height="11.2" rx="1.3" fill="#FF4D4F" />
      <rect x="5.7" y="8.9" width="2.2" height="6.2" rx="1.1" fill="#FF4D4F" fillOpacity="0.55" />
    </svg>
  );
});

export default Icon;
