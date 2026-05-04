# AGENTS.md: Project Context & Philosophy

## 🎯 The Core Mission

> "To provide a visual, state-aware environment for building, debugging, and deploying modular agentic systems using LangGraph."

---

## 💡 The "Why" (The Reason for Existence)

**The Problem:**
Building complex AI agents using pure code makes it difficult to visualize state transitions, debug non-deterministic routing, and separate high-level planning from low-level execution logic.

**The Solution:**
This application introduces a strict **Agentic Taxonomy** that separates "Thinking" from "Doing":

- **Orchestrators and Agents** handle open-ended reasoning, planning, and task delegation.
- **Skills** handle predictable, deterministic, step-by-step workflows represented as directed graphs.
- **The Canvas** provides a visual interface to define these flows and map data between the global **State Schema** and individual nodes.

---

## 👤 The Human Element

**Who is this for?**

- **Primary User:** AI Engineers and Developers building reliable agentic workflows that require more than just a chat interface.
- **The Emotional Goal:** Moving the developer from "guessing why the agent failed" to "seeing exactly where the graph branched" through real-time execution traces.

---

## 🛠 Project Principles (The "Vibe")

- **State-First Design:** The application revolves around the **State Schema**. If data is not defined in the schema, the system cannot maintain it in memory across node transitions.
- **Managed Delegation:** Agents are **Managers**, not creators. They should never draft complex artifacts (like documents or code) directly in text; they must delegate these tasks to a specialized **Skill** or **Tool**.
- **Observability via Tracing:** Every execution must produce a clear trace of node completions and state updates so the user can verify logic in the Sandbox.
- **Connectivity via MCP:** The system uses the **Model Context Protocol** to integrate with external APIs and databases as modular tools without modifying the core runtime.

---

## 🚫 Non-Goals & Boundaries

- We are **not** building a general-purpose chatbot wrapper.
- We are **not** exporting raw Python code; we generate and execute **Compiled Manifests** that define the system's behavior.
- We do **not** support "black box" logic where state changes are hidden from the user during execution.

---

## 📖 Key Domain Concepts

_These terms define the specific vocabulary of the Agent Authoring platform:_

| Term             | Meaning in this Project                                                                    |
| :--------------- | :----------------------------------------------------------------------------------------- |
| **Orchestrator** | The high-level traffic controller that selects the best Agent for a user request.          |
| **Agent**        | An autonomous runtime instance that reasons and delegates tasks to assigned Skills.        |
| **Skill**        | A deterministic graph workflow following a fixed logic path to produce consistent results. |
| **Trigger**      | The entry point node that maps external input payloads into the graph's internal state.    |
| **Response**     | The terminal node that synthesizes the final output returned to the caller.                |
| **Interrupt**    | A Human-in-the-Loop pause point where the graph waits for manual feedback.                 |

---

### Instruction to the LLM

> "Before suggesting any architectural changes, feature additions, or UI refinements, read this file. Every line of code you write should serve the **Core Mission** and strictly adhere to the separation between **Reasoning Agents** and **Deterministic Skills**."
