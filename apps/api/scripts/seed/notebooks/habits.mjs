import { seedFile } from "../sources.mjs";
import { timeline } from "./media.mjs";

const AUDIO_LINES = [
  [
    "S1",
    "Welcome in. Today we're looking at why some habits stick, and others fall over by Wednesday.",
  ],
  [
    "S2",
    "The short answer from these sources is that a habit is a loop, not a decision. There's a cue, a routine, and a reward.",
  ],
  [
    "S1",
    "So the cue is the trigger. A time of day, a place, a feeling, other people, or whatever you just did.",
  ],
  [
    "S2",
    "And the useful trick is that you rarely change the cue or the reward. You swap the routine in the middle.",
  ],
  [
    "S1",
    "The craving exercise in the notebook makes that practical. For five days, you note the time, place, mood, people, and last action whenever the urge hits.",
  ],
  [
    "S2",
    "By day three, most people spot the pattern. It's often the same hour, or the same feeling, every time.",
  ],
  ["S1", "And how long until the new routine feels automatic?"],
  [
    "S2",
    "Longer than the myth. One well known study found a median of about sixty six days, with a huge range. Missing a single day didn't matter much.",
  ],
  [
    "S1",
    "So be patient, stack the new habit onto something you already do, and don't panic about a bad Tuesday.",
  ],
  ["S2", "Start with one keystone habit, and let it pull the others along."],
];

const AUDIO_DURATIONS = [5.44, 8.01, 6.63, 6.41, 10.1, 7.37, 3.2, 9.85, 6.48, 4.4];

export const HABITS_NOTEBOOK = {
  key: "habits",
  title: "Build Better Habits",
  created: { days: 12 },
  instructions:
    "You are a behavioural coach working from the notebook's sources. When someone shares a schedule, a goal or a habit they want to change, identify the likely cue, routine and reward, then suggest one small experiment for the coming week. Ask one question at a time and keep advice concrete.",
  settings: {
    style: "custom",
    persona:
      "A warm, practical behavioural coach. Plain words, no jargon, one experiment at a time.",
    responseLength: "shorter",
    sourcesOnly: true,
  },
  guide: {
    generated: { days: 2 },
    summary:
      "These sources explain habits as a **habit loop** of cue, routine and reward, and show how to change behaviour by keeping the cue and reward while swapping the routine. They cover **keystone habits** that set off wider change, a five-day **craving diagnosis** for finding hidden triggers, and **implementation intentions** for planning new routines. Research on **habit formation** suggests automaticity takes weeks to months, and a missed day rarely undoes progress.",
    questions: [
      "How do I find the cue behind my afternoon snacking?",
      "What makes a habit a keystone habit?",
      "How long should I expect a new routine to take before it feels automatic?",
    ],
  },
  sources: [
    {
      key: "habit-loop",
      kind: "text",
      title: "The habit loop",
      created: { days: 12 },
      content: `# The habit loop

Most of what we do each day is not decided. It is repeated. Researchers who study routines describe a habit as a three-part loop.

**Cue.** Something tells the brain to go into automatic mode. Cues fall into five broad groups: a time of day, a location, an emotional state, other people, and the action that immediately came before.

**Routine.** The behaviour itself. It can be physical (reaching for a biscuit), mental (checking whether you locked the door) or emotional (snapping at a colleague when tired).

**Reward.** The payoff that teaches the brain the loop is worth remembering. Over time the brain begins to anticipate the reward as soon as it sees the cue, and that anticipation is what we feel as a craving.

## Why this matters

You cannot simply delete a habit. The cue and the craving remain. What you can do is keep the cue, keep the reward, and insert a new routine. Someone who smokes on their break because they want a few minutes away from their desk might take a short walk with a colleague instead. Same cue, same reward, different routine.

The loop also explains why willpower alone fails so often. Willpower fights the craving every time. Changing the routine works with it.`,
    },
    {
      key: "keystone-habits",
      kind: "text",
      title: "Keystone habits",
      created: { days: 11 },
      content: `# Keystone habits

Some habits matter more than others because they set off chain reactions. These are often called keystone habits.

Regular exercise is the classic example. People who start exercising often report eating better, sleeping more and spending less impulsively, even though nobody asked them to change those things. Families who eat dinner together tend to report children with steadier routines. Making the bed every morning has been linked, loosely, with feeling more in control of the day.

## What keystone habits have in common

- **Small wins.** They give a quick, visible success that makes the next change feel possible.
- **New structures.** They create routines or settings in which other habits can grow, such as a fixed wake-up time.
- **A shift in identity.** They change how people see themselves: "I am someone who looks after my health."

## How to pick one

Choose a habit that is easy to do daily, that you can see yourself succeeding at within a week, and that touches several parts of your life. Do not try to change everything at once. Start with one keystone and watch which other habits move with it.`,
    },
    {
      key: "craving-diagnosis",
      kind: "text",
      title: "Diagnosing a craving: a five-day exercise",
      created: { days: 10 },
      content: `# Diagnosing a craving

Use this exercise when you have a habit you want to change but cannot work out what sets it off.

## Step one: log the cue

For five days, every time the urge appears, write down five things:

1. Where are you?
2. What time is it?
3. What is your emotional state?
4. Who else is around?
5. What did you do just before?

Do not try to change anything yet. Just record. By the third day, most people see a pattern: the urge arrives at roughly the same time, or after the same kind of meeting, or when the same feeling shows up.

## Step two: experiment with rewards

Next, change the reward and see whether the craving goes away. If you usually buy a pastry at 3pm, try a walk one day, a chat with a colleague the next, and an apple the day after. Fifteen minutes later, note whether you still want the pastry. The reward that kills the craving tells you what you were really after: energy, company or a break.

## Step three: make a plan

Write the plan as a sentence: "At 3pm, I will walk to a colleague's desk and talk for ten minutes." A clear plan turns the new routine into the default.`,
    },
    {
      key: "implementation-intentions",
      kind: "text",
      title: "Habit stacking and implementation intentions",
      created: { days: 9 },
      content: `# Habit stacking and implementation intentions

Psychologists use the term **implementation intention** for a plan written in the form "When situation X arises, I will do Y." Studies across health, study and work goals have found that people who make these if-then plans follow through more often than people who only set a goal.

**Habit stacking** applies the same idea by attaching a new habit to an existing one. The old habit becomes the cue for the new one:

- After I pour my morning coffee, I will write down my top task for the day.
- After I sit on the train home, I will read for ten minutes.
- After I brush my teeth at night, I will lay out my running kit.

## Tips

- Choose an anchor habit that already happens every day, at a predictable time.
- Make the new habit small enough to do even on a bad day. Two minutes is plenty.
- Put the cue where you will see it. The running kit by the door does half the work.`,
    },
    {
      key: "formation-research",
      kind: "text",
      title: "How long a habit takes to form",
      created: { days: 8 },
      content: `# How long a habit takes to form

The idea that a habit takes 21 days to form is popular but has little evidence behind it.

A frequently cited study from University College London, published in 2009, followed volunteers who chose a new daily eating, drinking or exercise behaviour. Participants rated how automatic the behaviour felt each day. The median time to reach a plateau of automaticity was **66 days**, but individual times ranged from **18 to 254 days**. Simpler behaviours, such as drinking a glass of water with breakfast, became automatic faster than harder ones, such as doing sit-ups before dinner.

Importantly, **missing a single day did not materially affect the process**. Consistency mattered over the long run, but perfection did not.

## What this means in practice

- Expect weeks to months, not days.
- Do not treat a missed day as failure. Get back on track the next day.
- Keep the behaviour in a consistent context so the cue stays reliable.`,
    },
    {
      key: "habit-reference",
      kind: "url",
      title: "Habit - overview",
      provider: "web",
      externalUri: "https://en.wikipedia.org/wiki/Habit",
      created: { days: 7 },
      content: `Habit (overview)

A habit is a routine of behaviour that is repeated regularly and tends to occur subconsciously. Habits are formed through repetition in a stable context, which strengthens the link between a situation and an action until the situation alone can trigger it. Psychologists distinguish habits from goal-directed behaviour: goal-directed actions are sensitive to whether the outcome is still wanted, whereas habits continue even when the reward has lost its value.

Research on breaking habits suggests that changing the environment is often more effective than relying on self-control. Moving house, changing jobs or starting at a new school can disrupt old cues, which creates a window in which new habits are easier to establish.`,
    },
  ],
  notes: [
    {
      key: "my-schedule",
      title: "My weekday schedule",
      created: { days: 3 },
      content: `07:00 Alarm, phone in bed for 20 minutes
07:30 Shower, coffee
08:15 Commute (train, scroll news)
09:00 Email, standup at 09:30
12:30 Lunch at desk
15:00 Afternoon slump, usually a pastry from the café
18:00 Train home
19:00 Dinner, TV
23:30 Bed, phone for a while`,
    },
    {
      key: "coach-observations",
      title: "Coach's first read",
      created: { days: 2, hours: 22 },
      content: `- 15:00 pastry looks like a break and company craving, not hunger. Try the walk-and-talk test on three days.
- Phone in bed at both ends of the day: same cue (lying down), same reward (winding down). Swap for a book on the bedside table.
- Train home is a good anchor for a 10-minute reading habit.`,
    },
  ],
  media: [
    {
      key: "audio-overview",
      kind: "podcast",
      title: "Why habits stick, and how to swap the routine",
      created: { days: 2, hours: 4 },
      file: seedFile("habits-audio-overview.mp3", "audio/mpeg"),
      content: AUDIO_LINES.map(
        ([speaker, text]) => `${speaker === "S1" ? "Host" : "Guest"}: ${text}`,
      ).join("\n"),
      generation: {
        type: "podcast",
        mode: "audio",
        modelName: "Polychat voices",
        input: { format: "deep_dive", length: "short", language: "en" },
      },
      metadata: {
        media: {
          durationSeconds: 68,
          transcript: {
            status: "ready",
            speakers: { S1: "Host", S2: "Guest" },
            segments: AUDIO_LINES.map(([speaker, text], index) => ({
              speaker,
              text,
              ...timeline(AUDIO_DURATIONS)[index],
            })),
          },
          notes: {
            summary:
              "A short two-voice walk through the habit loop, the five-day craving log and how long new routines take to stick.",
            decisions: [],
            actionItems: [
              {
                task: "Run the five-day cue log for the 3pm pastry habit",
                owner: "You",
                due: "This week",
              },
            ],
          },
        },
      },
    },
    {
      key: "infographic",
      kind: "file",
      title: "The habit loop at a glance",
      created: { days: 1, hours: 20 },
      file: seedFile("habits-infographic.png", "image/png"),
      generation: {
        type: "studio",
        mode: "image",
        input: { orientation: "landscape", language: "en" },
        prompt:
          "A clean landscape infographic of the habit loop: cue, routine and reward as three coloured cards, with three supporting statistics underneath.",
      },
    },
  ],
  outputs: [
    {
      key: "flashcards",
      kind: "flashcards",
      title: "Habit science flashcards",
      created: { days: 1, hours: 6 },
      progress: { known: [0, 1, 4], missed: [3], answers: {} },
      content: {
        format: "flashcards",
        cards: [
          {
            front: "What are the three parts of the habit loop?",
            back: "Cue, routine and reward.",
          },
          {
            front: "Name the five groups of cues.",
            back: "Time of day, location, emotional state, other people and the immediately preceding action.",
          },
          {
            front: "Why does willpower alone tend to fail?",
            back: "It fights the craving every time, whereas changing the routine keeps the cue and reward and works with the craving.",
          },
          {
            front: "What was the median time to automaticity in the 2009 UCL study?",
            back: "66 days, with individual times ranging from 18 to 254 days.",
          },
          {
            front: "What is a keystone habit?",
            back: "A habit that sets off chain reactions, creating small wins, new structures or a shift in identity that help other habits change.",
          },
          {
            front: "What is an implementation intention?",
            back: 'A plan in the form "When situation X arises, I will do Y."',
          },
          {
            front: "In the craving exercise, how do you find the real reward?",
            back: "Swap in different rewards and check fifteen minutes later whether the craving is still there.",
          },
          {
            front: "Does missing one day reset habit formation?",
            back: "No. In the UCL study, a single missed day did not materially affect the process.",
          },
        ],
      },
    },
    {
      key: "quiz",
      kind: "quiz",
      title: "Habit loop check-in",
      created: { days: 1, hours: 5 },
      progress: { known: [], missed: [], answers: { 0: 1, 1: 2 } },
      content: {
        format: "quiz",
        questions: [
          {
            question: "Which part of the habit loop should you usually change?",
            options: ["The cue", "The routine", "The reward", "All three at once"],
            answerIndex: 1,
            explanation:
              "The sources recommend keeping the cue and reward and swapping the routine in the middle.",
          },
          {
            question: "How long should the cue log run in the craving exercise?",
            options: ["One day", "Three days", "Five days", "Three weeks"],
            answerIndex: 2,
            explanation:
              "The exercise asks you to record five details every time the urge appears, for five days.",
          },
          {
            question: "Which plan is written as an implementation intention?",
            options: [
              "I want to read more this year",
              "After I sit on the train home, I will read for ten minutes",
              "Reading is good for me",
              "I will try to read when I can",
            ],
            answerIndex: 1,
            explanation:
              "An implementation intention names a situation and the action that follows it.",
          },
          {
            question: "Why can moving house make habits easier to change?",
            options: [
              "It reduces stress",
              "It disrupts old cues, opening a window for new habits",
              "It increases willpower",
              "It changes rewards",
            ],
            answerIndex: 1,
            explanation:
              "The overview notes that changing the environment disrupts the cues that trigger old habits.",
          },
        ],
      },
    },
    {
      key: "mind-map",
      kind: "mind_map",
      title: "Changing a habit",
      created: { days: 1, hours: 4 },
      content: {
        format: "mind_map",
        root: {
          label: "Changing a habit",
          summary: "Habits run as loops, so change works best by redesigning the loop.",
          children: [
            {
              label: "The habit loop",
              children: [
                { label: "Cue", summary: "Time, place, mood, people or the previous action." },
                { label: "Routine", summary: "The automatic behaviour you swap." },
                { label: "Reward", summary: "The payoff the brain learns to crave." },
              ],
            },
            {
              label: "Diagnosis",
              children: [
                {
                  label: "Five-day cue log",
                  summary: "Record five details whenever the urge hits.",
                },
                { label: "Reward experiments", summary: "Test rewards to find the real craving." },
              ],
            },
            {
              label: "Building new routines",
              children: [
                { label: "Implementation intentions", summary: "When X happens, I will do Y." },
                { label: "Habit stacking", summary: "Attach the new habit to an existing one." },
                { label: "Keystone habits", summary: "Pick one that pulls others along." },
              ],
            },
            {
              label: "Expectations",
              children: [
                {
                  label: "66-day median",
                  summary: "Automaticity took 18 to 254 days in one study.",
                },
                { label: "Missed days", summary: "One slip does not undo progress." },
              ],
            },
          ],
        },
      },
    },
  ],
  chats: [
    {
      key: "afternoon-slump",
      title: "Fixing the 3pm pastry habit",
      created: { days: 2, hours: 23 },
      messages: [
        {
          role: "user",
          content:
            "I've added my schedule as a note. Every day around 3pm I buy a pastry and I'd like to stop. Where do I start?",
        },
        {
          role: "assistant",
          content:
            "Start by treating it as a loop rather than a lack of willpower. Your cue is probably the time and the slump that comes with it, the routine is the café trip, and the reward is still unknown {{cite:habit-loop}}.\n\nFor the next five days, each time the urge appears, jot down where you are, the time, how you feel, who is around and what you just finished {{cite:craving-diagnosis}}. Don't change anything yet.\n\nOne question to start: does the urge come on even on days you had a big lunch?",
        },
        {
          role: "user",
          content:
            "Yes, even after a big lunch. It's mostly when I've been staring at email all afternoon.",
        },
        {
          role: "assistant",
          content:
            "Then hunger is unlikely to be the reward. It sounds more like a break or some company. Try a reward experiment: on three different days at 3pm, take a five-minute walk, chat to a colleague, or eat an apple, and check fifteen minutes later whether you still want the pastry {{cite:craving-diagnosis}}.\n\nWhen you find the one that kills the craving, write the plan as a sentence, such as \"At 3pm, I will walk to a colleague's desk for ten minutes\" {{cite:implementation-intentions}}. Expect it to take weeks to feel automatic, and don't worry about the odd slip {{cite:formation-research}}.",
        },
      ],
    },
  ],
};
