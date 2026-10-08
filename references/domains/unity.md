# Domain: Unity game development

Anchors were written from memory in 2026 and are starting points only.
Verify their current status with `inspect`.

## Vocabulary

Unity package, UPM, OpenUPM, Unity asset, editor extension, editor tool, runtime
library, `<feature> for Unity`, Unity3D, URP/HDRP/Built-in, DOTS/ECS, Netcode,
Addressables, ScriptableObject, inspector attributes, dependency injection,
async/await (UniTask), tweening, state machine, behaviour tree, dialogue system,
procedural generation, pathfinding (A*, navmesh), save system, localization,
Unity MCP, Unity editor automation, Unity AI agent.

## Where to look

- OpenUPM (https://openupm.com): open-source UPM packages with GitHub links. Usually the best first stop.
- GitHub topics: `unity`, `unity3d`, `unity-package`, `upm-package`, `unity-editor`
- Curated: "awesome unity" lists
- Unity's own org (github.com/Unity-Technologies): official samples, ML-Agents, Netcode samples
- Well-known OSS anchors: UniTask, VContainer, Extenject/Zenject, Mirror and
  FishNet (networking), NaughtyAttributes, UniRx/R3, MessagePipe
- Unity Asset Store: often the incumbent, but **not open source**. Note it as an
  alternative and flag its license separately.
- Agent control of the Unity Editor: several independent "unity-mcp" projects
  exist. Compare tool coverage and supported Unity versions.

## Proof terms

Package: `package.json` with a `"unity"` field, `.asmdef`, `Runtime/`, `Editor/`, `Samples~`.
Editor automation: `[MenuItem`, `EditorWindow`, `AssetDatabase`, `EditorApplication`, `[InitializeOnLoad]`.
Runtime: `MonoBehaviour`, `ScriptableObject`, `ISystem` (DOTS), `NetworkBehaviour`.
Tests: `[Test]`, `[UnityTest]`, `Tests/Runtime`, `Tests/Editor`.

## Gotchas

- **Unity version and render pipeline compatibility** is the top failure. Check the
  `"unity"` field, `ProjectSettings/ProjectVersion.txt` and URP/HDRP requirements.
- IL2CPP/AOT and platform support (WebGL, mobile, consoles). Reflection-heavy libs can break.
- Asset Store EULA versus OSS licenses. Assets can't be redistributed in public repos.
- Many repos are whole sample *projects*, not packages. Extracting the code is a
  FORK/STUDY, not a USE.
- `probe` skips Unity's `Library/` and binary assets. Read `.cs`, `.asmdef` and `package.json`.
