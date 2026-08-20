import { memo } from "react";

import type { IconType } from "../icon-type";

const TITLE = "Thinking Machines";

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
      <circle cx="5.4" cy="5.4" r="2.2" fill="currentColor" />
      <circle cx="12" cy="5.4" r="2.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="18.6" cy="5.4" r="2.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="5.4" cy="12" r="2.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <circle cx="18.6" cy="12" r="2.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="5.4" cy="18.6" r="2.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="12" cy="18.6" r="2.2" fill="currentColor" fillOpacity="0.5" />
      <circle cx="18.6" cy="18.6" r="2.2" fill="currentColor" />
    </svg>
  );
});

export default Icon;
