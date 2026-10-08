# Domain: reverse engineering and binary analysis

Anchors were written from memory in 2026 and are starting points only.
Verify their current status with `inspect`. Scope this to lawful work: the user's own
software, interoperability, security research, and CTFs.

## Vocabulary

disassembler, decompiler, binary analysis, static analysis, dynamic
instrumentation, debugger, emulation, symbolic execution, firmware analysis,
APK/IPA analysis, .NET decompiler, IL/CIL, Java bytecode, Electron/asar
extraction, protocol reverse engineering, packet capture, file-format reversing,
binary diffing, signatures (YARA, FLIRT), headless analysis, "<tool> MCP",
"<tool> scripting API", agent-assisted reverse engineering.

## Where to look

- Frameworks: Ghidra (NSA, Apache-2.0), radare2 / rizin (+ Cutter GUI), angr (symbolic), Binary Ninja and IDA Pro (commercial, scriptable)
- Instrumentation and debugging: Frida, x64dbg, GDB plus extensions (GEF, pwndbg)
- Libraries: Capstone (disassembly), Unicorn (emulation), Keystone (assembly), LIEF (binary formats)
- Mobile and managed code: jadx and apktool (Android), ILSpy and dnSpyEx (.NET), JD-GUI/CFR (Java)
- Triage: Detect It Easy, binwalk (firmware), YARA
- Agent integration: MCP bridges for Ghidra and IDA exist in several independent
  repos, and broader agent toolkits (e.g. morluto/rea) wrap several backends.
  Compare which backend each one needs and whether it is free.
- Communities: awesome-reverse-engineering lists, CTF write-ups (they show which tools people actually use)

## Proof terms

Ghidra: `ghidra.app`, `FlatProgramAPI`, `DecompInterface`, `analyzeHeadless`.
IDA: `idaapi`, `ida_funcs`, `idc.`, `ida_hexrays`.
radare2/rizin: `r2pipe`, `rzpipe`, `cmdj(`.
Binary Ninja: `binaryninja`, `BinaryView`.
Frida: `Interceptor.attach`, `frida.attach`, `Java.perform`.
Formats: `ELF`, `PE`, `Mach-O`, `lief.parse`, `capstone.Cs(`.

## Gotchas

- **Backend dependency**: many tools need a commercial backend (IDA, Hopper,
  Binary Ninja). "Open source" may mean only the glue. Check what the user owns.
- Headless mode matters for agents: can it run without a GUI, and what is the
  latency per query?
- Platform: some instrumentation is OS-specific (process capture, kernel drivers).
- Legal: respect EULAs and anti-circumvention laws. Analysis of third-party
  software should stay within interoperability/research exceptions.
- Running samples is dangerous. Combined with OSS Scout's no-execution rule:
  never run a target binary or a cloned tool outside a sandbox VM.
