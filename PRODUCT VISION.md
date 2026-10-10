# Product Strategy & Architecture Challenge: Build a Production-Grade AI Harness Engineering IDE

## Your Role

Act as a world-class Principal AI Architect, Staff Software Engineer, developer-tools product strategist, distributed-systems architect, and product designer with deep expertise in:

- Agentic AI and harness engineering
- AI coding agents and agent-specific configuration systems
- Developer IDEs, code editors, and collaborative development environments
- Real-time multiplayer editing and distributed state synchronization
- Knowledge engineering, documentation-as-code, and dependency management
- Git, version control, branching, merging, and change management
- AI-assisted software engineering, automated validation, and agent orchestration
- Enterprise software architecture, governance, observability, and scalability

Think like an engineer who has built and operated production-grade developer platforms, not someone proposing another AI chatbot or documentation editor.

Your task is to conceive, architect, and plan a new category of developer tool: an **AI-native Harness Engineering IDE** designed specifically for creating, evolving, validating, maintaining, and collaboratively engineering AI coding-agent harnesses at scale.

Be ambitious about the product vision, rigorous about technical feasibility, and brutally honest about unnecessary complexity.

---

## 1. Background: The Problem I Have Personally Experienced

I have built an AI harness that supports agentic engineering workflows. Through this experience, I have identified several problems that existing development and collaboration tools do not adequately solve.

### Problem A: Multiple coding agents, shared underlying concepts

Different coding agents and environments, including Claude, Genie, and Antigravity, can have different configuration structures, file conventions, instruction formats, capabilities, and integration requirements.

However, much of the underlying harness knowledge remains conceptually consistent.

For example, the same engineering intent may need to be expressed differently depending on the target agent, even though the underlying rule, workflow, architectural decision, or domain knowledge is unchanged.

This creates a need to distinguish between:

- The canonical, agent-independent representation of harness knowledge.
- Agent-specific representations and configuration files.
- Agent capabilities and compatibility requirements.
- The transformations required to generate, validate, and maintain each representation.

I want to investigate whether harnesses should be authored using a canonical intermediate representation, a structured knowledge model, a graph, or another suitable abstraction, with agent-specific configurations generated from it.

Do not assume that a universal representation is always possible. Investigate where abstraction works, where agent-specific exceptions are necessary, and how to avoid losing agent-native capabilities.

### Problem B: Harness development resembles collaborative writing and software engineering simultaneously

Building a harness as a team is fundamentally different from editing a Google Doc or contributing to a conventional codebase.

Harnesses contain interdependent instructions, domain knowledge, architectural decisions, workflows, reusable capabilities, constraints, references, and agent-specific configurations.

One contributor may change a rule, while another modifies a dependent workflow. Both changes might be individually correct but collectively inconsistent.

Contributors need to understand not just what changed, but why it changed, what it affects, whether it conflicts with another decision, and whether the change remains valid across supported agents.

Traditional document collaboration is too weak for managing complex dependencies and engineering constraints. Traditional Git-based workflows provide valuable version control and review, but can introduce friction when several contributors need to make coordinated changes in real time or near real time.

Git must remain an important consideration, but I want you to investigate how it could be complemented by richer semantic collaboration, structured change management, automated impact analysis, and potentially live collaborative editing.

Do not assume that Git should be replaced. Determine which responsibilities belong to Git and which require a new collaboration layer.

### Problem C: A harness continues evolving after its initial creation

Creating the first working harness is only the beginning.

Its captured knowledge changes as the team uses it. New edge cases emerge, agent capabilities change, architectural decisions evolve, and previously valid assumptions become obsolete.

A seemingly small change may require updates to dependent instructions, examples, templates, generated configurations, validation rules, or documentation.

This creates several challenges:

- Discovering dependencies between knowledge components.
- Identifying the downstream effects of a change.
- Preventing contradictory or outdated instructions.
- Tracking the origin and rationale of knowledge.
- Knowing which agent configurations must be regenerated.
- Validating whether changes preserve existing behavior.
- Managing deprecated, superseded, or uncertain knowledge.
- Keeping contributors aligned while the harness evolves.

The tool must treat harness maintenance as an ongoing engineering lifecycle, not a one-time content-generation activity.

### Problem D: Traceability and team contributions become difficult at scale

When multiple engineers contribute to a harness, it becomes difficult to reconstruct:

- Who changed a particular rule or instruction.
- Why the change was made.
- Which evidence justified it.
- Which architectural decision it implements.
- Which other components depend on it.
- Which agent configurations were affected.
- Whether the change was validated.
- Who reviewed or approved it.
- Which versions of the harness contain it.
- Whether a production issue can be traced to a specific change.

I want traceability to be a core architectural capability, not an audit log added after the product is built.

---

## 2. Product Vision

Conceptualize a production-grade, AI-enabled Harness Engineering IDE.

Think of the product as potentially combining capabilities from:

- A code editor or IDE.
- A collaborative document editor.
- Git and structured code review.
- An AI agent development environment.
- A knowledge graph and dependency explorer.
- A configuration compiler and compatibility manager.
- An automated testing and validation platform.
- A governance, provenance, and auditability system.

However, do not simply combine these tools into a bloated application.

Identify the underlying jobs that engineers are trying to perform, the gaps in existing workflows, and the smallest coherent product architecture that solves those problems exceptionally well.

The experience should feel like an IDE purpose-built for harness engineering, rather than a document editor with AI features or a conventional IDE with a chatbot attached.

The product should enable teams to author, understand, collaborate on, test, version, publish, and continuously improve harnesses as structured engineering assets.

Treat harnesses as living, executable, versioned systems of knowledge, instructions, policies, workflows, and agent-specific artifacts.

This is a hypothesis to investigate, not a predetermined architectural truth.

---

## 3. Your First Responsibility: Investigate the Problem Before Designing the Solution

Before proposing features or architecture, conduct a rigorous problem analysis.

Identify the fundamental problems underlying the experiences described above.

Distinguish between:

1. Root causes.
2. Symptoms.
3. Existing solutions that partially address the problem.
4. Problems that genuinely require new capabilities.
5. Problems that could be solved more simply through process changes or existing tools.

Investigate the current ecosystem of AI coding-agent configuration, harness engineering, developer IDEs, collaborative editing, version control, AI agent development platforms, and knowledge-management systems.

Use current, credible sources when researching existing products, standards, frameworks, and technical approaches. Prefer official documentation and primary sources where available.

Clearly distinguish verified capabilities from assumptions and your own recommendations.

Examine relevant approaches such as:

- Git-based workflows and semantic diffs.
- Real-time collaborative editing and operational transformation or CRDTs.
- Structured documents and typed knowledge models.
- Abstract syntax trees and intermediate representations.
- Dependency graphs and impact analysis.
- Agent configuration generation and validation.
- Policy-as-code and automated quality gates.
- Knowledge provenance and versioned evidence.
- AI-assisted code review and change proposals.
- Test-driven development and regression evaluation.

These are candidate approaches, not mandatory features. Evaluate their suitability rather than adopting them indiscriminately.

Produce a problem taxonomy that explains which technical or organizational mechanism addresses each problem.

---

## 4. Define the Product's Core Abstraction

Determine what the fundamental unit of a harness should be.

Should it be a file, document, instruction, rule, workflow, capability, knowledge component, policy, dependency, structured object, or a combination of these?

Design a suitable conceptual model that can represent:

- Instructions and agent rules.
- Domain and project knowledge.
- Architectural decisions.
- Workflows and procedures.
- Tools and capabilities.
- Constraints and policies.
- Examples and reference materials.
- Dependencies between components.
- Agent-specific configuration mappings.
- Tests and evaluation criteria.
- Ownership and review requirements.
- Provenance, evidence, and version history.

Explain how these components relate to one another.

Determine whether a graph-based model, a structured document model, a file-first model, or a hybrid architecture provides the best balance of flexibility, usability, portability, and maintainability.

Address a critical design question:

**How can engineers preserve the simplicity and expressiveness of writing natural-language instructions while gaining the structure, dependency awareness, validation, and traceability of a software engineering system?**

Avoid forcing every piece of knowledge into an unnecessarily rigid schema.

Define which information should remain free-form text, which should be structured, and which should be represented as explicit relationships or executable rules.

Explain the canonical source of truth and how generated files relate to it.

---

## 5. Design the Agent Compatibility and Generation System

Develop an architecture for supporting multiple AI coding agents and their evolving configuration conventions.

The system should distinguish between shared harness intent and agent-specific implementation details.

Investigate how it could:

1. Define agent-independent knowledge and behavior.
2. Maintain agent-specific adapters or generators.
3. Discover supported capabilities and limitations.
4. Map canonical components to native agent configuration formats.
5. Preserve features that exist only in a particular agent.
6. Detect unsupported or lossy translations.
7. Validate generated configurations against the target agent's requirements.
8. Track which generated artifacts are stale after a change.
9. Support agent-specific overrides without creating uncontrolled duplication.
10. Adapt to changes in agent capabilities and configuration formats.

Use Claude, Genie, and Antigravity as initial examples, but verify their current capabilities and configuration conventions instead of assuming they are interchangeable.

Define what happens when an agent cannot express a particular instruction or capability.

Determine whether the correct behavior is to reject the configuration, issue a warning, use an explicitly documented fallback, or require a manual override.

Explain how the system could add future agents without requiring a redesign of the core architecture.

---

## 6. Design the Collaboration Model

Treat team collaboration as a first-class engineering problem.

The product should support engineers contributing simultaneously or near simultaneously to the same harness.

Explore the following requirements:

### Live collaboration

- Concurrent editing.
- Presence indicators and collaborator cursors where useful.
- Live updates to structured knowledge.
- Conflict detection and resolution.
- Safe handling of concurrent semantic changes.
- Clear ownership of in-progress work.
- A distinction between private drafts, shared drafts, and published versions.

### Semantic collaboration

A text-level diff is not always enough.

For example, two contributors might change different files that encode the same underlying rule, or modify separate components that depend on one another.

Investigate how the system could detect:

- Conflicting instructions.
- Duplicate or contradictory knowledge.
- Overlapping architectural decisions.
- Incompatible dependency changes.
- Concurrent edits to the same semantic component.
- Changes that invalidate another contributor's work.

Explain which conflicts can be detected automatically and which require human judgment.

### Collaboration workflows

Design workflows for:

- Individual contributions.
- Shared workspaces.
- Branches or isolated change sets.
- Change proposals.
- Reviews and approvals.
- Integration of concurrent changes.
- Rollbacks.
- Conflict resolution.
- Publishing a validated version.

Determine whether to extend Git, integrate with Git, or create an abstraction over Git.

Specify how the product preserves compatibility with existing repositories and standard developer workflows.

Do not promise seamless real-time collaboration across arbitrary Git repositories without explaining the synchronization and consistency model.

---

## 7. Design AI-Assisted Harness Engineering

AI should be a core engineering capability rather than a generic chat panel.

Identify high-value AI interactions throughout the harness lifecycle.

Investigate capabilities such as:

### Authoring assistance

- Convert natural-language requirements into structured harness components.
- Draft instructions and workflows.
- Suggest reusable knowledge components.
- Generate agent-specific configurations.
- Improve clarity, consistency, and completeness.

### Understanding assistance

- Explain a harness component in context.
- Explain why a rule exists.
- Trace a rule to its sources and decisions.
- Summarize dependencies.
- Explain the consequences of a proposed change.

### Maintenance assistance

- Detect contradictory instructions.
- Identify outdated or unsupported assumptions.
- Find duplicate knowledge.
- Detect broken references.
- Propose updates to dependent components.
- Identify stale generated artifacts.
- Suggest migrations when an agent's configuration format changes.

### Review assistance

- Explain a change semantically.
- Identify likely regressions.
- Compare intended behavior before and after a change.
- Check consistency with architectural decisions.
- Recommend targeted tests.
- Generate a review summary with supporting evidence.

### Usage-driven improvement

Investigate whether the product can learn from actual harness usage, including validation failures, recurring agent mistakes, human corrections, and successful outcomes.

It must distinguish evidence from speculation.

The system must not silently rewrite authoritative harness knowledge based on a single model-generated suggestion.

Design an explicit process for proposing, validating, reviewing, and incorporating changes derived from usage.

For every major AI feature, explain:

1. The user problem.
2. The required inputs.
3. The AI operation.
4. The tools and context required.
5. The output.
6. How correctness is evaluated.
7. How the user reviews or overrides the result.
8. How the action is recorded for traceability.

---

## 8. Design Dependency Management and Change Impact Analysis

This is one of the product's most important capabilities.

Model the harness as a system of interconnected components.

When a component changes, the tool should determine what may need to be reviewed, regenerated, tested, or reapproved.

For example:

A change to a database-migration rule might affect:

- Several migration workflows.
- A shared reference document.
- An agent-specific instruction.
- Generated configurations for two agents.
- Multiple regression tests.
- An approval policy.

Design a dependency system that can represent relationships such as:

- Depends on.
- References.
- Implements.
- Overrides.
- Generated from.
- Validated by.
- Supersedes.
- Conflicts with.
- Derived from.
- Approved by.

Define how dependency relationships are discovered, created, validated, and maintained.

Distinguish explicit dependencies from relationships inferred by AI.

Design a change-impact engine that can answer:

- What will this change affect?
- Why is each component affected?
- Which changes are mandatory?
- Which are recommendations?
- Which artifacts need regeneration?
- Which tests must be rerun?
- Which approvals become invalid?
- Can this change be safely merged or published?

Address transitive dependencies, circular references, stale relationships, and large dependency graphs.

Avoid automatically modifying every dependent component. Prefer proposed change sets with explanations, previews, and appropriate review requirements.

---

## 9. Make Traceability a Core Product Capability

Design an end-to-end provenance and auditability model.

The system should be able to reconstruct the history of a harness component and its downstream effects.

Consider the following chain:

Business requirement → architectural decision → harness component → agent-specific artifact → validation result → reviewer approval → published version → observed outcome.

Determine how to represent and query this chain.

The product should support questions such as:

- Who introduced this rule?
- Why does it exist?
- Which requirement does it satisfy?
- What evidence supports it?
- Which components depend on it?
- Which generated configurations contain it?
- Which tests validate it?
- Who approved the change?
- Which version was deployed?
- What changed between two versions?
- Which production failures may be related to this change?

Design immutable or tamper-evident audit records where justified, while keeping normal version history and collaborative editing practical.

Explain how traceability works across Git commits, semantic change sets, AI-generated suggestions, human approvals, generated artifacts, and external agent environments.

Define how the product handles sensitive data, secrets, access control, and audit retention.

---

## 10. Design the Product Experience and IDE

Translate the architecture into an intuitive, high-quality product experience.

The product should feel purpose-built for harness engineers.

Explore an IDE layout that may include:

- A repository or harness explorer.
- A structured editor with syntax-aware editing.
- A visual dependency graph.
- An agent compatibility and configuration panel.
- An AI engineering assistant.
- A semantic diff and change-impact panel.
- A collaboration and review interface.
- A validation and regression-testing panel.
- A provenance and audit timeline.
- A publishing and version-management interface.

Do not assume every panel belongs on the main screen.

Design the information architecture around actual engineering tasks.

Specify the core user journeys for:

1. Creating a harness from scratch.
2. Importing an existing harness from Git.
3. Connecting an existing repository to the canonical knowledge model.
4. Supporting a new coding agent.
5. Editing shared knowledge collaboratively.
6. Reviewing the downstream impact of a change.
7. Resolving conflicting changes.
8. Validating and publishing a harness version.
9. Investigating a regression.
10. Recovering or rolling back a problematic change.

For each journey, explain the interaction sequence, the information displayed, and how the product prevents common mistakes.

Optimize for developer productivity, clarity, low cognitive overhead, and confidence in the resulting harness.

---

## 11. Define the Technical Architecture

Propose a realistic, production-grade architecture.

Cover the following areas where appropriate:

- Frontend and editor framework.
- Backend and API architecture.
- Canonical harness data model.
- File storage and repository integration.
- Git synchronization.
- Real-time collaboration.
- Conflict resolution.
- Dependency graph storage and traversal.
- AI orchestration and model integration.
- Agent adapters and configuration generation.
- Validation and evaluation infrastructure.
- Background jobs and event processing.
- Database and persistence.
- Search and retrieval.
- Authentication and authorization.
- Audit logging and provenance.
- Observability and cost monitoring.
- Deployment and infrastructure.
- Multi-tenant isolation and enterprise governance.

Recommend concrete technologies only after explaining the requirements and trade-offs.

For each major architectural decision, provide:

- The proposed choice.
- Why it fits the problem.
- Alternatives considered.
- Limitations.
- Scaling implications.
- Migration or replacement strategy if the choice becomes unsuitable.

Use architecture diagrams, data-flow diagrams, state diagrams, and component diagrams where they materially improve understanding.

Explicitly distinguish the minimum viable architecture from the architecture needed at enterprise scale.

Avoid premature microservices, unnecessary databases, and technologies chosen merely because they are fashionable.

---

## 12. Define Reliability, Security, and Governance

Specify how the product should handle:

- Concurrent updates and consistency.
- Lost updates and conflicting edits.
- Partial failures.
- Stale generated configurations.
- Failed validation.
- Invalid dependency relationships.
- AI-generated incorrect changes.
- Unauthorized publication.
- Malicious instructions embedded in imported content.
- Repository and credential security.
- Data leakage between tenants.
- Recovery after service interruption.
- Audit integrity.
- Backward compatibility.
- Version migrations.
- Reproducible builds and generation.

Define what must be deterministic and what may rely on AI-based interpretation.

Critical operations such as authorization, approval enforcement, version binding, and publishing eligibility should use deterministic controls wherever practical.

Establish measurable reliability and security objectives rather than describing the product as merely secure or scalable.

---

## 13. Establish a Product Roadmap

Produce a phased implementation plan that prioritizes the most valuable capabilities without attempting to build everything simultaneously.

Consider the following candidate phases, but revise them if a better sequence emerges:

### Phase 0: Discovery and technical validation

- Validate the underlying problem.
- Analyze existing harness structures.
- Test the canonical representation hypothesis.
- Evaluate collaboration and Git integration approaches.
- Build technical prototypes for the highest-risk assumptions.

### Phase 1: Core harness editor

- Import and edit an existing harness.
- Establish the canonical model.
- Support agent-specific generation.
- Provide structured validation.
- Maintain basic version history.

### Phase 2: Collaborative engineering

- Shared workspaces.
- Concurrent editing.
- Semantic change sets.
- Review and approval workflows.
- Improved Git integration.

### Phase 3: Dependency intelligence

- Dependency graph.
- Change-impact analysis.
- Stale artifact detection.
- Targeted regression testing.
- Consistency checks.

### Phase 4: AI-native maintenance

- AI-assisted authoring and review.
- Contradiction detection.
- Proposed dependent updates.
- Usage-driven improvement.
- Provenance-aware reasoning.

### Phase 5: Enterprise readiness

- Governance.
- Fine-grained permissions.
- Multi-tenant deployment.
- Audit and compliance features.
- Scalability and operational monitoring.

For every phase, specify:

- Scope.
- User value.
- Features.
- Dependencies.
- Engineering complexity.
- Major risks.
- Acceptance criteria.
- Exit criteria.
- What must deliberately remain out of scope.

Identify which capabilities are essential to prove the product's value and which should wait.

---

## 14. Define Success Metrics

Propose measurable product and engineering metrics.

Consider:

- Time required to create a new harness.
- Time required to add support for a new agent.
- Time required to review and merge a change.
- Frequency of unresolved collaboration conflicts.
- Number of inconsistencies detected before publication.
- Percentage of generated configurations that pass validation.
- Frequency of stale artifacts.
- Time required to identify downstream impact.
- Regression rate after harness changes.
- Traceability coverage.
- Percentage of AI-suggested changes accepted after review.
- Time required to investigate a production issue.
- Cost per successful harness change.

Define meaningful baseline measurements and targets only where there is enough evidence. Where evidence is missing, explain how to establish the baseline rather than inventing arbitrary targets.

---

## 15. Challenge the Idea and Identify What Could Make It Fail

Do not simply agree with the product vision.

Act as a skeptical technical founder and architecture reviewer.

Evaluate:

- Whether this is a genuinely distinct product category.
- Whether existing IDEs, Git workflows, documentation platforms, or agent frameworks already solve significant portions of the problem.
- Whether a canonical representation creates more value than complexity.
- Whether real-time collaboration is necessary for the first version.
- Whether a semantic dependency graph can remain accurate at scale.
- Whether AI-generated dependency updates are safe enough.
- Whether teams would adopt a new IDE or prefer a Git-compatible extension.
- Whether the product should be a standalone application, an IDE extension, a web platform, or a hybrid.
- Whether the target user is an individual harness engineer, a platform team, or an enterprise AI engineering organization.
- Whether the product can deliver measurable value before every capability is implemented.

Identify the three biggest technical risks, the three biggest product risks, and the three assumptions that should be tested first.

Compare at least three plausible product strategies and recommend one, explaining the trade-offs.

---

## 16. Required Deliverables

Organize your final response into the following sections:

1. **Executive summary:** The product in one clear paragraph.
2. **Problem analysis:** Root causes, symptoms, and existing gaps.
3. **Product thesis:** The core insight and differentiated value.
4. **Target users and jobs to be done:** Who uses the product and why.
5. **Core abstractions:** The data model and canonical source of truth.
6. **Agent compatibility architecture:** Shared knowledge and agent-specific generation.
7. **Collaboration architecture:** Live editing, semantic changes, Git, and conflict resolution.
8. **AI capabilities:** Authoring, maintenance, review, and usage-driven improvement.
9. **Dependency and impact engine:** Relationships, change propagation, and validation.
10. **Traceability model:** Provenance, audit records, and version lineage.
11. **IDE experience:** Information architecture and critical user journeys.
12. **Technical architecture:** Components, technologies, interfaces, and data flows.
13. **Security and reliability:** Controls, failure modes, and operational requirements.
14. **Implementation roadmap:** Phases, priorities, dependencies, and acceptance criteria.
15. **Evaluation framework:** Product metrics, quality metrics, and testing strategy.
16. **Risks and trade-offs:** What could fail and how to mitigate it.
17. **First 30 days:** A concrete plan for validating and beginning implementation.
18. **Final recommendation:** What to build first, what not to build yet, and why.

Include Mermaid diagrams where useful, representative data schemas where necessary, and concrete examples rather than relying on generic product-management language.

Make explicit recommendations instead of presenting endless lists of equally plausible options.

---

## 17. Standards for the Response

Follow these rules throughout the analysis:

- Think from first principles.
- Be technically rigorous and product-minded.
- Research current tools and standards when the answer depends on their actual capabilities.
- Cite sources for important external claims.
- Separate facts, assumptions, hypotheses, and recommendations.
- Explain complex concepts clearly without sacrificing architectural depth.
- Prefer the smallest coherent architecture over unnecessary complexity.
- Address failure modes and operational realities.
- Treat traceability, collaboration, and dependency management as core product concerns.
- Preserve Git compatibility unless a compelling technical reason justifies an alternative.
- Do not assume all agent configurations can be represented identically.
- Do not assume AI can safely automate every maintenance operation.
- Avoid generic feature lists, shallow startup advice, and technology name-dropping.
- Do not start by generating code. First establish the product thesis, architecture, and validation strategy.

The ultimate goal is to produce a **decision-ready product and architecture blueprint** that can guide a serious engineering team toward building a differentiated, scalable, AI-native Harness Engineering IDE.

The result should make it clear what the product is, why it needs to exist, how it should work, how it differs from existing tools, what should be built first, and how the system can remain reliable as harnesses, teams, and AI agents continuously evolve.