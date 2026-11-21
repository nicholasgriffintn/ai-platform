import type { UnparsedModelCatalogue } from "../schema.js";

import family0 from "./families/agi.json" with { type: "json" };
import family1 from "./families/aion.json" with { type: "json" };
import family2 from "./families/aion-mini.json" with { type: "json" };
import family3 from "./families/aion-rp.json" with { type: "json" };
import family4 from "./families/allam.json" with { type: "json" };
import family5 from "./families/allenai.json" with { type: "json" };
import family6 from "./families/alpha.json" with { type: "json" };
import family7 from "./families/ampersand.json" with { type: "json" };
import family8 from "./families/apertus.json" with { type: "json" };
import family9 from "./families/arrow.json" with { type: "json" };
import family10 from "./families/auto.json" with { type: "json" };
import family11 from "./families/autoglm.json" with { type: "json" };
import family12 from "./families/aya.json" with { type: "json" };
import family13 from "./families/aya-tiny.json" with { type: "json" };
import family14 from "./families/aya-vision.json" with { type: "json" };
import family15 from "./families/azure-openai~2Fmai-ds-r1.json" with { type: "json" };
import family16 from "./families/azure-openai~2Fo1-preview.json" with { type: "json" };
import family17 from "./families/beam.json" with { type: "json" };
import family18 from "./families/beam-free.json" with { type: "json" };
import family19 from "./families/bedrock~2Famazon.titan-text-express-v1.json" with { type: "json" };
import family20 from "./families/bedrock~2Famazon.titan-text-express-v1~3A0~3A8k.json" with { type: "json" };
import family21 from "./families/bedrock~2Fcohere.embed-english-v3.json" with { type: "json" };
import family22 from "./families/bedrock~2Fcohere.embed-multilingual-v3.json" with { type: "json" };
import family23 from "./families/bedrock~2Ftwelvelabs.marengo-embed-2-7-v1~3A0.json" with { type: "json" };
import family24 from "./families/bedrock~2Fus.twelvelabs.pegasus-1-2-v1~3A0.json" with { type: "json" };
import family25 from "./families/bge.json" with { type: "json" };
import family26 from "./families/big-pickle.json" with { type: "json" };
import family27 from "./families/cartesia~2Fink-2.json" with { type: "json" };
import family28 from "./families/chutes~2Fchutesai~2FDevstral-Small-2505.json" with { type: "json" };
import family29 from "./families/chutes~2Fmiromind-ai~2FMiroThinker-v1.5-235B.json" with { type: "json" };
import family30 from "./families/chutes~2FNousResearch~2FHermes-4-405B-FP8-TEE.json" with { type: "json" };
import family31 from "./families/chutes~2FNousResearch~2FHermes-4-70B.json" with { type: "json" };
import family32 from "./families/chutes~2FNousResearch~2FHermes-4.3-36B.json" with { type: "json" };
import family33 from "./families/chutes~2FOpenGVLab~2FInternVL3-78B-TEE.json" with { type: "json" };
import family34 from "./families/chutes~2Ftencent~2FHy4.json" with { type: "json" };
import family35 from "./families/chutes~2Ftngtech~2FTNG-R1T-Chimera-TEE.json" with { type: "json" };
import family36 from "./families/chutes~2Ftngtech~2FTNG-R1T-Chimera-Turbo.json" with { type: "json" };
import family37 from "./families/chutes~2FXiaomiMiMo~2FMiMo-V2-Flash.json" with { type: "json" };
import family38 from "./families/claude.json" with { type: "json" };
import family39 from "./families/claude-fable.json" with { type: "json" };
import family40 from "./families/claude-haiku.json" with { type: "json" };
import family41 from "./families/claude-mythos.json" with { type: "json" };
import family42 from "./families/claude-opus.json" with { type: "json" };
import family43 from "./families/claude-sonnet.json" with { type: "json" };
import family44 from "./families/cloudflare~2Fclairic.json" with { type: "json" };
import family45 from "./families/cloudflare~2Fclef.json" with { type: "json" };
import family46 from "./families/codestral.json" with { type: "json" };
import family47 from "./families/codestral-embed.json" with { type: "json" };
import family48 from "./families/cogito.json" with { type: "json" };
import family49 from "./families/cohere-embed.json" with { type: "json" };
import family50 from "./families/cohere-embed-fast.json" with { type: "json" };
import family51 from "./families/cohere-embed-pro.json" with { type: "json" };
import family52 from "./families/cohere-rerank.json" with { type: "json" };
import family53 from "./families/cohere-rerank-fast.json" with { type: "json" };
import family54 from "./families/cohere-rerank-pro.json" with { type: "json" };
import family55 from "./families/cohere~2Fc4ai-aya-expanse-8b.json" with { type: "json" };
import family56 from "./families/cohere~2Fc4ai-aya-vision-8b.json" with { type: "json" };
import family57 from "./families/command.json" with { type: "json" };
import family58 from "./families/command-a.json" with { type: "json" };
import family59 from "./families/command-a-plus.json" with { type: "json" };
import family60 from "./families/command-r.json" with { type: "json" };
import family61 from "./families/command-r-plus.json" with { type: "json" };
import family62 from "./families/cortecs~2Fapertus-70b.json" with { type: "json" };
import family63 from "./families/cortecs~2Fcosmos3-super-reasoner.json" with { type: "json" };
import family64 from "./families/cortecs~2Fdevstral-small-2512.json" with { type: "json" };
import family65 from "./families/cortecs~2Fhermes-4-70b.json" with { type: "json" };
import family66 from "./families/cortecs~2Fholo2-30b-a3b.json" with { type: "json" };
import family67 from "./families/cortecs~2Fintellect-3.json" with { type: "json" };
import family68 from "./families/cortecs~2Fmagistral-medium-2509.json" with { type: "json" };
import family69 from "./families/cortecs~2Fmagistral-small-2509.json" with { type: "json" };
import family70 from "./families/cortecs~2Fminicpm-v-4.5.json" with { type: "json" };
import family71 from "./families/cortecs~2Fpixtral-12b-2409.json" with { type: "json" };
import family72 from "./families/cydonia.json" with { type: "json" };
import family73 from "./families/deepinfra~2Fxiaomi~2Fmimo-v2.5.json" with { type: "json" };
import family74 from "./families/deepinfra~2Fxiaomi~2Fmimo-v2.5-pro.json" with { type: "json" };
import family75 from "./families/deepseek.json" with { type: "json" };
import family76 from "./families/deepseek-flash.json" with { type: "json" };
import family77 from "./families/deepseek-flash-free.json" with { type: "json" };
import family78 from "./families/deepseek-ocr.json" with { type: "json" };
import family79 from "./families/deepseek-pro.json" with { type: "json" };
import family80 from "./families/deepseek-r.json" with { type: "json" };
import family81 from "./families/deepseek-thinking.json" with { type: "json" };
import family82 from "./families/devstral.json" with { type: "json" };
import family83 from "./families/dolphin.json" with { type: "json" };
import family84 from "./families/eleven.json" with { type: "json" };
import family85 from "./families/elevenlabs~2Fscribe_v2_realtime.json" with { type: "json" };
import family86 from "./families/ember.json" with { type: "json" };
import family87 from "./families/ernie.json" with { type: "json" };
import family88 from "./families/ernie-free.json" with { type: "json" };
import family89 from "./families/euryale.json" with { type: "json" };
import family90 from "./families/exa~2Fexa.json" with { type: "json" };
import family91 from "./families/exa~2Fexa-research.json" with { type: "json" };
import family92 from "./families/exa~2Fexa-research-pro.json" with { type: "json" };
import family93 from "./families/flint.json" with { type: "json" };
import family94 from "./families/flint-free.json" with { type: "json" };
import family95 from "./families/flux.json" with { type: "json" };
import family96 from "./families/flux-dev.json" with { type: "json" };
import family97 from "./families/flux-flex.json" with { type: "json" };
import family98 from "./families/flux-klein.json" with { type: "json" };
import family99 from "./families/flux-kontext-dev.json" with { type: "json" };
import family100 from "./families/flux-kontext-max.json" with { type: "json" };
import family101 from "./families/flux-kontext-pro.json" with { type: "json" };
import family102 from "./families/flux-max.json" with { type: "json" };
import family103 from "./families/flux-pro.json" with { type: "json" };
import family104 from "./families/flux-schnell.json" with { type: "json" };
import family105 from "./families/flux-video.json" with { type: "json" };
import family106 from "./families/fugu.json" with { type: "json" };
import family107 from "./families/fugu-max.json" with { type: "json" };
import family108 from "./families/fugu-ultra.json" with { type: "json" };
import family109 from "./families/gemini.json" with { type: "json" };
import family110 from "./families/gemini-computer-use.json" with { type: "json" };
import family111 from "./families/gemini-deep-research.json" with { type: "json" };
import family112 from "./families/gemini-deep-research-max.json" with { type: "json" };
import family113 from "./families/gemini-embedding.json" with { type: "json" };
import family114 from "./families/gemini-flash.json" with { type: "json" };
import family115 from "./families/gemini-flash-lite.json" with { type: "json" };
import family116 from "./families/gemini-live.json" with { type: "json" };
import family117 from "./families/gemini-live-translate.json" with { type: "json" };
import family118 from "./families/gemini-omni-flash.json" with { type: "json" };
import family119 from "./families/gemini-pro.json" with { type: "json" };
import family120 from "./families/gemini-transcribe.json" with { type: "json" };
import family121 from "./families/gemini-tts-flash.json" with { type: "json" };
import family122 from "./families/gemini-tts-flash-lite.json" with { type: "json" };
import family123 from "./families/gemini-tts-pro.json" with { type: "json" };
import family124 from "./families/gemma.json" with { type: "json" };
import family125 from "./families/gemma-diffusion.json" with { type: "json" };
import family126 from "./families/gemma-free.json" with { type: "json" };
import family127 from "./families/github-copilot~2Fo3.json" with { type: "json" };
import family128 from "./families/github-copilot~2Fo3-mini.json" with { type: "json" };
import family129 from "./families/github-copilot~2Fo4-mini.json" with { type: "json" };
import family130 from "./families/github-copilot~2Fraptor-mini.json" with { type: "json" };
import family131 from "./families/glm.json" with { type: "json" };
import family132 from "./families/glm-air.json" with { type: "json" };
import family133 from "./families/glm-flash.json" with { type: "json" };
import family134 from "./families/glm-turbo.json" with { type: "json" };
import family135 from "./families/glmv.json" with { type: "json" };
import family136 from "./families/glmv-flash.json" with { type: "json" };
import family137 from "./families/glmv-turbo.json" with { type: "json" };
import family138 from "./families/google-text-embedding.json" with { type: "json" };
import family139 from "./families/gpt.json" with { type: "json" };
import family140 from "./families/gpt-astra.json" with { type: "json" };
import family141 from "./families/gpt-audio.json" with { type: "json" };
import family142 from "./families/gpt-audio-mini.json" with { type: "json" };
import family143 from "./families/gpt-codex.json" with { type: "json" };
import family144 from "./families/gpt-codex-mini.json" with { type: "json" };
import family145 from "./families/gpt-codex-spark.json" with { type: "json" };
import family146 from "./families/gpt-image.json" with { type: "json" };
import family147 from "./families/gpt-image-mini.json" with { type: "json" };
import family148 from "./families/gpt-live.json" with { type: "json" };
import family149 from "./families/gpt-luna.json" with { type: "json" };
import family150 from "./families/gpt-mini.json" with { type: "json" };
import family151 from "./families/gpt-nano.json" with { type: "json" };
import family152 from "./families/gpt-oss.json" with { type: "json" };
import family153 from "./families/gpt-oss-safeguard.json" with { type: "json" };
import family154 from "./families/gpt-pro.json" with { type: "json" };
import family155 from "./families/gpt-realtime.json" with { type: "json" };
import family156 from "./families/gpt-realtime-mini.json" with { type: "json" };
import family157 from "./families/gpt-sol.json" with { type: "json" };
import family158 from "./families/gpt-terra.json" with { type: "json" };
import family159 from "./families/gpt-transcribe.json" with { type: "json" };
import family160 from "./families/gpt-transcribe-mini.json" with { type: "json" };
import family161 from "./families/gpt-tts.json" with { type: "json" };
import family162 from "./families/granite.json" with { type: "json" };
import family163 from "./families/granite-micro.json" with { type: "json" };
import family164 from "./families/greenpt~2Fgreen-embedding.json" with { type: "json" };
import family165 from "./families/greenpt~2Fgreen-rerank.json" with { type: "json" };
import family166 from "./families/greenpt~2Fgreen-s.json" with { type: "json" };
import family167 from "./families/greenpt~2Fgreen-s-pro.json" with { type: "json" };
import family168 from "./families/greenpt~2Fmetis.json" with { type: "json" };
import family169 from "./families/greenpt~2Fqwen3-embedding-8b.json" with { type: "json" };
import family170 from "./families/grok.json" with { type: "json" };
import family171 from "./families/grok-build.json" with { type: "json" };
import family172 from "./families/grok-imagine-image.json" with { type: "json" };
import family173 from "./families/grok-imagine-video.json" with { type: "json" };
import family174 from "./families/grok-imagine-video-lite.json" with { type: "json" };
import family175 from "./families/grok-transcribe.json" with { type: "json" };
import family176 from "./families/grok-tts.json" with { type: "json" };
import family177 from "./families/groq.json" with { type: "json" };
import family178 from "./families/hermes.json" with { type: "json" };
import family179 from "./families/heygen-video.json" with { type: "json" };
import family180 from "./families/hunyuan.json" with { type: "json" };
import family181 from "./families/hy.json" with { type: "json" };
import family182 from "./families/Hy.json" with { type: "json" };
import family183 from "./families/hy-flash.json" with { type: "json" };
import family184 from "./families/hy-flash-free.json" with { type: "json" };
import family185 from "./families/hy-mt.json" with { type: "json" };
import family186 from "./families/hy3.json" with { type: "json" };
import family187 from "./families/ideogram~2FV_3.json" with { type: "json" };
import family188 from "./families/imagen.json" with { type: "json" };
import family189 from "./families/inception~2Fmercury.json" with { type: "json" };
import family190 from "./families/inception~2Fmercury-coder.json" with { type: "json" };
import family191 from "./families/inkling.json" with { type: "json" };
import family192 from "./families/inkling-small.json" with { type: "json" };
import family193 from "./families/jamba.json" with { type: "json" };
import family194 from "./families/kat-coder.json" with { type: "json" };
import family195 from "./families/kilo~2Fbytedance~2Fui-tars-1.5-7b.json" with { type: "json" };
import family196 from "./families/kilo~2Fcallstack~2Fapex.json" with { type: "json" };
import family197 from "./families/kilo~2Fdots-studio~2Fdots-3-note-preview~3Afree.json" with { type: "json" };
import family198 from "./families/kilo~2Felorian~2Fglimpse.json" with { type: "json" };
import family199 from "./families/kilo~2Finterfaze~2Finterfaze-beta.json" with { type: "json" };
import family200 from "./families/kilo~2Fkt~2Fmidm-k-3.0-pro.json" with { type: "json" };
import family201 from "./families/kilo~2Fmicrosoft~2Fwizardlm-2-8x22b.json" with { type: "json" };
import family202 from "./families/kilo~2Fmoondream~2Fmoondream3-preview.json" with { type: "json" };
import family203 from "./families/kilo~2Fmoondream~2Fmoondream3.1-9b-a2b.json" with { type: "json" };
import family204 from "./families/kilo~2Fopenrouter~2Fauto.json" with { type: "json" };
import family205 from "./families/kilo~2Fopenrouter~2Fbodybuilder.json" with { type: "json" };
import family206 from "./families/kilo~2Fopenrouter~2Ffree.json" with { type: "json" };
import family207 from "./families/kilo~2Fopenrouter~2Fpareto-code.json" with { type: "json" };
import family208 from "./families/kilo~2Fpaperinstruments~2Fultramarine-1-flash.json" with { type: "json" };
import family209 from "./families/kilo~2Fperceptron~2Fperceptron-mk1.5.json" with { type: "json" };
import family210 from "./families/kilo~2Fprism-ml~2Fternary-bonsai-2-27b.json" with { type: "json" };
import family211 from "./families/kilo~2Fprism-ml~2Fternary-bonsai-2-9b.json" with { type: "json" };
import family212 from "./families/kilo~2Fricursiveai~2Fripple-65b-preview.json" with { type: "json" };
import family213 from "./families/kilo~2Fscaledown~2Fextract.json" with { type: "json" };
import family214 from "./families/kilo~2Fscaledown~2Fscaledown-extract-1.json" with { type: "json" };
import family215 from "./families/kilo~2Fscaledown~2Fscaledown-summarize-1.json" with { type: "json" };
import family216 from "./families/kilo~2Fscaledown~2Fsummarize.json" with { type: "json" };
import family217 from "./families/kilo~2Fstealth~2Fglyph-cluster.json" with { type: "json" };
import family218 from "./families/kilo~2Funbiased~2Fpareto.json" with { type: "json" };
import family219 from "./families/kimi.json" with { type: "json" };
import family220 from "./families/kimi-code.json" with { type: "json" };
import family221 from "./families/kimi-k2.json" with { type: "json" };
import family222 from "./families/kimi-k3.json" with { type: "json" };
import family223 from "./families/kimi-pro.json" with { type: "json" };
import family224 from "./families/kimi-thinking.json" with { type: "json" };
import family225 from "./families/kling.json" with { type: "json" };
import family226 from "./families/kling-turbo.json" with { type: "json" };
import family227 from "./families/kolibri.json" with { type: "json" };
import family228 from "./families/laguna.json" with { type: "json" };
import family229 from "./families/laguna-m.json" with { type: "json" };
import family230 from "./families/laguna-s.json" with { type: "json" };
import family231 from "./families/laguna-xs.json" with { type: "json" };
import family232 from "./families/leanstral.json" with { type: "json" };
import family233 from "./families/lfm.json" with { type: "json" };
import family234 from "./families/lfm-free.json" with { type: "json" };
import family235 from "./families/ling.json" with { type: "json" };
import family236 from "./families/ling-flash.json" with { type: "json" };
import family237 from "./families/ling-flash-free.json" with { type: "json" };
import family238 from "./families/ling-tiny.json" with { type: "json" };
import family239 from "./families/liquid.json" with { type: "json" };
import family240 from "./families/llama.json" with { type: "json" };
import family241 from "./families/llama-guard.json" with { type: "json" };
import family242 from "./families/llama-prompt-guard.json" with { type: "json" };
import family243 from "./families/longcat.json" with { type: "json" };
import family244 from "./families/longcat-free.json" with { type: "json" };
import family245 from "./families/lucid.json" with { type: "json" };
import family246 from "./families/lunaris.json" with { type: "json" };
import family247 from "./families/lyria-clip.json" with { type: "json" };
import family248 from "./families/lyria-pro.json" with { type: "json" };
import family249 from "./families/magistral-medium.json" with { type: "json" };
import family250 from "./families/magistral-small.json" with { type: "json" };
import family251 from "./families/magnum.json" with { type: "json" };
import family252 from "./families/mai.json" with { type: "json" };
import family253 from "./families/mai-code.json" with { type: "json" };
import family254 from "./families/mai-code-flash.json" with { type: "json" };
import family255 from "./families/mai-image.json" with { type: "json" };
import family256 from "./families/mai-image-flash.json" with { type: "json" };
import family257 from "./families/mai-transcribe.json" with { type: "json" };
import family258 from "./families/mai-voice.json" with { type: "json" };
import family259 from "./families/mai-voice-flash.json" with { type: "json" };
import family260 from "./families/mercury.json" with { type: "json" };
import family261 from "./families/mercury-edit.json" with { type: "json" };
import family262 from "./families/mimo.json" with { type: "json" };
import family263 from "./families/mimo-flash.json" with { type: "json" };
import family264 from "./families/mimo-flash-free.json" with { type: "json" };
import family265 from "./families/mimo-pro.json" with { type: "json" };
import family266 from "./families/minimax.json" with { type: "json" };
import family267 from "./families/minimax-h.json" with { type: "json" };
import family268 from "./families/minimax-h-max.json" with { type: "json" };
import family269 from "./families/minimax-m.json" with { type: "json" };
import family270 from "./families/minimax-m-flash.json" with { type: "json" };
import family271 from "./families/minimax-music.json" with { type: "json" };
import family272 from "./families/ministral.json" with { type: "json" };
import family273 from "./families/mistral.json" with { type: "json" };
import family274 from "./families/mistral-embed.json" with { type: "json" };
import family275 from "./families/mistral-large.json" with { type: "json" };
import family276 from "./families/mistral-medium.json" with { type: "json" };
import family277 from "./families/mistral-nemo.json" with { type: "json" };
import family278 from "./families/mistral-small.json" with { type: "json" };
import family279 from "./families/mistral~2Fcodestral-embed.json" with { type: "json" };
import family280 from "./families/mistral~2Fministral-14b-latest.json" with { type: "json" };
import family281 from "./families/mistral~2Fvoxtral-mini-transcribe-realtime-2602.json" with { type: "json" };
import family282 from "./families/mixtral.json" with { type: "json" };
import family283 from "./families/model-router.json" with { type: "json" };
import family284 from "./families/morph-fast.json" with { type: "json" };
import family285 from "./families/morph-large.json" with { type: "json" };
import family286 from "./families/motif.json" with { type: "json" };
import family287 from "./families/muse.json" with { type: "json" };
import family288 from "./families/muse-ember.json" with { type: "json" };
import family289 from "./families/muse-glimmer.json" with { type: "json" };
import family290 from "./families/muse-image.json" with { type: "json" };
import family291 from "./families/muse-spark.json" with { type: "json" };
import family292 from "./families/muse-wonder.json" with { type: "json" };
import family293 from "./families/mythomax.json" with { type: "json" };
import family294 from "./families/nano-banana.json" with { type: "json" };
import family295 from "./families/nano-banana-lite.json" with { type: "json" };
import family296 from "./families/nano-banana-pro.json" with { type: "json" };
import family297 from "./families/nemotron.json" with { type: "json" };
import family298 from "./families/nemotron-embed.json" with { type: "json" };
import family299 from "./families/nemotron-lightning.json" with { type: "json" };
import family300 from "./families/nemotron-lightning-free.json" with { type: "json" };
import family301 from "./families/nemotron-nano.json" with { type: "json" };
import family302 from "./families/nemotron-nano-free.json" with { type: "json" };
import family303 from "./families/nemotron-rerank.json" with { type: "json" };
import family304 from "./families/nemotron-safety.json" with { type: "json" };
import family305 from "./families/nemotron-super.json" with { type: "json" };
import family306 from "./families/nemotron-super-free.json" with { type: "json" };
import family307 from "./families/nemotron-ultra.json" with { type: "json" };
import family308 from "./families/nemotron-ultra-free.json" with { type: "json" };
import family309 from "./families/nemotron-voice.json" with { type: "json" };
import family310 from "./families/nex-n.json" with { type: "json" };
import family311 from "./families/nex-n-mini.json" with { type: "json" };
import family312 from "./families/nex-n-pro.json" with { type: "json" };
import family313 from "./families/north.json" with { type: "json" };
import family314 from "./families/north-mini.json" with { type: "json" };
import family315 from "./families/north-small.json" with { type: "json" };
import family316 from "./families/nousresearch.json" with { type: "json" };
import family317 from "./families/nova.json" with { type: "json" };
import family318 from "./families/nova-lite.json" with { type: "json" };
import family319 from "./families/nova-micro.json" with { type: "json" };
import family320 from "./families/nova-pro.json" with { type: "json" };
import family321 from "./families/nvidia~2Fmeta~2Fesm2-650m.json" with { type: "json" };
import family322 from "./families/nvidia~2Fmeta~2Fesmfold.json" with { type: "json" };
import family323 from "./families/nvidia~2Fnvidia~2Factive-speaker-detection.json" with { type: "json" };
import family324 from "./families/nvidia~2Fnvidia~2Fbevformer.json" with { type: "json" };
import family325 from "./families/nvidia~2Fnvidia~2Fcosmos-predict1-5b.json" with { type: "json" };
import family326 from "./families/nvidia~2Fnvidia~2Fcosmos-transfer1-7b.json" with { type: "json" };
import family327 from "./families/nvidia~2Fnvidia~2Fcosmos-transfer2_5-2b.json" with { type: "json" };
import family328 from "./families/nvidia~2Fnvidia~2Fmagpie-tts-zeroshot.json" with { type: "json" };
import family329 from "./families/nvidia~2Fnvidia~2Fnv-embed-v1.json" with { type: "json" };
import family330 from "./families/nvidia~2Fnvidia~2Fnv-embedcode-7b-v1.json" with { type: "json" };
import family331 from "./families/nvidia~2Fnvidia~2Fsparsedrive.json" with { type: "json" };
import family332 from "./families/nvidia~2Fnvidia~2Fstreampetr.json" with { type: "json" };
import family333 from "./families/nvidia~2Fnvidia~2Fstudiovoice.json" with { type: "json" };
import family334 from "./families/nvidia~2Fnvidia~2Fsynthetic-video-detector.json" with { type: "json" };
import family335 from "./families/o.json" with { type: "json" };
import family336 from "./families/o-mini.json" with { type: "json" };
import family337 from "./families/o-pro.json" with { type: "json" };
import family338 from "./families/olmo.json" with { type: "json" };
import family339 from "./families/openai~2Fcodex-mini-latest.json" with { type: "json" };
import family340 from "./families/opencode-go~2Ficeman-contributor-free.json" with { type: "json" };
import family341 from "./families/opencode-go~2Funion-alpha.json" with { type: "json" };
import family342 from "./families/opencode~2Ficeman-free.json" with { type: "json" };
import family343 from "./families/opencode~2Fjev-latest.json" with { type: "json" };
import family344 from "./families/opencode~2Ftidepool-alpha-free.json" with { type: "json" };
import family345 from "./families/opencode~2Funion-alpha.json" with { type: "json" };
import family346 from "./families/openrouter~2Faion-labs~2Faion-1.0.json" with { type: "json" };
import family347 from "./families/openrouter~2Faion-labs~2Faion-1.0-mini.json" with { type: "json" };
import family348 from "./families/openrouter~2Falibaba~2Ftongyi-deepresearch-30b-a3b.json" with { type: "json" };
import family349 from "./families/openrouter~2Fapodex~2Fapodex-1.1-mini~3Afree.json" with { type: "json" };
import family350 from "./families/openrouter~2Farcee-ai~2Fcoder-large.json" with { type: "json" };
import family351 from "./families/openrouter~2Farcee-ai~2Fmaestro-reasoning.json" with { type: "json" };
import family352 from "./families/openrouter~2Farcee-ai~2Fspotlight.json" with { type: "json" };
import family353 from "./families/openrouter~2Farcee-ai~2Ftrinity-large-preview.json" with { type: "json" };
import family354 from "./families/openrouter~2Farcee-ai~2Ftrinity-large-preview~3Afree.json" with { type: "json" };
import family355 from "./families/openrouter~2Farcee-ai~2Ftrinity-large-thinking~3Afree.json" with { type: "json" };
import family356 from "./families/openrouter~2Farcee-ai~2Ftrinity-mini~3Afree.json" with { type: "json" };
import family357 from "./families/openrouter~2Farcee-ai~2Fvirtuoso-large.json" with { type: "json" };
import family358 from "./families/openrouter~2Fbaidu~2Fcobuddy~3Afree.json" with { type: "json" };
import family359 from "./families/openrouter~2Fbaidu~2Fernie-4.5-21b-a3b.json" with { type: "json" };
import family360 from "./families/openrouter~2Fbaidu~2Fernie-4.5-21b-a3b-thinking.json" with { type: "json" };
import family361 from "./families/openrouter~2Fbaidu~2Fernie-4.5-300b-a47b.json" with { type: "json" };
import family362 from "./families/openrouter~2Fbaidu~2Fernie-4.5-vl-28b-a3b.json" with { type: "json" };
import family363 from "./families/openrouter~2Fbaidu~2Fqianfan-ocr-fast.json" with { type: "json" };
import family364 from "./families/openrouter~2Fbytedance~2Fui-tars-1.5-7b.json" with { type: "json" };
import family365 from "./families/openrouter~2Felorian~2Fglimpse.json" with { type: "json" };
import family366 from "./families/openrouter~2Fessentialai~2Frnj-1-instruct.json" with { type: "json" };
import family367 from "./families/openrouter~2Ffeatherless~2Fqwerky-72b.json" with { type: "json" };
import family368 from "./families/openrouter~2Finflection~2Finflection-3-pi.json" with { type: "json" };
import family369 from "./families/openrouter~2Finflection~2Finflection-3-productivity.json" with { type: "json" };
import family370 from "./families/openrouter~2Fkt~2Fmidm-k-3.0-pro.json" with { type: "json" };
import family371 from "./families/openrouter~2Fkwaipilot~2Fkat-coder-pro~3Afree.json" with { type: "json" };
import family372 from "./families/openrouter~2Fmicrosoft~2Fmai-ds-r1~3Afree.json" with { type: "json" };
import family373 from "./families/openrouter~2Fmicrosoft~2Fwizardlm-2-8x22b.json" with { type: "json" };
import family374 from "./families/openrouter~2Fmoondream~2Fmoondream3-preview.json" with { type: "json" };
import family375 from "./families/openrouter~2Fmoondream~2Fmoondream3.1-9b-a2b.json" with { type: "json" };
import family376 from "./families/openrouter~2Fnex-agi~2Fnex-n2-pro~3Afree.json" with { type: "json" };
import family377 from "./families/openrouter~2Fopenrouter~2Fbodybuilder.json" with { type: "json" };
import family378 from "./families/openrouter~2Fopenrouter~2Ffree.json" with { type: "json" };
import family379 from "./families/openrouter~2Fopenrouter~2Ffusion.json" with { type: "json" };
import family380 from "./families/openrouter~2Fopenrouter~2Fpareto-code.json" with { type: "json" };
import family381 from "./families/openrouter~2Fopenrouter~2Fsherlock-dash-alpha.json" with { type: "json" };
import family382 from "./families/openrouter~2Fopenrouter~2Fsherlock-think-alpha.json" with { type: "json" };
import family383 from "./families/openrouter~2Fperceptron~2Fperceptron-mk1.5.json" with { type: "json" };
import family384 from "./families/openrouter~2Fpoolside~2Flaguna-xs.2.json" with { type: "json" };
import family385 from "./families/openrouter~2Fpoolside~2Flaguna-xs.2~3Afree.json" with { type: "json" };
import family386 from "./families/openrouter~2Fprime-intellect~2Fintellect-3.json" with { type: "json" };
import family387 from "./families/openrouter~2Fprism-ml~2Fternary-bonsai-2-27b.json" with { type: "json" };
import family388 from "./families/openrouter~2Fprism-ml~2Fternary-bonsai-2-9b.json" with { type: "json" };
import family389 from "./families/openrouter~2Fradixark~2Fdaisyrose-27b.json" with { type: "json" };
import family390 from "./families/openrouter~2Fricursiveai~2Fripple-65b-preview.json" with { type: "json" };
import family391 from "./families/openrouter~2Fsao10k~2Fl3-euryale-70b.json" with { type: "json" };
import family392 from "./families/openrouter~2Fsarvamai~2Fsarvam-m~3Afree.json" with { type: "json" };
import family393 from "./families/openrouter~2Fscaledown~2Fextract.json" with { type: "json" };
import family394 from "./families/openrouter~2Fscaledown~2Fsummarize.json" with { type: "json" };
import family395 from "./families/openrouter~2Fsourceful~2Friverflow-v2-fast-preview.json" with { type: "json" };
import family396 from "./families/openrouter~2Fsourceful~2Friverflow-v2-max-preview.json" with { type: "json" };
import family397 from "./families/openrouter~2Fsourceful~2Friverflow-v2-standard-preview.json" with { type: "json" };
import family398 from "./families/openrouter~2Fstepfun~2Fstep-3.5-flash~3Afree.json" with { type: "json" };
import family399 from "./families/openrouter~2Fswitchpoint~2Frouter.json" with { type: "json" };
import family400 from "./families/openrouter~2Fthedrummer~2Frocinante-12b.json" with { type: "json" };
import family401 from "./families/openrouter~2Ftngtech~2Ftng-r1t-chimera~3Afree.json" with { type: "json" };
import family402 from "./families/openrouter~2Funbiased~2Fpareto.json" with { type: "json" };
import family403 from "./families/openrouter~2Fxiaomi~2Fmimo-v2-flash.json" with { type: "json" };
import family404 from "./families/openrouter~2Fxiaomi~2Fmimo-v2-omni.json" with { type: "json" };
import family405 from "./families/openrouter~2Fxiaomi~2Fmimo-v2-pro.json" with { type: "json" };
import family406 from "./families/orpheus.json" with { type: "json" };
import family407 from "./families/palmyra.json" with { type: "json" };
import family408 from "./families/parallel~2Fspeed.json" with { type: "json" };
import family409 from "./families/pareto.json" with { type: "json" };
import family410 from "./families/particle.json" with { type: "json" };
import family411 from "./families/perceptron-mk.json" with { type: "json" };
import family412 from "./families/perplexity-ai~2Fr1-1776.json" with { type: "json" };
import family413 from "./families/perplexity-ai~2Fsonar-reasoning.json" with { type: "json" };
import family414 from "./families/phi.json" with { type: "json" };
import family415 from "./families/phi-mini.json" with { type: "json" };
import family416 from "./families/pixtral.json" with { type: "json" };
import family417 from "./families/pixtral-large.json" with { type: "json" };
import family418 from "./families/polly.json" with { type: "json" };
import family419 from "./families/pplx-embed.json" with { type: "json" };
import family420 from "./families/qwen.json" with { type: "json" };
import family421 from "./families/qwen-asr-flash.json" with { type: "json" };
import family422 from "./families/qwen-coder.json" with { type: "json" };
import family423 from "./families/qwen-coder-flash.json" with { type: "json" };
import family424 from "./families/qwen-embedding.json" with { type: "json" };
import family425 from "./families/qwen-flash.json" with { type: "json" };
import family426 from "./families/qwen-image.json" with { type: "json" };
import family427 from "./families/qwen-max.json" with { type: "json" };
import family428 from "./families/qwen-mt-plus.json" with { type: "json" };
import family429 from "./families/qwen-omni-flash.json" with { type: "json" };
import family430 from "./families/qwen-plus.json" with { type: "json" };
import family431 from "./families/qwen-reranker.json" with { type: "json" };
import family432 from "./families/qwen-vl.json" with { type: "json" };
import family433 from "./families/qwen-vl-plus.json" with { type: "json" };
import family434 from "./families/qwen3.6.json" with { type: "json" };
import family435 from "./families/recraft.json" with { type: "json" };
import family436 from "./families/recraft-flash.json" with { type: "json" };
import family437 from "./families/recraft-pro.json" with { type: "json" };
import family438 from "./families/rednote.json" with { type: "json" };
import family439 from "./families/regolo-ai~2Fbrick-complexity-pro.json" with { type: "json" };
import family440 from "./families/reka.json" with { type: "json" };
import family441 from "./families/relace-apply.json" with { type: "json" };
import family442 from "./families/relace-search.json" with { type: "json" };
import family443 from "./families/remm.json" with { type: "json" };
import family444 from "./families/replicate~2F5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637.json" with { type: "json" };
import family445 from "./families/replicate~2F671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb.json" with { type: "json" };
import family446 from "./families/replicate~2F826801120720e563620006b99e412f7ed7b991dd4477e9160473d44a405ef9d9.json" with { type: "json" };
import family447 from "./families/replicate~2F847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405.json" with { type: "json" };
import family448 from "./families/replicate~2Falibaba~2Fhappyhorse-1.0.json" with { type: "json" };
import family449 from "./families/replicate~2Falibaba~2Fqwen-image-3.json" with { type: "json" };
import family450 from "./families/replicate~2Fblack-forest-labs~2Fflux-video-upscale.json" with { type: "json" };
import family451 from "./families/replicate~2Fbria~2Ffibo.json" with { type: "json" };
import family452 from "./families/replicate~2Fbria~2Fremove-background.json" with { type: "json" };
import family453 from "./families/replicate~2Fcbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f.json" with { type: "json" };
import family454 from "./families/replicate~2Fdatacte~2Fproteus-v0.3.json" with { type: "json" };
import family455 from "./families/replicate~2Felevenlabs~2Fdubbing.json" with { type: "json" };
import family456 from "./families/replicate~2Felevenlabs~2Fmusic.json" with { type: "json" };
import family457 from "./families/replicate~2Fgoogle~2Fgemini-omni-1.1.json" with { type: "json" };
import family458 from "./families/replicate~2Fgoogle~2Fnano-banana.json" with { type: "json" };
import family459 from "./families/replicate~2Fgoogle~2Fnano-banana-2.json" with { type: "json" };
import family460 from "./families/replicate~2Fgoogle~2Fnano-banana-pro.json" with { type: "json" };
import family461 from "./families/replicate~2Flightricks~2Fltx-2.5-fast.json" with { type: "json" };
import family462 from "./families/replicate~2Fluma~2Fray-3.2.json" with { type: "json" };
import family463 from "./families/replicate~2Fnightmareai~2Freal-esrgan.json" with { type: "json" };
import family464 from "./families/replicate~2Fprunaai~2Fp-image-ideogram.json" with { type: "json" };
import family465 from "./families/replicate~2Fprunaai~2Fp-video.json" with { type: "json" };
import family466 from "./families/replicate~2Fprunaai~2Fp-video-2-pro.json" with { type: "json" };
import family467 from "./families/replicate~2Fresemble-ai~2Fchatterbox-turbo.json" with { type: "json" };
import family468 from "./families/replicate~2Frunwayml~2Fgen-4.5.json" with { type: "json" };
import family469 from "./families/replicate~2Fstability-ai~2Fstable-audio-2.5.json" with { type: "json" };
import family470 from "./families/ring.json" with { type: "json" };
import family471 from "./families/sakana-namazu.json" with { type: "json" };
import family472 from "./families/schematron-small.json" with { type: "json" };
import family473 from "./families/schematron-turbo.json" with { type: "json" };
import family474 from "./families/sea-lion.json" with { type: "json" };
import family475 from "./families/seed.json" with { type: "json" };
import family476 from "./families/seed-code.json" with { type: "json" };
import family477 from "./families/seed-lite.json" with { type: "json" };
import family478 from "./families/seed-mini.json" with { type: "json" };
import family479 from "./families/seed-pro.json" with { type: "json" };
import family480 from "./families/seed-turbo.json" with { type: "json" };
import family481 from "./families/seedance.json" with { type: "json" };
import family482 from "./families/seedance-mini.json" with { type: "json" };
import family483 from "./families/seedance-pro.json" with { type: "json" };
import family484 from "./families/seedream.json" with { type: "json" };
import family485 from "./families/seedream-lite.json" with { type: "json" };
import family486 from "./families/seedream-pro.json" with { type: "json" };
import family487 from "./families/skyfall.json" with { type: "json" };
import family488 from "./families/solar-mini.json" with { type: "json" };
import family489 from "./families/solar-pro.json" with { type: "json" };
import family490 from "./families/sonar.json" with { type: "json" };
import family491 from "./families/sonar-deep-research.json" with { type: "json" };
import family492 from "./families/sonar-pro.json" with { type: "json" };
import family493 from "./families/sonar-reasoning.json" with { type: "json" };
import family494 from "./families/sonar-reasoning-pro.json" with { type: "json" };
import family495 from "./families/sonic.json" with { type: "json" };
import family496 from "./families/sora.json" with { type: "json" };
import family497 from "./families/stable-diffusion.json" with { type: "json" };
import family498 from "./families/step.json" with { type: "json" };
import family499 from "./families/step-flash.json" with { type: "json" };
import family500 from "./families/text-embedding.json" with { type: "json" };
import family501 from "./families/the-grid-ai~2Fagent-max.json" with { type: "json" };
import family502 from "./families/the-grid-ai~2Fagent-prime.json" with { type: "json" };
import family503 from "./families/the-grid-ai~2Fagent-standard.json" with { type: "json" };
import family504 from "./families/the-grid-ai~2Fbytedance-pro-latest.json" with { type: "json" };
import family505 from "./families/the-grid-ai~2Fcode-max.json" with { type: "json" };
import family506 from "./families/the-grid-ai~2Fcode-prime.json" with { type: "json" };
import family507 from "./families/the-grid-ai~2Fcode-standard.json" with { type: "json" };
import family508 from "./families/the-grid-ai~2Ftext-max.json" with { type: "json" };
import family509 from "./families/the-grid-ai~2Ftext-prime.json" with { type: "json" };
import family510 from "./families/the-grid-ai~2Ftext-standard.json" with { type: "json" };
import family511 from "./families/titan-embed.json" with { type: "json" };
import family512 from "./families/toast.json" with { type: "json" };
import family513 from "./families/together-ai~2Ftogethercomputer~2FRefuel-Llm-V2.json" with { type: "json" };
import family514 from "./families/together-ai~2Ftogethercomputer~2FRefuel-Llm-V2-Small.json" with { type: "json" };
import family515 from "./families/trinity.json" with { type: "json" };
import family516 from "./families/trinity-mini.json" with { type: "json" };
import family517 from "./families/typesafe~2Fjev.json" with { type: "json" };
import family518 from "./families/unslopnemo.json" with { type: "json" };
import family519 from "./families/unsloth.json" with { type: "json" };
import family520 from "./families/veo.json" with { type: "json" };
import family521 from "./families/veo-lite.json" with { type: "json" };
import family522 from "./families/vercel~2Fcallstack~2Fapex.json" with { type: "json" };
import family523 from "./families/vercel~2Fcohere~2Frerank-v5-fast.json" with { type: "json" };
import family524 from "./families/vercel~2Fcohere~2Frerank-v5-pro.json" with { type: "json" };
import family525 from "./families/vercel~2Felorian~2Fglimpse.json" with { type: "json" };
import family526 from "./families/vercel~2Ffish-audio~2Fdrama-3.json" with { type: "json" };
import family527 from "./families/vercel~2Finception~2Fmercury-edit-2.json" with { type: "json" };
import family528 from "./families/vercel~2Finterfaze~2Finterfaze-beta.json" with { type: "json" };
import family529 from "./families/vercel~2Fopenai~2Fcodex-mini.json" with { type: "json" };
import family530 from "./families/vercel~2Fpaperinstruments~2Fultramarine-1-flash.json" with { type: "json" };
import family531 from "./families/vercel~2Fperplexity~2Fsonar-reasoning.json" with { type: "json" };
import family532 from "./families/vercel~2Fprime-intellect~2Fintellect-3.json" with { type: "json" };
import family533 from "./families/vercel~2Fscaledown~2Fextract-1.json" with { type: "json" };
import family534 from "./families/vercel~2Fscaledown~2Fscaledown-extract-1.json" with { type: "json" };
import family535 from "./families/vercel~2Fscaledown~2Fscaledown-summarize-1.json" with { type: "json" };
import family536 from "./families/vercel~2Fstealth~2Fglyph-cluster.json" with { type: "json" };
import family537 from "./families/vercel~2Fstealth~2Fpixel-canary.json" with { type: "json" };
import family538 from "./families/vercel~2Ftopaz~2Fproteus.json" with { type: "json" };
import family539 from "./families/vercel~2Ftopaz~2Fstarlight-precise-2.6.json" with { type: "json" };
import family540 from "./families/vercel~2Ftopaz~2Fwonder-3.5.json" with { type: "json" };
import family541 from "./families/vercel~2Ftypesafe-ai~2Fjev.json" with { type: "json" };
import family542 from "./families/voxtral.json" with { type: "json" };
import family543 from "./families/voxtral-small.json" with { type: "json" };
import family544 from "./families/voxtral-transcribe.json" with { type: "json" };
import family545 from "./families/voxtral-tts.json" with { type: "json" };
import family546 from "./families/voyage.json" with { type: "json" };
import family547 from "./families/voyage-code.json" with { type: "json" };
import family548 from "./families/voyage-large.json" with { type: "json" };
import family549 from "./families/voyage-lite.json" with { type: "json" };
import family550 from "./families/voyage-rerank.json" with { type: "json" };
import family551 from "./families/voyage-rerank-lite.json" with { type: "json" };
import family552 from "./families/wan.json" with { type: "json" };
import family553 from "./families/weaver.json" with { type: "json" };
import family554 from "./families/whisper.json" with { type: "json" };
import family555 from "./families/workers-ai~2F~40cf~2Fai4bharat~2Findictrans2-en-indic-1B.json" with { type: "json" };
import family556 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-base-en-v1.5.json" with { type: "json" };
import family557 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-large-en-v1.5.json" with { type: "json" };
import family558 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-m3.json" with { type: "json" };
import family559 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-reranker-base.json" with { type: "json" };
import family560 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-small-en-v1.5.json" with { type: "json" };
import family561 from "./families/workers-ai~2F~40cf~2Fcloudflare~2Fclairic-flash.json" with { type: "json" };
import family562 from "./families/workers-ai~2F~40cf~2Fcloudflare~2Fclef-omni.json" with { type: "json" };
import family563 from "./families/workers-ai~2F~40cf~2Fdeepgram~2Faura-1.json" with { type: "json" };
import family564 from "./families/workers-ai~2F~40cf~2Fdeepgram~2Faura-2-en.json" with { type: "json" };
import family565 from "./families/workers-ai~2F~40cf~2Fdeepgram~2Faura-2-es.json" with { type: "json" };
import family566 from "./families/workers-ai~2F~40cf~2Fdeepgram~2Fflux.json" with { type: "json" };
import family567 from "./families/workers-ai~2F~40cf~2Fhuggingface~2Fdistilbert-sst-2-int8.json" with { type: "json" };
import family568 from "./families/workers-ai~2F~40cf~2Fleonardo~2Flucid-origin.json" with { type: "json" };
import family569 from "./families/workers-ai~2F~40cf~2Fleonardo~2Fphoenix-1.0.json" with { type: "json" };
import family570 from "./families/workers-ai~2F~40cf~2Fllava-hf~2Fllava-1.5-7b-hf.json" with { type: "json" };
import family571 from "./families/workers-ai~2F~40cf~2Flykon~2Fdreamshaper-8-lcm.json" with { type: "json" };
import family572 from "./families/workers-ai~2F~40cf~2Fmeta~2Fm2m100-1.2b.json" with { type: "json" };
import family573 from "./families/workers-ai~2F~40cf~2Fmyshell-ai~2Fmelotts.json" with { type: "json" };
import family574 from "./families/workers-ai~2F~40cf~2Fpfnet~2Fplamo-embedding-1b.json" with { type: "json" };
import family575 from "./families/workers-ai~2F~40cf~2Fpipecat-ai~2Fsmart-turn-v2.json" with { type: "json" };
import provider0 from "./providers/openai.json" with { type: "json" };
import provider1 from "./providers/anthropic.json" with { type: "json" };
import provider2 from "./providers/mistral.json" with { type: "json" };
import provider3 from "./providers/morph.json" with { type: "json" };
import provider4 from "./providers/bedrock.json" with { type: "json" };
import provider5 from "./providers/bedrock-mantle.json" with { type: "json" };
import provider6 from "./providers/deepinfra.json" with { type: "json" };
import provider7 from "./providers/deepseek.json" with { type: "json" };
import provider8 from "./providers/azure-openai.json" with { type: "json" };
import provider9 from "./providers/grok.json" with { type: "json" };
import provider10 from "./providers/groq.json" with { type: "json" };
import provider11 from "./providers/huggingface.json" with { type: "json" };
import provider12 from "./providers/openrouter.json" with { type: "json" };
import provider13 from "./providers/parallel.json" with { type: "json" };
import provider14 from "./providers/perplexity-ai.json" with { type: "json" };
import provider15 from "./providers/requesty.json" with { type: "json" };
import provider16 from "./providers/workers-ai.json" with { type: "json" };
import provider17 from "./providers/together-ai.json" with { type: "json" };
import provider18 from "./providers/google-ai-studio.json" with { type: "json" };
import provider19 from "./providers/elevenlabs.json" with { type: "json" };
import provider20 from "./providers/cartesia.json" with { type: "json" };
import provider21 from "./providers/fireworks.json" with { type: "json" };
import provider22 from "./providers/hyperbolic.json" with { type: "json" };
import provider23 from "./providers/inference.json" with { type: "json" };
import provider24 from "./providers/chutes.json" with { type: "json" };
import provider25 from "./providers/vercel.json" with { type: "json" };
import provider26 from "./providers/upstage.json" with { type: "json" };
import provider27 from "./providers/github-copilot.json" with { type: "json" };
import provider28 from "./providers/inception.json" with { type: "json" };
import provider29 from "./providers/replicate.json" with { type: "json" };
import provider30 from "./providers/exa.json" with { type: "json" };
import provider31 from "./providers/fal.json" with { type: "json" };
import provider32 from "./providers/ideogram.json" with { type: "json" };
import provider33 from "./providers/cerebras.json" with { type: "json" };
import provider34 from "./providers/cohere.json" with { type: "json" };
import provider35 from "./providers/opencode.json" with { type: "json" };
import provider36 from "./providers/opencode-go.json" with { type: "json" };
import provider37 from "./providers/cortecs.json" with { type: "json" };
import provider38 from "./providers/nova.json" with { type: "json" };
import provider39 from "./providers/poolside.json" with { type: "json" };
import provider40 from "./providers/hetzner.json" with { type: "json" };
import provider41 from "./providers/alibaba.json" with { type: "json" };
import provider42 from "./providers/zai.json" with { type: "json" };
import provider43 from "./providers/moonshot.json" with { type: "json" };
import provider44 from "./providers/minimax.json" with { type: "json" };
import provider45 from "./providers/google-vertex.json" with { type: "json" };
import provider46 from "./providers/ollama-cloud.json" with { type: "json" };
import provider47 from "./providers/meta.json" with { type: "json" };
import provider48 from "./providers/greenpt.json" with { type: "json" };
import provider49 from "./providers/lucidquery.json" with { type: "json" };
import provider50 from "./providers/ovhcloud.json" with { type: "json" };
import provider51 from "./providers/regolo-ai.json" with { type: "json" };
import provider52 from "./providers/sakana.json" with { type: "json" };
import provider53 from "./providers/standardcompute.json" with { type: "json" };
import provider54 from "./providers/the-grid-ai.json" with { type: "json" };
import provider55 from "./providers/kimi-for-coding.json" with { type: "json" };
import provider56 from "./providers/thinkingmachines.json" with { type: "json" };
import provider57 from "./providers/typesafe.json" with { type: "json" };
import provider58 from "./providers/kilo.json" with { type: "json" };
import provider59 from "./providers/nebius.json" with { type: "json" };
import provider60 from "./providers/baseten.json" with { type: "json" };
import provider61 from "./providers/nvidia.json" with { type: "json" };
import provider62 from "./providers/polly.json" with { type: "json" };
import provider63 from "./providers/perplexity-agent.json" with { type: "json" };

const catalogue: UnparsedModelCatalogue = {
  families: {
    "agi": family0,
    "aion": family1,
    "aion-mini": family2,
    "aion-rp": family3,
    "allam": family4,
    "allenai": family5,
    "alpha": family6,
    "ampersand": family7,
    "apertus": family8,
    "arrow": family9,
    "auto": family10,
    "autoglm": family11,
    "aya": family12,
    "aya-tiny": family13,
    "aya-vision": family14,
    "azure-openai/mai-ds-r1": family15,
    "azure-openai/o1-preview": family16,
    "beam": family17,
    "beam-free": family18,
    "bedrock/amazon.titan-text-express-v1": family19,
    "bedrock/amazon.titan-text-express-v1:0:8k": family20,
    "bedrock/cohere.embed-english-v3": family21,
    "bedrock/cohere.embed-multilingual-v3": family22,
    "bedrock/twelvelabs.marengo-embed-2-7-v1:0": family23,
    "bedrock/us.twelvelabs.pegasus-1-2-v1:0": family24,
    "bge": family25,
    "big-pickle": family26,
    "cartesia/ink-2": family27,
    "chutes/chutesai/Devstral-Small-2505": family28,
    "chutes/miromind-ai/MiroThinker-v1.5-235B": family29,
    "chutes/NousResearch/Hermes-4-405B-FP8-TEE": family30,
    "chutes/NousResearch/Hermes-4-70B": family31,
    "chutes/NousResearch/Hermes-4.3-36B": family32,
    "chutes/OpenGVLab/InternVL3-78B-TEE": family33,
    "chutes/tencent/Hy4": family34,
    "chutes/tngtech/TNG-R1T-Chimera-TEE": family35,
    "chutes/tngtech/TNG-R1T-Chimera-Turbo": family36,
    "chutes/XiaomiMiMo/MiMo-V2-Flash": family37,
    "claude": family38,
    "claude-fable": family39,
    "claude-haiku": family40,
    "claude-mythos": family41,
    "claude-opus": family42,
    "claude-sonnet": family43,
    "cloudflare/clairic": family44,
    "cloudflare/clef": family45,
    "codestral": family46,
    "codestral-embed": family47,
    "cogito": family48,
    "cohere-embed": family49,
    "cohere-embed-fast": family50,
    "cohere-embed-pro": family51,
    "cohere-rerank": family52,
    "cohere-rerank-fast": family53,
    "cohere-rerank-pro": family54,
    "cohere/c4ai-aya-expanse-8b": family55,
    "cohere/c4ai-aya-vision-8b": family56,
    "command": family57,
    "command-a": family58,
    "command-a-plus": family59,
    "command-r": family60,
    "command-r-plus": family61,
    "cortecs/apertus-70b": family62,
    "cortecs/cosmos3-super-reasoner": family63,
    "cortecs/devstral-small-2512": family64,
    "cortecs/hermes-4-70b": family65,
    "cortecs/holo2-30b-a3b": family66,
    "cortecs/intellect-3": family67,
    "cortecs/magistral-medium-2509": family68,
    "cortecs/magistral-small-2509": family69,
    "cortecs/minicpm-v-4.5": family70,
    "cortecs/pixtral-12b-2409": family71,
    "cydonia": family72,
    "deepinfra/xiaomi/mimo-v2.5": family73,
    "deepinfra/xiaomi/mimo-v2.5-pro": family74,
    "deepseek": family75,
    "deepseek-flash": family76,
    "deepseek-flash-free": family77,
    "deepseek-ocr": family78,
    "deepseek-pro": family79,
    "deepseek-r": family80,
    "deepseek-thinking": family81,
    "devstral": family82,
    "dolphin": family83,
    "eleven": family84,
    "elevenlabs/scribe_v2_realtime": family85,
    "ember": family86,
    "ernie": family87,
    "ernie-free": family88,
    "euryale": family89,
    "exa/exa": family90,
    "exa/exa-research": family91,
    "exa/exa-research-pro": family92,
    "flint": family93,
    "flint-free": family94,
    "flux": family95,
    "flux-dev": family96,
    "flux-flex": family97,
    "flux-klein": family98,
    "flux-kontext-dev": family99,
    "flux-kontext-max": family100,
    "flux-kontext-pro": family101,
    "flux-max": family102,
    "flux-pro": family103,
    "flux-schnell": family104,
    "flux-video": family105,
    "fugu": family106,
    "fugu-max": family107,
    "fugu-ultra": family108,
    "gemini": family109,
    "gemini-computer-use": family110,
    "gemini-deep-research": family111,
    "gemini-deep-research-max": family112,
    "gemini-embedding": family113,
    "gemini-flash": family114,
    "gemini-flash-lite": family115,
    "gemini-live": family116,
    "gemini-live-translate": family117,
    "gemini-omni-flash": family118,
    "gemini-pro": family119,
    "gemini-transcribe": family120,
    "gemini-tts-flash": family121,
    "gemini-tts-flash-lite": family122,
    "gemini-tts-pro": family123,
    "gemma": family124,
    "gemma-diffusion": family125,
    "gemma-free": family126,
    "github-copilot/o3": family127,
    "github-copilot/o3-mini": family128,
    "github-copilot/o4-mini": family129,
    "github-copilot/raptor-mini": family130,
    "glm": family131,
    "glm-air": family132,
    "glm-flash": family133,
    "glm-turbo": family134,
    "glmv": family135,
    "glmv-flash": family136,
    "glmv-turbo": family137,
    "google-text-embedding": family138,
    "gpt": family139,
    "gpt-astra": family140,
    "gpt-audio": family141,
    "gpt-audio-mini": family142,
    "gpt-codex": family143,
    "gpt-codex-mini": family144,
    "gpt-codex-spark": family145,
    "gpt-image": family146,
    "gpt-image-mini": family147,
    "gpt-live": family148,
    "gpt-luna": family149,
    "gpt-mini": family150,
    "gpt-nano": family151,
    "gpt-oss": family152,
    "gpt-oss-safeguard": family153,
    "gpt-pro": family154,
    "gpt-realtime": family155,
    "gpt-realtime-mini": family156,
    "gpt-sol": family157,
    "gpt-terra": family158,
    "gpt-transcribe": family159,
    "gpt-transcribe-mini": family160,
    "gpt-tts": family161,
    "granite": family162,
    "granite-micro": family163,
    "greenpt/green-embedding": family164,
    "greenpt/green-rerank": family165,
    "greenpt/green-s": family166,
    "greenpt/green-s-pro": family167,
    "greenpt/metis": family168,
    "greenpt/qwen3-embedding-8b": family169,
    "grok": family170,
    "grok-build": family171,
    "grok-imagine-image": family172,
    "grok-imagine-video": family173,
    "grok-imagine-video-lite": family174,
    "grok-transcribe": family175,
    "grok-tts": family176,
    "groq": family177,
    "hermes": family178,
    "heygen-video": family179,
    "hunyuan": family180,
    "hy": family181,
    "Hy": family182,
    "hy-flash": family183,
    "hy-flash-free": family184,
    "hy-mt": family185,
    "hy3": family186,
    "ideogram/V_3": family187,
    "imagen": family188,
    "inception/mercury": family189,
    "inception/mercury-coder": family190,
    "inkling": family191,
    "inkling-small": family192,
    "jamba": family193,
    "kat-coder": family194,
    "kilo/bytedance/ui-tars-1.5-7b": family195,
    "kilo/callstack/apex": family196,
    "kilo/dots-studio/dots-3-note-preview:free": family197,
    "kilo/elorian/glimpse": family198,
    "kilo/interfaze/interfaze-beta": family199,
    "kilo/kt/midm-k-3.0-pro": family200,
    "kilo/microsoft/wizardlm-2-8x22b": family201,
    "kilo/moondream/moondream3-preview": family202,
    "kilo/moondream/moondream3.1-9b-a2b": family203,
    "kilo/openrouter/auto": family204,
    "kilo/openrouter/bodybuilder": family205,
    "kilo/openrouter/free": family206,
    "kilo/openrouter/pareto-code": family207,
    "kilo/paperinstruments/ultramarine-1-flash": family208,
    "kilo/perceptron/perceptron-mk1.5": family209,
    "kilo/prism-ml/ternary-bonsai-2-27b": family210,
    "kilo/prism-ml/ternary-bonsai-2-9b": family211,
    "kilo/ricursiveai/ripple-65b-preview": family212,
    "kilo/scaledown/extract": family213,
    "kilo/scaledown/scaledown-extract-1": family214,
    "kilo/scaledown/scaledown-summarize-1": family215,
    "kilo/scaledown/summarize": family216,
    "kilo/stealth/glyph-cluster": family217,
    "kilo/unbiased/pareto": family218,
    "kimi": family219,
    "kimi-code": family220,
    "kimi-k2": family221,
    "kimi-k3": family222,
    "kimi-pro": family223,
    "kimi-thinking": family224,
    "kling": family225,
    "kling-turbo": family226,
    "kolibri": family227,
    "laguna": family228,
    "laguna-m": family229,
    "laguna-s": family230,
    "laguna-xs": family231,
    "leanstral": family232,
    "lfm": family233,
    "lfm-free": family234,
    "ling": family235,
    "ling-flash": family236,
    "ling-flash-free": family237,
    "ling-tiny": family238,
    "liquid": family239,
    "llama": family240,
    "llama-guard": family241,
    "llama-prompt-guard": family242,
    "longcat": family243,
    "longcat-free": family244,
    "lucid": family245,
    "lunaris": family246,
    "lyria-clip": family247,
    "lyria-pro": family248,
    "magistral-medium": family249,
    "magistral-small": family250,
    "magnum": family251,
    "mai": family252,
    "mai-code": family253,
    "mai-code-flash": family254,
    "mai-image": family255,
    "mai-image-flash": family256,
    "mai-transcribe": family257,
    "mai-voice": family258,
    "mai-voice-flash": family259,
    "mercury": family260,
    "mercury-edit": family261,
    "mimo": family262,
    "mimo-flash": family263,
    "mimo-flash-free": family264,
    "mimo-pro": family265,
    "minimax": family266,
    "minimax-h": family267,
    "minimax-h-max": family268,
    "minimax-m": family269,
    "minimax-m-flash": family270,
    "minimax-music": family271,
    "ministral": family272,
    "mistral": family273,
    "mistral-embed": family274,
    "mistral-large": family275,
    "mistral-medium": family276,
    "mistral-nemo": family277,
    "mistral-small": family278,
    "mistral/codestral-embed": family279,
    "mistral/ministral-14b-latest": family280,
    "mistral/voxtral-mini-transcribe-realtime-2602": family281,
    "mixtral": family282,
    "model-router": family283,
    "morph-fast": family284,
    "morph-large": family285,
    "motif": family286,
    "muse": family287,
    "muse-ember": family288,
    "muse-glimmer": family289,
    "muse-image": family290,
    "muse-spark": family291,
    "muse-wonder": family292,
    "mythomax": family293,
    "nano-banana": family294,
    "nano-banana-lite": family295,
    "nano-banana-pro": family296,
    "nemotron": family297,
    "nemotron-embed": family298,
    "nemotron-lightning": family299,
    "nemotron-lightning-free": family300,
    "nemotron-nano": family301,
    "nemotron-nano-free": family302,
    "nemotron-rerank": family303,
    "nemotron-safety": family304,
    "nemotron-super": family305,
    "nemotron-super-free": family306,
    "nemotron-ultra": family307,
    "nemotron-ultra-free": family308,
    "nemotron-voice": family309,
    "nex-n": family310,
    "nex-n-mini": family311,
    "nex-n-pro": family312,
    "north": family313,
    "north-mini": family314,
    "north-small": family315,
    "nousresearch": family316,
    "nova": family317,
    "nova-lite": family318,
    "nova-micro": family319,
    "nova-pro": family320,
    "nvidia/meta/esm2-650m": family321,
    "nvidia/meta/esmfold": family322,
    "nvidia/nvidia/active-speaker-detection": family323,
    "nvidia/nvidia/bevformer": family324,
    "nvidia/nvidia/cosmos-predict1-5b": family325,
    "nvidia/nvidia/cosmos-transfer1-7b": family326,
    "nvidia/nvidia/cosmos-transfer2_5-2b": family327,
    "nvidia/nvidia/magpie-tts-zeroshot": family328,
    "nvidia/nvidia/nv-embed-v1": family329,
    "nvidia/nvidia/nv-embedcode-7b-v1": family330,
    "nvidia/nvidia/sparsedrive": family331,
    "nvidia/nvidia/streampetr": family332,
    "nvidia/nvidia/studiovoice": family333,
    "nvidia/nvidia/synthetic-video-detector": family334,
    "o": family335,
    "o-mini": family336,
    "o-pro": family337,
    "olmo": family338,
    "openai/codex-mini-latest": family339,
    "opencode-go/iceman-contributor-free": family340,
    "opencode-go/union-alpha": family341,
    "opencode/iceman-free": family342,
    "opencode/jev-latest": family343,
    "opencode/tidepool-alpha-free": family344,
    "opencode/union-alpha": family345,
    "openrouter/aion-labs/aion-1.0": family346,
    "openrouter/aion-labs/aion-1.0-mini": family347,
    "openrouter/alibaba/tongyi-deepresearch-30b-a3b": family348,
    "openrouter/apodex/apodex-1.1-mini:free": family349,
    "openrouter/arcee-ai/coder-large": family350,
    "openrouter/arcee-ai/maestro-reasoning": family351,
    "openrouter/arcee-ai/spotlight": family352,
    "openrouter/arcee-ai/trinity-large-preview": family353,
    "openrouter/arcee-ai/trinity-large-preview:free": family354,
    "openrouter/arcee-ai/trinity-large-thinking:free": family355,
    "openrouter/arcee-ai/trinity-mini:free": family356,
    "openrouter/arcee-ai/virtuoso-large": family357,
    "openrouter/baidu/cobuddy:free": family358,
    "openrouter/baidu/ernie-4.5-21b-a3b": family359,
    "openrouter/baidu/ernie-4.5-21b-a3b-thinking": family360,
    "openrouter/baidu/ernie-4.5-300b-a47b": family361,
    "openrouter/baidu/ernie-4.5-vl-28b-a3b": family362,
    "openrouter/baidu/qianfan-ocr-fast": family363,
    "openrouter/bytedance/ui-tars-1.5-7b": family364,
    "openrouter/elorian/glimpse": family365,
    "openrouter/essentialai/rnj-1-instruct": family366,
    "openrouter/featherless/qwerky-72b": family367,
    "openrouter/inflection/inflection-3-pi": family368,
    "openrouter/inflection/inflection-3-productivity": family369,
    "openrouter/kt/midm-k-3.0-pro": family370,
    "openrouter/kwaipilot/kat-coder-pro:free": family371,
    "openrouter/microsoft/mai-ds-r1:free": family372,
    "openrouter/microsoft/wizardlm-2-8x22b": family373,
    "openrouter/moondream/moondream3-preview": family374,
    "openrouter/moondream/moondream3.1-9b-a2b": family375,
    "openrouter/nex-agi/nex-n2-pro:free": family376,
    "openrouter/openrouter/bodybuilder": family377,
    "openrouter/openrouter/free": family378,
    "openrouter/openrouter/fusion": family379,
    "openrouter/openrouter/pareto-code": family380,
    "openrouter/openrouter/sherlock-dash-alpha": family381,
    "openrouter/openrouter/sherlock-think-alpha": family382,
    "openrouter/perceptron/perceptron-mk1.5": family383,
    "openrouter/poolside/laguna-xs.2": family384,
    "openrouter/poolside/laguna-xs.2:free": family385,
    "openrouter/prime-intellect/intellect-3": family386,
    "openrouter/prism-ml/ternary-bonsai-2-27b": family387,
    "openrouter/prism-ml/ternary-bonsai-2-9b": family388,
    "openrouter/radixark/daisyrose-27b": family389,
    "openrouter/ricursiveai/ripple-65b-preview": family390,
    "openrouter/sao10k/l3-euryale-70b": family391,
    "openrouter/sarvamai/sarvam-m:free": family392,
    "openrouter/scaledown/extract": family393,
    "openrouter/scaledown/summarize": family394,
    "openrouter/sourceful/riverflow-v2-fast-preview": family395,
    "openrouter/sourceful/riverflow-v2-max-preview": family396,
    "openrouter/sourceful/riverflow-v2-standard-preview": family397,
    "openrouter/stepfun/step-3.5-flash:free": family398,
    "openrouter/switchpoint/router": family399,
    "openrouter/thedrummer/rocinante-12b": family400,
    "openrouter/tngtech/tng-r1t-chimera:free": family401,
    "openrouter/unbiased/pareto": family402,
    "openrouter/xiaomi/mimo-v2-flash": family403,
    "openrouter/xiaomi/mimo-v2-omni": family404,
    "openrouter/xiaomi/mimo-v2-pro": family405,
    "orpheus": family406,
    "palmyra": family407,
    "parallel/speed": family408,
    "pareto": family409,
    "particle": family410,
    "perceptron-mk": family411,
    "perplexity-ai/r1-1776": family412,
    "perplexity-ai/sonar-reasoning": family413,
    "phi": family414,
    "phi-mini": family415,
    "pixtral": family416,
    "pixtral-large": family417,
    "polly": family418,
    "pplx-embed": family419,
    "qwen": family420,
    "qwen-asr-flash": family421,
    "qwen-coder": family422,
    "qwen-coder-flash": family423,
    "qwen-embedding": family424,
    "qwen-flash": family425,
    "qwen-image": family426,
    "qwen-max": family427,
    "qwen-mt-plus": family428,
    "qwen-omni-flash": family429,
    "qwen-plus": family430,
    "qwen-reranker": family431,
    "qwen-vl": family432,
    "qwen-vl-plus": family433,
    "qwen3.6": family434,
    "recraft": family435,
    "recraft-flash": family436,
    "recraft-pro": family437,
    "rednote": family438,
    "regolo-ai/brick-complexity-pro": family439,
    "reka": family440,
    "relace-apply": family441,
    "relace-search": family442,
    "remm": family443,
    "replicate/5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637": family444,
    "replicate/671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb": family445,
    "replicate/826801120720e563620006b99e412f7ed7b991dd4477e9160473d44a405ef9d9": family446,
    "replicate/847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405": family447,
    "replicate/alibaba/happyhorse-1.0": family448,
    "replicate/alibaba/qwen-image-3": family449,
    "replicate/black-forest-labs/flux-video-upscale": family450,
    "replicate/bria/fibo": family451,
    "replicate/bria/remove-background": family452,
    "replicate/cbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f": family453,
    "replicate/datacte/proteus-v0.3": family454,
    "replicate/elevenlabs/dubbing": family455,
    "replicate/elevenlabs/music": family456,
    "replicate/google/gemini-omni-1.1": family457,
    "replicate/google/nano-banana": family458,
    "replicate/google/nano-banana-2": family459,
    "replicate/google/nano-banana-pro": family460,
    "replicate/lightricks/ltx-2.5-fast": family461,
    "replicate/luma/ray-3.2": family462,
    "replicate/nightmareai/real-esrgan": family463,
    "replicate/prunaai/p-image-ideogram": family464,
    "replicate/prunaai/p-video": family465,
    "replicate/prunaai/p-video-2-pro": family466,
    "replicate/resemble-ai/chatterbox-turbo": family467,
    "replicate/runwayml/gen-4.5": family468,
    "replicate/stability-ai/stable-audio-2.5": family469,
    "ring": family470,
    "sakana-namazu": family471,
    "schematron-small": family472,
    "schematron-turbo": family473,
    "sea-lion": family474,
    "seed": family475,
    "seed-code": family476,
    "seed-lite": family477,
    "seed-mini": family478,
    "seed-pro": family479,
    "seed-turbo": family480,
    "seedance": family481,
    "seedance-mini": family482,
    "seedance-pro": family483,
    "seedream": family484,
    "seedream-lite": family485,
    "seedream-pro": family486,
    "skyfall": family487,
    "solar-mini": family488,
    "solar-pro": family489,
    "sonar": family490,
    "sonar-deep-research": family491,
    "sonar-pro": family492,
    "sonar-reasoning": family493,
    "sonar-reasoning-pro": family494,
    "sonic": family495,
    "sora": family496,
    "stable-diffusion": family497,
    "step": family498,
    "step-flash": family499,
    "text-embedding": family500,
    "the-grid-ai/agent-max": family501,
    "the-grid-ai/agent-prime": family502,
    "the-grid-ai/agent-standard": family503,
    "the-grid-ai/bytedance-pro-latest": family504,
    "the-grid-ai/code-max": family505,
    "the-grid-ai/code-prime": family506,
    "the-grid-ai/code-standard": family507,
    "the-grid-ai/text-max": family508,
    "the-grid-ai/text-prime": family509,
    "the-grid-ai/text-standard": family510,
    "titan-embed": family511,
    "toast": family512,
    "together-ai/togethercomputer/Refuel-Llm-V2": family513,
    "together-ai/togethercomputer/Refuel-Llm-V2-Small": family514,
    "trinity": family515,
    "trinity-mini": family516,
    "typesafe/jev": family517,
    "unslopnemo": family518,
    "unsloth": family519,
    "veo": family520,
    "veo-lite": family521,
    "vercel/callstack/apex": family522,
    "vercel/cohere/rerank-v5-fast": family523,
    "vercel/cohere/rerank-v5-pro": family524,
    "vercel/elorian/glimpse": family525,
    "vercel/fish-audio/drama-3": family526,
    "vercel/inception/mercury-edit-2": family527,
    "vercel/interfaze/interfaze-beta": family528,
    "vercel/openai/codex-mini": family529,
    "vercel/paperinstruments/ultramarine-1-flash": family530,
    "vercel/perplexity/sonar-reasoning": family531,
    "vercel/prime-intellect/intellect-3": family532,
    "vercel/scaledown/extract-1": family533,
    "vercel/scaledown/scaledown-extract-1": family534,
    "vercel/scaledown/scaledown-summarize-1": family535,
    "vercel/stealth/glyph-cluster": family536,
    "vercel/stealth/pixel-canary": family537,
    "vercel/topaz/proteus": family538,
    "vercel/topaz/starlight-precise-2.6": family539,
    "vercel/topaz/wonder-3.5": family540,
    "vercel/typesafe-ai/jev": family541,
    "voxtral": family542,
    "voxtral-small": family543,
    "voxtral-transcribe": family544,
    "voxtral-tts": family545,
    "voyage": family546,
    "voyage-code": family547,
    "voyage-large": family548,
    "voyage-lite": family549,
    "voyage-rerank": family550,
    "voyage-rerank-lite": family551,
    "wan": family552,
    "weaver": family553,
    "whisper": family554,
    "workers-ai/@cf/ai4bharat/indictrans2-en-indic-1B": family555,
    "workers-ai/@cf/baai/bge-base-en-v1.5": family556,
    "workers-ai/@cf/baai/bge-large-en-v1.5": family557,
    "workers-ai/@cf/baai/bge-m3": family558,
    "workers-ai/@cf/baai/bge-reranker-base": family559,
    "workers-ai/@cf/baai/bge-small-en-v1.5": family560,
    "workers-ai/@cf/cloudflare/clairic-flash": family561,
    "workers-ai/@cf/cloudflare/clef-omni": family562,
    "workers-ai/@cf/deepgram/aura-1": family563,
    "workers-ai/@cf/deepgram/aura-2-en": family564,
    "workers-ai/@cf/deepgram/aura-2-es": family565,
    "workers-ai/@cf/deepgram/flux": family566,
    "workers-ai/@cf/huggingface/distilbert-sst-2-int8": family567,
    "workers-ai/@cf/leonardo/lucid-origin": family568,
    "workers-ai/@cf/leonardo/phoenix-1.0": family569,
    "workers-ai/@cf/llava-hf/llava-1.5-7b-hf": family570,
    "workers-ai/@cf/lykon/dreamshaper-8-lcm": family571,
    "workers-ai/@cf/meta/m2m100-1.2b": family572,
    "workers-ai/@cf/myshell-ai/melotts": family573,
    "workers-ai/@cf/pfnet/plamo-embedding-1b": family574,
    "workers-ai/@cf/pipecat-ai/smart-turn-v2": family575,
  },
  providers: {
    "openai": provider0,
    "anthropic": provider1,
    "mistral": provider2,
    "morph": provider3,
    "bedrock": provider4,
    "bedrock-mantle": provider5,
    "deepinfra": provider6,
    "deepseek": provider7,
    "azure-openai": provider8,
    "grok": provider9,
    "groq": provider10,
    "huggingface": provider11,
    "openrouter": provider12,
    "parallel": provider13,
    "perplexity-ai": provider14,
    "requesty": provider15,
    "workers-ai": provider16,
    "together-ai": provider17,
    "google-ai-studio": provider18,
    "elevenlabs": provider19,
    "cartesia": provider20,
    "fireworks": provider21,
    "hyperbolic": provider22,
    "inference": provider23,
    "chutes": provider24,
    "vercel": provider25,
    "upstage": provider26,
    "github-copilot": provider27,
    "inception": provider28,
    "replicate": provider29,
    "exa": provider30,
    "fal": provider31,
    "ideogram": provider32,
    "cerebras": provider33,
    "cohere": provider34,
    "opencode": provider35,
    "opencode-go": provider36,
    "cortecs": provider37,
    "nova": provider38,
    "poolside": provider39,
    "hetzner": provider40,
    "alibaba": provider41,
    "zai": provider42,
    "moonshot": provider43,
    "minimax": provider44,
    "google-vertex": provider45,
    "ollama-cloud": provider46,
    "meta": provider47,
    "greenpt": provider48,
    "lucidquery": provider49,
    "ovhcloud": provider50,
    "regolo-ai": provider51,
    "sakana": provider52,
    "standardcompute": provider53,
    "the-grid-ai": provider54,
    "kimi-for-coding": provider55,
    "thinkingmachines": provider56,
    "typesafe": provider57,
    "kilo": provider58,
    "nebius": provider59,
    "baseten": provider60,
    "nvidia": provider61,
    "polly": provider62,
    "perplexity-agent": provider63,
  },
};

export default catalogue;
