# Domain: AI agents, agent frameworks and agent tooling

Anchors were written from memory in 2026 and are starting points only. This field
churns monthly, so verify their current status with `inspect` and prefer recent sources.

## Vocabulary

agent framework, multi-agent, orchestration, agent SDK, tool calling / function
calling, planner-executor, ReAct, workflow graph, state machine, durable
execution, memory (short/long-term, vector, episodic), RAG, browser agent,
computer use, coding agent, agent skills, subagents, evals, tracing/observability,
guardrails, human-in-the-loop, "<task> agent", "autonomous <task>", "<product> copilot".

## Where to look

- Vendor SDKs: Claude Agent SDK, OpenAI Agents SDK, Google ADK. Vendor docs list their official examples.
- Frameworks: LangGraph, CrewAI, AutoGen/AG2, smolagents, Pydantic AI, Mastra (TS), Agno, LlamaIndex, DSPy, Letta (memory)
- Task agents: OpenHands and Aider (coding), browser-use and Stagehand (browser)
- Skills and plugins: Anthropic's skills repos, skill registries (verify the original source and license; aggregators copy without scripts)
- Curated: "awesome ai agents" lists, framework comparison posts from the last 6 months
- Evals and observability: Langfuse, Phoenix (Arize), promptfoo, OpenTelemetry GenAI conventions

## Proof terms

Agent loop: `tool_use`, `tool_calls`, `function_call`, `while` plus `stop_reason`, `max_turns`, `handoff`.
State and durability: `checkpoint`, `checkpointer`, `resume`, `StateGraph`, `persist`.
Memory: `embedding`, `vector`, `retriev`, `summar`.
Safety: `approval`, `human_in_the_loop`, `interrupt`, `sandbox`, `allowlist`.
Evals: `eval`, `benchmark`, `golden`, `assert`.

## Gotchas

- **Hype is the norm here.** Viral demo repos with five-figure stars and no tests are common.
  Weight outside issue authors, merged outside PRs and releases heavily.
- Framework lock-in: heavy frameworks wrap simple loops. For many tasks the
  vendor SDK plus a small loop is the better INTEGRATE choice; STUDY the framework for patterns.
- Model coupling: check which providers and models are supported, and whether
  examples depend on deprecated model IDs or APIs.
- Benchmarks in READMEs are usually self-reported. Look for independent reproductions.
- Skill and prompt repos: the value is in the instructions and scripts. Check that
  the scripts referenced by a SKILL.md actually exist in the repo.
