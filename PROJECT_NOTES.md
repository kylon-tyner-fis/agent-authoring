# Project Roadmap & UX Considerations

## UI/UX Improvements
- **Edge-Aware Dropdowns**: Implement logic to ensure dropdowns open upwards or sideways if there is insufficient space below the trigger.
- **Model Configuration Styling**: Enhance the visual design of dropdown triggers used for AI model selection/configuration.
- **Entity Gradients**: Standardize the use of premium gradients across all entity types (Agents, Orchestrators, Tools, etc.), not just Skills.
- **Archive Exploration**: Add a dedicated interface or filter to view and restore archived entities (skills, etc.).
- **Publishing Diffs**: Generate an automated "diff" summary when an entity is published. This should use an LLM or user input to explain what changed since the last version.
- **Cross-Entity Versioning**: Extend the versioning system currently used for Skills to all other major entities (Agents, Orchestrators).

## Feature Requests
- **Value Node**: Implement a new node type in the orchestration canvas that allows:
  - Pulling a value directly from the global state schema.
  - Inputting a hard-coded static value.
- **Implicit State Schema**: Explore the possibility of removing the explicit state schema definition. Investigate if the schema can be implicitly derived from the union of all node inputs and outputs while maintaining mapping capabilities.
- **Pre-Save File Management**: Allow users to create or add files/artifacts to an Agent before the initial save (may require an auto-save trigger).
- **Validation Gating**: Defer strict skill/orchestrator validation until the "Publish" phase. Allow users to save their work in an "invalid" or "draft" state to facilitate iterative building.

## UX Considerations
- **First-Time User Experience (FTUE)**:
  - Optimize the dashboard for new users.
  - **Empty State CTAs**: When an entity count (e.g., Tools) is 0, replace the static "Configured" text with a prominent "Create your first [Entity]" button.
- **User Journey Mapping**: Map out the end-to-end journey for both "Authoring" (building the agent) and "Toolkit Usage" (the end-user/teacher experience).

## Architectural Notes
- **Client-Side MCP**: Allow orchestrators to receive and utilize MCP connections provided by the client runtime.
- **Artifact-Centric Uploads**: Move away from generic "reference file" uploads in the authoring environment; shift toward an "artifact upload" paradigm.
- **System Awareness**: Ensure the Orchestrator has context on how the system (client) operates.
- **Component Decoupling**: Move Tools and MCP server configuration out of the main "System Composer" to reduce complexity.

## Domain Hierarchy
The project follows this structural hierarchy:
`Org` -> `Workspaces` -> `Projects` -> `Orchestrators` -> `Agents` -> `Skills` -> `Tools + MCPs`
