import { useEffect, useState } from "react";
import { useExperiments } from "~/hooks/use-experiments";

export const defaultParrot = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" aria-labelledby="title" role="img"><title id="title" class="sr-only">Polychat Logo</title><path fill="#2E7D32" stroke="#333" stroke-width="2" d="M50 100 70 60 110 50 140 70 150 100 120 130H80z"></path><path fill="#FF9800" stroke="#333" stroke-width="2" d="M140 70 170 60 160 90 150 100z"></path><path fill="#8BC34A" stroke="#333" stroke-width="2" d="M80 45 90 25 100 45z"></path><path fill="#AED581" stroke="#333" stroke-width="2" d="M100 45 110 30 120 50z"></path><path fill="#1B5E20" stroke="#333" stroke-width="2" d="M80 90 60 110 70 120 90 110z"></path><path fill="#8BC34A" stroke="#333" stroke-width="2" d="M50 100 30 90 25 110 40 115z"></path><path fill="#689F38" stroke="#333" stroke-width="2" d="M50 100 35 120 45 130 60 120z"></path><circle cx="100" cy="70" r="4" fill="#333"></circle><circle cx="100" cy="70" r="1" fill="#FFF"></circle><path fill="#FFEB3B" stroke="#333" stroke-width="1.5" d="M90 100 100 120 110 100z"></path><path fill="#795548" stroke="#333" stroke-width="1.5" d="M100 130 95 150 105 150 100 130z"></path><path fill="#5D4037" stroke="#333" stroke-width="1.5" d="M95 150 85 155 105 155 115 155 105 150z"></path></svg>`;
export const minimalistParrot = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" aria-labelledby="title" role="img"><title id="title" class="sr-only">Polychat Logo</title><path fill="#9E9E9E" stroke="#333" stroke-width="2" d="M60 100 75 70 110 60 140 80 145 100 120 125H80z"></path><path fill="#FF9800" stroke="#333" stroke-width="2" d="M140 80 160 70 150 90z"></path><circle cx="105" cy="80" r="3" fill="#333"></circle><path fill="#757575" stroke="#333" stroke-width="2" d="M80 95 65 110 80 115z"></path><path fill="#BDBDBD" stroke="#333" stroke-width="2" d="M60 100 45 110 55 120z"></path><path fill="#616161" stroke="#333" stroke-width="1.5" d="M100 125 95 145 105 145 100 125z"></path><path fill="#424242" stroke="#333" stroke-width="1.5" d="M95 145 85 150 105 150 115 150 105 145z"></path></svg>`;
export const tropicalParrot = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" aria-labelledby="title" role="img"><title id="title" class="sr-only">Polychat Logo</title><path fill="#1E88E5" stroke="#333" stroke-width="2" d="M50 100 70 60 110 50 140 70 150 100 120 130H80z"></path><path fill="#FFC107" stroke="#333" stroke-width="2" d="M140 70 170 60 160 90 150 100z"></path><path fill="#E53935" stroke="#333" stroke-width="2" d="M80 45 90 25 100 45z"></path><path fill="#F44336" stroke="#333" stroke-width="2" d="M100 45 110 30 120 50z"></path><path fill="#0D47A1" stroke="#333" stroke-width="2" d="M80 90 60 110 70 120 90 110z"></path><path fill="#4CAF50" stroke="#333" stroke-width="2" d="M50 100 30 90 25 110 40 115z"></path><path fill="#8BC34A" stroke="#333" stroke-width="2" d="M50 100 35 120 45 130 60 120z"></path><circle cx="100" cy="70" r="4" fill="#333"></circle><circle cx="100" cy="70" r="1" fill="#FFF"></circle><path fill="#FFEB3B" stroke="#333" stroke-width="1.5" d="M90 100 100 120 110 100z"></path><path fill="#795548" stroke="#333" stroke-width="1.5" d="M100 130 95 150 105 150 100 130z"></path><path fill="#5D4037" stroke="#333" stroke-width="1.5" d="M95 150 85 155 105 155 115 155 105 150z"></path></svg>`;
export const abstractParrot = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" aria-labelledby="title" role="img"><title id="title" class="sr-only">Polychat Parrot Logo</title><polygon fill="#673AB7" stroke="#333" stroke-width="1.5" points="50,100 70,60 110,50 140,70 150,100 120,130 80,130"></polygon><polygon fill="#FF9800" stroke="#333" stroke-width="1.5" points="140,70 170,60 160,90 150,100"></polygon><polygon fill="#9C27B0" stroke="#333" stroke-width="1.5" points="80,45 95,25 110,45"></polygon><polygon fill="#4A148C" stroke="#333" stroke-width="1.5" points="80,90 60,110 70,120 90,110"></polygon><polygon fill="#7B1FA2" stroke="#333" stroke-width="1.5" points="50,100 30,90 25,110 40,115"></polygon><circle cx="100" cy="70" r="4" fill="#333"></circle><polygon fill="#E1BEE7" stroke="#333" stroke-width="1" points="90,80 100,90 110,80"></polygon><polygon fill="#CE93D8" stroke="#333" stroke-width="1" points="90,100 100,120 110,100"></polygon><line x1="120" y1="90" x2="130" y2="100" stroke="#333" stroke-width="1.5"></line><line x1="120" y1="100" x2="130" y2="90" stroke="#333" stroke-width="1.5"></line><polygon fill="#512DA8" stroke="#333" stroke-width="1.5" points="100,130 95,150 105,150"></polygon><polygon fill="#4527A0" stroke="#333" stroke-width="1.5" points="95,150 85,155 105,155 115,155 105,150"></polygon></svg>`;

export type LogoVariant = "default" | "minimalist" | "tropical" | "abstract";

export interface LogoProps {
  variant?: LogoVariant;
  className?: string;
}

export function Logo({ variant = "default", className = "" }: LogoProps) {
  const { getVariant } = useExperiments();
  const [experimentVariant, setExperimentVariant] =
    useState<LogoVariant>(variant);

  useEffect(() => {
    getVariant("logo").then((result) => {
      if (result) setExperimentVariant(result as LogoVariant);
    });
  }, [getVariant]);

  const logoSvg = (() => {
    switch (experimentVariant) {
      case "minimalist":
        return minimalistParrot;
      case "tropical":
        return tropicalParrot;
      case "abstract":
        return abstractParrot;
      default:
        return defaultParrot;
    }
  })();

  return (
    <div
      className={className}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: it's hard coded
      dangerouslySetInnerHTML={{ __html: logoSvg }}
      role="img"
      aria-label="Polychat Logo"
    />
  );
}
