export const FILMS_NOTEBOOK = {
  key: "films",
  title: "Films of the Century So Far",
  created: { days: 40 },
  instructions:
    "Act as a film critic's research desk. When recommending films, give the year and director, explain in one line why each one matters, and group suggestions by theme rather than ranking them.",
  settings: {
    style: "default",
    persona: "",
    responseLength: "longer",
    sourcesOnly: true,
    followTopic: "Films",
  },
  guide: {
    generated: { days: 5 },
    summary:
      "These sources trace how cinema changed between 2000 and 2025. They follow the rise of the **franchise blockbuster**, the moment **international cinema** broke through with mainstream audiences, a run of intimate **independent films**, the growing ambition of **animation**, and the way **streaming** reshaped release windows. A starter **watchlist** gathers twenty titles from across these currents.",
    questions: [
      "Which films best show how international cinema broke through?",
      "How did streaming change the way films are released?",
      "What should I watch first if I like quiet character studies?",
    ],
  },
  sources: [
    {
      key: "franchise-era",
      kind: "text",
      title: "The blockbuster that ate the multiplex",
      created: { days: 40 },
      content: `# The blockbuster that ate the multiplex

If one trend defines mainstream cinema since 2000, it is the franchise. The decade opened with the first X-Men film (2000) and the first Spider-Man (2002), and closed with a shared superhero universe that turned individual films into episodes of a much larger story.

Studios learned that familiar characters reduce risk. By the late 2010s, sequels, remakes and adaptations regularly made up most of the year's top-grossing films in the United States. Avengers: Endgame (2019) became, for a time, the highest-grossing film ever released.

## What critics argued about

- **Craft versus formula.** Some directors and critics argued that franchise films had become theme-park rides, efficient but interchangeable. Others pointed to entries with real personality, such as Christopher Nolan's The Dark Knight (2008) and Ryan Coogler's Black Panther (2018).
- **Mid-budget squeeze.** As blockbuster budgets rose, studios made fewer mid-budget dramas and comedies for cinemas. Many of those stories moved to television and streaming.
- **Global audiences.** Franchises travelled well, which made international box office, especially China, a major factor in what got made.

By the mid-2020s, audiences showed signs of franchise fatigue, and several original films found large audiences again.`,
    },
    {
      key: "international",
      kind: "text",
      title: "Subtitles stopped being a barrier",
      created: { days: 38 },
      content: `# Subtitles stopped being a barrier

For most of the twentieth century, foreign-language films reached English-speaking audiences mainly through art-house cinemas. That changed in the 2010s and early 2020s.

The turning point most critics name is Bong Joon-ho's **Parasite** (2019), a South Korean thriller about two families divided by class. It won the Palme d'Or at Cannes and, in 2020, became the first film not in English to win the Academy Award for Best Picture.

## The wider wave

- Alfonso Cuarón's **Roma** (2018), a black-and-white Mexican drama, won three Oscars and reached a huge audience through streaming.
- Ryusuke Hamaguchi's **Drive My Car** (2021) was nominated for Best Picture and won Best International Feature.
- Earlier in the century, films such as Ang Lee's **Crouching Tiger, Hidden Dragon** (2000) and Guillermo del Toro's **Pan's Labyrinth** (2006) had already proved that subtitled films could be popular hits.

## Why it happened

Streaming services commissioned and promoted local-language work for global audiences, and younger viewers raised on subtitled television series were less put off by reading on screen. Festival prizes and awards campaigns did the rest.`,
    },
    {
      key: "indies",
      kind: "text",
      title: "The quiet indies",
      created: { days: 36 },
      content: `# The quiet indies

Alongside the blockbusters, a strand of small, intimate films reshaped what critics valued. Many were made for modest budgets by directors early in their careers.

- **Moonlight** (2016), directed by Barry Jenkins, follows a young man in Miami across three stages of his life. It won Best Picture in a famously confused ceremony moment when the wrong winner was first announced.
- **Lady Bird** (2017), Greta Gerwig's solo directing debut, captured a teenager's last year at home with unusual warmth.
- **Aftersun** (2022), by Charlotte Wells, uses a father and daughter's holiday to explore memory and grief, and became a critics' favourite.
- **Past Lives** (2023), Celine Song's debut, follows two childhood friends who reconnect decades later.

## What they share

These films tend to trust silence and small gestures over plot. They are often autobiographical, rely on careful performances, and leave endings open. Distributors such as A24 built a recognisable brand around this kind of filmmaking, turning modest releases into cultural events.`,
    },
    {
      key: "animation",
      kind: "text",
      title: "Animation grew up",
      created: { days: 34 },
      content: `# Animation grew up

The century opened with Hayao Miyazaki's **Spirited Away** (2001), which became Japan's highest-grossing film and won the Academy Award for Best Animated Feature, a category introduced in 2002.

Pixar dominated the 2000s with films that appealed to adults as much as children, including **WALL-E** (2008), with its nearly wordless first act, and **Up** (2009), whose opening montage about a marriage is often cited as one of the most moving sequences in modern film.

## New styles

- **Spider-Man: Into the Spider-Verse** (2018) mixed comic-book printing effects, varied frame rates and multiple art styles, and influenced a wave of more stylised animation.
- European and independent studios produced hand-drawn and stop-motion work such as **The Secret of Kells** (2009) and **Flow** (2024), a wordless Latvian film that won the Oscar for Best Animated Feature.

Critics increasingly argued that animation is a medium, not a genre, capable of any kind of story.`,
    },
    {
      key: "streaming",
      kind: "text",
      title: "Streaming and the shrinking window",
      created: { days: 32 },
      content: `# Streaming and the shrinking window

For decades, films played exclusively in cinemas for around three months before reaching home video. This "theatrical window" protected cinema ticket sales.

Streaming services began commissioning their own films in the late 2010s, and some, such as Netflix, released many of them online on the same day as, or shortly after, a limited cinema run. Festival programmers and awards bodies debated whether these counted as films at all.

The pandemic accelerated everything. In 2020 and 2021, with cinemas closed or restricted, several major studios released films directly to streaming or simultaneously in cinemas and at home. When cinemas reopened, many studios agreed much shorter exclusive windows, often around 45 days, and sometimes less for films that underperformed.

## Effects

- More films reach audiences quickly, wherever they live.
- Mid-budget films increasingly premiere on streaming rather than in cinemas.
- Cinemas lean more heavily on big events, premium formats and repertory screenings.`,
    },
    {
      key: "watchlist",
      kind: "text",
      title: "A starter watchlist",
      created: { days: 30 },
      content: `# A starter watchlist: twenty films, 2000–2025

| Year | Film | Director | Current |
|---|---|---|---|
| 2000 | In the Mood for Love | Wong Kar-wai | International |
| 2000 | Crouching Tiger, Hidden Dragon | Ang Lee | International |
| 2001 | Spirited Away | Hayao Miyazaki | Animation |
| 2001 | Mulholland Drive | David Lynch | Independent |
| 2006 | Pan's Labyrinth | Guillermo del Toro | International |
| 2007 | There Will Be Blood | Paul Thomas Anderson | Independent |
| 2008 | The Dark Knight | Christopher Nolan | Franchise |
| 2008 | WALL-E | Andrew Stanton | Animation |
| 2014 | Boyhood | Richard Linklater | Independent |
| 2015 | Mad Max: Fury Road | George Miller | Franchise |
| 2016 | Moonlight | Barry Jenkins | Independent |
| 2017 | Get Out | Jordan Peele | Independent |
| 2017 | Lady Bird | Greta Gerwig | Independent |
| 2018 | Roma | Alfonso Cuarón | Streaming |
| 2018 | Spider-Man: Into the Spider-Verse | Persichetti, Ramsey, Rothman | Animation |
| 2019 | Parasite | Bong Joon-ho | International |
| 2021 | Drive My Car | Ryusuke Hamaguchi | International |
| 2022 | Aftersun | Charlotte Wells | Independent |
| 2023 | Past Lives | Celine Song | Independent |
| 2024 | Flow | Gints Zilbalodis | Animation |`,
    },
  ],
  notes: [
    {
      key: "watched",
      title: "Already watched",
      created: { days: 9 },
      content:
        "Parasite, Spirited Away, The Dark Knight, Get Out. Next up: Aftersun, then Drive My Car.",
    },
  ],
  outputs: [
    {
      key: "report",
      kind: "report",
      title: "Five currents in 21st-century film",
      created: { days: 4 },
      content: {
        format: "markdown",
        body: `# Five currents in 21st-century film

## 1. The franchise blockbuster
Shared universes turned films into episodes. The Dark Knight (2008) and Black Panther (2018) showed the form could carry real personality, while critics worried about formula and a shrinking mid-budget middle.

## 2. International cinema goes mainstream
Parasite (2019) became the first film not in English to win Best Picture. Roma (2018) and Drive My Car (2021) confirmed the shift, helped by streaming and audiences used to subtitles.

## 3. The quiet indie
Moonlight, Lady Bird, Aftersun and Past Lives favoured small gestures, open endings and autobiographical detail.

## 4. Animation as a medium
From Spirited Away (2001) to Spider-Man: Into the Spider-Verse (2018) and Flow (2024), animation proved it could tell any kind of story in any style.

## 5. Streaming and the window
The exclusive cinema run shrank from about three months to around 45 days after the pandemic, pushing mid-budget films online and cinemas towards big events.

## Where to start
Pick one film from each current: The Dark Knight, Parasite, Aftersun, Spirited Away and Roma.`,
      },
    },
    {
      key: "mind-map",
      kind: "mind_map",
      title: "Cinema since 2000",
      created: { days: 4 },
      content: {
        format: "mind_map",
        root: {
          label: "Cinema since 2000",
          children: [
            {
              label: "Franchises",
              summary: "Shared universes dominated the box office.",
              children: [
                { label: "Superhero universes" },
                { label: "Mid-budget squeeze" },
                { label: "Franchise fatigue" },
              ],
            },
            {
              label: "International",
              summary: "Subtitled films reached mainstream audiences.",
              children: [
                { label: "Parasite", summary: "First non-English Best Picture winner (2020)." },
                { label: "Roma" },
                { label: "Drive My Car" },
              ],
            },
            {
              label: "Independent",
              children: [{ label: "Moonlight" }, { label: "Aftersun" }, { label: "Past Lives" }],
            },
            {
              label: "Animation",
              children: [
                { label: "Spirited Away" },
                { label: "Spider-Verse style" },
                { label: "Flow" },
              ],
            },
            {
              label: "Streaming",
              children: [
                { label: "Shorter windows", summary: "About 45 days after the pandemic." },
                { label: "Same-day releases" },
              ],
            },
          ],
        },
      },
    },
    {
      key: "quiz",
      kind: "quiz",
      title: "Modern cinema quiz",
      created: { days: 3 },
      content: {
        format: "quiz",
        questions: [
          {
            question: "Which film was the first not in English to win Best Picture?",
            options: ["Roma", "Parasite", "Drive My Car", "Pan's Labyrinth"],
            answerIndex: 1,
            explanation: "Parasite won Best Picture in 2020.",
          },
          {
            question: "Roughly how long did exclusive cinema windows become after the pandemic?",
            options: ["7 days", "45 days", "90 days", "6 months"],
            answerIndex: 1,
            explanation:
              "Many studios agreed windows of around 45 days, down from about three months.",
          },
          {
            question:
              "Which animated film opened the century and won the new Best Animated Feature Oscar?",
            options: ["WALL-E", "Up", "Spirited Away", "Flow"],
            answerIndex: 2,
            explanation: "Spirited Away (2001) won the award, introduced in 2002.",
          },
          {
            question: "Who directed Aftersun?",
            options: ["Greta Gerwig", "Celine Song", "Charlotte Wells", "Barry Jenkins"],
            answerIndex: 2,
            explanation: "Aftersun (2022) was Charlotte Wells's debut feature.",
          },
        ],
      },
    },
  ],
  chats: [
    {
      key: "international",
      title: "How international cinema broke through",
      created: { days: 6 },
      messages: [
        { role: "user", content: "Which films best show how international cinema broke through?" },
        {
          role: "assistant",
          content:
            "Grouped by how they opened the door:\n\n**The early proof**\n- **Crouching Tiger, Hidden Dragon** (2000, Ang Lee): showed a subtitled martial-arts epic could be a mainstream hit {{cite:international}}.\n- **Pan's Labyrinth** (2006, Guillermo del Toro): a Spanish-language fable that found a broad audience {{cite:international}}.\n\n**The breakthrough**\n- **Parasite** (2019, Bong Joon-ho): won the Palme d'Or and, in 2020, became the first film not in English to win Best Picture {{cite:international}}.\n\n**The streaming wave**\n- **Roma** (2018, Alfonso Cuarón): won three Oscars and reached a huge audience online {{cite:international}}, part of the wider shift in how films are released {{cite:streaming}}.\n- **Drive My Car** (2021, Ryusuke Hamaguchi): nominated for Best Picture and won Best International Feature {{cite:international}}.\n\nIf you only watch one, start with Parasite. It's also on the starter watchlist {{cite:watchlist}}.",
        },
      ],
    },
  ],
};
