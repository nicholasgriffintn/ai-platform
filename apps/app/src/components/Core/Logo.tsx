import { isLogoVariant, LogoMark, type LogoVariant } from "@ngriffin_uk/polychat-component-ui";
import { useEffect, useState } from "react";

import { useOpenFeature } from "~/hooks/use-openfeature";

export type { LogoVariant };

export interface LogoProps {
  variant?: LogoVariant;
  className?: string;
}

export function Logo({ variant = "logo_control", className = "" }: LogoProps) {
  const { getObjectDetails } = useOpenFeature();
  const [experimentVariant, setExperimentVariant] = useState<LogoVariant>(variant);

  useEffect(() => {
    let isMounted = true;

    getObjectDetails("logo", {}).then((result) => {
      if (isMounted && isLogoVariant(result?.variant)) {
        setExperimentVariant(result.variant);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [getObjectDetails]);

  return <LogoMark variant={experimentVariant} className={className} />;
}
