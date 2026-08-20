import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Xiaomi";

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
        d="M5.2 2.6h13.6A2.6 2.6 0 0 1 21.4 5.2v13.6a2.6 2.6 0 0 1-2.6 2.6H5.2a2.6 2.6 0 0 1-2.6-2.6V5.2a2.6 2.6 0 0 1 2.6-2.6zm1.4 5.8v7.4h2.1v-5.3h2v5.3h2.1V8.4zm8.7 0v7.4h2.1V8.4z"
        fill="#FF6900"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
});

export default Icon;
