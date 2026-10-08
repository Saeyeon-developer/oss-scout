# Domain: video editing, processing and generation pipelines

Anchors were written from memory in 2026 and are starting points only.
Verify their current status with `inspect`.

## Vocabulary

video editor, NLE, non-linear editor, timeline, multitrack, EDL, OTIO /
OpenTimelineIO, rough cut, auto-edit, jump cut, silence removal, scene detection,
shot boundary, B-roll, captions/subtitles (SRT, ASS, VTT), burn-in, transitions,
keyframes, compositing, motion graphics, programmatic video, video as code,
render farm, transcoding, proxy, FFmpeg GUI/wrapper/filtergraph, WebCodecs,
"CapCut/Premiere/Final Cut/DaVinci alternative", "<NLE> scripting API".

## Where to look

- Engines and libraries: FFmpeg, GStreamer, MLT Framework, libopenshot, PyAV, ffmpeg.wasm, WebCodecs-based libs
- Desktop editors: Shotcut and Kdenlive (MLT), OpenShot, Olive, Blender VSE, LosslessCut
- Programmatic/"video as code": Remotion, Motion Canvas (and its fork Revideo), editly, MoviePy
- Automation: auto-editor (silence cuts), PySceneDetect (scene detection), OpenTimelineIO (timeline interchange)
- Scripting of commercial NLEs: DaVinci Resolve scripting API, Premiere UXP/ExtendScript, Final Cut FCPXML
- Registries: npm (Remotion ecosystem), PyPI (`moviepy`, `av`, `scenedetect`)
- Agent-driven editors are a fast-moving, hype-prone niche. Expect many young repos; verify each.

## Proof terms

Timeline model: `track`, `clip`, `in_point`/`inPoint`, `out_point`, `trim`, `ripple`, `undo`, `keyframe`.
Rendering: `ffmpeg`, `filter_complex`, `-filter_complex`, `VideoEncoder`, `avcodec`, `render(`, `export`.
Interchange: `otio`, `opentimelineio`, `fcpxml`, `edl`.
Agent surface: `tools/list`, `inputSchema` (MCP), REST routes, CLI subcommands, a JSON timeline schema.

## Gotchas

- **Licensing**: FFmpeg's license depends on build flags (LGPL by default, GPL
  with x264/x265 and similar). MLT apps are GPL. Codecs such as H.264/HEVC have patent pools.
- "AI video editor" often means a script that calls an LLM and then FFmpeg once.
  Check for a real timeline model (multi-track, undo, re-render) versus one-shot pipelines.
- Preview performance and frame accuracy are where hobby editors fail. Look
  for issues about A/V sync, variable frame rate and seeking.
- Platform: many agent-editors are macOS-only (Swift/AVFoundation) or browser-only.
  Check against the user's OS early.
- An open timeline format (OTIO, FCPXML) lets you INTEGRATE with a pro NLE instead of
  BUILDing an editor. Consider that path explicitly.
