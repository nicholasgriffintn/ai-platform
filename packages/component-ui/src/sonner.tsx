import type { ThemeAppearance } from "@ngriffin_uk/polychat-library-chat";
import { Toaster as Sonner, type ToasterProps as SonnerProps } from "sonner";

const toasterStyle: React.CSSProperties & Record<string, string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
};

export interface ToasterProps extends Omit<SonnerProps, "theme"> {
  appearance: ThemeAppearance;
}

const Toaster = ({ appearance, ...props }: ToasterProps) => {
  return <Sonner theme={appearance} className="toaster group" style={toasterStyle} {...props} />;
};

export { Toaster };
