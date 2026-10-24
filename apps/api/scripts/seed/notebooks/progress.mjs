import { seedFile } from "../sources.mjs";
import { seedId } from "../sql.mjs";
import { timeline } from "./media.mjs";

const VIDEO_ID = seedId("output", "progress", "video");

const VIDEO_SCENES = [
  {
    title: "Why progress feels slow",
    caption: "",
    visual: "A winding road through layered paper hills towards a small village at dusk.",
    narration:
      "Most of us live in a world far richer than our grandparents did, yet it often feels as if progress has stalled. These sources ask why.",
  },
  {
    title: "The productivity puzzle",
    caption: "2.8% a year, then 1.5%",
    visual: "Paper bars climbing steeply, then levelling off, with a golden gear above.",
    narration:
      "In the United States, labour productivity grew by about two point eight per cent a year from 1948 to 1973, and by about one and a half per cent from 2007 to 2019. Small differences compound into very different futures.",
  },
  {
    title: "Building got harder",
    caption: "",
    visual: "Half-finished paper tower blocks beside a tall crane, one outline still empty.",
    narration:
      "One argument is that we stopped building. Homes, power lines and transit now take longer and cost more to approve, so good ideas wait years for permission.",
  },
  {
    title: "Work left the office",
    caption: "About 1 in 4 paid days at home",
    visual: "A tidy desk at home with a laptop, a mug and a plant beneath a sunny window.",
    narration:
      "Remote work is the clearest break with the past. Surveys suggest roughly a quarter of paid working days in America are now worked from home, far above the level before 2020.",
  },
  {
    title: "Together, apart",
    caption: "",
    visual:
      "Three people on separate benches, each looking at a glowing phone, joined only by dotted lines.",
    narration:
      "Meanwhile, time spent with friends has been falling for years, and public health officials now treat loneliness as a health risk. Technology connects us, but it doesn't always bring us together.",
  },
  {
    title: "What to watch next",
    caption: "",
    visual: "A long paper bridge over calm water with the sun rising behind it.",
    narration:
      "So the questions for the next decade are practical ones. Can we build faster, train new workers well when teams are remote, and design tools that bring people back into the room?",
  },
];

const VIDEO_DURATIONS = [7.9, 16.39, 9.44, 10.65, 11.51, 10.5];

export const PROGRESS_NOTEBOOK = {
  key: "progress",
  title: "Progress, Work and Loneliness",
  created: { days: 25 },
  instructions:
    "Explain economic and social trends clearly for a general reader. Separate what the evidence shows from what is argued, give figures with their year and source, and say plainly when the evidence is mixed.",
  settings: {
    style: "learning_guide",
    persona: "",
    responseLength: "default",
    sourcesOnly: true,
  },
  guide: {
    generated: { days: 3 },
    summary:
      "These sources examine why progress can feel slow despite rising living standards. They trace the long slowdown in **productivity growth**, the argument that rich countries have made **building** harder, the lasting shift to **remote work** and what it means for early-career learning, and evidence on **loneliness** as time with friends declines. A final thread weighs early, mixed evidence on how **AI** is affecting entry-level jobs.",
    questions: [
      "What does the evidence say about remote work and how junior staff learn?",
      "Why did productivity growth slow after the 1970s?",
      "Is AI already reducing entry-level hiring?",
    ],
  },
  sources: [
    {
      key: "productivity",
      kind: "text",
      title: "Why productivity growth stalled",
      created: { days: 25 },
      content: `# Why productivity growth stalled

Labour productivity, the output produced per hour worked, is the main driver of rising living standards over the long run.

In the United States, productivity in the non-farm business sector grew at roughly **2.8 per cent a year between 1948 and 1973**. Growth then slowed sharply. Apart from a burst in the late 1990s and early 2000s linked to information technology, it has mostly run well below the post-war pace, averaging around **1.5 per cent a year between 2007 and 2019**.

The gap sounds small but compounds. At 2.8 per cent, output per hour doubles in about 25 years. At 1.5 per cent, it takes nearly 47.

## Competing explanations

- **Measurement.** Some argue official statistics miss the value of free digital services. Most studies find this explains only a small part of the slowdown.
- **Fewer big ideas.** Others argue that the inventions of the early twentieth century, such as electricity and the internal combustion engine, were unusually transformative and hard to repeat.
- **Less dynamism.** Business start-up rates have fallen and established firms hold a larger share of activity, which may slow the spread of better practices.
- **Barriers to building.** A growing school of thought blames rules that make it slow and costly to build homes, infrastructure and energy projects.`,
    },
    {
      key: "building",
      kind: "text",
      title: "Building more: the abundance argument",
      created: { days: 24 },
      content: `# Building more: the abundance argument

A loose coalition of economists, writers and policymakers argues that many rich countries suffer from a shortage of building. They point to high housing costs in productive cities, slow progress on clean energy transmission and the rising cost of public transport projects.

The argument has three parts.

1. **Housing.** Restrictive zoning and lengthy approval processes limit new homes where jobs are, pushing up rents and preventing people from moving to higher-wage areas.
2. **Infrastructure.** Environmental reviews intended to protect communities can take years. A 2020 review by the US Council on Environmental Quality found that full environmental impact statements took an average of about four and a half years to complete.
3. **Energy.** Building new power lines often requires approval from many jurisdictions, which slows the connection of new wind and solar projects to the grid.

Critics respond that reviews protect against real harms, that faster building can displace existing residents, and that construction costs also reflect labour shortages and materials prices. Most agree, however, that the time taken to approve projects has become a policy question in its own right.`,
    },
    {
      key: "remote-work",
      kind: "text",
      title: "Remote work, five years on",
      created: { days: 22 },
      content: `# Remote work, five years on

Before 2020, working from home was rare. Surveys of American workers suggest that roughly one in twenty paid working days was done from home.

During the pandemic that share jumped to more than half. It then fell back, but not to where it started. Since 2023, survey data from a long-running study of US workers has put the share of paid days worked from home at **around a quarter**, a level that has been fairly stable for several years.

## Who works from home

Remote and hybrid work is concentrated among higher-paid, university-educated workers in office jobs. Most workers in retail, hospitality, health care and manufacturing still work on site.

## What the evidence says about productivity

The evidence is mixed. Studies of fully remote call-centre and data-entry work have found productivity gains from fewer breaks and quieter environments. Other studies, particularly of collaborative and creative work, find that remote teams communicate less across groups and may innovate less. Hybrid arrangements, where staff are in the office two or three days a week, have generally shown little effect on productivity while improving retention.`,
    },
    {
      key: "loneliness",
      kind: "text",
      title: "The loneliness question",
      created: { days: 20 },
      content: `# The loneliness question

In 2023 the US Surgeon General issued an advisory describing loneliness and social isolation as a public health concern. The advisory linked a lack of social connection with higher risks of heart disease, stroke, dementia, depression and early death.

One striking figure in the advisory came from the American Time Use Survey: the time Americans spent with friends in person fell from about **60 minutes a day in 2003 to about 20 minutes a day in 2020**. The decline was steepest among young people.

## Is technology to blame?

Opinions differ. Some researchers argue that smartphones and social media have displaced face-to-face time, especially for teenagers. Others caution that the decline began before smartphones were widespread, and that long working hours, falling membership of clubs and religious groups, and more time spent at home also play a part.

What is clearer is that the trend is broad. It shows up across ages, incomes and regions, which suggests the causes are structural rather than individual.`,
    },
    {
      key: "ai-entry-level",
      kind: "text",
      title: "AI and the future of entry-level jobs",
      created: { days: 18 },
      content: `# AI and the future of entry-level jobs

Generative AI tools can now draft emails, summarise documents and write simple code. A natural question is whether they will replace the junior roles where people traditionally learn their trade.

## Early evidence

The evidence so far is limited and mixed.

- Several controlled studies have found that AI assistants raise the output of less experienced workers the most, for example in customer support and some writing tasks. This suggests AI could narrow skill gaps.
- A 2025 working paper using payroll data reported that employment of workers aged 22 to 25 in the occupations most exposed to AI had fallen relative to less exposed occupations since late 2022, while employment of older workers in the same jobs was steady.
- Other researchers note that the labour market for young graduates had already softened for reasons unrelated to AI, such as higher interest rates and a slowdown in technology hiring.

## Open questions

If AI absorbs routine tasks, firms may need to redesign junior roles so that new staff still build judgement. The risk is not only fewer jobs but fewer good places to learn.`,
    },
    {
      key: "deep-research",
      kind: "text",
      title: "Deep research: remote work and early-career learning",
      created: { days: 6 },
      metadata: {
        research: { query: "Does remote work hurt early-career learning?", depth: "deep" },
      },
      content: `# Deep research: does remote work hurt early-career learning?

## Summary

The best available evidence suggests that **working near colleagues helps junior staff learn faster**, but at a cost to the productivity of the senior staff who teach them. The effect is strongest in roles that depend on informal feedback.

## Key findings

1. **Proximity increases feedback.** A study of software engineers at a large US firm found that engineers who sat on the same floor as their teammates received substantially more written feedback on their code than those whose teammates were in another building. The effect was largest for junior engineers.
2. **Mentoring has a cost.** The same study found that senior engineers who sat near juniors produced less code themselves, reflecting time spent helping others.
3. **Promotions and quits.** Some surveys suggest that fully remote junior staff feel less visible to managers, though evidence on promotion rates is still limited.
4. **Hybrid as a compromise.** Firms increasingly schedule shared in-office days so that teams overlap, aiming to keep informal learning without losing flexibility.

## Gaps in the evidence

Most studies come from a small number of large technology firms. There is little rigorous evidence for smaller organisations or non-technical roles.`,
    },
  ],
  notes: [
    {
      key: "questions-for-team",
      title: "Questions for the team offsite",
      created: { days: 4 },
      content:
        "- Should juniors have fixed in-office days with their mentors?\n- How do we measure feedback, not just output?\n- Pilot one anchor day a week for a quarter and compare.",
    },
  ],
  outputs: [
    {
      key: "video",
      kind: "video",
      title: "Progress in six scenes",
      created: { days: 2, hours: 2 },
      file: seedFile(
        "progress-video-narration.mp3",
        "audio/mpeg",
        `outputs/${VIDEO_ID}/narration.mp3`,
      ),
      sceneFiles: VIDEO_SCENES.map((_scene, index) =>
        seedFile(`progress-scene-${index}.png`, "image/png", `outputs/${VIDEO_ID}/scenes/${index}`),
      ),
      content: {
        format: "video_overview",
        style: "papercraft",
        scenes: VIDEO_SCENES.map((scene) => ({ ...scene, image: true })),
        timings: timeline(VIDEO_DURATIONS),
      },
    },
    {
      key: "deck",
      kind: "deck",
      title: "Briefing: the state of progress",
      created: { days: 2, hours: 1 },
      content: {
        format: "slides",
        slides: [
          {
            layout: "title",
            title: "The state of progress",
            subtitle: "Productivity, building, work and connection",
            bullets: [],
          },
          {
            layout: "content",
            title: "Productivity growth has roughly halved",
            bullets: [
              "About 2.8% a year in 1948–1973",
              "About 1.5% a year in 2007–2019",
              "Output per hour now takes nearly twice as long to double",
            ],
            notes: "Lead with the compounding point: small gaps become big ones.",
          },
          {
            layout: "two_column",
            title: "Building: the case and the critics",
            bullets: [],
            columns: [
              "**For faster building**\n\n- Housing shortages in productive cities\n- Reviews averaging about 4.5 years\n- Slow grid connections for clean energy",
              "**Cautions**\n\n- Reviews protect against real harms\n- Displacement risks\n- Labour and materials costs matter too",
            ],
          },
          {
            layout: "content",
            title: "Remote work settled at about a quarter of paid days",
            bullets: [
              "Up from roughly 1 in 20 before 2020",
              "Concentrated in higher-paid office jobs",
              "Hybrid shows little productivity effect but better retention",
            ],
          },
          {
            layout: "quote",
            title:
              "Time with friends fell from about 60 to about 20 minutes a day between 2003 and 2020.",
            subtitle: "American Time Use Survey, cited in the 2023 Surgeon General advisory",
            bullets: [],
          },
          {
            layout: "content",
            title: "What to watch",
            bullets: [
              "Approval times for homes and power lines",
              "How firms redesign junior roles around AI",
              "Whether shared office days restore informal learning",
            ],
          },
        ],
      },
    },
    {
      key: "sheet",
      kind: "sheet",
      title: "Key figures",
      created: { days: 2 },
      content: {
        format: "tables",
        tables: [
          {
            name: "Trends",
            columns: [
              { key: "measure", label: "Measure", type: "text" },
              { key: "before", label: "Before", type: "text" },
              { key: "after", label: "After", type: "text" },
              { key: "source", label: "Source", type: "text" },
            ],
            rows: [
              {
                measure: "US labour productivity growth",
                before: "2.8% a year (1948–1973)",
                after: "1.5% a year (2007–2019)",
                source: "Why productivity growth stalled",
              },
              {
                measure: "Paid days worked from home",
                before: "About 1 in 20 (pre-2020)",
                after: "About 1 in 4 (2023 onwards)",
                source: "Remote work, five years on",
              },
              {
                measure: "Time with friends in person",
                before: "About 60 min a day (2003)",
                after: "About 20 min a day (2020)",
                source: "The loneliness question",
              },
              {
                measure: "Environmental impact statement",
                before: "",
                after: "About 4.5 years on average",
                source: "Building more: the abundance argument",
              },
            ],
          },
        ],
      },
    },
  ],
  chats: [
    {
      key: "remote-learning",
      title: "Remote work and junior staff",
      created: { days: 5 },
      messages: [
        {
          role: "user",
          content: "What does the evidence say about remote work and how junior staff learn?",
        },
        {
          role: "assistant",
          content:
            "The short version: sitting near colleagues seems to help junior staff learn, but it costs the seniors who help them.\n\n- **Feedback rises with proximity.** Engineers who sat on the same floor as their teammates received substantially more feedback on their code, and juniors benefited most {{cite:deep-research}}.\n- **Mentoring isn't free.** Senior engineers near juniors produced less code themselves {{cite:deep-research}}.\n- **Productivity overall is mixed.** Fully remote routine work can be more productive, while collaborative work tends to suffer, and hybrid shows little effect either way {{cite:remote-work}}.\n\nA caveat worth keeping: most of this comes from a few large technology firms, so it may not carry over to smaller teams or non-technical roles {{cite:deep-research}}.",
        },
        {
          role: "user",
          content: "Does AI change that picture for entry-level roles?",
        },
        {
          role: "assistant",
          content:
            "Possibly, but the evidence is early. Controlled studies find AI assistants help less experienced workers most, which could narrow skill gaps. On the other hand, a 2025 payroll study found employment of 22 to 25 year olds fell in the most AI-exposed occupations, while older workers in the same jobs were steady {{cite:ai-entry-level}}.\n\nPut together with the proximity findings, the risk the sources highlight is fewer good places to learn, not only fewer jobs {{cite:ai-entry-level}}.",
        },
      ],
    },
  ],
};
