import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Sakana AI";

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
        d="M2.5 12c2.6-3.6 6-5.4 10.2-5.4 3.3 0 6.1 1.3 8.4 3.8L21.5 12l-.4.4c-2.3 2.5-5.1 3.8-8.4 3.8-4.2 0-7.6-1.8-10.2-5.4l-.3-.4zm10.2-3c-3 0-5.5 1-7.5 3 2 2 4.5 3 7.5 3 2.4 0 4.5-.8 6.3-2.4l.7-.6-.7-.6C17.2 9.8 15.1 9 12.7 9zm2 1.9a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
        fill="#E4572E"
      />
    </svg>
  );
});

export default Icon;
