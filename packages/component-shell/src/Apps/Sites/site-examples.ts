export interface SitePromptExample {
  title: string;
  prompt: string;
}

export const SITE_PROMPT_EXAMPLES: readonly SitePromptExample[] = [
  {
    title: "Wedding bakery",
    prompt:
      "Create a warm, editorial one-page website for Flour & Fold, an independent Leeds bakery specialising in bespoke wedding cakes. The audience is engaged couples who value craft and personal service. Include a confident hero with a consultation call to action, a gallery of cake styles, a simple four-step process, transparent starting prices, testimonials, FAQs and an enquiry form. Use specific, believable copy rather than filler. The visual direction should feel refined but welcoming, with cream, dark chocolate and raspberry tones, expressive serif headings, generous photography and excellent mobile accessibility.",
  },
  {
    title: "SaaS launch",
    prompt:
      "Design a polished three-page marketing site for Relay, a project handoff tool for small creative agencies. Build Home, Product and Pricing pages for operations leads frustrated by scattered files and unclear ownership. Explain the workflow through concrete product examples, show integrations and security details, and finish each page with a useful call to action. Pricing should have three clearly differentiated tiers with a monthly and annual comparison. Use deep navy, warm white and a sharp lime accent, with crisp typography and lightweight product-interface visuals. Avoid invented customer logos or unsupported performance claims.",
  },
  {
    title: "Coffee dashboard",
    prompt:
      "Build a responsive operations dashboard for Northstar Coffee, a subscription coffee business. Use a persistent sidebar and a compact date-range filter. The overview should show monthly recurring revenue, active subscribers, churn, average order value and fulfilment risk; include a revenue trend chart, subscription-plan mix, retention view, recent orders table and a short list of accounts needing attention. Use realistic sample data with clear units and comparison periods. Keep the interface information-dense but calm, using warm neutrals, coffee-brown accents, strong hierarchy and accessible chart colours. Optimise the mobile layout rather than simply shrinking the desktop view.",
  },
  {
    title: "Photo portfolio",
    prompt:
      "Create an understated portfolio for Mara Vale, a documentary photographer working across culture, place and community. Include Home, Work, About and Contact pages. The home page should lead with one strong image and a concise introduction; Work should organise projects into editorial case-study cards; each project needs a narrative, image sequence and credits; About should balance biography, selected clients and availability. Use image placeholders with useful art direction, not generic decoration. Choose a monochrome editorial system with one muted red accent, large typography, careful whitespace and subtle transitions. Make keyboard navigation and image descriptions first-class concerns.",
  },
  {
    title: "Climate campaign",
    prompt:
      "Create a campaign website for Common Ground, a local charity helping neighbourhoods replace paved front gardens with climate-resilient planting. The site should explain the problem without alarmism, show how the programme works, present two resident stories, outline where donations go and offer clear routes to volunteer, request a garden visit or donate. Include Home, Our work and Get involved pages, plus a compact transparency section. Do not invent impact statistics; use clearly labelled placeholders where verified figures are needed. Use an optimistic, practical visual language inspired by field guides, with moss green, clay and paper tones, friendly illustrations and highly accessible calls to action.",
  },
  {
    title: "Design conference",
    prompt:
      "Build an energetic event site for Signal/Noise, a two-day independent design conference in Manchester. The primary goals are to explain the programme and sell tickets. Include a bold landing page, speaker lineup, filterable schedule split across two stages, ticket options, venue and travel information, accessibility details, sponsor section and FAQs. Write concise copy aimed at senior designers and creative technologists, and make dates, times and ticket availability impossible to miss. Use an experimental editorial grid, black and warm white foundations, vivid orange and cyan accents, oversized type and purposeful motion that respects reduced-motion settings.",
  },
  {
    title: "Developer docs",
    prompt:
      "Create a documentation site for Orbit, a fictional TypeScript SDK for scheduling background jobs. Design a useful quick-start experience for developers evaluating the SDK. Include an overview, installation, authentication, first job tutorial, retries and idempotency guide, API reference, common errors and a migration note. Use a left navigation tree, in-page table of contents, copyable code examples, clear callouts and previous/next navigation. Keep technical wording precise and examples internally consistent. The visual style should be compact and professional with excellent code contrast, restrained blue accents, clear focus states and a strong mobile navigation pattern.",
  },
  {
    title: "Seasonal restaurant",
    prompt:
      "Design a characterful website for Alder, a small seasonal restaurant in Bristol serving a concise changing menu. The site should help visitors understand the food, reserve a table and plan their visit. Include a confident home page, sample lunch and dinner menus, the restaurant's sourcing philosophy, private dining information, opening hours, location and accessibility details. Make reservation actions prominent without overwhelming the story. Use grounded, specific copy with no luxury clichés. The visual direction should combine forest green, oat and oxblood, tactile food photography, a contemporary serif and a relaxed editorial layout that works beautifully on mobile.",
  },
  {
    title: "Independent shop",
    prompt:
      "Build a playful online shop for Odd Hours, an independent studio selling limited-run desk objects. Create a working product discovery journey with categories, search, filters, product detail, a stateful basket and checkout form. Use believable products, variants, stock states and prices. The visual system should feel like a colourful 1990s mail-order catalogue: bold borders, unexpected type scale, saturated primary colours and dense but legible product grids. Avoid a generic luxury storefront or empty marketing sections.",
  },
  {
    title: "Clinic booking",
    prompt:
      "Create a complete appointment-booking app for Harbour Physio. Let a patient choose a treatment, practitioner, available date and time, enter their details and reach a clear confirmation state. Include rescheduling guidance, pricing, clinic accessibility and preparation notes. Use a calm organic direction with warm white, eucalyptus and ink colours, soft spacing and direct language. The booking flow must work through state changes rather than appearing as a static mock-up.",
  },
  {
    title: "AI research tool",
    prompt:
      "Design a focused AI research workspace called Threadline for analysts comparing source material. Build an input area for a research question, source selection, useful presets, an active working state, a structured answer with citations and a searchable history. Include controls to save, rename and remove research runs using realistic stateful interactions. Use a dark futuristic direction with a precise grid, restrained cyan glow, compact information density and excellent keyboard focus. Do not use a generic chatbot layout.",
  },
  {
    title: "Language game",
    prompt:
      "Build a genuinely playable vocabulary game called Quickfire for intermediate Spanish learners. Show a short rules screen, timed multiple-choice rounds, immediate feedback, streaks, score, progress and a final result with a restart path. Seed enough question data for a convincing session and implement the game through page state. Use a joyful maximalist direction with oversized type, bold colour fields and expressive motion while respecting reduced-motion preferences.",
  },
];
