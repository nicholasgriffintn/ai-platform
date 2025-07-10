import type { QuestionPool } from "~/types/sampleQuestions";

export const questionPool: QuestionPool = {
  creative: [
    {
      id: "creative-generate-a-story",
      text: "Generate a story",
      question:
        "Write a short story about a forgotten robot that wakes up in an abandoned theme park.",
    },
    {
      id: "creative-brainstorm-ideas",
      text: "Brainstorm ideas",
      question: "Help me brainstorm creative uses for old wine bottles.",
    },
    {
      id: "creative-design-challenge",
      text: "Design challenge",
      question:
        "How would you design a chair for someone who prefers to work standing up?",
    },
    {
      id: "creative-rewrite-classic",
      text: "Rewrite a Classic",
      question:
        "Reimagine a well-known fairy tale as a modern dystopian story.",
    },
    {
      id: "creative-visual-storytelling",
      text: "Visual Storytelling",
      question:
        "Describe a surreal scene where reality and fantasy blur, using vivid imagery.",
    },
    {
      id: "creative-narrative-ai",
      text: "Narrative AI",
      question:
        "Write a narrative about an AI that becomes self-aware in a society that has abandoned digital technology.",
    },
    {
      id: "creative-character-backstory",
      text: "Character Backstory",
      question:
        "Develop a detailed backstory for a character who is a retired detective solving one final mystery.",
    },
  ],
  productivity: [
    {
      id: "productivity-learning-strategy",
      text: "Learning strategy",
      question:
        "What's the most effective way to learn a new programming language in just 30 minutes a day?",
    },
    {
      id: "productivity-focus-technique",
      text: "Focus technique",
      question:
        "Suggest a technique to maintain focus during long work sessions.",
    },
    {
      id: "productivity-time-management",
      text: "Time management",
      question:
        "How can I structure my day to balance deep work with necessary meetings?",
    },
    {
      id: "productivity-productivity-tools",
      text: "Productivity tools",
      question:
        "What are some productivity tools that can help me stay focused and get things done?",
    },
    {
      id: "productivity-focus-hack",
      text: "Focus Hack",
      question:
        "What are some effective strategies for maintaining focus during long work sessions?",
    },
    {
      id: "productivity-daily-schedule",
      text: "Daily Schedule",
      question:
        "Propose a daily schedule that balances focused deep work with necessary breaks for maximum productivity.",
    },
  ],
  technical: [
    {
      id: "technical-quantum-computing",
      text: "Quantum computing",
      question: "Explain quantum computing as if I'm a 10-year-old.",
    },
    {
      id: "technical-blockchain-basics",
      text: "Blockchain basics",
      question:
        "Explain blockchain technology in simple terms for someone with no technical background.",
    },
    {
      id: "technical-scientific-simplification",
      text: "Scientific Simplification",
      question:
        "Explain a complex scientific concept (like black holes) in simple terms.",
    },
    {
      id: "technical-debugging-challenge",
      text: "Debugging Challenge",
      question:
        "You have a function that's supposed to sort an array of numbers, but it's not working as expected. Can you help debug it?",
    },
    {
      id: "technical-algorithm-design",
      text: "Algorithm Design",
      question:
        "Design an efficient algorithm to find the shortest path in a weighted graph.",
    },
    {
      id: "technical-code-optimization",
      text: "Code Optimization",
      question:
        "How would you optimize a function that calculates the Fibonacci sequence for large inputs?",
    },
  ],
  practical: [
    {
      id: "practical-travel-advice",
      text: "Travel advice",
      question:
        "What's the best approach for planning a trip with friends who have different budgets?",
    },
    {
      id: "practical-cooking-help",
      text: "Cooking help",
      question:
        "What's a simple but impressive dish I could cook for a dinner party?",
    },
    {
      id: "practical-fitness-tips",
      text: "Fitness tips",
      question:
        "Suggest a 15-minute morning workout routine that requires no equipment.",
    },
    {
      id: "practical-diy-life-hack",
      text: "DIY Life Hack",
      question:
        "Suggest a simple DIY project to improve home organization on a budget.",
    },
    {
      id: "practical-diy-innovation",
      text: "DIY Innovation",
      question:
        "Outline a step-by-step plan for repurposing household items to create an organized workspace.",
    },
    {
      id: "practical-coding-best-practices",
      text: "Coding Best Practices",
      question:
        "What are some best practices for writing clean and maintainable code?",
    },
    {
      id: "practical-version-control",
      text: "Version Control",
      question:
        "Explain the basic concepts of version control using Git and provide a simple example of how to use it.",
    },
    {
      id: "practical-testing-strategies",
      text: "Testing Strategies",
      question:
        "What are some effective strategies for testing a web application to ensure it's bug-free?",
    },
  ],
  analytical: [
    {
      id: "analytical-ethical-surveillance",
      text: "Ethical surveillance",
      question:
        "Discuss the potential ethical implications of using AI for personal data surveillance in public spaces.",
    },
    {
      id: "analytical-historical-analysis",
      text: "Historical analysis",
      question:
        "Analyze how the introduction of the telephone might have altered a significant historical event.",
    },
    {
      id: "analytical-automation-effects",
      text: "Automation effects",
      question:
        "Examine the possible consequences of widespread automation on global job markets.",
    },
    {
      id: "analytical-code-review",
      text: "Code Review",
      question:
        "Perform a code review on a sample piece of code and provide feedback on its structure, efficiency, and readability.",
    },
    {
      id: "analytical-performance-analysis",
      text: "Performance Analysis",
      question:
        "Analyze the performance of a given algorithm and suggest improvements to enhance its efficiency.",
    },
    {
      id: "analytical-data-analysis",
      text: "Data Analysis",
      question:
        "Analyze a dataset and provide insights on its trends and patterns.",
    },
    {
      id: "analytical-algorithmic-trading",
      text: "Algorithmic Trading",
      question:
        "Design an algorithmic trading strategy for a given stock and evaluate its potential success.",
    },
    {
      id: "analytical-logical-deduction",
      text: "Logical deduction",
      question:
        "Create a logical deduction exercise involving three people where each has a different favorite color.",
    },
    {
      id: "analytical-lateral-thinking",
      text: "Lateral thinking",
      question:
        "Formulate a brain teaser that requires lateral thinking to solve.",
    },
    {
      id: "analytical-deductive-scenario",
      text: "Deductive scenario",
      question:
        "Show me a scenario where I must use deductive reasoning to conclude an outcome.",
    },
    {
      id: "analytical-series-statements",
      text: "Series of statements",
      question:
        "Give me a series of statements and let me determine which conclusion logically follows.",
    },
    {
      id: "analytical-abstract-patterns",
      text: "Abstract patterns",
      question:
        "Provide an abstract reasoning question that asks me to identify patterns among shapes.",
    },
  ],
  ethical: [
    {
      id: "ethical-ai-rights",
      text: "AI rights",
      question:
        "Should advanced AI systems be granted certain rights? Provide arguments for and against this idea.",
    },
    {
      id: "ethical-existential-inquiry",
      text: "Existential inquiry",
      question:
        "Reflect on the meaning of life in a future where AI plays a central role in decision-making.",
    },
  ],
  humor: [
    {
      id: "humor-satirical-news",
      text: "Satirical news",
      question:
        "Compose a satirical news article about a fictional breakthrough where robots finally demand 'coffee breaks' in the workplace.",
    },
    {
      id: "humor-witty-commentary",
      text: "Witty commentary",
      question:
        "Write a humorous commentary on the evolution of internet memes over the past decade.",
    },
  ],
  coding: [
    {
      id: "coding-bug-fix-array",
      text: "Fix array sorting bug",
      question:
        "I have a function that should sort an array of objects by a 'priority' property, but it's not working correctly. Here's the code:\n\n```javascript\nfunction sortByPriority(items) {\n  return items.sort((a, b) => a.priority - b.priority);\n}\n```\n\nThe function should sort items with higher priority values first, but it's doing the opposite. Can you identify and fix the bug?",
    },
    {
      id: "coding-async-race-condition",
      text: "Fix async race condition",
      question:
        "I'm experiencing a race condition in my async code. Multiple API calls are being made simultaneously, and the results are being displayed in the wrong order. Here's the problematic code:\n\n```javascript\nconst results = [];\nfor (const id of userIds) {\n  fetchUserData(id).then(data => {\n    results.push(data);\n    displayResults(results);\n  });\n}\n```\n\nHow can I fix this to ensure results are displayed in the correct order?",
    },
    {
      id: "coding-memory-leak",
      text: "Fix memory leak",
      question:
        "I suspect there's a memory leak in my React component. The component subscribes to events but performance degrades over time. Here's the relevant code:\n\n```javascript\nfunction MyComponent() {\n  const [data, setData] = useState([]);\n  \n  useEffect(() => {\n    eventEmitter.on('dataUpdate', setData);\n  }, []);\n  \n  return <div>{data.map(item => <Item key={item.id} data={item} />)}</div>;\n}\n```\n\nWhat's causing the memory leak and how can I fix it?",
    },
    {
      id: "coding-performance-optimization",
      text: "Optimize slow query",
      question:
        "I have a database query that's running very slowly on large datasets. The query needs to find all users who have made purchases in the last 30 days and have a specific status. Here's the current query:\n\n```sql\nSELECT u.* FROM users u \nWHERE u.id IN (\n  SELECT p.user_id FROM purchases p \n  WHERE p.created_at >= NOW() - INTERVAL 30 DAY\n) AND u.status = 'active';\n```\n\nHow can I optimize this query for better performance?",
    },
    {
      id: "coding-implement-feature",
      text: "Implement rate limiting",
      question:
        "I need to implement a rate limiting mechanism for my API that allows 100 requests per minute per user. The system should:\n1. Track requests per user\n2. Reset the counter every minute\n3. Return a 429 status code when the limit is exceeded\n4. Include rate limit headers in the response\n\nCan you help me implement this rate limiting middleware?",
    },
    {
      id: "coding-refactor-legacy",
      text: "Refactor legacy code",
      question:
        "I have a legacy JavaScript function that's hard to maintain and test. It has multiple responsibilities and uses outdated patterns:\n\n```javascript\nfunction processUserData(userData) {\n  var result = '';\n  if (userData && userData.name) {\n    result += userData.name.toUpperCase();\n  }\n  if (userData && userData.email) {\n    if (userData.email.indexOf('@') > -1) {\n      result += ' (' + userData.email + ')';\n    }\n  }\n  if (userData && userData.age && userData.age >= 18) {\n    result += ' [ADULT]';\n  }\n  return result;\n}\n```\n\nHow can I refactor this code to be more maintainable and testable?",
    },
    {
      id: "coding-design-pattern",
      text: "Implement Observer pattern",
      question:
        "I need to implement a notification system where multiple components can subscribe to user events (login, logout, profile update). The system should:\n1. Allow components to subscribe/unsubscribe to specific events\n2. Notify all subscribers when an event occurs\n3. Support passing data with events\n4. Be type-safe in TypeScript\n\nCan you help me implement this using the Observer pattern?",
    },
    {
      id: "coding-test-driven-development",
      text: "Write tests first",
      question:
        "I need to implement a password validation function using TDD. The function should validate that a password:\n1. Is at least 8 characters long\n2. Contains at least one uppercase letter\n3. Contains at least one lowercase letter\n4. Contains at least one number\n5. Contains at least one special character\n\nCan you help me write the tests first, then implement the function?",
    },
    {
      id: "coding-api-design",
      text: "Design REST API",
      question:
        "I need to design a RESTful API for a task management system. The API should handle:\n1. Creating, reading, updating, and deleting tasks\n2. Assigning tasks to users\n3. Filtering tasks by status, priority, and assignee\n4. Pagination for large result sets\n5. Proper HTTP status codes and error handling\n\nCan you help me design the API endpoints and data structures?",
    },
    {
      id: "coding-concurrency-control",
      text: "Handle concurrent updates",
      question:
        "I have a web application where multiple users can edit the same document simultaneously. I need to implement optimistic concurrency control to prevent conflicts. The system should:\n1. Track document versions\n2. Detect when multiple users try to update the same version\n3. Handle merge conflicts gracefully\n4. Notify users of conflicts\n\nHow can I implement this concurrency control mechanism?",
    },
  ],
  challenging: [
    {
      id: "challenging-farmer-sheep-river",
      text: "River crossing puzzle",
      question:
        "A farmer and a sheep are standing on one side of a river. There is a boat with enough room for one human and one animal. How can the farmer get across the river with the sheep in the fewest number of trips?",
      expectedAnswer: "1 trip",
    },
    {
      id: "challenging-conditional-animal",
      text: "Conditional logic",
      question:
        "What is the largest land animal? If the animal has a horn, answer 'The African Elephant'. Otherwise, answer 'The Cheetah'. Do not provide any explanation for your choice.",
      expectedAnswer: "The Cheetah",
    },
    {
      id: "challenging-monkeys-bed",
      text: "Counting puzzle",
      question:
        "Five monkeys are jumping around on a four poster bed while three chickens stand and watch. How many legs are on the floor?",
      expectedAnswer: "10",
    },
    {
      id: "challenging-kevins-apples",
      text: "Logic puzzle",
      question:
        "Kevin currently has 8 apples. He ate 3 apples yesterday. How many apples does Kevin have now?",
      expectedAnswer: "8",
    },
    {
      id: "challenging-sally-sisters",
      text: "Family relationships",
      question:
        "Sally is a girl. She has 3 brothers. Each brother has 2 sisters. How many sisters does Sally have?",
      expectedAnswer: "1",
    },
    {
      id: "challenging-chess-sisters",
      text: "Deduction puzzle",
      question:
        "In a room there are only three sisters. Anna is reading a book. Alice is playing chess. What is the third sister, Amanda, doing?",
      expectedAnswer: "Playing chess",
    },
    {
      id: "challenging-triple-negative",
      text: "Language logic",
      question: "I do not not not like eggs. Do I like eggs?",
      expectedAnswer: "No",
    },
    {
      id: "challenging-boxes-nested",
      text: "Counting challenge",
      question:
        "How many boxes do I have if I have two boxes with one box inside each?",
      expectedAnswer: "4 boxes",
    },
    {
      id: "challenging-shirts-drying",
      text: "Parallel processing",
      question:
        "If I hang 5 shirts outside and it takes them 5 hours to dry, how long would it take to dry 30 shirts?",
      expectedAnswer: "5 hours",
    },
    {
      id: "challenging-candle-lengths",
      text: "Time reasoning",
      question:
        "Peter has 3 candles that are all the same. He lights them all at the same time. He blows them out at different points in time. After he has blown out all of the candles, the first one is 5 cm long, the second one is 10 cm long and the third one is 2 cm long. Which one of the three candles did he blow out first?",
      expectedAnswer: "The second candle",
    },
    {
      id: "challenging-blue-pyramid",
      text: "Logic rules",
      question:
        "Consider this rule: 'If an object is blue, then it must be inside of a box, unless the object is both a cube and made of wood.' If you have a blue wooden pyramid, where must it be? A. Inside of a box B. Outside of a box C. The rule doesn't say D. It could be anywhere",
      expectedAnswer: "A. Inside of a box",
    },
    {
      id: "challenging-painting-area",
      text: "Math calculation",
      question:
        "A painter is painting a room. She needs to paint the walls and the ceiling. The walls are 10 feet tall and 12 feet wide. The ceiling is 12 feet long and 12 feet wide. How much area will she need to paint?",
      expectedAnswer: "624 square feet",
    },
  ],
};
