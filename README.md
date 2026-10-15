# Trace Fix AI

**AI-Powered Software Workflow Failure Explorer**

Trace Fix AI is an interactive workflow-diagnosis simulator for exploring software pipeline failures and comparing alternative paths through a dependency graph. It helps developers visualize how a diagnostic search proceeds, inspect the states it explores, and understand the path selected under different search strategies.

The application focuses on three algorithms—**Breadth-First Search (BFS), Uniform-Cost Search (UCS), and A* Search**—with an emphasis on transparent execution traces rather than opaque recommendations.

> **Simulation notice:** The included workflows, failure evidence, transition costs, and outcomes are illustrative scenarios. They are not connected to a real production system. A displayed candidate cause or recovery path is a result within the configured simulation, not a verified diagnosis of a live incident.

---

## At a glance

| | |
|---|---|
| **Application** | Interactive software workflow simulator |
| **Primary use** | Explore failure paths and compare diagnostic search strategies |
| **Algorithms** | BFS, UCS, A* |
| **Frontend** | React, TypeScript, TanStack Start |
| **Styling** | Tailwind CSS |
| **Runtime and tooling** | Vite, Bun/npm-compatible scripts |
| **Scenario and run storage** | Browser-local storage |
| **External AI service required** | No |

## Key capabilities

- **Interactive workflow graph** — inspect workflow stages, dependencies, transitions, and weighted edges.
- **Scenario-driven investigation** — load a prepared failure scenario and explore its diagnostic state space.
- **Step-by-step execution** — inspect the algorithm's recorded events, frontier, explored states, and selected path.
- **Three search strategies** — compare breadth-first, least-cost, and heuristic-guided exploration.
- **Path and performance metrics** — inspect path length, accumulated cost where applicable, explored states, and runtime.
- **Workflow editing** — configure nodes, transitions, transition costs, and start/goal states where supported by the current interface.
- **Run history and exports** — review saved browser-local runs and export available report formats.
- **Local-first operation** — run the simulator without credentials for a third-party LLM or production monitoring service.

## How the algorithms differ

### Breadth-First Search (BFS)

BFS explores a graph level by level using a FIFO queue. It finds a path with the fewest edges when the graph is treated as unweighted. It does **not** generally minimize a sum of differing transition costs.

### Uniform-Cost Search (UCS)

UCS expands the lowest accumulated-cost state first, using a priority queue. With non-negative edge costs and correct graph-search handling, it finds a minimum-cost path when a solution is reached under the algorithm's completeness assumptions.

### A* Search

A* prioritizes states using

`f(n) = g(n) + h(n)`

where `g(n)` is the cost accumulated so far and `h(n)` estimates the remaining cost to the goal. Its optimality depends on the state model, implementation, and heuristic properties; an arbitrary heuristic does not automatically guarantee an optimal answer.

### Interpreting results fairly

BFS, UCS, and A* optimize different criteria or use different guidance. Compare them on the same scenario, start state, goal state, and transition graph. Treat runtime as a measurement from the current browser and machine—not as a universal performance guarantee.

---

## Getting started

### Prerequisites

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/) **or** a compatible Node.js/npm installation
- A modern browser

### 1. Clone the repository

```bash
git clone https://github.com/rohanv2007/trace-fix-ai.git
cd trace-fix-ai
```

### 2. Install dependencies

Using Bun:

```bash
bun install
```

Or using npm:

```bash
npm install
```

### 3. Start the development server

Using Bun:

```bash
bun run dev
```

Or using npm:

```bash
npm run dev
```

Open the local URL printed by the development server.

### 4. Create a production build

```bash
bun run build
```

Or:

```bash
npm run build
```

To serve the generated build locally with Vite:

```bash
bun run preview
```

The project scripts are defined in `package.json`. Use the package manager and lockfile that match your development environment; avoid mixing package managers unnecessarily.

---

## Testing and code quality

Run the automated test suite:

```bash
bun run test
```

Run the linter:

```bash
bun run lint
```

Format the source code with the repository's Prettier configuration:

```bash
bun run format
```

Use the same commands with `npm run` when working with npm.

**Documentation note:** These are the project's available scripts; this README does not assert that the tests, linter, or production build pass in every environment. Run them after cloning and review any reported failures.

## Project structure

The codebase is a TypeScript/React application. Key areas include:

```text
trace-fix-ai/
├── src/
│   ├── lib/
│   │   ├── algorithms/   # Search implementations
│   │   ├── scenarios.ts  # Scenario graph definitions
│   │   └── store.ts      # Browser-local application state
│   ├── routes/           # Application routes and views
│   └── test/             # Automated tests
├── public/               # Static assets
├── package.json          # Scripts and dependencies
├── vite.config.ts        # Vite configuration
├── vitest.config.ts      # Test configuration
└── README.md
```

The directory map above highlights the main areas relevant to the simulator; individual files may evolve as the application develops.

## Data, privacy, and limitations

- **Browser-local persistence:** Custom workflows, active scenario state, and run history are stored in the browser using local storage, according to the current project architecture. They do not automatically synchronize across browsers, devices, or users.
- **Illustrative scenarios:** Failure descriptions, logs, edge costs, and outcomes supplied with the simulator are examples designed for controlled demonstrations.
- **No production remediation:** The simulator does not execute real deployment commands, restart services, modify production configuration, or establish that a real system has been repaired.
- **No live observability by default:** The project does not require a connection to external CI/CD, logging, cloud, or incident-management platforms.
- **Measurement variability:** Browser timing measurements can be very small and affected by hardware, browser scheduling, and runtime conditions. Use node and path metrics alongside timing when comparing algorithms.
- **Algorithm assumptions matter:** Results are only as reliable as the graph, edge costs, goal definition, and—when using A*—the heuristic and its stated assumptions.

## Development principles

Trace Fix AI is designed around three principles:

1. **Inspectable decisions** — show the route and exploration trace rather than presenting a result without context.
2. **Reproducible comparisons** — keep scenario inputs consistent when comparing algorithms.
3. **Honest scope** — distinguish simulated evidence from live telemetry, measured results from illustrative data, and implemented behavior from future integrations.

## Roadmap

Potential future improvements include:

- Persisted server-side workspaces and collaboration.
- Import adapters for approved CI/CD logs and workflow definitions.
- Additional scenario formats and graph-validation options.
- Expanded accessibility and keyboard-first graph navigation.
- Benchmark export improvements and reproducible experiment bundles.

These are possible extensions, not claims about functionality already delivered.

## Contributing

For a change, keep algorithm logic separate from rendering components, add or update tests when search behavior changes, and verify the simulator against representative scenarios. Prefer focused pull requests that explain the behavior being changed and how it was validated.

## License

No license is specified in this repository at the time this README was written. Unless a license is added, standard copyright restrictions apply; do not assume the project is open source or available for unrestricted reuse.

---

**Repository:** [rohanv2007/trace-fix-ai](https://github.com/rohanv2007/trace-fix-ai)  
**Built with:** React · TypeScript · TanStack Start · Tailwind CSS · Vite · Vitest
