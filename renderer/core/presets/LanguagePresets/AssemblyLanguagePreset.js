import {
  createSyntaxDefinition,
  createSyntaxState,
  createSyntaxStateRule,
  createSyntaxRuleAction,
  createSyntaxCaptureMap,
  createSymbolRegister,
  createSyntaxStateTransition,
  createDynamicEnd,
  createHighlightStyle,
  createTokenStyle,
  createPredefinedSymbol,
  findRootSyntaxState,
  RuleType,
  PatternType,
  TokenType,
  TransitionType,
  RegisterScope,
  OnUnmatched,
} from '@data/SyntaxDefinitionManager.js';

// ─── Custom token types ───────────────────────────────────────────────────────

const TOKEN_TYPE_REGISTER    = 'register';
const TOKEN_TYPE_INSTRUCTION = 'instruction';
const TOKEN_TYPE_DIRECTIVE   = 'directive';
const TOKEN_TYPE_LABEL_DEF   = 'label_def';
const TOKEN_TYPE_LABEL_REF   = 'label_ref';
const TOKEN_TYPE_SECTION     = 'section';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addRule(syntaxState, name, setup) {
  const rule = createSyntaxStateRule(name);
  setup(rule);
  syntaxState.rules.push(rule);
  return rule;
}

function newState(def, name) {
  const s = createSyntaxState(name);
  def.states.push(s);
  return s;
}

// ─── Main factory ─────────────────────────────────────────────────────────────

export function createAssemblyLanguage() {
  const def = createSyntaxDefinition('Assembly');
  def.id      = 'Assembly';
  def.aliases = ['asm', 'nasm', 'gas', 'masm', 'fasm', 'att', 'arm', 'aarch64', 'riscv', 'x86', 'x86_64'];
  def.builtIn = true;
  def.symbolHoisting = true;
  def.exampleCode = EXAMPLE_CODE;

  const root        = findRootSyntaxState(def);
  root.onUnmatched  = OnUnmatched.CHARACTER;

  // ── Inner states ────────────────────────────────────────────────────────────
  const strDouble   = newState(def, 'string_double');
  const strSingle   = newState(def, 'string_single');
  const strEscape   = newState(def, 'string_escape');

  strDouble.onUnmatched = OnUnmatched.CHARACTER;
  strSingle.onUnmatched = OnUnmatched.CHARACTER;

  // ── Escape sequences inside strings ─────────────────────────────────────────
  for (const st of [strDouble, strSingle]) {
    addRule(st, 'escape', r => {
      r.type        = RuleType.MATCH;
      r.patternType = PatternType.REGEX;
      r.pattern     = /\\(?:[abfnrtvz\\'"0]|x[0-9a-fA-F]{1,2}|[0-7]{1,3})/.source;
      const a = createSyntaxRuleAction();
      a.tokenType   = TokenType.ESCAPE;
      r.action      = a;
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ROOT RULES  (order = priority — first match wins)
  // ══════════════════════════════════════════════════════════════════════════════

  // ── Comments ─────────────────────────────────────────────────────────────
  //   Supports: ; … (NASM/MASM), # … (GAS/ARM), // … (LLVM-MCA hints), @ … (ARM GAS)
  addRule(root, 'comment_line', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /(?:;|#|\/\/|@(?=\s)).*/.source;
    const a = createSyntaxRuleAction();
    a.tokenType   = TokenType.COMMENT;
    r.action      = a;
  });

  // C-style block comment used in GAS / LLVM IR embedded asm
  addRule(root, 'comment_block', r => {
    r.type         = RuleType.BEGIN_END;
    r.begin        = /\/\*/.source;
    r.end          = /\*\//.source;
    r.beginAction  = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.COMMENT; return a; })();
    r.endAction    = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.COMMENT; return a; })();
    r.contentTokenType = TokenType.COMMENT;
    r.innerStateId = newState(def, 'block_comment').id;
    def.states[def.states.length - 1].onUnmatched = OnUnmatched.CHARACTER;
  });

  // ── Label definitions  (identifier: or .local_label:) ────────────────────
  addRule(root, 'label_def', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /(?:^\s*|(?<=\n)\s*)(?:\.|[A-Za-z_$?@][A-Za-z0-9_$?@.]*)(?=\s*:)/.source;
    const a       = createSyntaxRuleAction();
    a.tokenType   = TOKEN_TYPE_LABEL_DEF;
    a.register    = { tokenType: TOKEN_TYPE_LABEL_REF, scope: RegisterScope.GLOBAL };
    r.action      = a;
  });

  // Colon after label (punctuation, separate token so label text stays clean)
  addRule(root, 'label_colon', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /(?<=[A-Za-z0-9_$?@.]):/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.PUNCTUATION; r.action = a;
  });

  // ── Section / segment directives ─────────────────────────────────────────
  addRule(root, 'section_keyword', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    // Matches well-known ELF/PE section names (.text, .data, .bss, …) and the
    // bare NASM/MASM 'section' / 'segment' keyword when followed by whitespace.
    // Must come BEFORE directives_dot so these get TOKEN_TYPE_SECTION, not DIRECTIVE.
    r.pattern     = /(?:\.(?:text|data|bss|rodata|code|const|stack|heap|init|fini|plt|got|tdata|tbss|eh_frame|debug\w*|section|segment)(?=\s|$)|(?<!\.)(?:section|segment)(?=\s))/i.source;
    const a = createSyntaxRuleAction(); a.tokenType = TOKEN_TYPE_SECTION; r.action = a;
  });

  // ── Macro definitions with name capture — MUST come first! ───────────────
  //   These rules match  "%macro Name"  /  "Name MACRO"  /  ".macro name"  as a
  //   whole so the name gets its own capture group and is registered in the symbol
  //   table.  They must sit BEFORE the generic directive rules, because the lexer
  //   is first-match-wins: if directives_percent fires first it eats "%macro" and
  //   the name is never seen by a capture rule.

  // NASM:  %macro PRINT_STR 2
  addRule(root, 'nasm_macro_def', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern     = /(%macro)\s+([A-Za-z_.$?@][A-Za-z0-9_.$?@]*)/.source;
    const cap = createSyntaxCaptureMap();
    cap.groups['1'] = { tokenType: TOKEN_TYPE_DIRECTIVE, register: null };
    cap.groups['2'] = {
      tokenType: TokenType.FUNCTION,
      register:  createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL),
    };
    const a = createSyntaxRuleAction();
    a.captures = cap;
    r.action = a;
  });

  // MASM:  MyMacro MACRO  /  MyProc PROC
  addRule(root, 'masm_macro_def', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern     = /\b([A-Za-z_.$?@][A-Za-z0-9_.$?@]*)\s+(MACRO|PROC)\b/.source;
    const cap = createSyntaxCaptureMap();
    cap.groups['1'] = {
      tokenType: TokenType.FUNCTION,
      register:  createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL),
    };
    cap.groups['2'] = { tokenType: TOKEN_TYPE_DIRECTIVE, register: null };
    const a = createSyntaxRuleAction();
    a.captures = cap;
    r.action = a;
  });

  // GAS:  .macro my_macro
  addRule(root, 'gas_macro_def', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern     = /(\.macro)\s+([A-Za-z_.$?@][A-Za-z0-9_.$?@]*)/.source;
    const cap = createSyntaxCaptureMap();
    cap.groups['1'] = { tokenType: TOKEN_TYPE_DIRECTIVE, register: null };
    cap.groups['2'] = {
      tokenType: TokenType.FUNCTION,
      register:  createSymbolRegister(TokenType.FUNCTION, RegisterScope.GLOBAL),
    };
    const a = createSyntaxRuleAction();
    a.captures = cap;
    r.action = a;
  });

  // ── NASM/FASM %-directives (generic fallback after macro-def rules) ──────
  //   IMPORTANT: PatternType.KEYWORDS compiles to \b…\b which does NOT match
  //   before non-word chars like '%', so these must be REGEX rules.
  addRule(root, 'directives_percent', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /%(?:endmacro|endrep|elifndef|elifdef|elifn?def|ifndef|assign|define|include|undef|ifdef|elseif|elif|else|endif|macro|push|pop|rotate|rep|use|if)\b/i.source;
    const a = createSyntaxRuleAction(); a.tokenType = TOKEN_TYPE_DIRECTIVE; r.action = a;
  });

  // ── GAS / ARM / RISC-V / AVR dot-directives (.globl, .cfi_*, …) ─────────
  //   Same issue: \b before '.' doesn't work → REGEX rule.
  //   Must come AFTER gas_macro_def so ".macro name" is handled by the capture rule.
  addRule(root, 'directives_dot', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.caseInsensitive = true;
    r.pattern = /\.(?:ascii|asciz|string|byte|short|word|long|quad|float|double|single|octa|fill|space|zero|skip|balignl?w?|p2align|globl?|local|hidden|protected|internal|extern|comm|lcomm|weak(?:ref)?|set|equiv|equ|eqv|type|size|file|ident|version|include|incbin|macro|endm|irpc?|rept|endr|ifc?|ifnc?|ifdef|ifndef|ifeq|ifne|ifg[et]|ifl[et]|else(?:if)?|endif|err(?:or)?|warning|print|pushsection|popsection|previous|cfi_startproc|cfi_endproc|cfi_def_cfa(?:_offset|_register)?|cfi_(?:rel_)?offset|cfi_restore(?:_state)?|cfi_remember_state|cfi_same_value|cfi_escape|cfi_signal_frame|cfi_undefined|cfi_adjust_cfa_offset|cfi_personality|cfi_lsda|fnstart|fnend|save|vsave|cantunwind|handlerdata|thumb_func|thumb_set|arm|thumb|code|syntax|cpu|fpu|arch|object_arch|req|unreq|dn|qn|ltorg|option|attribute|insn|device|cseg|dseg|eseg|def|undef|overlap|nooverlap|listmac?|nolistmac?|message|model|stack|const|radix)\b/i.source;
    const a = createSyntaxRuleAction(); a.tokenType = TOKEN_TYPE_DIRECTIVE; r.action = a;
  });

  // ── Plain-word directives (NASM / MASM — \b works fine for alpha-only) ───
  addRule(root, 'directives_word', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern     = [
      'db', 'dw', 'dd', 'dq', 'dt', 'do', 'dy', 'dz',
      'resb', 'resw', 'resd', 'resq', 'rest', 'reso', 'resy', 'resz',
      'equ', 'times', 'align', 'alignb',
      'global', 'extern', 'common', 'static',
      'bits', 'use16', 'use32', 'use64',
      'struc', 'endstruc', 'istruc', 'iend',
      'org', 'incbin',
      'proc', 'endp', 'endm', 'local', 'label',
      'assume', 'public', 'extrn', 'ends',
      'segment',
      'ife', 'ifz', 'ifdifi', 'ifidn',
    ];
    const a = createSyntaxRuleAction(); a.tokenType = TOKEN_TYPE_DIRECTIVE; r.action = a;
  });

  // ── x86 / x86-64 instructions ────────────────────────────────────────────
  addRule(root, 'instructions_x86', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern     = [
      // ── Data transfer ────────────────────
      'mov', 'movabs', 'movbe', 'movsx', 'movsxd', 'movzx',
      'movs', 'movsb', 'movsw', 'movsd', 'movsq',
      'cmovb', 'cmovc', 'cmovnb', 'cmovnc', 'cmovae',
      'cmove', 'cmovz', 'cmovne', 'cmovnz',
      'cmovl', 'cmovnge', 'cmovge', 'cmovnl',
      'cmovle', 'cmovng', 'cmovg', 'cmovnle',
      'cmovs', 'cmovns', 'cmovo', 'cmovno',
      'cmovp', 'cmovpe', 'cmovnp', 'cmovpo',
      'cmova', 'cmovnbe', 'cmovbe', 'cmovna',
      'xchg', 'xadd', 'cmpxchg', 'cmpxchg8b', 'cmpxchg16b',
      'bswap', 'xlat', 'xlatb',
      'push', 'pop', 'pusha', 'popa', 'pushad', 'popad', 'pushf', 'popf', 'pushfd', 'popfd', 'pushfq', 'popfq',
      'lea', 'lds', 'les', 'lfs', 'lgs', 'lss',
      'lods', 'lodsb', 'lodsw', 'lodsd', 'lodsq',
      'stos', 'stosb', 'stosw', 'stosd', 'stosq',
      'ins', 'insb', 'insw', 'insd',
      'outs', 'outsb', 'outsw', 'outsd',
      // ── Arithmetic ───────────────────────
      'add', 'adc', 'sub', 'sbb', 'mul', 'imul', 'div', 'idiv',
      'inc', 'dec', 'neg', 'not',
      'and', 'or', 'xor',
      'shl', 'shr', 'sal', 'sar', 'rol', 'ror', 'rcl', 'rcr',
      'shld', 'shrd',
      'aaa', 'aad', 'aam', 'aas', 'daa', 'das',
      'cbw', 'cwd', 'cwde', 'cdq', 'cdqe', 'cqo',
      // ── Comparison / test ────────────────
      'cmp', 'test', 'bt', 'bts', 'btr', 'btc',
      'bsf', 'bsr', 'tzcnt', 'lzcnt', 'popcnt',
      // ── Control flow ─────────────────────
      'jmp', 'call', 'ret', 'retf', 'retn', 'iret', 'iretd', 'iretq',
      'je', 'jz', 'jne', 'jnz',
      'jl', 'jnge', 'jge', 'jnl',
      'jle', 'jng', 'jg', 'jnle',
      'jb', 'jc', 'jnb', 'jnc', 'jae',
      'jbe', 'jna', 'ja', 'jnbe',
      'js', 'jns', 'jo', 'jno',
      'jp', 'jpe', 'jnp', 'jpo',
      'jcxz', 'jecxz', 'jrcxz',
      'loop', 'loope', 'loopz', 'loopne', 'loopnz',
      // ── String operations ─────────────────
      'rep', 'repe', 'repz', 'repne', 'repnz',
      'scas', 'scasb', 'scasw', 'scasd', 'scasq',
      'cmps', 'cmpsb', 'cmpsw', 'cmpsd', 'cmpsq',
      // ── Stack frame ──────────────────────
      'enter', 'leave',
      // ── Misc / privileged ────────────────
      'nop', 'hlt', 'wait', 'pause', 'ud2', 'cpuid',
      'int', 'int1', 'int3', 'into', 'bound',
      'in', 'out',
      'sti', 'cli', 'stc', 'clc', 'cmc', 'std', 'cld', 'stac', 'clac',
      'syscall', 'sysenter', 'sysexit', 'sysret',
      'lgdt', 'lidt', 'lldt', 'ltr', 'sgdt', 'sidt', 'sldt', 'str',
      'lmsw', 'smsw', 'clts',
      'invd', 'wbinvd', 'invlpg', 'invpcid',
      'rdmsr', 'wrmsr', 'rdpmc', 'rdtsc', 'rdtscp',
      'xsave', 'xrstor', 'xsaveopt', 'xgetbv', 'xsetbv',
      'lock', 'mfence', 'lfence', 'sfence',
      'prefetch', 'prefetchw', 'prefetchnta',
      'prefetcht0', 'prefetcht1', 'prefetcht2',
      'clflush', 'clflushopt', 'clwb',
      'endbr32', 'endbr64',
      // ── Set byte on condition ─────────────
      'sete', 'setz', 'setne', 'setnz',
      'setl', 'setnge', 'setge', 'setnl',
      'setle', 'setng', 'setg', 'setnle',
      'setb', 'setc', 'setnb', 'setnc', 'setae',
      'setbe', 'setna', 'seta', 'setnbe',
      'sets', 'setns', 'seto', 'setno',
      'setp', 'setpe', 'setnp', 'setpo',
      // ── x87 FPU ──────────────────────────
      'fld', 'fst', 'fstp', 'fild', 'fist', 'fistp', 'fisttp',
      'fbld', 'fbstp',
      'fxch',
      'fadd', 'fadds', 'faddp', 'fiadd',
      'fsub', 'fsubr', 'fsubp', 'fsubrp', 'fisub', 'fisubr',
      'fmul', 'fmulp', 'fimul',
      'fdiv', 'fdivr', 'fdivp', 'fdivrp', 'fidiv', 'fidivr',
      'fcom', 'fcomp', 'fcompp', 'fucom', 'fucomp', 'fucompp',
      'fcomi', 'fcomip', 'fucomi', 'fucomip',
      'ftst', 'fxam', 'fstsw', 'fnstsw', 'fstcw', 'fldcw', 'fstenv', 'fldenv',
      'fsave', 'frstor', 'fxsave', 'fxrstor',
      'fabs', 'fchs', 'fsqrt', 'fscale', 'fprem', 'fprem1',
      'frndint', 'fxtract', 'fyl2x', 'fyl2xp1', 'fldl2e', 'fldl2t',
      'fldlg2', 'fldln2', 'fld1', 'fldz', 'fldpi',
      'f2xm1', 'fpatan', 'fptan', 'fsin', 'fcos', 'fsincos',
      'finit', 'fninit', 'fclex', 'fnclex',
      'ffree', 'ffreep', 'fnop',
      // ── SSE / SSE2 / SSE3 / SSE4 ─────────
      'movaps', 'movups', 'movapd', 'movupd', 'movss', 'movsd',
      'movlps', 'movhps', 'movlpd', 'movhpd',
      'movntps', 'movntpd', 'movntdq', 'movnti', 'movntq',
      'movdqa', 'movdqu', 'movdq2q', 'movq2dq',
      'movd', 'movq',
      'addps', 'addpd', 'addss', 'addsd',
      'subps', 'subpd', 'subss', 'subsd',
      'mulps', 'mulpd', 'mulss', 'mulsd',
      'divps', 'divpd', 'divss', 'divsd',
      'sqrtps', 'sqrtpd', 'sqrtss', 'sqrtsd',
      'maxps', 'maxpd', 'maxss', 'maxsd',
      'minps', 'minpd', 'minss', 'minsd',
      'cmpps', 'cmppd', 'cmpss', 'cmpsd',
      'comiss', 'ucomiss', 'comisd', 'ucomisd',
      'cvtsi2ss', 'cvtsi2sd', 'cvtss2si', 'cvtsd2si',
      'cvttss2si', 'cvttsd2si', 'cvtss2sd', 'cvtsd2ss',
      'cvtps2pd', 'cvtpd2ps', 'cvtps2dq', 'cvtpd2dq',
      'cvtdq2ps', 'cvtdq2pd', 'cvttps2dq', 'cvttpd2dq',
      'andps', 'andpd', 'andnps', 'andnpd',
      'orps', 'orpd', 'xorps', 'xorpd',
      'shufps', 'shufpd', 'unpcklps', 'unpckhps', 'unpcklpd', 'unpckhpd',
      'punpcklbw', 'punpcklwd', 'punpckldq', 'punpcklqdq',
      'punpckhbw', 'punpckhwd', 'punpckhdq', 'punpckhqdq',
      'packsswb', 'packssdw', 'packuswb', 'packusdw',
      'paddb', 'paddw', 'paddd', 'paddq', 'paddsb', 'paddsw', 'paddusb', 'paddusw',
      'psubb', 'psubw', 'psubd', 'psubq', 'psubsb', 'psubsw', 'psubusb', 'psubusw',
      'pmullw', 'pmulhw', 'pmulhuw', 'pmuld', 'pmuldq',
      'pand', 'pandn', 'por', 'pxor',
      'psllw', 'pslld', 'psllq', 'psrlw', 'psrld', 'psrlq', 'psraw', 'psrad',
      'pslldq', 'psrldq',
      'pcmpeqb', 'pcmpeqw', 'pcmpeqd', 'pcmpeqq',
      'pcmpgtb', 'pcmpgtw', 'pcmpgtd', 'pcmpgtq',
      'pminub', 'pminsb', 'pminuw', 'pminsw', 'pminud', 'pminsd',
      'pmaxub', 'pmaxsb', 'pmaxuw', 'pmaxsw', 'pmaxud', 'pmaxsd',
      'pavgb', 'pavgw',
      'psadbw', 'phaddw', 'phaddd', 'phsubw', 'phsubd',
      'phaddsw', 'phsubsw',
      'pmaddwd', 'pmaddubsw',
      'palignr', 'pshufb', 'pshufhw', 'pshuflw', 'pshufd',
      'insertps', 'extractps', 'blendps', 'blendpd', 'blendvps', 'blendvpd',
      'pinsrb', 'pinsrw', 'pinsrd', 'pinsrq',
      'pextrb', 'pextrw', 'pextrd', 'pextrq',
      'roundps', 'roundpd', 'roundss', 'roundsd',
      'dppd', 'dpps', 'mpsadbw',
      'pcmpestri', 'pcmpestrm', 'pcmpistri', 'pcmpistrm', 'pcmpgtq',
      'phminposuw', 'pmovsx', 'pmovzx',
      // ── AVX / AVX2 ───────────────────────
      'vmovaps', 'vmovups', 'vmovapd', 'vmovupd', 'vmovss', 'vmovsd',
      'vaddps', 'vaddpd', 'vaddss', 'vaddsd',
      'vsubps', 'vsubpd', 'vsubss', 'vsubsd',
      'vmulps', 'vmulpd', 'vmulss', 'vmulsd',
      'vdivps', 'vdivpd', 'vdivss', 'vdivsd',
      'vbroadcastss', 'vbroadcastsd', 'vbroadcastf128',
      'vinsertf128', 'vextractf128', 'vperm2f128',
      'vpermq', 'vpermd',
      'vgatherdps', 'vgatherdpd', 'vgatherqps', 'vgatherqpd',
      'vfmadd132ps', 'vfmadd213ps', 'vfmadd231ps',
      'vfmadd132pd', 'vfmadd213pd', 'vfmadd231pd',
      'vfmadd132ss', 'vfmadd213ss', 'vfmadd231ss',
      'vfmadd132sd', 'vfmadd213sd', 'vfmadd231sd',
      'vzeroupper', 'vzeroall',
      // ── MMX ──────────────────────────────
      'emms',
    ];
    const a = createSyntaxRuleAction(); a.tokenType = TOKEN_TYPE_INSTRUCTION; r.action = a;
  });

  // ── ARM / AArch64 instructions ───────────────────────────────────────────
  addRule(root, 'instructions_arm', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern     = [
      // Data processing
      'add', 'adds', 'adc', 'adcs', 'sub', 'subs', 'sbc', 'sbcs', 'rsb', 'rsbs', 'rsc',
      'and', 'ands', 'eor', 'eors', 'orr', 'orrs', 'orn', 'orns', 'bic', 'bics',
      'mul', 'muls', 'mla', 'mls', 'umull', 'umlal', 'smull', 'smlal',
      'sdiv', 'udiv',
      'lsl', 'lsr', 'asr', 'ror', 'rrx',
      'mov', 'movs', 'mvn', 'mvns', 'movw', 'movt',
      'neg', 'negs',
      'cmp', 'cmn', 'tst', 'teq',
      // Load / Store
      'ldr', 'ldrb', 'ldrh', 'ldrsb', 'ldrsh', 'ldrd', 'ldm', 'ldmia', 'ldmib', 'ldmda', 'ldmdb',
      'str', 'strb', 'strh', 'strd', 'stm', 'stmia', 'stmib', 'stmda', 'stmdb',
      'push', 'pop',
      'ldrex', 'strex', 'ldrexb', 'strexb', 'ldrexh', 'strexh', 'ldrexd', 'strexd',
      'clrex',
      // Branch
      'b', 'bl', 'bx', 'blx', 'bxj', 'cbz', 'cbnz', 'tbb', 'tbh',
      'beq', 'bne', 'blt', 'bgt', 'ble', 'bge', 'bcs', 'bcc', 'bhi', 'bls', 'bmi', 'bpl', 'bvs', 'bvc', 'bal',
      // AArch64
      'adr', 'adrp',
      'ldp', 'stp',
      'ldar', 'ldaur', 'stlr', 'stlur',
      'cas', 'casp', 'ldaxr', 'stlxr',
      'madd', 'msub', 'mneg',
      'smaddl', 'smsubl', 'smnegl', 'smulh',
      'umaddl', 'umsubl', 'umnegl', 'umulh',
      'extr', 'ubfx', 'sbfx', 'ubfiz', 'sbfiz', 'bfxil', 'bfi',
      'cls', 'clz', 'rbit', 'rev', 'rev16', 'rev32',
      'sxtb', 'sxth', 'sxtw', 'uxtb', 'uxth',
      'sys', 'sysl', 'ic', 'dc', 'at', 'tlbi',
      'hint', 'nop', 'yield', 'wfe', 'wfi', 'sev', 'sevl', 'isb', 'dsb', 'dmb',
      'msr', 'mrs',
      'svc', 'hvc', 'smc', 'brk', 'hlt',
      'ret', 'eret',
      // NEON/SIMD (AArch64)
      'fadd', 'fsub', 'fmul', 'fdiv', 'fabs', 'fneg', 'fsqrt',
      'fcmp', 'fcmpe', 'fccmp', 'fcsel',
      'fcvt', 'fcvtas', 'fcvtau', 'fcvtms', 'fcvtmu', 'fcvtns', 'fcvtnu', 'fcvtps', 'fcvtpu', 'fcvtzs', 'fcvtzu',
      'scvtf', 'ucvtf',
      'fmadd', 'fmsub', 'fnmadd', 'fnmsub', 'fmov',
      'fmin', 'fmax', 'fminnm', 'fmaxnm',
      'dup', 'ins', 'umov', 'smov',
      'ext', 'zip1', 'zip2', 'uzp1', 'uzp2', 'trn1', 'trn2', 'rev64', 'rev32', 'rev16',
      'tbl', 'tbx',
    ];
    const a = createSyntaxRuleAction(); a.tokenType = TOKEN_TYPE_INSTRUCTION; r.action = a;
  });

  // ── RISC-V instructions ───────────────────────────────────────────────────
  addRule(root, 'instructions_riscv', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern     = [
      // RV32I / RV64I base
      'lui', 'auipc',
      'jal', 'jalr',
      'beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu',
      'lb', 'lh', 'lw', 'ld', 'lbu', 'lhu', 'lwu',
      'sb', 'sh', 'sw', 'sd',
      'addi', 'slti', 'sltiu', 'xori', 'ori', 'andi', 'slli', 'srli', 'srai',
      'add', 'sub', 'sll', 'slt', 'sltu', 'xor', 'srl', 'sra', 'or', 'and',
      'fence', 'fence.i',
      'ecall', 'ebreak',
      'addiw', 'slliw', 'srliw', 'sraiw',
      'addw', 'subw', 'sllw', 'srlw', 'sraw',
      // M extension
      'mul', 'mulh', 'mulhsu', 'mulhu', 'div', 'divu', 'rem', 'remu',
      'mulw', 'divw', 'divuw', 'remw', 'remuw',
      // A extension
      'lr.w', 'sc.w', 'amoswap.w', 'amoadd.w', 'amoxor.w', 'amoand.w',
      'amoor.w', 'amomin.w', 'amomax.w', 'amominu.w', 'amomaxu.w',
      'lr.d', 'sc.d', 'amoswap.d', 'amoadd.d',
      // F/D extensions
      'flw', 'fsw', 'fmadd.s', 'fmsub.s', 'fnmsub.s', 'fnmadd.s',
      'fadd.s', 'fsub.s', 'fmul.s', 'fdiv.s', 'fsqrt.s',
      'fsgnj.s', 'fsgnjn.s', 'fsgnjx.s', 'fmin.s', 'fmax.s',
      'fcvt.w.s', 'fcvt.wu.s', 'fmv.x.w', 'feq.s', 'flt.s', 'fle.s',
      'fclass.s', 'fcvt.s.w', 'fcvt.s.wu', 'fmv.w.x',
      'fld', 'fsd', 'fadd.d', 'fsub.d', 'fmul.d', 'fdiv.d', 'fsqrt.d',
      // Pseudo-instructions
      'nop', 'li', 'mv', 'not', 'neg', 'negw', 'sext.w',
      'seqz', 'snez', 'sltz', 'sgtz',
      'beqz', 'bnez', 'blez', 'bgez', 'bltz', 'bgtz', 'bgt', 'ble', 'bgtu', 'bleu',
      'j', 'jr', 'ret', 'call', 'tail',
      'la', 'lla', 'lga',
      'csrr', 'csrw', 'csrs', 'csrc', 'csrwi', 'csrsi', 'csrci',
      // Zicsr
      'csrrw', 'csrrs', 'csrrc', 'csrrwi', 'csrrsi', 'csrrci',
    ];
    const a = createSyntaxRuleAction(); a.tokenType = TOKEN_TYPE_INSTRUCTION; r.action = a;
  });

  // ── x86 / x86-64 Registers ───────────────────────────────────────────────
  addRule(root, 'registers_x86', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern     = [
      // 64-bit general purpose
      'rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'rsp', 'rbp',
      'r8',  'r9',  'r10', 'r11', 'r12', 'r13', 'r14', 'r15',
      // 32-bit
      'eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'esp', 'ebp',
      'r8d', 'r9d', 'r10d', 'r11d', 'r12d', 'r13d', 'r14d', 'r15d',
      // 16-bit
      'ax',  'bx',  'cx',  'dx',  'si',  'di',  'sp',  'bp',
      'r8w', 'r9w', 'r10w', 'r11w', 'r12w', 'r13w', 'r14w', 'r15w',
      // 8-bit
      'al',  'ah',  'bl',  'bh',  'cl',  'ch',  'dl',  'dh',
      'sil', 'dil', 'spl', 'bpl',
      'r8b', 'r9b', 'r10b', 'r11b', 'r12b', 'r13b', 'r14b', 'r15b',
      // Instruction pointer
      'rip', 'eip', 'ip',
      // Flags
      'rflags', 'eflags', 'flags',
      // Segment
      'cs', 'ds', 'es', 'fs', 'gs', 'ss',
      // Control / debug / test
      'cr0', 'cr2', 'cr3', 'cr4', 'cr8',
      'dr0', 'dr1', 'dr2', 'dr3', 'dr6', 'dr7',
      // x87 FPU
      'st0', 'st1', 'st2', 'st3', 'st4', 'st5', 'st6', 'st7',
      'st(0)', 'st(1)', 'st(2)', 'st(3)', 'st(4)', 'st(5)', 'st(6)', 'st(7)',
      // MMX
      'mm0', 'mm1', 'mm2', 'mm3', 'mm4', 'mm5', 'mm6', 'mm7',
      // SSE XMM (0-31)
      'xmm0',  'xmm1',  'xmm2',  'xmm3',  'xmm4',  'xmm5',  'xmm6',  'xmm7',
      'xmm8',  'xmm9',  'xmm10', 'xmm11', 'xmm12', 'xmm13', 'xmm14', 'xmm15',
      'xmm16', 'xmm17', 'xmm18', 'xmm19', 'xmm20', 'xmm21', 'xmm22', 'xmm23',
      'xmm24', 'xmm25', 'xmm26', 'xmm27', 'xmm28', 'xmm29', 'xmm30', 'xmm31',
      // AVX YMM (0-31)
      'ymm0',  'ymm1',  'ymm2',  'ymm3',  'ymm4',  'ymm5',  'ymm6',  'ymm7',
      'ymm8',  'ymm9',  'ymm10', 'ymm11', 'ymm12', 'ymm13', 'ymm14', 'ymm15',
      'ymm16', 'ymm17', 'ymm18', 'ymm19', 'ymm20', 'ymm21', 'ymm22', 'ymm23',
      'ymm24', 'ymm25', 'ymm26', 'ymm27', 'ymm28', 'ymm29', 'ymm30', 'ymm31',
      // AVX-512 ZMM (0-31)
      'zmm0',  'zmm1',  'zmm2',  'zmm3',  'zmm4',  'zmm5',  'zmm6',  'zmm7',
      'zmm8',  'zmm9',  'zmm10', 'zmm11', 'zmm12', 'zmm13', 'zmm14', 'zmm15',
      'zmm16', 'zmm17', 'zmm18', 'zmm19', 'zmm20', 'zmm21', 'zmm22', 'zmm23',
      'zmm24', 'zmm25', 'zmm26', 'zmm27', 'zmm28', 'zmm29', 'zmm30', 'zmm31',
      // AVX-512 mask registers
      'k0', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7',
      // MXCSR / GDTR / IDTR
      'mxcsr', 'gdtr', 'idtr', 'ldtr', 'tr',
      // GAS percent-prefixed (matched as keyword boundary works because % is not \w)
      '%rax', '%rbx', '%rcx', '%rdx', '%rsi', '%rdi', '%rsp', '%rbp',
      '%r8',  '%r9',  '%r10', '%r11', '%r12', '%r13', '%r14', '%r15',
      '%eax', '%ebx', '%ecx', '%edx', '%esi', '%edi', '%esp', '%ebp',
      '%rip', '%eip',
    ];
    const a = createSyntaxRuleAction(); a.tokenType = TOKEN_TYPE_REGISTER; r.action = a;
  });

  // ── ARM registers ────────────────────────────────────────────────────────
  addRule(root, 'registers_arm', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern     = [
      // ARM 32-bit
      'r0',  'r1',  'r2',  'r3',  'r4',  'r5',  'r6',  'r7',
      'r8',  'r9',  'r10', 'r11', 'r12', 'r13', 'r14', 'r15',
      'sp', 'lr', 'pc', 'cpsr', 'spsr', 'apsr',
      // AArch64 general purpose (x0-x30, w0-w30)
      'x0',  'x1',  'x2',  'x3',  'x4',  'x5',  'x6',  'x7',
      'x8',  'x9',  'x10', 'x11', 'x12', 'x13', 'x14', 'x15',
      'x16', 'x17', 'x18', 'x19', 'x20', 'x21', 'x22', 'x23',
      'x24', 'x25', 'x26', 'x27', 'x28', 'x29', 'x30',
      'w0',  'w1',  'w2',  'w3',  'w4',  'w5',  'w6',  'w7',
      'w8',  'w9',  'w10', 'w11', 'w12', 'w13', 'w14', 'w15',
      'w16', 'w17', 'w18', 'w19', 'w20', 'w21', 'w22', 'w23',
      'w24', 'w25', 'w26', 'w27', 'w28', 'w29', 'w30',
      'xzr', 'wzr', 'xsp', 'wsp', 'fp',
      // FP/SIMD scalar: b0-b31, h0-h31, s0-s31, d0-d31, q0-q31
      'b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7',
      'h0', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7',
      's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7',
      'd0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7',
      'q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7',
      'v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7',
    ];
    const a = createSyntaxRuleAction(); a.tokenType = TOKEN_TYPE_REGISTER; r.action = a;
  });

  // ── RISC-V registers ─────────────────────────────────────────────────────
  addRule(root, 'registers_riscv', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern     = [
      // ABI names
      'zero', 'ra', 'sp', 'gp', 'tp',
      'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',
      's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11',
      't0', 't1', 't2', 't3', 't4', 't5', 't6',
      'fp',
      // Numeric names
      'x0',  'x1',  'x2',  'x3',  'x4',  'x5',  'x6',  'x7',
      'x8',  'x9',  'x10', 'x11', 'x12', 'x13', 'x14', 'x15',
      'x16', 'x17', 'x18', 'x19', 'x20', 'x21', 'x22', 'x23',
      'x24', 'x25', 'x26', 'x27', 'x28', 'x29', 'x30', 'x31',
      // FP registers
      'f0',  'f1',  'f2',  'f3',  'f4',  'f5',  'f6',  'f7',
      'f8',  'f9',  'f10', 'f11', 'f12', 'f13', 'f14', 'f15',
      'f16', 'f17', 'f18', 'f19', 'f20', 'f21', 'f22', 'f23',
      'f24', 'f25', 'f26', 'f27', 'f28', 'f29', 'f30', 'f31',
      'ft0', 'ft1', 'ft2', 'ft3', 'ft4', 'ft5', 'ft6', 'ft7',
      'fa0', 'fa1', 'fa2', 'fa3', 'fa4', 'fa5', 'fa6', 'fa7',
      'fs0', 'fs1', 'fs2', 'fs3', 'fs4', 'fs5', 'fs6', 'fs7',
      'fs8', 'fs9', 'fs10', 'fs11',
    ];
    const a = createSyntaxRuleAction(); a.tokenType = TOKEN_TYPE_REGISTER; r.action = a;
  });

  // ── Keywords (size specifiers, conditions, modifiers) ────────────────────
  addRule(root, 'keywords', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.KEYWORDS;
    r.caseInsensitive = true;
    r.pattern     = [
      // x86 size specifiers
      'byte', 'word', 'dword', 'qword', 'tword', 'oword', 'yword', 'zword',
      'ptr', 'far', 'near', 'short',
      // x86 NASM specials
      'strict', 'nosplit', 'rel', 'abs', 'wrt',
      // x86 segment overrides (bare)
      'cs', 'ds', 'es', 'fs', 'gs', 'ss',
      // ARM condition suffixes (standalone tokens in some syntaxes)
      'eq', 'ne', 'cs', 'cc', 'mi', 'pl', 'vs', 'vc', 'hi', 'ls', 'ge', 'lt', 'gt', 'le', 'al',
      // ARM shift types
      'lsl', 'lsr', 'asr', 'ror', 'rrx',
      // ARM load/store multiples
      'ia', 'ib', 'da', 'db', 'fd', 'fa', 'ed', 'ea',
      // RISC-V ABI specials
      'zero',
      // Common assembler modifiers
      'offset', 'type', 'sizeof', 'lengthof',
    ];
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.KEYWORD; r.action = a;
  });

  // ── Operators & punctuation ──────────────────────────────────────────────
  addRule(root, 'operators', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /[+\-*\/&|^~<>!%]=?|<<|>>/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.OPERATOR; r.action = a;
  });

  addRule(root, 'punctuation', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /[,\[\](){}.:]/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.PUNCTUATION; r.action = a;
  });

  // ── Numbers ──────────────────────────────────────────────────────────────
  addRule(root, 'number_hex', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    // Matches: 0xFF, 0xDEAD_BEEF, $FF (NASM), 0ABCDh (MASM trailing-h), FFh
    r.pattern     = /(?:0[xX][0-9a-fA-F][0-9a-fA-F_]*|\$[0-9a-fA-F][0-9a-fA-F_]*|(?<![.\w])[0-9][0-9a-fA-F]*[hH]\b)/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  addRule(root, 'number_bin', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    // 0b1010, 1010b (MASM), %1010 (NASM)
    r.pattern     = /(?:0[bB][01][01_]*|%[01][01_]*|[01]+[bB]\b)/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  addRule(root, 'number_oct', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /0[oOqQ][0-7][0-7_]*|[0-7]+[oOqQ]\b/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  addRule(root, 'number_float', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /\b\d[\d_]*\.[\d_]*(?:[eEpP][+-]?\d+)?[fF]?\b/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  addRule(root, 'number_int', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /\b\d[\d_]*\b/.source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.NUMBER; r.action = a;
  });

  
  addRule(root, 'identifier', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /[A-Za-z_.$?@][A-Za-z0-9_.$?@]*/.source;
    const a       = createSyntaxRuleAction();
    a.tokenType   = TokenType.IDENTIFIER;
    r.action      = a;
  });

  // ── Strings ──────────────────────────────────────────────────────────────
  addRule(root, 'string_double', r => {
    r.type         = RuleType.BEGIN_END;
    r.begin        = '"';
    r.end          = '"';
    r.beginAction  = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.STRING; a.transition = createSyntaxStateTransition(TransitionType.PUSH, strDouble.id); return a; })();
    r.endAction    = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.STRING; a.transition = createSyntaxStateTransition(TransitionType.POP); return a; })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strDouble.id;
  });

  addRule(root, 'string_single', r => {
    r.type         = RuleType.BEGIN_END;
    r.begin        = "'";
    r.end          = "'";
    r.beginAction  = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.STRING; a.transition = createSyntaxStateTransition(TransitionType.PUSH, strSingle.id); return a; })();
    r.endAction    = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.STRING; a.transition = createSyntaxStateTransition(TransitionType.POP); return a; })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = strSingle.id;
  });

  // Backtick string (some MASM variants)
  addRule(root, 'string_backtick', r => {
    r.type         = RuleType.BEGIN_END;
    r.begin        = '`';
    r.end          = '`';
    r.beginAction  = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.STRING; return a; })();
    r.endAction    = (() => { const a = createSyntaxRuleAction(); a.tokenType = TokenType.STRING; return a; })();
    r.contentTokenType = TokenType.STRING;
    r.innerStateId = newState(def, 'string_backtick').id;
    def.states[def.states.length - 1].onUnmatched = OnUnmatched.CHARACTER;
  });

  // Character literals  'A',  '\n'
  addRule(root, 'char_literal', r => {
    r.type        = RuleType.MATCH;
    r.patternType = PatternType.REGEX;
    r.pattern     = /'(?:\\.|[^'\\])'/. source;
    const a = createSyntaxRuleAction(); a.tokenType = TokenType.STRING; r.action = a;
  });

  def.predefinedSymbols = [
    createPredefinedSymbol('printf', TokenType.FUNCTION),
    createPredefinedSymbol('exit',   TokenType.FUNCTION),
    createPredefinedSymbol('malloc', TokenType.FUNCTION),
  ];

  return def;
}

export function createAssemblyLanguageStyles(asmDef) {
  // ─── Highlight Style: Dark ─────────────────────────────────────────────────
  const darkStyle = createHighlightStyle(asmDef.id, 'Dark');
  darkStyle.builtIn = true;
  darkStyle.tokenStyles = [
    // Custom token types
    createTokenStyle(TOKEN_TYPE_INSTRUCTION, '#c586c0'),       // purple   — instructions
    createTokenStyle(TOKEN_TYPE_REGISTER,    '#4fc1ff'),       // cyan     — registers
    createTokenStyle(TOKEN_TYPE_DIRECTIVE,   '#9cdcfe'),       // light blue — directives
    createTokenStyle(TOKEN_TYPE_LABEL_DEF,   '#dcdcaa'),       // yellow   — label definitions
    createTokenStyle(TOKEN_TYPE_LABEL_REF,   '#dcdcaa'),       // yellow   — label references
    createTokenStyle(TOKEN_TYPE_SECTION,     '#c8c8c8', { bold: true }),  // grey bold — section names
    // Built-in token types
    createTokenStyle(TokenType.KEYWORD,      '#569cd6'),       // blue
    createTokenStyle(TokenType.TYPE,         '#4ec9b0'),       // teal
    createTokenStyle(TokenType.IDENTIFIER,   '#d4d4d4'),       // light grey
    createTokenStyle(TokenType.VARIABLE,     '#9cdcfe'),
    createTokenStyle(TokenType.FUNCTION,     '#dcdcaa'),
    createTokenStyle(TokenType.PARAMETER,    '#9cdcfe', { italic: true }),
    createTokenStyle(TokenType.PROPERTY,     '#9cdcfe'),
    createTokenStyle(TokenType.OPERATOR,     '#d4d4d4'),
    createTokenStyle(TokenType.PUNCTUATION,  '#d4d4d4'),
    createTokenStyle(TokenType.NUMBER,       '#b5cea8'),       // light green
    createTokenStyle(TokenType.STRING,       '#ce9178'),       // orange
    createTokenStyle(TokenType.COMMENT,      '#6a9955', { italic: true }),  // green italic
    createTokenStyle(TokenType.ESCAPE,       '#d7ba7d'),       // gold
    createTokenStyle(TokenType.DECORATOR,    '#c8c8c8'),
    createTokenStyle(TokenType.NAMESPACE,    '#4ec9b0'),
    createTokenStyle(TokenType.LITERAL,      '#569cd6'),
    createTokenStyle(TokenType.OTHER,        '#d4d4d4'),
  ];

  // ─── Highlight Style: Light ────────────────────────────────────────────────
  const lightStyle = createHighlightStyle(asmDef.id, 'Light');
  lightStyle.tokenStyles = [
    createTokenStyle(TOKEN_TYPE_INSTRUCTION, '#7b3f9e'),
    createTokenStyle(TOKEN_TYPE_REGISTER,    '#0070c1'),
    createTokenStyle(TOKEN_TYPE_DIRECTIVE,   '#001080'),
    createTokenStyle(TOKEN_TYPE_LABEL_DEF,   '#795e26'),
    createTokenStyle(TOKEN_TYPE_LABEL_REF,   '#795e26'),
    createTokenStyle(TOKEN_TYPE_SECTION,     '#000000', { bold: true }),
    createTokenStyle(TokenType.FUNCTION,     '#795e26'),       // brown — macro names
    createTokenStyle(TokenType.KEYWORD,      '#0000ff'),
    createTokenStyle(TokenType.TYPE,         '#267f99'),
    createTokenStyle(TokenType.IDENTIFIER,   '#000000'),
    createTokenStyle(TokenType.NUMBER,       '#098658'),
    createTokenStyle(TokenType.STRING,       '#a31515'),
    createTokenStyle(TokenType.COMMENT,      '#008000', { italic: true }),
    createTokenStyle(TokenType.ESCAPE,       '#ee0000'),
    createTokenStyle(TokenType.OPERATOR,     '#000000'),
    createTokenStyle(TokenType.PUNCTUATION,  '#000000'),
    createTokenStyle(TokenType.OTHER,        '#000000'),
  ];

  return [darkStyle, lightStyle];
}

// ─── Example code ─────────────────────────────────────────────────────────────

const EXAMPLE_CODE = `\
;  Assembly Syntax Showcase
;  Demonstrates x86-64 (NASM), GAS AT&T, ARM AArch64, and RISC-V idioms

; ── NASM / x86-64 ────────────────────────────────────────────────────────────
; Build:  nasm -f elf64 showcase.asm && ld showcase.o -o showcase

          bits 64
          global    _start
          extern    printf

          section   .data
msg:      db        "Hello, World!", 10, 0   ; null-terminated string
fmt:      db        "sum = %d", 10, 0
pi_val:   dq        3.14159265358979323846   ; 64-bit float constant
mask32:   dd        0xDEAD_BEEF              ; hex with separator

          section   .bss
buf:      resb      64                       ; reserve 64 bytes

          section   .text

; ── Macro definition ──────────────────────────────────────────────────────────
%macro  PRINT_STR  2                        ; name, len
    mov   rax, 1                            ; sys_write
    mov   rdi, 1                            ; stdout
    mov   rsi, %1
    mov   rdx, %2
    syscall
%endmacro

; ── _start: entry point ───────────────────────────────────────────────────────
_start:
    ; --- Print message via macro ---
    PRINT_STR msg, 14

    ; --- Integer arithmetic ---
    mov   rax, 42
    mov   rbx, 0xFF
    add   rax, rbx                          ; rax = 0x129
    imul  rax, rax, 3                       ; rax *= 3
    xor   rcx, rcx                          ; rcx = 0

    ; --- Bit manipulation ---
    mov   rdx, 0b1010_1100_0011_1111
    shl   rdx, 4
    and   rdx, 0xFFFF
    popcnt rcx, rdx                         ; count set bits

    ; --- SSE2: packed double addition ---
    movapd  xmm0, [rel pi_table]
    movapd  xmm1, [rel pi_table + 16]
    addpd   xmm0, xmm1                      ; xmm0 += xmm1 (packed double)
    movapd  [rel buf], xmm0

    ; --- Conditional branch ---
    cmp   rax, 100
    jge   .big_number
    jmp   .done

.big_number:
    mov   rsi, rax
    lea   rdi, [rel fmt]
    xor   eax, eax
    call  printf

.done:
    mov   rax, 60                           ; sys_exit
    xor   rdi, rdi
    syscall

; ── Helper: sum of array ──────────────────────────────────────────────────────
; rdi = pointer, rsi = length → rax = sum
sum_array:
    xor   eax, eax
    test  rsi, rsi
    jz    .ret
.loop:
    add   eax, dword [rdi]
    add   rdi, 4
    dec   rsi
    jnz   .loop
.ret:
    ret

; ── Data aligned to 16 bytes ─────────────────────────────────────────────────
          align 16
pi_table: dq    3.141592653589793, 2.718281828459045
          dq    1.6180339887498949, 1.4142135623730951

; ── GAS AT&T syntax (comment block to show style) ────────────────────────────
/*
  AT&T syntax example (GAS):

  .globl main
  main:
      movq  $60, %rax          # sys_exit
      xorq  %rdi, %rdi
      syscall

  Note: src, dst operand order is REVERSED vs Intel syntax.
*/

; ── ARM AArch64 (informational, same file parsed for color demo) ──────────────
// AArch64 entry point
// x0 = argc, x1 = argv
arm_main:
    stp     x29, x30, [sp, #-16]!   // push frame pointer + link register
    mov     x29, sp

    mov     x0, #42
    mov     x1, #58
    add     x2, x0, x1              // x2 = 100

    ldr     x3, =msg                // load address of msg
    bl      printf                  // call printf

    ldp     x29, x30, [sp], #16    // pop frame
    ret

// AArch64 SIMD: add two float32 vectors
neon_add:
    ld1     { v0.4s }, [x0]         // load 4 × f32 from [x0]
    ld1     { v1.4s }, [x1]
    fadd    v2.4s, v0.4s, v1.4s     // v2 = v0 + v1
    st1     { v2.4s }, [x2]         // store result
    ret

; ── RISC-V RV64GC ─────────────────────────────────────────────────────────────
# RISC-V entry, a0=argc  a1=argv
riscv_main:
    addi    sp, sp, -16
    sd      ra, 8(sp)               # save return address

    li      a0, 42                  # a0 = 42
    li      a1, 58
    add     a2, a0, a1              # a2 = 100

    la      a0, msg                 # a0 = &msg
    call    printf

    ld      ra, 8(sp)
    addi    sp, sp, 16
    ret

# RISC-V: sum 1..n in a0, result in a0
sum_1_to_n:
    mv      t0, a0                  # t0 = n
    li      a0, 0                   # accumulator = 0
.L_loop:
    beqz    t0, .L_done
    add     a0, a0, t0
    addi    t0, t0, -1
    j       .L_loop
.L_done:
    ret
`;