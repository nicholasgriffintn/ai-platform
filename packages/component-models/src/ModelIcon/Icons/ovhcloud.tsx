import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "OVHcloud";

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
        d="M18.4 9.4A6.6 6.6 0 005.9 8 4.6 4.6 0 006.5 17h11.2a4.3 4.3 0 00.7-8.5zm-.7 5.9H6.5a2 2 0 01-.2-4l1.6-.2.4-1.6a4 4 0 017.7.8l.3 1.7 1.7.2a1.7 1.7 0 01-.3 3.4z"
        fill="#123F6D"
      />
      <path d="M9.3 12.1h1.9l.9 2.2.9-2.2h1.9L13 16.4h-1.7z" fill="#123F6D" />
    </svg>
  );
});

export default Icon;
