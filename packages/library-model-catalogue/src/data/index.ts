import type { UnparsedModelCatalogue } from "../schema.js";

import family0 from "./families/agi.json" with { type: "json" };
import family1 from "./families/allenai.json" with { type: "json" };
import family2 from "./families/alpha.json" with { type: "json" };
import family3 from "./families/auto.json" with { type: "json" };
import family4 from "./families/azure-openai~2Fmai-ds-r1.json" with { type: "json" };
import family5 from "./families/azure-openai~2Fo1-preview.json" with { type: "json" };
import family6 from "./families/beam.json" with { type: "json" };
import family7 from "./families/bedrock~2Famazon.titan-text-express-v1.json" with { type: "json" };
import family8 from "./families/bedrock~2Famazon.titan-text-express-v1~3A0~3A8k.json" with { type: "json" };
import family9 from "./families/bedrock~2Fcohere.embed-english-v3.json" with { type: "json" };
import family10 from "./families/bedrock~2Fcohere.embed-multilingual-v3.json" with { type: "json" };
import family11 from "./families/bedrock~2Ftwelvelabs.marengo-embed-2-7-v1~3A0.json" with { type: "json" };
import family12 from "./families/bedrock~2Fus.twelvelabs.pegasus-1-2-v1~3A0.json" with { type: "json" };
import family13 from "./families/bge.json" with { type: "json" };
import family14 from "./families/big-pickle.json" with { type: "json" };
import family15 from "./families/canopylabs.json" with { type: "json" };
import family16 from "./families/cartesia~2Fink-2.json" with { type: "json" };
import family17 from "./families/chutes~2Fchutesai~2FDevstral-Small-2505.json" with { type: "json" };
import family18 from "./families/chutes~2Fmiromind-ai~2FMiroThinker-v1.5-235B.json" with { type: "json" };
import family19 from "./families/chutes~2FNousResearch~2FHermes-4-405B-FP8-TEE.json" with { type: "json" };
import family20 from "./families/chutes~2FNousResearch~2FHermes-4-70B.json" with { type: "json" };
import family21 from "./families/chutes~2FNousResearch~2FHermes-4.3-36B.json" with { type: "json" };
import family22 from "./families/chutes~2FOpenGVLab~2FInternVL3-78B-TEE.json" with { type: "json" };
import family23 from "./families/chutes~2Ftngtech~2FTNG-R1T-Chimera-TEE.json" with { type: "json" };
import family24 from "./families/chutes~2Ftngtech~2FTNG-R1T-Chimera-Turbo.json" with { type: "json" };
import family25 from "./families/chutes~2FXiaomiMiMo~2FMiMo-V2-Flash.json" with { type: "json" };
import family26 from "./families/claude.json" with { type: "json" };
import family27 from "./families/claude-fable.json" with { type: "json" };
import family28 from "./families/claude-haiku.json" with { type: "json" };
import family29 from "./families/claude-mythos.json" with { type: "json" };
import family30 from "./families/claude-opus.json" with { type: "json" };
import family31 from "./families/claude-sonnet.json" with { type: "json" };
import family32 from "./families/cloudflare~2Fclairic.json" with { type: "json" };
import family33 from "./families/cloudflare~2Fclef.json" with { type: "json" };
import family34 from "./families/codestral.json" with { type: "json" };
import family35 from "./families/codestral-embed.json" with { type: "json" };
import family36 from "./families/cogito.json" with { type: "json" };
import family37 from "./families/cohere-embed.json" with { type: "json" };
import family38 from "./families/cohere~2Fc4ai-aya-expanse-32b.json" with { type: "json" };
import family39 from "./families/cohere~2Fc4ai-aya-expanse-8b.json" with { type: "json" };
import family40 from "./families/cohere~2Fc4ai-aya-vision-32b.json" with { type: "json" };
import family41 from "./families/cohere~2Fc4ai-aya-vision-8b.json" with { type: "json" };
import family42 from "./families/cohere~2Ftiny-aya-earth.json" with { type: "json" };
import family43 from "./families/cohere~2Ftiny-aya-fire.json" with { type: "json" };
import family44 from "./families/cohere~2Ftiny-aya-global.json" with { type: "json" };
import family45 from "./families/cohere~2Ftiny-aya-water.json" with { type: "json" };
import family46 from "./families/command.json" with { type: "json" };
import family47 from "./families/command-a.json" with { type: "json" };
import family48 from "./families/command-r.json" with { type: "json" };
import family49 from "./families/cortecs~2Fapertus-70b.json" with { type: "json" };
import family50 from "./families/cortecs~2Fcosmos3-super-reasoner.json" with { type: "json" };
import family51 from "./families/cortecs~2Fdevstral-small-2512.json" with { type: "json" };
import family52 from "./families/cortecs~2Fhermes-4-70b.json" with { type: "json" };
import family53 from "./families/cortecs~2Fholo2-30b-a3b.json" with { type: "json" };
import family54 from "./families/cortecs~2Fintellect-3.json" with { type: "json" };
import family55 from "./families/cortecs~2Fkolibri-1.json" with { type: "json" };
import family56 from "./families/cortecs~2Fmagistral-medium-2509.json" with { type: "json" };
import family57 from "./families/cortecs~2Fmagistral-small-2509.json" with { type: "json" };
import family58 from "./families/cortecs~2Fminicpm-v-4.5.json" with { type: "json" };
import family59 from "./families/cortecs~2Fpixtral-12b-2409.json" with { type: "json" };
import family60 from "./families/deepinfra~2Fxiaomi~2Fmimo-v2.5.json" with { type: "json" };
import family61 from "./families/deepinfra~2Fxiaomi~2Fmimo-v2.5-pro.json" with { type: "json" };
import family62 from "./families/deepseek.json" with { type: "json" };
import family63 from "./families/deepseek-flash.json" with { type: "json" };
import family64 from "./families/deepseek-thinking.json" with { type: "json" };
import family65 from "./families/devstral.json" with { type: "json" };
import family66 from "./families/eleven.json" with { type: "json" };
import family67 from "./families/elevenlabs~2Fscribe_v2_realtime.json" with { type: "json" };
import family68 from "./families/ernie.json" with { type: "json" };
import family69 from "./families/exa~2Fexa.json" with { type: "json" };
import family70 from "./families/exa~2Fexa-research.json" with { type: "json" };
import family71 from "./families/exa~2Fexa-research-pro.json" with { type: "json" };
import family72 from "./families/fireworks~2Faccounts~2Ffireworks~2Fmodels~2Fember-1.json" with { type: "json" };
import family73 from "./families/flint.json" with { type: "json" };
import family74 from "./families/flux.json" with { type: "json" };
import family75 from "./families/fugu.json" with { type: "json" };
import family76 from "./families/gemini.json" with { type: "json" };
import family77 from "./families/gemini-flash.json" with { type: "json" };
import family78 from "./families/gemini-flash-lite.json" with { type: "json" };
import family79 from "./families/gemini-pro.json" with { type: "json" };
import family80 from "./families/gemma.json" with { type: "json" };
import family81 from "./families/github-copilot~2Fo3.json" with { type: "json" };
import family82 from "./families/github-copilot~2Fo3-mini.json" with { type: "json" };
import family83 from "./families/github-copilot~2Fo4-mini.json" with { type: "json" };
import family84 from "./families/github-copilot~2Fraptor-mini.json" with { type: "json" };
import family85 from "./families/glm.json" with { type: "json" };
import family86 from "./families/glm-air.json" with { type: "json" };
import family87 from "./families/glm-flash.json" with { type: "json" };
import family88 from "./families/gpt.json" with { type: "json" };
import family89 from "./families/gpt-astra.json" with { type: "json" };
import family90 from "./families/gpt-codex.json" with { type: "json" };
import family91 from "./families/gpt-codex-spark.json" with { type: "json" };
import family92 from "./families/gpt-image.json" with { type: "json" };
import family93 from "./families/gpt-luna.json" with { type: "json" };
import family94 from "./families/gpt-mini.json" with { type: "json" };
import family95 from "./families/gpt-nano.json" with { type: "json" };
import family96 from "./families/gpt-oss.json" with { type: "json" };
import family97 from "./families/gpt-pro.json" with { type: "json" };
import family98 from "./families/gpt-sol.json" with { type: "json" };
import family99 from "./families/gpt-terra.json" with { type: "json" };
import family100 from "./families/granite.json" with { type: "json" };
import family101 from "./families/greenpt~2Fgreen-embedding.json" with { type: "json" };
import family102 from "./families/greenpt~2Fgreen-rerank.json" with { type: "json" };
import family103 from "./families/greenpt~2Fgreen-s.json" with { type: "json" };
import family104 from "./families/greenpt~2Fgreen-s-pro.json" with { type: "json" };
import family105 from "./families/greenpt~2Fmetis.json" with { type: "json" };
import family106 from "./families/greenpt~2Fqwen3-embedding-8b.json" with { type: "json" };
import family107 from "./families/grok.json" with { type: "json" };
import family108 from "./families/grok-build.json" with { type: "json" };
import family109 from "./families/groq.json" with { type: "json" };
import family110 from "./families/groq~2Fallam-2-7b.json" with { type: "json" };
import family111 from "./families/hermes.json" with { type: "json" };
import family112 from "./families/huggingface~2Fstepfun-ai~2FStep-3.7-Flash.json" with { type: "json" };
import family113 from "./families/hunyuan.json" with { type: "json" };
import family114 from "./families/Hy.json" with { type: "json" };
import family115 from "./families/hy3.json" with { type: "json" };
import family116 from "./families/ideogram~2FV_3.json" with { type: "json" };
import family117 from "./families/imagen.json" with { type: "json" };
import family118 from "./families/inception~2Fmercury.json" with { type: "json" };
import family119 from "./families/inception~2Fmercury-coder.json" with { type: "json" };
import family120 from "./families/jamba.json" with { type: "json" };
import family121 from "./families/kat-coder.json" with { type: "json" };
import family122 from "./families/kilo~2F~7Eunbiased~2Fpareto-latest.json" with { type: "json" };
import family123 from "./families/kilo~2Faion-labs~2Faion-2.0.json" with { type: "json" };
import family124 from "./families/kilo~2Faion-labs~2Faion-3.0.json" with { type: "json" };
import family125 from "./families/kilo~2Faion-labs~2Faion-3.0-mini.json" with { type: "json" };
import family126 from "./families/kilo~2Faion-labs~2Faion-3.5.json" with { type: "json" };
import family127 from "./families/kilo~2Faion-labs~2Faion-3.5-mini.json" with { type: "json" };
import family128 from "./families/kilo~2Fanthracite-org~2Fmagnum-v4-72b.json" with { type: "json" };
import family129 from "./families/kilo~2Fbytedance~2Fui-tars-1.5-7b.json" with { type: "json" };
import family130 from "./families/kilo~2Fdots-studio~2Fdots-3-note-preview~3Afree.json" with { type: "json" };
import family131 from "./families/kilo~2Felorian~2Fglimpse.json" with { type: "json" };
import family132 from "./families/kilo~2Ffireworks~2Fember-1.json" with { type: "json" };
import family133 from "./families/kilo~2Fgryphe~2Fmythomax-l2-13b.json" with { type: "json" };
import family134 from "./families/kilo~2Finference-net~2Fschematron-v2-small.json" with { type: "json" };
import family135 from "./families/kilo~2Finference-net~2Fschematron-v2-turbo.json" with { type: "json" };
import family136 from "./families/kilo~2Fmicrosoft~2Fwizardlm-2-8x22b.json" with { type: "json" };
import family137 from "./families/kilo~2Fmoondream~2Fmoondream3-preview.json" with { type: "json" };
import family138 from "./families/kilo~2Fmoondream~2Fmoondream3.1-9b-a2b.json" with { type: "json" };
import family139 from "./families/kilo~2Fopenrouter~2Fauto.json" with { type: "json" };
import family140 from "./families/kilo~2Fopenrouter~2Fbodybuilder.json" with { type: "json" };
import family141 from "./families/kilo~2Fopenrouter~2Ffree.json" with { type: "json" };
import family142 from "./families/kilo~2Fopenrouter~2Fpareto-code.json" with { type: "json" };
import family143 from "./families/kilo~2Fparticle-ai~2Fparticle-1.json" with { type: "json" };
import family144 from "./families/kilo~2Fperceptron~2Fperceptron-mk1.json" with { type: "json" };
import family145 from "./families/kilo~2Fperceptron~2Fperceptron-mk1.5.json" with { type: "json" };
import family146 from "./families/kilo~2Fprism-ml~2Fternary-bonsai-2-27b.json" with { type: "json" };
import family147 from "./families/kilo~2Fprism-ml~2Fternary-bonsai-2-9b.json" with { type: "json" };
import family148 from "./families/kilo~2Frelace~2Frelace-apply-3.json" with { type: "json" };
import family149 from "./families/kilo~2Frelace~2Frelace-search.json" with { type: "json" };
import family150 from "./families/kilo~2Fscaledown~2Fextract.json" with { type: "json" };
import family151 from "./families/kilo~2Fscaledown~2Fsummarize.json" with { type: "json" };
import family152 from "./families/kilo~2Fstealth~2Fglyph-cluster.json" with { type: "json" };
import family153 from "./families/kilo~2Fstepfun~2Fstep-3.7-flash.json" with { type: "json" };
import family154 from "./families/kilo~2Fstepfun~2Fstep-5-preview.json" with { type: "json" };
import family155 from "./families/kilo~2Fthedrummer~2Fcydonia-24b-v4.1.json" with { type: "json" };
import family156 from "./families/kilo~2Fthedrummer~2Fskyfall-36b-v2.json" with { type: "json" };
import family157 from "./families/kilo~2Fthedrummer~2Funslopnemo-12b.json" with { type: "json" };
import family158 from "./families/kilo~2Funbiased~2Fpareto.json" with { type: "json" };
import family159 from "./families/kilo~2Funbiased~2Fpareto-26.10.json" with { type: "json" };
import family160 from "./families/kilo~2Funbiased~2Fpareto-26.10-preview.json" with { type: "json" };
import family161 from "./families/kilo~2Funbiased~2Fpareto-26.9.json" with { type: "json" };
import family162 from "./families/kilo~2Fundi95~2Fremm-slerp-l2-13b.json" with { type: "json" };
import family163 from "./families/kimi.json" with { type: "json" };
import family164 from "./families/kimi-k2.json" with { type: "json" };
import family165 from "./families/kimi-k3.json" with { type: "json" };
import family166 from "./families/kimi-thinking.json" with { type: "json" };
import family167 from "./families/kling.json" with { type: "json" };
import family168 from "./families/laguna.json" with { type: "json" };
import family169 from "./families/leanstral.json" with { type: "json" };
import family170 from "./families/ling.json" with { type: "json" };
import family171 from "./families/liquid.json" with { type: "json" };
import family172 from "./families/llama.json" with { type: "json" };
import family173 from "./families/longcat.json" with { type: "json" };
import family174 from "./families/lucid.json" with { type: "json" };
import family175 from "./families/lyria.json" with { type: "json" };
import family176 from "./families/magistral.json" with { type: "json" };
import family177 from "./families/magistral-medium.json" with { type: "json" };
import family178 from "./families/magistral-small.json" with { type: "json" };
import family179 from "./families/mai.json" with { type: "json" };
import family180 from "./families/mercury.json" with { type: "json" };
import family181 from "./families/mimo.json" with { type: "json" };
import family182 from "./families/mimo-v2.5.json" with { type: "json" };
import family183 from "./families/mimo-v2.5-pro.json" with { type: "json" };
import family184 from "./families/minimax.json" with { type: "json" };
import family185 from "./families/minimax-m3.json" with { type: "json" };
import family186 from "./families/minimax-music.json" with { type: "json" };
import family187 from "./families/ministral.json" with { type: "json" };
import family188 from "./families/mistral.json" with { type: "json" };
import family189 from "./families/mistral-embed.json" with { type: "json" };
import family190 from "./families/mistral-large.json" with { type: "json" };
import family191 from "./families/mistral-medium.json" with { type: "json" };
import family192 from "./families/mistral-nemo.json" with { type: "json" };
import family193 from "./families/mistral-small.json" with { type: "json" };
import family194 from "./families/mistral~2Fcodestral-embed.json" with { type: "json" };
import family195 from "./families/mistral~2Fministral-14b-latest.json" with { type: "json" };
import family196 from "./families/mistral~2Fvoxtral-mini-transcribe-realtime-2602.json" with { type: "json" };
import family197 from "./families/mixtral.json" with { type: "json" };
import family198 from "./families/model-router.json" with { type: "json" };
import family199 from "./families/morph.json" with { type: "json" };
import family200 from "./families/muse.json" with { type: "json" };
import family201 from "./families/nemotron.json" with { type: "json" };
import family202 from "./families/north.json" with { type: "json" };
import family203 from "./families/nousresearch.json" with { type: "json" };
import family204 from "./families/nova.json" with { type: "json" };
import family205 from "./families/nova-lite.json" with { type: "json" };
import family206 from "./families/nova-micro.json" with { type: "json" };
import family207 from "./families/nova-pro.json" with { type: "json" };
import family208 from "./families/nvidia~2Fmeta~2Fesm2-650m.json" with { type: "json" };
import family209 from "./families/nvidia~2Fmeta~2Fesmfold.json" with { type: "json" };
import family210 from "./families/nvidia~2Fnvidia~2Factive-speaker-detection.json" with { type: "json" };
import family211 from "./families/nvidia~2Fnvidia~2Fbevformer.json" with { type: "json" };
import family212 from "./families/nvidia~2Fnvidia~2Fcosmos-predict1-5b.json" with { type: "json" };
import family213 from "./families/nvidia~2Fnvidia~2Fcosmos-transfer1-7b.json" with { type: "json" };
import family214 from "./families/nvidia~2Fnvidia~2Fcosmos-transfer2_5-2b.json" with { type: "json" };
import family215 from "./families/nvidia~2Fnvidia~2Fmagpie-tts-zeroshot.json" with { type: "json" };
import family216 from "./families/nvidia~2Fnvidia~2Fnv-embed-v1.json" with { type: "json" };
import family217 from "./families/nvidia~2Fnvidia~2Fnv-embedcode-7b-v1.json" with { type: "json" };
import family218 from "./families/nvidia~2Fnvidia~2Fsparsedrive.json" with { type: "json" };
import family219 from "./families/nvidia~2Fnvidia~2Fstreampetr.json" with { type: "json" };
import family220 from "./families/nvidia~2Fnvidia~2Fstudiovoice.json" with { type: "json" };
import family221 from "./families/nvidia~2Fnvidia~2Fsynthetic-video-detector.json" with { type: "json" };
import family222 from "./families/nvidia~2Fstepfun-ai~2Fstep-5-preview.json" with { type: "json" };
import family223 from "./families/o.json" with { type: "json" };
import family224 from "./families/o-mini.json" with { type: "json" };
import family225 from "./families/o-pro.json" with { type: "json" };
import family226 from "./families/olmo.json" with { type: "json" };
import family227 from "./families/openai~2Fcodex-mini-latest.json" with { type: "json" };
import family228 from "./families/opencode-go~2Ficeman-contributor-free.json" with { type: "json" };
import family229 from "./families/opencode-go~2Fstep-5-preview.json" with { type: "json" };
import family230 from "./families/opencode-go~2Funion-alpha.json" with { type: "json" };
import family231 from "./families/opencode~2Fjev-latest.json" with { type: "json" };
import family232 from "./families/opencode~2Funion-alpha.json" with { type: "json" };
import family233 from "./families/openrouter~2F~7Eunbiased~2Fpareto-latest.json" with { type: "json" };
import family234 from "./families/openrouter~2Faion-labs~2Faion-1.0.json" with { type: "json" };
import family235 from "./families/openrouter~2Faion-labs~2Faion-1.0-mini.json" with { type: "json" };
import family236 from "./families/openrouter~2Faion-labs~2Faion-2.0.json" with { type: "json" };
import family237 from "./families/openrouter~2Faion-labs~2Faion-3.0.json" with { type: "json" };
import family238 from "./families/openrouter~2Faion-labs~2Faion-3.0-mini.json" with { type: "json" };
import family239 from "./families/openrouter~2Faion-labs~2Faion-3.5.json" with { type: "json" };
import family240 from "./families/openrouter~2Faion-labs~2Faion-3.5-mini.json" with { type: "json" };
import family241 from "./families/openrouter~2Falibaba~2Ftongyi-deepresearch-30b-a3b.json" with { type: "json" };
import family242 from "./families/openrouter~2Fanthracite-org~2Fmagnum-v4-72b.json" with { type: "json" };
import family243 from "./families/openrouter~2Fapodex~2Fapodex-1.1-mini~3Afree.json" with { type: "json" };
import family244 from "./families/openrouter~2Farcee-ai~2Fcoder-large.json" with { type: "json" };
import family245 from "./families/openrouter~2Farcee-ai~2Fmaestro-reasoning.json" with { type: "json" };
import family246 from "./families/openrouter~2Farcee-ai~2Fspotlight.json" with { type: "json" };
import family247 from "./families/openrouter~2Farcee-ai~2Ftrinity-large-preview.json" with { type: "json" };
import family248 from "./families/openrouter~2Farcee-ai~2Ftrinity-large-preview~3Afree.json" with { type: "json" };
import family249 from "./families/openrouter~2Farcee-ai~2Ftrinity-large-thinking~3Afree.json" with { type: "json" };
import family250 from "./families/openrouter~2Farcee-ai~2Ftrinity-mini~3Afree.json" with { type: "json" };
import family251 from "./families/openrouter~2Farcee-ai~2Fvirtuoso-large.json" with { type: "json" };
import family252 from "./families/openrouter~2Fbaidu~2Fcobuddy~3Afree.json" with { type: "json" };
import family253 from "./families/openrouter~2Fbaidu~2Fernie-4.5-21b-a3b.json" with { type: "json" };
import family254 from "./families/openrouter~2Fbaidu~2Fernie-4.5-21b-a3b-thinking.json" with { type: "json" };
import family255 from "./families/openrouter~2Fbaidu~2Fernie-4.5-300b-a47b.json" with { type: "json" };
import family256 from "./families/openrouter~2Fbaidu~2Fernie-4.5-vl-28b-a3b.json" with { type: "json" };
import family257 from "./families/openrouter~2Fbaidu~2Fqianfan-ocr-fast.json" with { type: "json" };
import family258 from "./families/openrouter~2Fbytedance~2Fui-tars-1.5-7b.json" with { type: "json" };
import family259 from "./families/openrouter~2Felorian~2Fglimpse.json" with { type: "json" };
import family260 from "./families/openrouter~2Fessentialai~2Frnj-1-instruct.json" with { type: "json" };
import family261 from "./families/openrouter~2Ffeatherless~2Fqwerky-72b.json" with { type: "json" };
import family262 from "./families/openrouter~2Ffireworks~2Fember-1.json" with { type: "json" };
import family263 from "./families/openrouter~2Fgryphe~2Fmythomax-l2-13b.json" with { type: "json" };
import family264 from "./families/openrouter~2Finference-net~2Fschematron-v2-small.json" with { type: "json" };
import family265 from "./families/openrouter~2Finference-net~2Fschematron-v2-turbo.json" with { type: "json" };
import family266 from "./families/openrouter~2Finflection~2Finflection-3-pi.json" with { type: "json" };
import family267 from "./families/openrouter~2Finflection~2Finflection-3-productivity.json" with { type: "json" };
import family268 from "./families/openrouter~2Fkwaipilot~2Fkat-coder-pro~3Afree.json" with { type: "json" };
import family269 from "./families/openrouter~2Fmicrosoft~2Fmai-ds-r1~3Afree.json" with { type: "json" };
import family270 from "./families/openrouter~2Fmicrosoft~2Fwizardlm-2-8x22b.json" with { type: "json" };
import family271 from "./families/openrouter~2Fmoondream~2Fmoondream3-preview.json" with { type: "json" };
import family272 from "./families/openrouter~2Fmoondream~2Fmoondream3.1-9b-a2b.json" with { type: "json" };
import family273 from "./families/openrouter~2Fnex-agi~2Fnex-n2-pro~3Afree.json" with { type: "json" };
import family274 from "./families/openrouter~2Fopenrouter~2Fbodybuilder.json" with { type: "json" };
import family275 from "./families/openrouter~2Fopenrouter~2Ffree.json" with { type: "json" };
import family276 from "./families/openrouter~2Fopenrouter~2Ffusion.json" with { type: "json" };
import family277 from "./families/openrouter~2Fopenrouter~2Fpareto-code.json" with { type: "json" };
import family278 from "./families/openrouter~2Fopenrouter~2Fsherlock-dash-alpha.json" with { type: "json" };
import family279 from "./families/openrouter~2Fopenrouter~2Fsherlock-think-alpha.json" with { type: "json" };
import family280 from "./families/openrouter~2Fparticle-ai~2Fparticle-1.json" with { type: "json" };
import family281 from "./families/openrouter~2Fperceptron~2Fperceptron-mk1.json" with { type: "json" };
import family282 from "./families/openrouter~2Fperceptron~2Fperceptron-mk1.5.json" with { type: "json" };
import family283 from "./families/openrouter~2Fpoolside~2Flaguna-xs.2.json" with { type: "json" };
import family284 from "./families/openrouter~2Fpoolside~2Flaguna-xs.2~3Afree.json" with { type: "json" };
import family285 from "./families/openrouter~2Fprime-intellect~2Fintellect-3.json" with { type: "json" };
import family286 from "./families/openrouter~2Fprism-ml~2Fternary-bonsai-2-27b.json" with { type: "json" };
import family287 from "./families/openrouter~2Fprism-ml~2Fternary-bonsai-2-9b.json" with { type: "json" };
import family288 from "./families/openrouter~2Frelace~2Frelace-apply-3.json" with { type: "json" };
import family289 from "./families/openrouter~2Frelace~2Frelace-search.json" with { type: "json" };
import family290 from "./families/openrouter~2Fsao10k~2Fl3-euryale-70b.json" with { type: "json" };
import family291 from "./families/openrouter~2Fsarvamai~2Fsarvam-m~3Afree.json" with { type: "json" };
import family292 from "./families/openrouter~2Fscaledown~2Fextract.json" with { type: "json" };
import family293 from "./families/openrouter~2Fscaledown~2Fsummarize.json" with { type: "json" };
import family294 from "./families/openrouter~2Fsourceful~2Friverflow-v2-fast-preview.json" with { type: "json" };
import family295 from "./families/openrouter~2Fsourceful~2Friverflow-v2-max-preview.json" with { type: "json" };
import family296 from "./families/openrouter~2Fsourceful~2Friverflow-v2-standard-preview.json" with { type: "json" };
import family297 from "./families/openrouter~2Fstepfun~2Fstep-3.5-flash~3Afree.json" with { type: "json" };
import family298 from "./families/openrouter~2Fstepfun~2Fstep-3.7-flash.json" with { type: "json" };
import family299 from "./families/openrouter~2Fstepfun~2Fstep-5-preview.json" with { type: "json" };
import family300 from "./families/openrouter~2Fswitchpoint~2Frouter.json" with { type: "json" };
import family301 from "./families/openrouter~2Fthedrummer~2Fcydonia-24b-v4.1.json" with { type: "json" };
import family302 from "./families/openrouter~2Fthedrummer~2Frocinante-12b.json" with { type: "json" };
import family303 from "./families/openrouter~2Fthedrummer~2Fskyfall-36b-v2.json" with { type: "json" };
import family304 from "./families/openrouter~2Fthedrummer~2Funslopnemo-12b.json" with { type: "json" };
import family305 from "./families/openrouter~2Ftngtech~2Ftng-r1t-chimera~3Afree.json" with { type: "json" };
import family306 from "./families/openrouter~2Funbiased~2Fpareto.json" with { type: "json" };
import family307 from "./families/openrouter~2Funbiased~2Fpareto-26.10.json" with { type: "json" };
import family308 from "./families/openrouter~2Funbiased~2Fpareto-26.10-preview.json" with { type: "json" };
import family309 from "./families/openrouter~2Funbiased~2Fpareto-26.9.json" with { type: "json" };
import family310 from "./families/openrouter~2Fundi95~2Fremm-slerp-l2-13b.json" with { type: "json" };
import family311 from "./families/openrouter~2Fxiaomi~2Fmimo-v2-flash.json" with { type: "json" };
import family312 from "./families/openrouter~2Fxiaomi~2Fmimo-v2-omni.json" with { type: "json" };
import family313 from "./families/openrouter~2Fxiaomi~2Fmimo-v2-pro.json" with { type: "json" };
import family314 from "./families/palmyra.json" with { type: "json" };
import family315 from "./families/parallel~2Fspeed.json" with { type: "json" };
import family316 from "./families/perplexity-ai~2Fr1-1776.json" with { type: "json" };
import family317 from "./families/perplexity-ai~2Fsonar-reasoning.json" with { type: "json" };
import family318 from "./families/phi.json" with { type: "json" };
import family319 from "./families/pixtral.json" with { type: "json" };
import family320 from "./families/polly.json" with { type: "json" };
import family321 from "./families/qwen.json" with { type: "json" };
import family322 from "./families/qwen3.5.json" with { type: "json" };
import family323 from "./families/qwen3.6.json" with { type: "json" };
import family324 from "./families/qwen3.7-plus.json" with { type: "json" };
import family325 from "./families/qwen3.8-max.json" with { type: "json" };
import family326 from "./families/recraft.json" with { type: "json" };
import family327 from "./families/rednote.json" with { type: "json" };
import family328 from "./families/regolo-ai~2Fapertus-70b.json" with { type: "json" };
import family329 from "./families/regolo-ai~2Fbrick-complexity-pro.json" with { type: "json" };
import family330 from "./families/reka.json" with { type: "json" };
import family331 from "./families/replicate~2F5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637.json" with { type: "json" };
import family332 from "./families/replicate~2F671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb.json" with { type: "json" };
import family333 from "./families/replicate~2F826801120720e563620006b99e412f7ed7b991dd4477e9160473d44a405ef9d9.json" with { type: "json" };
import family334 from "./families/replicate~2F847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405.json" with { type: "json" };
import family335 from "./families/replicate~2Falibaba~2Fhappyhorse-1.0.json" with { type: "json" };
import family336 from "./families/replicate~2Falibaba~2Fqwen-image-3.json" with { type: "json" };
import family337 from "./families/replicate~2Fblack-forest-labs~2Fflux-video-upscale.json" with { type: "json" };
import family338 from "./families/replicate~2Fbria~2Ffibo.json" with { type: "json" };
import family339 from "./families/replicate~2Fbria~2Fremove-background.json" with { type: "json" };
import family340 from "./families/replicate~2Fcbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f.json" with { type: "json" };
import family341 from "./families/replicate~2Fdatacte~2Fproteus-v0.3.json" with { type: "json" };
import family342 from "./families/replicate~2Felevenlabs~2Fdubbing.json" with { type: "json" };
import family343 from "./families/replicate~2Felevenlabs~2Fmusic.json" with { type: "json" };
import family344 from "./families/replicate~2Fgoogle~2Fgemini-omni-1.1.json" with { type: "json" };
import family345 from "./families/replicate~2Fgoogle~2Fnano-banana.json" with { type: "json" };
import family346 from "./families/replicate~2Fgoogle~2Fnano-banana-2.json" with { type: "json" };
import family347 from "./families/replicate~2Fgoogle~2Fnano-banana-pro.json" with { type: "json" };
import family348 from "./families/replicate~2Flightricks~2Fltx-2.5-fast.json" with { type: "json" };
import family349 from "./families/replicate~2Fluma~2Fray-3.2.json" with { type: "json" };
import family350 from "./families/replicate~2Fnightmareai~2Freal-esrgan.json" with { type: "json" };
import family351 from "./families/replicate~2Fprunaai~2Fp-image-ideogram.json" with { type: "json" };
import family352 from "./families/replicate~2Fprunaai~2Fp-video.json" with { type: "json" };
import family353 from "./families/replicate~2Fprunaai~2Fp-video-2-pro.json" with { type: "json" };
import family354 from "./families/replicate~2Fresemble-ai~2Fchatterbox-turbo.json" with { type: "json" };
import family355 from "./families/replicate~2Frunwayml~2Fgen-4.5.json" with { type: "json" };
import family356 from "./families/replicate~2Fstability-ai~2Fstable-audio-2.5.json" with { type: "json" };
import family357 from "./families/requesty~2Fstep-3.7-flash.json" with { type: "json" };
import family358 from "./families/requesty~2Fstep-5-preview.json" with { type: "json" };
import family359 from "./families/ring.json" with { type: "json" };
import family360 from "./families/sakana-namazu.json" with { type: "json" };
import family361 from "./families/seed.json" with { type: "json" };
import family362 from "./families/solar-mini.json" with { type: "json" };
import family363 from "./families/solar-pro.json" with { type: "json" };
import family364 from "./families/sonar.json" with { type: "json" };
import family365 from "./families/sonar-deep-research.json" with { type: "json" };
import family366 from "./families/sonar-pro.json" with { type: "json" };
import family367 from "./families/sonar-reasoning.json" with { type: "json" };
import family368 from "./families/sonic.json" with { type: "json" };
import family369 from "./families/sora.json" with { type: "json" };
import family370 from "./families/stable-diffusion.json" with { type: "json" };
import family371 from "./families/step.json" with { type: "json" };
import family372 from "./families/text-embedding.json" with { type: "json" };
import family373 from "./families/the-grid-ai~2Fagent-max.json" with { type: "json" };
import family374 from "./families/the-grid-ai~2Fagent-prime.json" with { type: "json" };
import family375 from "./families/the-grid-ai~2Fagent-standard.json" with { type: "json" };
import family376 from "./families/the-grid-ai~2Fbytedance-pro-latest.json" with { type: "json" };
import family377 from "./families/the-grid-ai~2Fcode-max.json" with { type: "json" };
import family378 from "./families/the-grid-ai~2Fcode-prime.json" with { type: "json" };
import family379 from "./families/the-grid-ai~2Fcode-standard.json" with { type: "json" };
import family380 from "./families/the-grid-ai~2Ftext-max.json" with { type: "json" };
import family381 from "./families/the-grid-ai~2Ftext-prime.json" with { type: "json" };
import family382 from "./families/the-grid-ai~2Ftext-standard.json" with { type: "json" };
import family383 from "./families/titan-embed.json" with { type: "json" };
import family384 from "./families/together-ai~2Ftogethercomputer~2FRefuel-Llm-V2.json" with { type: "json" };
import family385 from "./families/together-ai~2Ftogethercomputer~2FRefuel-Llm-V2-Small.json" with { type: "json" };
import family386 from "./families/trinity.json" with { type: "json" };
import family387 from "./families/trinity-mini.json" with { type: "json" };
import family388 from "./families/typesafe~2Fjev.json" with { type: "json" };
import family389 from "./families/unsloth.json" with { type: "json" };
import family390 from "./families/v0.json" with { type: "json" };
import family391 from "./families/veo.json" with { type: "json" };
import family392 from "./families/vercel~2Fcallstack~2Fapex.json" with { type: "json" };
import family393 from "./families/vercel~2Fcohere~2Frerank-v5-fast.json" with { type: "json" };
import family394 from "./families/vercel~2Fcohere~2Frerank-v5-pro.json" with { type: "json" };
import family395 from "./families/vercel~2Felorian~2Fglimpse.json" with { type: "json" };
import family396 from "./families/vercel~2Ffireworks~2Fember-1.json" with { type: "json" };
import family397 from "./families/vercel~2Ffish-audio~2Fdrama-3.json" with { type: "json" };
import family398 from "./families/vercel~2Fheygen~2Fheygen-video-1.json" with { type: "json" };
import family399 from "./families/vercel~2Finception~2Fmercury-edit-2.json" with { type: "json" };
import family400 from "./families/vercel~2Finterfaze~2Finterfaze-beta.json" with { type: "json" };
import family401 from "./families/vercel~2Fmixedbread~2Ftoast-1.json" with { type: "json" };
import family402 from "./families/vercel~2Fopenai~2Fcodex-mini.json" with { type: "json" };
import family403 from "./families/vercel~2Fparticle~2Fparticle-1.json" with { type: "json" };
import family404 from "./families/vercel~2Fperplexity~2Fpplx-embed-v1-4b.json" with { type: "json" };
import family405 from "./families/vercel~2Fperplexity~2Fsonar-reasoning.json" with { type: "json" };
import family406 from "./families/vercel~2Fprime-intellect~2Fintellect-3.json" with { type: "json" };
import family407 from "./families/vercel~2Fquiverai~2Farrow-2.json" with { type: "json" };
import family408 from "./families/vercel~2Fquiverai~2Farrow-2-telos.json" with { type: "json" };
import family409 from "./families/vercel~2Fscaledown~2Fscaledown-extract-1.json" with { type: "json" };
import family410 from "./families/vercel~2Fscaledown~2Fscaledown-summarize-1.json" with { type: "json" };
import family411 from "./families/vercel~2Fstealth~2Fglyph-cluster.json" with { type: "json" };
import family412 from "./families/vercel~2Fstealth~2Fpixel-canary.json" with { type: "json" };
import family413 from "./families/vercel~2Ftopaz~2Fproteus.json" with { type: "json" };
import family414 from "./families/vercel~2Ftopaz~2Fstarlight-precise-2.6.json" with { type: "json" };
import family415 from "./families/vercel~2Ftopaz~2Fwonder-3.5.json" with { type: "json" };
import family416 from "./families/vercel~2Ftypesafe-ai~2Fjev.json" with { type: "json" };
import family417 from "./families/voxtral.json" with { type: "json" };
import family418 from "./families/voyage.json" with { type: "json" };
import family419 from "./families/whisper.json" with { type: "json" };
import family420 from "./families/workers-ai~2F~40cf~2Fai4bharat~2Findictrans2-en-indic-1B.json" with { type: "json" };
import family421 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-base-en-v1.5.json" with { type: "json" };
import family422 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-large-en-v1.5.json" with { type: "json" };
import family423 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-m3.json" with { type: "json" };
import family424 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-reranker-base.json" with { type: "json" };
import family425 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-small-en-v1.5.json" with { type: "json" };
import family426 from "./families/workers-ai~2F~40cf~2Fcloudflare~2Fclef-omni.json" with { type: "json" };
import family427 from "./families/workers-ai~2F~40cf~2Fdeepgram~2Faura-1.json" with { type: "json" };
import family428 from "./families/workers-ai~2F~40cf~2Fdeepgram~2Faura-2-en.json" with { type: "json" };
import family429 from "./families/workers-ai~2F~40cf~2Fdeepgram~2Faura-2-es.json" with { type: "json" };
import family430 from "./families/workers-ai~2F~40cf~2Fdeepgram~2Fflux.json" with { type: "json" };
import family431 from "./families/workers-ai~2F~40cf~2Fhuggingface~2Fdistilbert-sst-2-int8.json" with { type: "json" };
import family432 from "./families/workers-ai~2F~40cf~2Fleonardo~2Flucid-origin.json" with { type: "json" };
import family433 from "./families/workers-ai~2F~40cf~2Fleonardo~2Fphoenix-1.0.json" with { type: "json" };
import family434 from "./families/workers-ai~2F~40cf~2Fllava-hf~2Fllava-1.5-7b-hf.json" with { type: "json" };
import family435 from "./families/workers-ai~2F~40cf~2Flykon~2Fdreamshaper-8-lcm.json" with { type: "json" };
import family436 from "./families/workers-ai~2F~40cf~2Fmeta~2Fm2m100-1.2b.json" with { type: "json" };
import family437 from "./families/workers-ai~2F~40cf~2Fmyshell-ai~2Fmelotts.json" with { type: "json" };
import family438 from "./families/workers-ai~2F~40cf~2Fpfnet~2Fplamo-embedding-1b.json" with { type: "json" };
import family439 from "./families/workers-ai~2F~40cf~2Fpipecat-ai~2Fsmart-turn-v2.json" with { type: "json" };
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

const catalogue: UnparsedModelCatalogue = {
  families: {
    "agi": family0,
    "allenai": family1,
    "alpha": family2,
    "auto": family3,
    "azure-openai/mai-ds-r1": family4,
    "azure-openai/o1-preview": family5,
    "beam": family6,
    "bedrock/amazon.titan-text-express-v1": family7,
    "bedrock/amazon.titan-text-express-v1:0:8k": family8,
    "bedrock/cohere.embed-english-v3": family9,
    "bedrock/cohere.embed-multilingual-v3": family10,
    "bedrock/twelvelabs.marengo-embed-2-7-v1:0": family11,
    "bedrock/us.twelvelabs.pegasus-1-2-v1:0": family12,
    "bge": family13,
    "big-pickle": family14,
    "canopylabs": family15,
    "cartesia/ink-2": family16,
    "chutes/chutesai/Devstral-Small-2505": family17,
    "chutes/miromind-ai/MiroThinker-v1.5-235B": family18,
    "chutes/NousResearch/Hermes-4-405B-FP8-TEE": family19,
    "chutes/NousResearch/Hermes-4-70B": family20,
    "chutes/NousResearch/Hermes-4.3-36B": family21,
    "chutes/OpenGVLab/InternVL3-78B-TEE": family22,
    "chutes/tngtech/TNG-R1T-Chimera-TEE": family23,
    "chutes/tngtech/TNG-R1T-Chimera-Turbo": family24,
    "chutes/XiaomiMiMo/MiMo-V2-Flash": family25,
    "claude": family26,
    "claude-fable": family27,
    "claude-haiku": family28,
    "claude-mythos": family29,
    "claude-opus": family30,
    "claude-sonnet": family31,
    "cloudflare/clairic": family32,
    "cloudflare/clef": family33,
    "codestral": family34,
    "codestral-embed": family35,
    "cogito": family36,
    "cohere-embed": family37,
    "cohere/c4ai-aya-expanse-32b": family38,
    "cohere/c4ai-aya-expanse-8b": family39,
    "cohere/c4ai-aya-vision-32b": family40,
    "cohere/c4ai-aya-vision-8b": family41,
    "cohere/tiny-aya-earth": family42,
    "cohere/tiny-aya-fire": family43,
    "cohere/tiny-aya-global": family44,
    "cohere/tiny-aya-water": family45,
    "command": family46,
    "command-a": family47,
    "command-r": family48,
    "cortecs/apertus-70b": family49,
    "cortecs/cosmos3-super-reasoner": family50,
    "cortecs/devstral-small-2512": family51,
    "cortecs/hermes-4-70b": family52,
    "cortecs/holo2-30b-a3b": family53,
    "cortecs/intellect-3": family54,
    "cortecs/kolibri-1": family55,
    "cortecs/magistral-medium-2509": family56,
    "cortecs/magistral-small-2509": family57,
    "cortecs/minicpm-v-4.5": family58,
    "cortecs/pixtral-12b-2409": family59,
    "deepinfra/xiaomi/mimo-v2.5": family60,
    "deepinfra/xiaomi/mimo-v2.5-pro": family61,
    "deepseek": family62,
    "deepseek-flash": family63,
    "deepseek-thinking": family64,
    "devstral": family65,
    "eleven": family66,
    "elevenlabs/scribe_v2_realtime": family67,
    "ernie": family68,
    "exa/exa": family69,
    "exa/exa-research": family70,
    "exa/exa-research-pro": family71,
    "fireworks/accounts/fireworks/models/ember-1": family72,
    "flint": family73,
    "flux": family74,
    "fugu": family75,
    "gemini": family76,
    "gemini-flash": family77,
    "gemini-flash-lite": family78,
    "gemini-pro": family79,
    "gemma": family80,
    "github-copilot/o3": family81,
    "github-copilot/o3-mini": family82,
    "github-copilot/o4-mini": family83,
    "github-copilot/raptor-mini": family84,
    "glm": family85,
    "glm-air": family86,
    "glm-flash": family87,
    "gpt": family88,
    "gpt-astra": family89,
    "gpt-codex": family90,
    "gpt-codex-spark": family91,
    "gpt-image": family92,
    "gpt-luna": family93,
    "gpt-mini": family94,
    "gpt-nano": family95,
    "gpt-oss": family96,
    "gpt-pro": family97,
    "gpt-sol": family98,
    "gpt-terra": family99,
    "granite": family100,
    "greenpt/green-embedding": family101,
    "greenpt/green-rerank": family102,
    "greenpt/green-s": family103,
    "greenpt/green-s-pro": family104,
    "greenpt/metis": family105,
    "greenpt/qwen3-embedding-8b": family106,
    "grok": family107,
    "grok-build": family108,
    "groq": family109,
    "groq/allam-2-7b": family110,
    "hermes": family111,
    "huggingface/stepfun-ai/Step-3.7-Flash": family112,
    "hunyuan": family113,
    "Hy": family114,
    "hy3": family115,
    "ideogram/V_3": family116,
    "imagen": family117,
    "inception/mercury": family118,
    "inception/mercury-coder": family119,
    "jamba": family120,
    "kat-coder": family121,
    "kilo/~unbiased/pareto-latest": family122,
    "kilo/aion-labs/aion-2.0": family123,
    "kilo/aion-labs/aion-3.0": family124,
    "kilo/aion-labs/aion-3.0-mini": family125,
    "kilo/aion-labs/aion-3.5": family126,
    "kilo/aion-labs/aion-3.5-mini": family127,
    "kilo/anthracite-org/magnum-v4-72b": family128,
    "kilo/bytedance/ui-tars-1.5-7b": family129,
    "kilo/dots-studio/dots-3-note-preview:free": family130,
    "kilo/elorian/glimpse": family131,
    "kilo/fireworks/ember-1": family132,
    "kilo/gryphe/mythomax-l2-13b": family133,
    "kilo/inference-net/schematron-v2-small": family134,
    "kilo/inference-net/schematron-v2-turbo": family135,
    "kilo/microsoft/wizardlm-2-8x22b": family136,
    "kilo/moondream/moondream3-preview": family137,
    "kilo/moondream/moondream3.1-9b-a2b": family138,
    "kilo/openrouter/auto": family139,
    "kilo/openrouter/bodybuilder": family140,
    "kilo/openrouter/free": family141,
    "kilo/openrouter/pareto-code": family142,
    "kilo/particle-ai/particle-1": family143,
    "kilo/perceptron/perceptron-mk1": family144,
    "kilo/perceptron/perceptron-mk1.5": family145,
    "kilo/prism-ml/ternary-bonsai-2-27b": family146,
    "kilo/prism-ml/ternary-bonsai-2-9b": family147,
    "kilo/relace/relace-apply-3": family148,
    "kilo/relace/relace-search": family149,
    "kilo/scaledown/extract": family150,
    "kilo/scaledown/summarize": family151,
    "kilo/stealth/glyph-cluster": family152,
    "kilo/stepfun/step-3.7-flash": family153,
    "kilo/stepfun/step-5-preview": family154,
    "kilo/thedrummer/cydonia-24b-v4.1": family155,
    "kilo/thedrummer/skyfall-36b-v2": family156,
    "kilo/thedrummer/unslopnemo-12b": family157,
    "kilo/unbiased/pareto": family158,
    "kilo/unbiased/pareto-26.10": family159,
    "kilo/unbiased/pareto-26.10-preview": family160,
    "kilo/unbiased/pareto-26.9": family161,
    "kilo/undi95/remm-slerp-l2-13b": family162,
    "kimi": family163,
    "kimi-k2": family164,
    "kimi-k3": family165,
    "kimi-thinking": family166,
    "kling": family167,
    "laguna": family168,
    "leanstral": family169,
    "ling": family170,
    "liquid": family171,
    "llama": family172,
    "longcat": family173,
    "lucid": family174,
    "lyria": family175,
    "magistral": family176,
    "magistral-medium": family177,
    "magistral-small": family178,
    "mai": family179,
    "mercury": family180,
    "mimo": family181,
    "mimo-v2.5": family182,
    "mimo-v2.5-pro": family183,
    "minimax": family184,
    "minimax-m3": family185,
    "minimax-music": family186,
    "ministral": family187,
    "mistral": family188,
    "mistral-embed": family189,
    "mistral-large": family190,
    "mistral-medium": family191,
    "mistral-nemo": family192,
    "mistral-small": family193,
    "mistral/codestral-embed": family194,
    "mistral/ministral-14b-latest": family195,
    "mistral/voxtral-mini-transcribe-realtime-2602": family196,
    "mixtral": family197,
    "model-router": family198,
    "morph": family199,
    "muse": family200,
    "nemotron": family201,
    "north": family202,
    "nousresearch": family203,
    "nova": family204,
    "nova-lite": family205,
    "nova-micro": family206,
    "nova-pro": family207,
    "nvidia/meta/esm2-650m": family208,
    "nvidia/meta/esmfold": family209,
    "nvidia/nvidia/active-speaker-detection": family210,
    "nvidia/nvidia/bevformer": family211,
    "nvidia/nvidia/cosmos-predict1-5b": family212,
    "nvidia/nvidia/cosmos-transfer1-7b": family213,
    "nvidia/nvidia/cosmos-transfer2_5-2b": family214,
    "nvidia/nvidia/magpie-tts-zeroshot": family215,
    "nvidia/nvidia/nv-embed-v1": family216,
    "nvidia/nvidia/nv-embedcode-7b-v1": family217,
    "nvidia/nvidia/sparsedrive": family218,
    "nvidia/nvidia/streampetr": family219,
    "nvidia/nvidia/studiovoice": family220,
    "nvidia/nvidia/synthetic-video-detector": family221,
    "nvidia/stepfun-ai/step-5-preview": family222,
    "o": family223,
    "o-mini": family224,
    "o-pro": family225,
    "olmo": family226,
    "openai/codex-mini-latest": family227,
    "opencode-go/iceman-contributor-free": family228,
    "opencode-go/step-5-preview": family229,
    "opencode-go/union-alpha": family230,
    "opencode/jev-latest": family231,
    "opencode/union-alpha": family232,
    "openrouter/~unbiased/pareto-latest": family233,
    "openrouter/aion-labs/aion-1.0": family234,
    "openrouter/aion-labs/aion-1.0-mini": family235,
    "openrouter/aion-labs/aion-2.0": family236,
    "openrouter/aion-labs/aion-3.0": family237,
    "openrouter/aion-labs/aion-3.0-mini": family238,
    "openrouter/aion-labs/aion-3.5": family239,
    "openrouter/aion-labs/aion-3.5-mini": family240,
    "openrouter/alibaba/tongyi-deepresearch-30b-a3b": family241,
    "openrouter/anthracite-org/magnum-v4-72b": family242,
    "openrouter/apodex/apodex-1.1-mini:free": family243,
    "openrouter/arcee-ai/coder-large": family244,
    "openrouter/arcee-ai/maestro-reasoning": family245,
    "openrouter/arcee-ai/spotlight": family246,
    "openrouter/arcee-ai/trinity-large-preview": family247,
    "openrouter/arcee-ai/trinity-large-preview:free": family248,
    "openrouter/arcee-ai/trinity-large-thinking:free": family249,
    "openrouter/arcee-ai/trinity-mini:free": family250,
    "openrouter/arcee-ai/virtuoso-large": family251,
    "openrouter/baidu/cobuddy:free": family252,
    "openrouter/baidu/ernie-4.5-21b-a3b": family253,
    "openrouter/baidu/ernie-4.5-21b-a3b-thinking": family254,
    "openrouter/baidu/ernie-4.5-300b-a47b": family255,
    "openrouter/baidu/ernie-4.5-vl-28b-a3b": family256,
    "openrouter/baidu/qianfan-ocr-fast": family257,
    "openrouter/bytedance/ui-tars-1.5-7b": family258,
    "openrouter/elorian/glimpse": family259,
    "openrouter/essentialai/rnj-1-instruct": family260,
    "openrouter/featherless/qwerky-72b": family261,
    "openrouter/fireworks/ember-1": family262,
    "openrouter/gryphe/mythomax-l2-13b": family263,
    "openrouter/inference-net/schematron-v2-small": family264,
    "openrouter/inference-net/schematron-v2-turbo": family265,
    "openrouter/inflection/inflection-3-pi": family266,
    "openrouter/inflection/inflection-3-productivity": family267,
    "openrouter/kwaipilot/kat-coder-pro:free": family268,
    "openrouter/microsoft/mai-ds-r1:free": family269,
    "openrouter/microsoft/wizardlm-2-8x22b": family270,
    "openrouter/moondream/moondream3-preview": family271,
    "openrouter/moondream/moondream3.1-9b-a2b": family272,
    "openrouter/nex-agi/nex-n2-pro:free": family273,
    "openrouter/openrouter/bodybuilder": family274,
    "openrouter/openrouter/free": family275,
    "openrouter/openrouter/fusion": family276,
    "openrouter/openrouter/pareto-code": family277,
    "openrouter/openrouter/sherlock-dash-alpha": family278,
    "openrouter/openrouter/sherlock-think-alpha": family279,
    "openrouter/particle-ai/particle-1": family280,
    "openrouter/perceptron/perceptron-mk1": family281,
    "openrouter/perceptron/perceptron-mk1.5": family282,
    "openrouter/poolside/laguna-xs.2": family283,
    "openrouter/poolside/laguna-xs.2:free": family284,
    "openrouter/prime-intellect/intellect-3": family285,
    "openrouter/prism-ml/ternary-bonsai-2-27b": family286,
    "openrouter/prism-ml/ternary-bonsai-2-9b": family287,
    "openrouter/relace/relace-apply-3": family288,
    "openrouter/relace/relace-search": family289,
    "openrouter/sao10k/l3-euryale-70b": family290,
    "openrouter/sarvamai/sarvam-m:free": family291,
    "openrouter/scaledown/extract": family292,
    "openrouter/scaledown/summarize": family293,
    "openrouter/sourceful/riverflow-v2-fast-preview": family294,
    "openrouter/sourceful/riverflow-v2-max-preview": family295,
    "openrouter/sourceful/riverflow-v2-standard-preview": family296,
    "openrouter/stepfun/step-3.5-flash:free": family297,
    "openrouter/stepfun/step-3.7-flash": family298,
    "openrouter/stepfun/step-5-preview": family299,
    "openrouter/switchpoint/router": family300,
    "openrouter/thedrummer/cydonia-24b-v4.1": family301,
    "openrouter/thedrummer/rocinante-12b": family302,
    "openrouter/thedrummer/skyfall-36b-v2": family303,
    "openrouter/thedrummer/unslopnemo-12b": family304,
    "openrouter/tngtech/tng-r1t-chimera:free": family305,
    "openrouter/unbiased/pareto": family306,
    "openrouter/unbiased/pareto-26.10": family307,
    "openrouter/unbiased/pareto-26.10-preview": family308,
    "openrouter/unbiased/pareto-26.9": family309,
    "openrouter/undi95/remm-slerp-l2-13b": family310,
    "openrouter/xiaomi/mimo-v2-flash": family311,
    "openrouter/xiaomi/mimo-v2-omni": family312,
    "openrouter/xiaomi/mimo-v2-pro": family313,
    "palmyra": family314,
    "parallel/speed": family315,
    "perplexity-ai/r1-1776": family316,
    "perplexity-ai/sonar-reasoning": family317,
    "phi": family318,
    "pixtral": family319,
    "polly": family320,
    "qwen": family321,
    "qwen3.5": family322,
    "qwen3.6": family323,
    "qwen3.7-plus": family324,
    "qwen3.8-max": family325,
    "recraft": family326,
    "rednote": family327,
    "regolo-ai/apertus-70b": family328,
    "regolo-ai/brick-complexity-pro": family329,
    "reka": family330,
    "replicate/5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637": family331,
    "replicate/671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb": family332,
    "replicate/826801120720e563620006b99e412f7ed7b991dd4477e9160473d44a405ef9d9": family333,
    "replicate/847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405": family334,
    "replicate/alibaba/happyhorse-1.0": family335,
    "replicate/alibaba/qwen-image-3": family336,
    "replicate/black-forest-labs/flux-video-upscale": family337,
    "replicate/bria/fibo": family338,
    "replicate/bria/remove-background": family339,
    "replicate/cbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f": family340,
    "replicate/datacte/proteus-v0.3": family341,
    "replicate/elevenlabs/dubbing": family342,
    "replicate/elevenlabs/music": family343,
    "replicate/google/gemini-omni-1.1": family344,
    "replicate/google/nano-banana": family345,
    "replicate/google/nano-banana-2": family346,
    "replicate/google/nano-banana-pro": family347,
    "replicate/lightricks/ltx-2.5-fast": family348,
    "replicate/luma/ray-3.2": family349,
    "replicate/nightmareai/real-esrgan": family350,
    "replicate/prunaai/p-image-ideogram": family351,
    "replicate/prunaai/p-video": family352,
    "replicate/prunaai/p-video-2-pro": family353,
    "replicate/resemble-ai/chatterbox-turbo": family354,
    "replicate/runwayml/gen-4.5": family355,
    "replicate/stability-ai/stable-audio-2.5": family356,
    "requesty/step-3.7-flash": family357,
    "requesty/step-5-preview": family358,
    "ring": family359,
    "sakana-namazu": family360,
    "seed": family361,
    "solar-mini": family362,
    "solar-pro": family363,
    "sonar": family364,
    "sonar-deep-research": family365,
    "sonar-pro": family366,
    "sonar-reasoning": family367,
    "sonic": family368,
    "sora": family369,
    "stable-diffusion": family370,
    "step": family371,
    "text-embedding": family372,
    "the-grid-ai/agent-max": family373,
    "the-grid-ai/agent-prime": family374,
    "the-grid-ai/agent-standard": family375,
    "the-grid-ai/bytedance-pro-latest": family376,
    "the-grid-ai/code-max": family377,
    "the-grid-ai/code-prime": family378,
    "the-grid-ai/code-standard": family379,
    "the-grid-ai/text-max": family380,
    "the-grid-ai/text-prime": family381,
    "the-grid-ai/text-standard": family382,
    "titan-embed": family383,
    "together-ai/togethercomputer/Refuel-Llm-V2": family384,
    "together-ai/togethercomputer/Refuel-Llm-V2-Small": family385,
    "trinity": family386,
    "trinity-mini": family387,
    "typesafe/jev": family388,
    "unsloth": family389,
    "v0": family390,
    "veo": family391,
    "vercel/callstack/apex": family392,
    "vercel/cohere/rerank-v5-fast": family393,
    "vercel/cohere/rerank-v5-pro": family394,
    "vercel/elorian/glimpse": family395,
    "vercel/fireworks/ember-1": family396,
    "vercel/fish-audio/drama-3": family397,
    "vercel/heygen/heygen-video-1": family398,
    "vercel/inception/mercury-edit-2": family399,
    "vercel/interfaze/interfaze-beta": family400,
    "vercel/mixedbread/toast-1": family401,
    "vercel/openai/codex-mini": family402,
    "vercel/particle/particle-1": family403,
    "vercel/perplexity/pplx-embed-v1-4b": family404,
    "vercel/perplexity/sonar-reasoning": family405,
    "vercel/prime-intellect/intellect-3": family406,
    "vercel/quiverai/arrow-2": family407,
    "vercel/quiverai/arrow-2-telos": family408,
    "vercel/scaledown/scaledown-extract-1": family409,
    "vercel/scaledown/scaledown-summarize-1": family410,
    "vercel/stealth/glyph-cluster": family411,
    "vercel/stealth/pixel-canary": family412,
    "vercel/topaz/proteus": family413,
    "vercel/topaz/starlight-precise-2.6": family414,
    "vercel/topaz/wonder-3.5": family415,
    "vercel/typesafe-ai/jev": family416,
    "voxtral": family417,
    "voyage": family418,
    "whisper": family419,
    "workers-ai/@cf/ai4bharat/indictrans2-en-indic-1B": family420,
    "workers-ai/@cf/baai/bge-base-en-v1.5": family421,
    "workers-ai/@cf/baai/bge-large-en-v1.5": family422,
    "workers-ai/@cf/baai/bge-m3": family423,
    "workers-ai/@cf/baai/bge-reranker-base": family424,
    "workers-ai/@cf/baai/bge-small-en-v1.5": family425,
    "workers-ai/@cf/cloudflare/clef-omni": family426,
    "workers-ai/@cf/deepgram/aura-1": family427,
    "workers-ai/@cf/deepgram/aura-2-en": family428,
    "workers-ai/@cf/deepgram/aura-2-es": family429,
    "workers-ai/@cf/deepgram/flux": family430,
    "workers-ai/@cf/huggingface/distilbert-sst-2-int8": family431,
    "workers-ai/@cf/leonardo/lucid-origin": family432,
    "workers-ai/@cf/leonardo/phoenix-1.0": family433,
    "workers-ai/@cf/llava-hf/llava-1.5-7b-hf": family434,
    "workers-ai/@cf/lykon/dreamshaper-8-lcm": family435,
    "workers-ai/@cf/meta/m2m100-1.2b": family436,
    "workers-ai/@cf/myshell-ai/melotts": family437,
    "workers-ai/@cf/pfnet/plamo-embedding-1b": family438,
    "workers-ai/@cf/pipecat-ai/smart-turn-v2": family439,
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
  },
};

export default catalogue;
