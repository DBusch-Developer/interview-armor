const INTERVIEW_QUESTIONS = [

  // ─────────────────────────────────────────────────────────
  //  BEGINNER  (30)
  // ─────────────────────────────────────────────────────────

  // HTML
  { id: "html-b01", category: "HTML", level: "Beginner", type: "Technical",
    question: "What is semantic HTML, and why does it matter?",
    tip: "Name a few semantic elements and explain the accessibility and SEO benefits." },
  { id: "html-b02", category: "HTML", level: "Beginner", type: "Technical",
    question: "How would you make a form more accessible?",
    tip: "Mention labels, helpful error messages, keyboard focus, and clear input types." },
  { id: "html-b03", category: "HTML", level: "Beginner", type: "Technical",
    question: "When would you use a button instead of an anchor tag?",
    tip: "Buttons trigger actions. Links navigate somewhere." },

  // CSS
  { id: "css-b01", category: "CSS", level: "Beginner", type: "Technical",
    question: "Explain the CSS box model.",
    tip: "Cover content, padding, border, margin, and box-sizing." },
  { id: "css-b02", category: "CSS", level: "Beginner", type: "Technical",
    question: "What is the difference between flexbox and grid?",
    tip: "Flexbox is one-dimensional. Grid is two-dimensional." },
  { id: "css-b03", category: "CSS", level: "Beginner", type: "Technical",
    question: "How would you center an element on a page?",
    tip: "Give one flexbox answer and one grid answer if you can." },

  // JavaScript
  { id: "js-b01", category: "JavaScript", level: "Beginner", type: "Technical",
    question: "What is the difference between let, const, and var?",
    tip: "Mention reassignment, scope, and why var is usually avoided." },
  { id: "js-b02", category: "JavaScript", level: "Beginner", type: "Technical",
    question: "What does === check that == does not?",
    tip: "Mention type coercion and give a quick example." },
  { id: "js-b03", category: "JavaScript", level: "Beginner", type: "Technical",
    question: "What is an array method you use often, and why?",
    tip: "Pick map, filter, forEach, find, or reduce and give a concrete example." },
  { id: "js-b04", category: "JavaScript", level: "Beginner", type: "Technical",
    question: "Explain what a function does in JavaScript.",
    tip: "Use a plain-language analogy plus a small practical example." },

  // DOM
  { id: "dom-b01", category: "DOM", level: "Beginner", type: "Technical",
    question: "What is the DOM?",
    tip: "Explain it as the browser's object version of the HTML page." },
  { id: "dom-b02", category: "DOM", level: "Beginner", type: "Technical",
    question: "How do you select an element with JavaScript?",
    tip: "Mention querySelector and getElementById." },
  { id: "dom-b03", category: "DOM", level: "Beginner", type: "Technical",
    question: "What is an event listener?",
    tip: "Explain how JavaScript waits for user actions like clicks or input." },

  // Git
  { id: "git-b01", category: "Git", level: "Beginner", type: "Technical",
    question: "What is the difference between git add, git commit, and git push?",
    tip: "Explain staging, saving locally, and sending to a remote." },
  { id: "git-b02", category: "Git", level: "Beginner", type: "Technical",
    question: "What is a branch in Git?",
    tip: "Describe isolated work before merging." },
  { id: "git-b03", category: "Git", level: "Beginner", type: "Technical",
    question: "What would you do if you had a merge conflict?",
    tip: "Explain reading the conflict markers, choosing the right code, testing, and committing." },

  // React
  { id: "react-b01", category: "React", level: "Beginner", type: "Technical",
    question: "What is a component in React?",
    tip: "Explain it as a reusable piece of UI, like a custom HTML element, that returns JSX." },
  { id: "react-b02", category: "React", level: "Beginner", type: "Technical",
    question: "What are props, and how do you pass them?",
    tip: "Props are read-only inputs to a component. Mention destructuring." },
  { id: "react-b03", category: "React", level: "Beginner", type: "Technical",
    question: "What does useState do, and why can't you just use a regular variable?",
    tip: "useState tells React to re-render when the value changes. A plain variable wouldn't trigger that." },

  // Tailwind
  { id: "tw-b01", category: "Tailwind", level: "Beginner", type: "Technical",
    question: "What is utility-first CSS, and how is Tailwind different from writing your own classes?",
    tip: "Tailwind gives you small single-purpose classes to compose styles directly in markup." },
  { id: "tw-b02", category: "Tailwind", level: "Beginner", type: "Technical",
    question: "How do you make a Tailwind class apply only on larger screens?",
    tip: "Mention the breakpoint prefixes like md: and lg:, and the mobile-first default." },

  // Accessibility
  { id: "a11y-b01", category: "Accessibility", level: "Beginner", type: "Technical",
    question: "What does the alt attribute do on an image, and when do you leave it empty?",
    tip: "Cover screen readers, meaningful vs. decorative images, and the empty-string convention." },
  { id: "a11y-b02", category: "Accessibility", level: "Beginner", type: "Technical",
    question: "What is the difference between hiding something with display:none and visually-hidden CSS?",
    tip: "display:none removes it for everyone. Visually-hidden keeps it for screen readers." },

  // Testing
  { id: "test-b01", category: "Testing", level: "Beginner", type: "Technical",
    question: "What is a unit test, and what is something you would unit-test?",
    tip: "A unit test checks one small piece of logic. Good example: a function that formats a date." },
  { id: "test-b02", category: "Testing", level: "Beginner", type: "Technical",
    question: "Walk me through the arrange / act / assert pattern.",
    tip: "Set up the inputs, call the thing, then check the result. Give a quick example." },

  // Behavioral
  { id: "beh-b01", category: "Behavioral", level: "Beginner", type: "Behavioral",
    question: "Tell me about a time you solved a difficult problem.",
    tip: "Use STAR: situation, task, action, result." },
  { id: "beh-b02", category: "Behavioral", level: "Beginner", type: "Behavioral",
    question: "Tell me about a time you had to learn something quickly.",
    tip: "Show resourcefulness, practice, and how you applied it." },
  { id: "beh-b03", category: "Behavioral", level: "Beginner", type: "Behavioral",
    question: "Describe a time you received feedback and used it to improve.",
    tip: "Choose a real example and explain what changed afterward." },
  { id: "beh-b04", category: "Behavioral", level: "Beginner", type: "Behavioral",
    question: "Why do you want to become a developer?",
    tip: "Connect your story to building, problem-solving, and growth." },
  { id: "beh-b05", category: "Behavioral", level: "Beginner", type: "Behavioral",
    question: "Tell me about a project you are proud of.",
    tip: "Explain the problem, your role, the tech, and the result." },


  // ─────────────────────────────────────────────────────────
  //  INTERMEDIATE  (30)
  // ─────────────────────────────────────────────────────────

  // JavaScript
  { id: "js-i01", category: "JavaScript", level: "Intermediate", type: "Technical",
    question: "Explain closures with an example.",
    tip: "Show an inner function holding onto a variable from an outer function after the outer one returns." },
  { id: "js-i02", category: "JavaScript", level: "Intermediate", type: "Technical",
    question: "What is the event loop, and why does it matter?",
    tip: "Cover the call stack, the task queue, and how async work is scheduled." },
  { id: "js-i03", category: "JavaScript", level: "Intermediate", type: "Technical",
    question: "What is the difference between Promises and async/await, and when do you reach for each?",
    tip: "Same underlying mechanism. Async/await reads sequentially; Promises chain better for parallel work." },

  // CSS
  { id: "css-i01", category: "CSS", level: "Intermediate", type: "Technical",
    question: "When would you reach for CSS Grid over Flexbox, and when would you stick with Flexbox?",
    tip: "Grid is for two-dimensional layout. Flexbox is for one direction with flexible items." },
  { id: "css-i02", category: "CSS", level: "Intermediate", type: "Technical",
    question: "How would you implement a dark mode toggle that respects the user's system preference?",
    tip: "Mention prefers-color-scheme, CSS custom properties, and a manual override stored in localStorage." },

  // Git
  { id: "git-i01", category: "Git", level: "Intermediate", type: "Technical",
    question: "What is the difference between git merge and git rebase? When would you choose one?",
    tip: "Merge preserves history. Rebase rewrites it for a linear log. Don't rebase shared branches." },
  { id: "git-i02", category: "Git", level: "Intermediate", type: "Technical",
    question: "What does git stash do, and when have you used it?",
    tip: "Parks uncommitted changes so you can switch context. Give a real example." },

  // React
  { id: "react-i01", category: "React", level: "Intermediate", type: "Technical",
    question: "What are the rules of hooks, and why do they exist?",
    tip: "Top-level only, in components/custom hooks only. React relies on call order to track state." },
  { id: "react-i02", category: "React", level: "Intermediate", type: "Technical",
    question: "When should you reach for Context, and when is it overkill?",
    tip: "Use it for low-frequency, cross-cutting values (theme, auth). Avoid it for state that changes often." },
  { id: "react-i03", category: "React", level: "Intermediate", type: "Technical",
    question: "How would you prevent unnecessary re-renders in a React component?",
    tip: "Cover React.memo, useMemo, useCallback, lifting state down, and when these tools backfire." },

  // TypeScript
  { id: "ts-i01", category: "TypeScript", level: "Intermediate", type: "Technical",
    question: "When would you use a type alias versus an interface?",
    tip: "Both work for objects. Interfaces merge declarations; types handle unions and primitives." },
  { id: "ts-i02", category: "TypeScript", level: "Intermediate", type: "Technical",
    question: "Explain generics with a real example.",
    tip: "Show a small function or container where the input type flows through to the output." },

  // Node.js
  { id: "node-i01", category: "Node.js", level: "Intermediate", type: "Technical",
    question: "How is Node's event loop different from the browser's?",
    tip: "Cover phases (timers, poll, check), libuv, and process.nextTick vs. setImmediate." },
  { id: "node-i02", category: "Node.js", level: "Intermediate", type: "Technical",
    question: "What are streams, and when would you reach for them?",
    tip: "Process data in chunks instead of loading it all into memory. Good for files and large responses." },

  // APIs
  { id: "api-i01", category: "APIs", level: "Intermediate", type: "Technical",
    question: "When would you choose REST over GraphQL, and vice versa?",
    tip: "REST is simpler and cacheable. GraphQL avoids over-fetching when clients vary widely." },
  { id: "api-i02", category: "APIs", level: "Intermediate", type: "Technical",
    question: "How would you handle versioning for a public API?",
    tip: "URL versioning, header versioning, or evolutionary changes. Talk about trade-offs and client impact." },

  // State Management
  { id: "state-i01", category: "State Management", level: "Intermediate", type: "Technical",
    question: "When should you reach for a state library like Redux or Zustand versus local state?",
    tip: "Local first. Reach for a library when state is shared widely or changes need coordination." },
  { id: "state-i02", category: "State Management", level: "Intermediate", type: "Technical",
    question: "What is the difference between server state and client state, and why does it matter?",
    tip: "Server state has cache, sync, and staleness concerns. Tools like React Query handle that for you." },

  // Performance
  { id: "perf-i01", category: "Performance", level: "Intermediate", type: "Technical",
    question: "What are Core Web Vitals, and how do you improve them?",
    tip: "LCP, INP, CLS. Cover image optimization, reducing main-thread work, and reserving space for media." },
  { id: "perf-i02", category: "Performance", level: "Intermediate", type: "Technical",
    question: "How would you reduce a JavaScript bundle that has gotten too large?",
    tip: "Code splitting, tree shaking, lazy loading routes, swapping heavy dependencies, analyzing the bundle." },

  // Databases
  { id: "db-i01", category: "Databases", level: "Intermediate", type: "Technical",
    question: "Walk me through the difference between INNER JOIN, LEFT JOIN, and OUTER JOIN.",
    tip: "Use a small two-table example and describe what rows survive in each case." },
  { id: "db-i02", category: "Databases", level: "Intermediate", type: "Technical",
    question: "What is an index, and what are the trade-offs of adding one?",
    tip: "Indexes speed reads at the cost of writes and storage. Talk about which columns are worth indexing." },

  // Testing
  { id: "test-i01", category: "Testing", level: "Intermediate", type: "Technical",
    question: "What is the difference between unit, integration, and end-to-end tests, and what is the right mix?",
    tip: "Cover the testing pyramid and which kinds of bugs each layer catches." },
  { id: "test-i02", category: "Testing", level: "Intermediate", type: "Technical",
    question: "When should you mock something in a test, and when does mocking hurt you?",
    tip: "Mock to isolate. Over-mocking turns tests into restatements of the implementation." },

  // Next.js
  { id: "next-i01", category: "Next.js", level: "Intermediate", type: "Technical",
    question: "Compare SSR, SSG, and ISR. How do you decide which to use for a page?",
    tip: "Cover freshness, build time, request cost, and SEO." },
  { id: "next-i02", category: "Next.js", level: "Intermediate", type: "Technical",
    question: "What changed between the Pages Router and the App Router?",
    tip: "Cover server components, layouts, data fetching, and mental model differences." },

  // Behavioral
  { id: "beh-i01", category: "Behavioral", level: "Intermediate", type: "Behavioral",
    question: "Tell me about a time you disagreed with a teammate. How did you resolve it?",
    tip: "Focus on listening, finding shared ground, and what you actually shipped." },
  { id: "beh-i02", category: "Behavioral", level: "Intermediate", type: "Behavioral",
    question: "Describe a feature or project you had to scope down. How did you decide what to cut?",
    tip: "Cover what you cut, why, and how you communicated it to stakeholders." },
  { id: "beh-i03", category: "Behavioral", level: "Intermediate", type: "Behavioral",
    question: "Tell me about a time you mentored or helped a less experienced developer.",
    tip: "Cover what they were stuck on, how you guided them, and what changed afterward." },
  { id: "beh-i04", category: "Behavioral", level: "Intermediate", type: "Behavioral",
    question: "Describe a time you had to explain something technical to a non-technical person.",
    tip: "Show the analogy you used and how you checked their understanding." },


  // ─────────────────────────────────────────────────────────
  //  ADVANCED  (30)
  // ─────────────────────────────────────────────────────────

  // System Design
  { id: "sd-a01", category: "System Design", level: "Advanced", type: "Technical",
    question: "Walk me through how you'd design a URL shortener.",
    tip: "Cover the API, storage, short-code generation, collisions, and how you'd scale reads." },
  { id: "sd-a02", category: "System Design", level: "Advanced", type: "Technical",
    question: "Design a real-time chat application for ten million daily active users.",
    tip: "Cover protocol choice, fan-out, presence, message storage, and delivery guarantees." },
  { id: "sd-a03", category: "System Design", level: "Advanced", type: "Technical",
    question: "Walk me through how you'd architect a news feed like Twitter's.",
    tip: "Cover fan-out on read vs. write, cache layers, hot accounts, and ranking." },
  { id: "sd-a04", category: "System Design", level: "Advanced", type: "Technical",
    question: "How would you design a rate limiter for a public API?",
    tip: "Cover algorithms (token bucket, leaky bucket), per-user vs. global, and where to enforce it." },
  { id: "sd-a05", category: "System Design", level: "Advanced", type: "Technical",
    question: "Design a caching layer for a read-heavy site with bursty updates.",
    tip: "Cover cache layers, invalidation strategies, stampede protection, and CDN behavior." },
  { id: "sd-a06", category: "System Design", level: "Advanced", type: "Technical",
    question: "Walk me through choosing a database for a new product. What questions do you ask first?",
    tip: "Read/write ratio, consistency needs, query patterns, scale targets, and operational comfort." },

  // Distributed Systems
  { id: "dist-a01", category: "Distributed Systems", level: "Advanced", type: "Technical",
    question: "Explain CAP theorem and how it shows up in real system decisions.",
    tip: "Pick a real database (Dynamo, Spanner, Postgres replicas) and explain where it lands." },
  { id: "dist-a02", category: "Distributed Systems", level: "Advanced", type: "Technical",
    question: "What does eventual consistency mean, and how do you build a product around it?",
    tip: "Cover read-your-writes, conflict resolution, and UX patterns like optimistic updates." },
  { id: "dist-a03", category: "Distributed Systems", level: "Advanced", type: "Technical",
    question: "How does leader election work, and where have you seen it used?",
    tip: "Touch on Raft or Paxos at a high level, plus practical systems like Kafka or Zookeeper." },

  // Performance
  { id: "perf-a01", category: "Performance", level: "Advanced", type: "Technical",
    question: "How would you design CDN and caching strategy for a global e-commerce site?",
    tip: "Cover edge caching, cache keys, personalization, purge strategy, and origin shield." },
  { id: "perf-a02", category: "Performance", level: "Advanced", type: "Technical",
    question: "Walk me through how you'd profile a performance regression in production.",
    tip: "Cover RUM, synthetic monitoring, flame graphs, and how you isolate the regression." },
  { id: "perf-a03", category: "Performance", level: "Advanced", type: "Technical",
    question: "What is your strategy for code splitting in a large frontend app?",
    tip: "Route-level vs. component-level, vendor splitting, prefetching, and measuring the payoff." },

  // Architecture
  { id: "arch-a01", category: "Architecture", level: "Advanced", type: "Technical",
    question: "Compare a monolith and microservices for a five-year-old startup that's scaling.",
    tip: "Team size, deployment friction, operational overhead, and where real service boundaries exist." },
  { id: "arch-a02", category: "Architecture", level: "Advanced", type: "Technical",
    question: "What are micro-frontends, and when are they worth the complexity?",
    tip: "Cover team autonomy, deployment independence, runtime integration, and the real coordination cost." },
  { id: "arch-a03", category: "Architecture", level: "Advanced", type: "Technical",
    question: "When does a monorepo help, and when does it hurt?",
    tip: "Cover shared tooling, atomic refactors, build performance, and code ownership." },

  // Security
  { id: "sec-a01", category: "Security", level: "Advanced", type: "Technical",
    question: "How do you prevent XSS in a modern frontend app?",
    tip: "Cover output escaping, dangerouslySetInnerHTML, CSP, and trusted types." },
  { id: "sec-a02", category: "Security", level: "Advanced", type: "Technical",
    question: "When would you use JWTs versus server sessions, and what are the security trade-offs?",
    tip: "Cover statelessness, revocation, storage, and CSRF/XSS surface." },
  { id: "sec-a03", category: "Security", level: "Advanced", type: "Technical",
    question: "How would you manage secrets across services in production?",
    tip: "Cover secret stores, rotation, scoping, and never-in-Git as a baseline." },

  // Databases
  { id: "db-a01", category: "Databases", level: "Advanced", type: "Technical",
    question: "Walk me through how you'd find and fix a slow query in production.",
    tip: "Cover EXPLAIN, index analysis, query rewriting, and when caching is the right answer." },
  { id: "db-a02", category: "Databases", level: "Advanced", type: "Technical",
    question: "When would you shard a database, and how do you choose a shard key?",
    tip: "Cover hot spots, cross-shard queries, resharding pain, and consistency implications." },
  { id: "db-a03", category: "Databases", level: "Advanced", type: "Technical",
    question: "What are the trade-offs between relational and document databases for a new product?",
    tip: "Cover query patterns, schema evolution, joins, and operational maturity." },

  // DevOps & Infrastructure
  { id: "devops-a01", category: "DevOps & Infrastructure", level: "Advanced", type: "Technical",
    question: "Walk me through containerizing a Node.js app with Docker, with production in mind.",
    tip: "Cover multi-stage builds, small base images, non-root users, and signal handling." },
  { id: "devops-a02", category: "DevOps & Infrastructure", level: "Advanced", type: "Technical",
    question: "How would you design a CI/CD pipeline for a team shipping multiple times a day?",
    tip: "Cover trunk-based dev, gating tests, deploy strategies (blue-green, canary), and rollback." },
  { id: "devops-a03", category: "DevOps & Infrastructure", level: "Advanced", type: "Technical",
    question: "What does good observability look like, and what would you instrument first?",
    tip: "Cover logs, metrics, traces, and SLOs. Focus on signals that drive action." },

  // React
  { id: "react-a01", category: "React", level: "Advanced", type: "Technical",
    question: "Walk me through how React reconciliation works.",
    tip: "Cover the diffing algorithm, keys, and why list keys matter for correctness." },
  { id: "react-a02", category: "React", level: "Advanced", type: "Technical",
    question: "What does concurrent rendering give you, and what changes for component authors?",
    tip: "Cover transitions, Suspense for data, and why pure render functions matter." },

  // Node.js
  { id: "node-a01", category: "Node.js", level: "Advanced", type: "Technical",
    question: "How would you scale a Node.js service that's CPU-bound?",
    tip: "Cover clustering, worker threads, offloading, and when to move work out of Node entirely." },
  { id: "node-a02", category: "Node.js", level: "Advanced", type: "Technical",
    question: "Walk me through backpressure in a streaming Node pipeline.",
    tip: "Cover what backpressure is, how pipe handles it, and how it fails when ignored." },

  // Behavioral
  { id: "beh-a01", category: "Behavioral", level: "Advanced", type: "Behavioral",
    question: "Tell me about a technical decision you owned that turned out to be wrong. What did you learn?",
    tip: "Own it. Show the reasoning at the time, what changed, and how you operate differently now." },
  { id: "beh-a02", category: "Behavioral", level: "Advanced", type: "Behavioral",
    question: "Tell me about a time you led a project across multiple teams.",
    tip: "Cover how you handled scope, communication, and conflicting priorities across teams." }
];

window.INTERVIEW_QUESTIONS = INTERVIEW_QUESTIONS;

// Full master list. Practice.js will compute which categories appear for the
// selected level by reading INTERVIEW_QUESTIONS, so adding a question to a new
// category automatically surfaces it in the filter.
window.INTERVIEW_CATEGORIES = [
  "All",
  "HTML", "CSS", "JavaScript", "DOM", "Git",
  "React", "Tailwind", "Accessibility", "Testing",
  "TypeScript", "Node.js", "APIs", "State Management",
  "Performance", "Databases", "Next.js",
  "System Design", "Distributed Systems", "Architecture",
  "Security", "DevOps & Infrastructure",
  "Behavioral"
];

window.INTERVIEW_LEVELS = ["All", "Beginner", "Intermediate", "Advanced"];
