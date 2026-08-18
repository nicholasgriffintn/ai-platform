import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const toasterStyle: React.CSSProperties & Record<string, string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
};

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={toasterStyle}
      {...props}
    />
  );
};

export { Toaster };
