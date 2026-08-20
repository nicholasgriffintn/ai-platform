import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "StepFun";

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
      <rect x="2" y="16.4" width="5.4" height="5.6" rx="1.4" fill="#2F6BFF" />
      <rect x="9.3" y="10.4" width="5.4" height="11.6" rx="1.4" fill="#2F6BFF" />
      <rect x="16.6" y="4.4" width="5.4" height="17.6" rx="1.4" fill="#2F6BFF" />
    </svg>
  );
});

export default Icon;
