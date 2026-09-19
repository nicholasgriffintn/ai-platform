import { z } from "zod";

export const SITE_ICON_NAMES = [
  "alert",
  "arrow-right",
  "bell",
  "bolt",
  "box",
  "calendar",
  "chart",
  "check",
  "clock",
  "cloud",
  "code",
  "cpu",
  "credit-card",
  "database",
  "download",
  "file",
  "gift",
  "globe",
  "heart",
  "help",
  "home",
  "image",
  "info",
  "layers",
  "link",
  "lock",
  "mail",
  "map-pin",
  "menu",
  "message",
  "phone",
  "play",
  "plus",
  "rocket",
  "search",
  "settings",
  "shield",
  "sparkles",
  "star",
  "trending-down",
  "trending-up",
  "upload",
  "users",
  "zap",
] as const;
export type SiteIconName = (typeof SITE_ICON_NAMES)[number];

const icon = z.enum(SITE_ICON_NAMES);
const optionalIcon = icon.optional();
const optionalText = z.string().optional();
const align = z.enum(["start", "center", "end"]).optional();
const gap = z.enum(["none", "xs", "sm", "md", "lg", "xl"]).optional();
const size = z.enum(["sm", "md", "lg"]).optional();

const link = z.object({ label: z.string(), href: z.string() });
const optionalLink = link.optional();
const image = z.object({ src: optionalText, alt: z.string() });
const optionalImage = image.optional();

export const SITE_COMPONENT_CATEGORIES = [
  "layout",
  "navigation",
  "section",
  "content",
  "form",
  "data",
] as const;
export type SiteComponentCategory = (typeof SITE_COMPONENT_CATEGORIES)[number];

export interface SiteComponentDefinition<TProps extends z.ZodObject = z.ZodObject> {
  category: SiteComponentCategory;
  description: string;
  props: TProps;
  acceptsChildren: boolean;
  example: z.input<TProps>;
}

function define<TProps extends z.ZodObject>(
  definition: SiteComponentDefinition<TProps>,
): SiteComponentDefinition<TProps> {
  return definition;
}

export const SITE_CATALOG = {
  Page: define({
    category: "layout",
    description:
      "The root of every page. Its children are laid out top to bottom. Use exactly one per page.",
    props: z.object({}),
    acceptsChildren: true,
    example: {},
  }),
  Section: define({
    category: "layout",
    description:
      "A full-width band of the page with padding and an optional background. Child text automatically keeps readable contrast. Wrap loose content in one; composed sections (Hero, FeatureGrid, Pricing) already include their own.",
    props: z.object({
      background: z.enum(["default", "muted", "primary", "inverted"]).optional(),
      padding: z.enum(["sm", "md", "lg"]).optional(),
      width: z.enum(["narrow", "default", "wide", "full"]).optional(),
      anchor: optionalText,
    }),
    acceptsChildren: true,
    example: { background: "muted", padding: "lg" },
  }),
  Stack: define({
    category: "layout",
    description: "Flex container that lays children out in one direction.",
    props: z.object({
      direction: z.enum(["vertical", "horizontal"]).optional(),
      gap,
      align,
      justify: z.enum(["start", "center", "end", "between"]).optional(),
      wrap: z.boolean().optional(),
    }),
    acceptsChildren: true,
    example: { direction: "horizontal", gap: "md", align: "center" },
  }),
  Grid: define({
    category: "layout",
    description: "Responsive grid of equal columns. Columns collapse on small screens.",
    props: z.object({
      columns: z.number().int().min(1).max(6).optional(),
      gap,
    }),
    acceptsChildren: true,
    example: { columns: 3, gap: "md" },
  }),
  Card: define({
    category: "layout",
    description:
      "Bordered surface for grouped content. Default and elevated cards provide their own surface; outline and ghost cards inherit their parent contrast. Give it a title when the group needs a label; put the body in children.",
    props: z.object({
      title: optionalText,
      description: optionalText,
      variant: z.enum(["default", "outline", "elevated", "ghost"]).optional(),
      padding: z.enum(["none", "sm", "md", "lg"]).optional(),
    }),
    acceptsChildren: true,
    example: { title: "Overview", variant: "default" },
  }),
  Divider: define({
    category: "layout",
    description: "Thin horizontal rule.",
    props: z.object({ label: optionalText }),
    acceptsChildren: false,
    example: {},
  }),
  Spacer: define({
    category: "layout",
    description: "Empty vertical space.",
    props: z.object({ size }),
    acceptsChildren: false,
    example: { size: "md" },
  }),
  Tabs: define({
    category: "layout",
    description:
      "Tabbed panels with built-in control and panel spacing. Each child is one panel, in the same order as the tabs array. Give the tabs and children the same length, and use a Stack or Card for panel content rather than a full Section.",
    props: z.object({
      tabs: z.array(z.object({ label: z.string(), value: z.string() })),
      defaultValue: optionalText,
    }),
    acceptsChildren: true,
    example: {
      tabs: [
        { label: "Overview", value: "overview" },
        { label: "Activity", value: "activity" },
      ],
      defaultValue: "overview",
    },
  }),
  AppShell: define({
    category: "layout",
    description:
      "Application layout with a sidebar of navigation and a main area for children. Use for dashboards and tools instead of Navbar.",
    props: z.object({
      brand: z.string(),
      nav: z.array(
        z.object({
          label: z.string(),
          href: z.string(),
          icon: optionalIcon,
          active: z.boolean().optional(),
        }),
      ),
      user: z.object({ name: z.string(), email: optionalText }).optional(),
      title: optionalText,
    }),
    acceptsChildren: true,
    example: {
      brand: "Ledger",
      nav: [
        { label: "Overview", href: "/", icon: "home", active: true },
        { label: "Customers", href: "/customers", icon: "users" },
      ],
      user: { name: "Ada Lovelace", email: "ada@example.com" },
      title: "Overview",
    },
  }),
  Navbar: define({
    category: "navigation",
    description: "Top navigation bar with brand, links and an optional call to action.",
    props: z.object({
      brand: z.string(),
      links: z.array(link),
      cta: optionalLink,
      sticky: z.boolean().optional(),
    }),
    acceptsChildren: false,
    example: {
      brand: "Acme",
      links: [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "/pricing" },
      ],
      cta: { label: "Get started", href: "/signup" },
    },
  }),
  Footer: define({
    category: "navigation",
    description:
      "Compact responsive page footer with brand, optional link columns and a copyright line. It inherits the surrounding surface, so avoid adding dramatic outer spacing.",
    props: z.object({
      brand: z.string(),
      tagline: optionalText,
      columns: z.array(z.object({ title: z.string(), links: z.array(link) })).optional(),
      copyright: optionalText,
    }),
    acceptsChildren: false,
    example: {
      brand: "Acme",
      tagline: "Tools for small teams.",
      columns: [
        {
          title: "Product",
          links: [
            { label: "Features", href: "#features" },
            { label: "Pricing", href: "/pricing" },
          ],
        },
      ],
      copyright: "© 2026 Acme",
    },
  }),
  Breadcrumbs: define({
    category: "navigation",
    description: "Breadcrumb trail. The last item is the current page.",
    props: z.object({ items: z.array(link) }),
    acceptsChildren: false,
    example: {
      items: [
        { label: "Home", href: "/" },
        { label: "Docs", href: "/docs" },
      ],
    },
  }),
  Hero: define({
    category: "section",
    description:
      "Opening section of a landing page: eyebrow, headline, supporting copy and up to two calls to action. Split layout places an image beside the copy.",
    props: z.object({
      eyebrow: optionalText,
      headline: z.string(),
      description: optionalText,
      primaryCta: optionalLink,
      secondaryCta: optionalLink,
      layout: z.enum(["centered", "left", "split"]).optional(),
      image: optionalImage,
      background: z.enum(["default", "muted", "gradient", "inverted"]).optional(),
    }),
    acceptsChildren: false,
    example: {
      eyebrow: "New",
      headline: "Ship the thing you keep talking about",
      description: "A short, honest sentence about what this is and who it is for.",
      primaryCta: { label: "Start free", href: "/signup" },
      secondaryCta: { label: "See how it works", href: "#features" },
      layout: "centered",
    },
  }),
  FeatureGrid: define({
    category: "section",
    description: "Grid of features, each with an icon, title and description.",
    props: z.object({
      eyebrow: optionalText,
      headline: optionalText,
      description: optionalText,
      items: z.array(
        z.object({
          icon: optionalIcon,
          title: z.string(),
          description: z.string(),
        }),
      ),
      columns: z.number().int().min(2).max(4).optional(),
      variant: z.enum(["cards", "plain"]).optional(),
    }),
    acceptsChildren: false,
    example: {
      headline: "Everything in one place",
      items: [
        { icon: "zap", title: "Fast", description: "Loads in under a second." },
        {
          icon: "shield",
          title: "Safe",
          description: "Your data stays yours.",
        },
        {
          icon: "users",
          title: "Shared",
          description: "Built for whole teams.",
        },
      ],
      columns: 3,
      variant: "cards",
    },
  }),
  Stats: define({
    category: "section",
    description: "Row of headline numbers. Only use figures the brief actually gives.",
    props: z.object({
      headline: optionalText,
      items: z.array(z.object({ value: z.string(), label: z.string() })),
    }),
    acceptsChildren: false,
    example: {
      items: [
        { value: "12k", label: "Teams" },
        { value: "99.9%", label: "Uptime" },
      ],
    },
  }),
  LogoCloud: define({
    category: "section",
    description: "Row of customer or partner names. Renders names as wordmarks.",
    props: z.object({ title: optionalText, logos: z.array(z.string()) }),
    acceptsChildren: false,
    example: { title: "Trusted by", logos: ["Northwind", "Contoso", "Globex"] },
  }),
  Testimonials: define({
    category: "section",
    description: "Customer quotes with author and role.",
    props: z.object({
      headline: optionalText,
      items: z.array(z.object({ quote: z.string(), author: z.string(), role: optionalText })),
      layout: z.enum(["grid", "single"]).optional(),
    }),
    acceptsChildren: false,
    example: {
      headline: "What people say",
      items: [
        {
          quote: "Saved us a day a week.",
          author: "Jo Park",
          role: "Ops lead, Northwind",
        },
      ],
      layout: "grid",
    },
  }),
  Pricing: define({
    category: "section",
    description: "Pricing tiers side by side. Mark one tier as featured.",
    props: z.object({
      headline: optionalText,
      description: optionalText,
      tiers: z.array(
        z.object({
          name: z.string(),
          price: z.string(),
          period: optionalText,
          description: optionalText,
          features: z.array(z.string()),
          cta: link,
          featured: z.boolean().optional(),
        }),
      ),
    }),
    acceptsChildren: false,
    example: {
      headline: "Simple pricing",
      tiers: [
        {
          name: "Starter",
          price: "£0",
          period: "/month",
          features: ["1 project", "Community support"],
          cta: { label: "Start free", href: "/signup" },
        },
        {
          name: "Team",
          price: "£19",
          period: "/month",
          features: ["Unlimited projects", "Priority support"],
          cta: { label: "Start trial", href: "/signup?plan=team" },
          featured: true,
        },
      ],
    },
  }),
  FAQ: define({
    category: "section",
    description: "Expandable questions and answers.",
    props: z.object({
      headline: optionalText,
      items: z.array(z.object({ question: z.string(), answer: z.string() })),
    }),
    acceptsChildren: false,
    example: {
      headline: "Questions",
      items: [{ question: "Is there a free plan?", answer: "Yes, for one project." }],
    },
  }),
  CTA: define({
    category: "section",
    description: "Closing call to action band.",
    props: z.object({
      headline: z.string(),
      description: optionalText,
      primaryCta: link,
      secondaryCta: optionalLink,
      variant: z.enum(["default", "primary", "muted"]).optional(),
    }),
    acceptsChildren: false,
    example: {
      headline: "Ready when you are",
      primaryCta: { label: "Create an account", href: "/signup" },
      variant: "primary",
    },
  }),
  Steps: define({
    category: "section",
    description: "Numbered process steps.",
    props: z.object({
      headline: optionalText,
      items: z.array(z.object({ title: z.string(), description: z.string() })),
      direction: z.enum(["horizontal", "vertical"]).optional(),
    }),
    acceptsChildren: false,
    example: {
      headline: "How it works",
      items: [
        { title: "Connect", description: "Link your tools." },
        { title: "Describe", description: "Say what you want." },
        { title: "Ship", description: "Review and publish." },
      ],
    },
  }),
  Team: define({
    category: "section",
    description: "People with name, role and an optional bio.",
    props: z.object({
      headline: optionalText,
      members: z.array(
        z.object({
          name: z.string(),
          role: z.string(),
          bio: optionalText,
          image: optionalImage,
        }),
      ),
    }),
    acceptsChildren: false,
    example: {
      headline: "The team",
      members: [{ name: "Sam Rivera", role: "Founder" }],
    },
  }),
  Gallery: define({
    category: "section",
    description:
      "Grid of images with optional captions. Omit src unless the brief gives a real URL.",
    props: z.object({
      headline: optionalText,
      items: z.array(z.object({ src: optionalText, alt: z.string(), caption: optionalText })),
      columns: z.number().int().min(2).max(4).optional(),
    }),
    acceptsChildren: false,
    example: {
      items: [{ alt: "Studio at dusk", caption: "The studio" }],
      columns: 3,
    },
  }),
  Newsletter: define({
    category: "section",
    description: "Email capture band.",
    props: z.object({
      headline: z.string(),
      description: optionalText,
      placeholder: optionalText,
      buttonLabel: optionalText,
    }),
    acceptsChildren: false,
    example: { headline: "Get the monthly letter", buttonLabel: "Subscribe" },
  }),
  Articles: define({
    category: "section",
    description: "List of posts or articles with title, excerpt, date and author.",
    props: z.object({
      headline: optionalText,
      items: z.array(
        z.object({
          title: z.string(),
          excerpt: optionalText,
          date: optionalText,
          author: optionalText,
          href: optionalText,
          tag: optionalText,
        }),
      ),
      layout: z.enum(["grid", "list"]).optional(),
    }),
    acceptsChildren: false,
    example: {
      headline: "Writing",
      items: [
        {
          title: "Why we rewrote the importer",
          excerpt: "It was slow.",
          date: "2026-03-01",
        },
      ],
    },
  }),
  Heading: define({
    category: "content",
    description: "Heading text. Level sets the HTML element; size is independent.",
    props: z.object({
      text: z.string(),
      level: z.number().int().min(1).max(4).optional(),
      size: z.enum(["sm", "md", "lg", "xl", "display"]).optional(),
      align,
    }),
    acceptsChildren: false,
    example: { text: "Overview", level: 2, size: "lg" },
  }),
  Text: define({
    category: "content",
    description:
      "Paragraph text. Default inherits a readable colour from its surface; muted reduces emphasis; primary uses the brand accent.",
    props: z.object({
      text: z.string(),
      size: z.enum(["xs", "sm", "md", "lg"]).optional(),
      tone: z.enum(["default", "muted", "primary"]).optional(),
      weight: z.enum(["normal", "medium", "semibold"]).optional(),
      align,
    }),
    acceptsChildren: false,
    example: { text: "A short explanation.", tone: "muted" },
  }),
  Badge: define({
    category: "content",
    description: "Small status label.",
    props: z.object({
      text: z.string(),
      variant: z
        .enum(["default", "secondary", "outline", "success", "warning", "danger"])
        .optional(),
    }),
    acceptsChildren: false,
    example: { text: "Beta", variant: "secondary" },
  }),
  Button: define({
    category: "content",
    description: "Button or link styled as a button.",
    props: z.object({
      label: z.string(),
      href: optionalText,
      variant: z
        .enum(["primary", "secondary", "outline", "ghost", "link", "destructive"])
        .optional(),
      size,
      icon: optionalIcon,
      fullWidth: z.boolean().optional(),
    }),
    acceptsChildren: false,
    example: { label: "Save changes", variant: "primary" },
  }),
  Link: define({
    category: "content",
    description: "Inline text link.",
    props: z.object({
      label: z.string(),
      href: z.string(),
      icon: optionalIcon,
    }),
    acceptsChildren: false,
    example: { label: "Read the docs", href: "/docs", icon: "arrow-right" },
  }),
  Image: define({
    category: "content",
    description:
      "Image with a chosen aspect ratio. Use auto when it should fill the available height in a stretched Grid or Card. Omit src unless the brief gives a real URL; a labelled placeholder renders instead.",
    props: z.object({
      src: optionalText,
      alt: z.string(),
      aspect: z.enum(["square", "video", "portrait", "wide", "auto"]).optional(),
      rounded: z.boolean().optional(),
    }),
    acceptsChildren: false,
    example: { alt: "Dashboard screenshot", aspect: "video", rounded: true },
  }),
  Icon: define({
    category: "content",
    description: "Standalone icon from the icon list.",
    props: z.object({
      name: icon,
      size,
      tone: z.enum(["default", "muted", "primary"]).optional(),
    }),
    acceptsChildren: false,
    example: { name: "sparkles", size: "md", tone: "primary" },
  }),
  Avatar: define({
    category: "content",
    description: "Circular avatar showing initials when no image is given.",
    props: z.object({ name: z.string(), src: optionalText, size }),
    acceptsChildren: false,
    example: { name: "Ada Lovelace", size: "md" },
  }),
  List: define({
    category: "content",
    description: "Bulleted, numbered or check list of short items.",
    props: z.object({
      items: z.array(z.string()),
      style: z.enum(["bullet", "number", "check"]).optional(),
    }),
    acceptsChildren: false,
    example: {
      items: ["Unlimited projects", "Priority support"],
      style: "check",
    },
  }),
  Quote: define({
    category: "content",
    description: "Single pull quote with attribution.",
    props: z.object({
      text: z.string(),
      author: optionalText,
      role: optionalText,
    }),
    acceptsChildren: false,
    example: { text: "It just works.", author: "Jo Park", role: "Northwind" },
  }),
  Code: define({
    category: "content",
    description: "Preformatted code block.",
    props: z.object({
      code: z.string(),
      language: optionalText,
      title: optionalText,
    }),
    acceptsChildren: false,
    example: { code: "npm install acme", language: "bash" },
  }),
  Alert: define({
    category: "content",
    description: "Callout with a title and message.",
    props: z.object({
      title: z.string(),
      description: optionalText,
      variant: z.enum(["info", "success", "warning", "danger"]).optional(),
    }),
    acceptsChildren: false,
    example: {
      title: "Heads up",
      description: "Exports run nightly.",
      variant: "info",
    },
  }),
  Metric: define({
    category: "data",
    description: "Single KPI with an optional change indicator.",
    props: z.object({
      label: z.string(),
      value: z.string(),
      change: optionalText,
      trend: z.enum(["up", "down", "flat"]).optional(),
      icon: optionalIcon,
    }),
    acceptsChildren: false,
    example: {
      label: "Revenue",
      value: "£48,200",
      change: "+12%",
      trend: "up",
    },
  }),
  Progress: define({
    category: "data",
    description: "Progress bar from 0 to 100.",
    props: z.object({
      value: z.number().min(0).max(100),
      label: optionalText,
      showValue: z.boolean().optional(),
    }),
    acceptsChildren: false,
    example: { value: 64, label: "Storage used", showValue: true },
  }),
  Chart: define({
    category: "data",
    description:
      "Simple bar, line, area or donut chart from label/value pairs. Values are numbers.",
    props: z.object({
      type: z.enum(["bar", "line", "area", "donut"]),
      title: optionalText,
      data: z.array(z.object({ label: z.string(), value: z.number() })),
      height: z.enum(["sm", "md", "lg"]).optional(),
    }),
    acceptsChildren: false,
    example: {
      type: "bar",
      title: "Signups by month",
      data: [
        { label: "Jan", value: 120 },
        { label: "Feb", value: 180 },
        { label: "Mar", value: 240 },
      ],
    },
  }),
  Table: define({
    category: "data",
    description:
      "Data table. Columns define keys; each row is an object keyed by those column keys with string values.",
    props: z.object({
      caption: optionalText,
      columns: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          align: z.enum(["start", "end"]).optional(),
        }),
      ),
      rows: z.array(z.record(z.string(), z.string())),
      striped: z.boolean().optional(),
    }),
    acceptsChildren: false,
    example: {
      columns: [
        { key: "name", label: "Name" },
        { key: "status", label: "Status" },
        { key: "amount", label: "Amount", align: "end" },
      ],
      rows: [{ name: "Invoice 1042", status: "Paid", amount: "£320.00" }],
    },
  }),
  KeyValue: define({
    category: "data",
    description: "Two-column list of labels and values.",
    props: z.object({
      items: z.array(z.object({ label: z.string(), value: z.string() })),
    }),
    acceptsChildren: false,
    example: { items: [{ label: "Plan", value: "Team" }] },
  }),
  EmptyState: define({
    category: "data",
    description: "Placeholder for a list with nothing in it.",
    props: z.object({
      title: z.string(),
      description: optionalText,
      action: optionalLink,
      icon: optionalIcon,
    }),
    acceptsChildren: false,
    example: {
      title: "No invoices yet",
      action: { label: "Create invoice", href: "/invoices/new" },
    },
  }),
  Form: define({
    category: "form",
    description:
      "Form with labelled fields and a submit button. Field types: text, email, password, number, textarea, select, checkbox. Select fields need options.",
    props: z.object({
      title: optionalText,
      description: optionalText,
      fields: z.array(
        z.object({
          name: z.string(),
          label: z.string(),
          type: z.enum(["text", "email", "password", "number", "textarea", "select", "checkbox"]),
          placeholder: optionalText,
          required: z.boolean().optional(),
          options: z.array(z.string()).optional(),
        }),
      ),
      submitLabel: z.string(),
      layout: z.enum(["stacked", "inline"]).optional(),
    }),
    acceptsChildren: false,
    example: {
      title: "Contact us",
      fields: [
        { name: "email", label: "Email", type: "email", required: true },
        { name: "message", label: "Message", type: "textarea" },
      ],
      submitLabel: "Send",
    },
  }),
  Input: define({
    category: "form",
    description: "Single labelled input outside a Form, for toolbars and filters.",
    props: z.object({
      label: optionalText,
      placeholder: optionalText,
      type: z.enum(["text", "email", "search", "number"]).optional(),
      icon: optionalIcon,
    }),
    acceptsChildren: false,
    example: {
      placeholder: "Search customers",
      type: "search",
      icon: "search",
    },
  }),
  Select: define({
    category: "form",
    description: "Single labelled select outside a Form.",
    props: z.object({
      label: optionalText,
      options: z.array(z.string()),
      value: optionalText,
    }),
    acceptsChildren: false,
    example: {
      label: "Status",
      options: ["All", "Paid", "Overdue"],
      value: "All",
    },
  }),
  Switch: define({
    category: "form",
    description: "Labelled on/off toggle.",
    props: z.object({
      label: z.string(),
      description: optionalText,
      checked: z.boolean().optional(),
    }),
    acceptsChildren: false,
    example: { label: "Email notifications", checked: true },
  }),
} as const satisfies Record<string, SiteComponentDefinition>;

export type SiteCatalog = typeof SITE_CATALOG;
export type SiteComponentType = keyof SiteCatalog;
export type SiteComponentProps<T extends SiteComponentType> = z.infer<SiteCatalog[T]["props"]>;

export const SITE_COMPONENT_TYPES = Object.keys(SITE_CATALOG) as SiteComponentType[];

export function isSiteComponentType(type: string): type is SiteComponentType {
  return Object.hasOwn(SITE_CATALOG, type);
}

export function getSiteComponentDefinition(type: string): SiteComponentDefinition | null {
  return isSiteComponentType(type) ? SITE_CATALOG[type] : null;
}
