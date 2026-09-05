import { THEME_BOOTSTRAP_SCRIPT } from "@ngriffin_uk/polychat-component-ui";
import { Links, Meta, Scripts, ScrollRestoration } from "react-router";

interface AppShellProps {
  children: React.ReactNode;
}

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Polychat",
  description: "Chat with multiple AI models from one place",
  url: "https://polychat.app",
  applicationCategory: "AIApplication",
};

export function AppShell({ children }: AppShellProps) {
  return (
    <html lang="en" className="dark bg-background" data-polychat-theme="dark">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#040810" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <link
          rel="search"
          type="application/opensearchdescription+xml"
          title="Polychat"
          href="/opensearch.xml"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
