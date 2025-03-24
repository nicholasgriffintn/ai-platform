import { forwardRef } from "react";

import type { IconType } from "~/types";

export const TITLE = "Hunyuan";

const Icon: IconType = forwardRef(({ size = "1em", style, ...rest }, ref) => {
  const titleId = "hunyuan-icon-title";
  return (
    <svg
      height={size}
      ref={ref}
      style={{ flex: "none", lineHeight: 1, ...style }}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby={titleId}
      focusable="false"
      {...rest}
    >
      <title id={titleId}>{TITLE}</title>
      <g fill="none" fillRule="evenodd">
        <circle cx="12" cy="12" fill="#0055E9" r="12" />
        <path
          d="M12 0c.518 0 1.028.033 1.528.096A6.188 6.188 0 0112.12 12.28l-.12.001c-2.99 0-5.242 2.179-5.554 5.11-.223 2.086.353 4.412 2.242 6.146C3.672 22.1 0 17.479 0 12 0 5.373 5.373 0 12 0z"
          fill="#A8DFF5"
        />
        <path
          d="M5.286 5a2.438 2.438 0 01.682 3.38c-3.962 5.966-3.215 10.743 2.648 15.136C3.636 22.056 0 17.452 0 12c0-1.787.39-3.482 1.09-5.006.253-.435.525-.872.817-1.311A2.438 2.438 0 015.286 5z"
          fill="#0055E9"
        />
        <path
          d="M12.98.04c.272.021.543.053.81.093.583.106 1.117.254 1.538.44 6.638 2.927 8.07 10.052 1.748 15.642a4.125 4.125 0 01-5.822-.358c-1.51-1.706-1.3-4.184.357-5.822.858-.848 3.108-1.223 4.045-2.441 1.257-1.634 2.122-6.009-2.523-7.506L12.98.039z"
          fill="#00BCFF"
        />
        <path
          d="M13.528.096A6.187 6.187 0 0112 12.281a5.75 5.75 0 00-1.71.255c.147-.905.595-1.784 1.321-2.501.858-.848 3.108-1.223 4.045-2.441 1.27-1.651 2.14-6.104-2.676-7.554.184.014.367.033.548.056z"
          fill="#ECECEE"
        />
      </g>
    </svg>
  );
});

export default Icon;
