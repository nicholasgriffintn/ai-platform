import type { UnparsedModelCatalogue } from "../schema.js";

import family0 from "./families/agi.json" with { type: "json" };
import family1 from "./families/allenai.json" with { type: "json" };
import family2 from "./families/alpha.json" with { type: "json" };
import family3 from "./families/auto.json" with { type: "json" };
import family4 from "./families/azure-openai~2Fmai-ds-r1.json" with { type: "json" };
import family5 from "./families/azure-openai~2Fo1-preview.json" with { type: "json" };
import family6 from "./families/bedrock~2Famazon.titan-text-express-v1.json" with { type: "json" };
import family7 from "./families/bedrock~2Famazon.titan-text-express-v1~3A0~3A8k.json" with { type: "json" };
import family8 from "./families/bedrock~2Fcohere.embed-english-v3.json" with { type: "json" };
import family9 from "./families/bedrock~2Fcohere.embed-multilingual-v3.json" with { type: "json" };
import family10 from "./families/bedrock~2Ftwelvelabs.marengo-embed-2-7-v1~3A0.json" with { type: "json" };
import family11 from "./families/bedrock~2Fus.twelvelabs.pegasus-1-2-v1~3A0.json" with { type: "json" };
import family12 from "./families/big-pickle.json" with { type: "json" };
import family13 from "./families/canopylabs.json" with { type: "json" };
import family14 from "./families/cartesia~2Fink-2.json" with { type: "json" };
import family15 from "./families/chutes~2Fchutesai~2FDevstral-Small-2505.json" with { type: "json" };
import family16 from "./families/chutes~2Fmiromind-ai~2FMiroThinker-v1.5-235B.json" with { type: "json" };
import family17 from "./families/chutes~2FNousResearch~2FHermes-4-405B-FP8-TEE.json" with { type: "json" };
import family18 from "./families/chutes~2FNousResearch~2FHermes-4-70B.json" with { type: "json" };
import family19 from "./families/chutes~2FNousResearch~2FHermes-4.3-36B.json" with { type: "json" };
import family20 from "./families/chutes~2FOpenGVLab~2FInternVL3-78B-TEE.json" with { type: "json" };
import family21 from "./families/chutes~2Ftngtech~2FTNG-R1T-Chimera-TEE.json" with { type: "json" };
import family22 from "./families/chutes~2Ftngtech~2FTNG-R1T-Chimera-Turbo.json" with { type: "json" };
import family23 from "./families/chutes~2FXiaomiMiMo~2FMiMo-V2-Flash.json" with { type: "json" };
import family24 from "./families/claude.json" with { type: "json" };
import family25 from "./families/claude-fable.json" with { type: "json" };
import family26 from "./families/claude-haiku.json" with { type: "json" };
import family27 from "./families/claude-mythos.json" with { type: "json" };
import family28 from "./families/claude-opus.json" with { type: "json" };
import family29 from "./families/claude-sonnet.json" with { type: "json" };
import family30 from "./families/cloudflare~2Fclef.json" with { type: "json" };
import family31 from "./families/codestral.json" with { type: "json" };
import family32 from "./families/codestral-embed.json" with { type: "json" };
import family33 from "./families/cogito.json" with { type: "json" };
import family34 from "./families/cohere-embed.json" with { type: "json" };
import family35 from "./families/cohere~2Fc4ai-aya-expanse-32b.json" with { type: "json" };
import family36 from "./families/cohere~2Fc4ai-aya-expanse-8b.json" with { type: "json" };
import family37 from "./families/cohere~2Fc4ai-aya-vision-32b.json" with { type: "json" };
import family38 from "./families/cohere~2Fc4ai-aya-vision-8b.json" with { type: "json" };
import family39 from "./families/cohere~2Ftiny-aya-earth.json" with { type: "json" };
import family40 from "./families/cohere~2Ftiny-aya-fire.json" with { type: "json" };
import family41 from "./families/cohere~2Ftiny-aya-global.json" with { type: "json" };
import family42 from "./families/cohere~2Ftiny-aya-water.json" with { type: "json" };
import family43 from "./families/command.json" with { type: "json" };
import family44 from "./families/command-a.json" with { type: "json" };
import family45 from "./families/command-r.json" with { type: "json" };
import family46 from "./families/cortecs~2Fapertus-70b.json" with { type: "json" };
import family47 from "./families/cortecs~2Fcosmos3-super-reasoner.json" with { type: "json" };
import family48 from "./families/cortecs~2Fdevstral-small-2512.json" with { type: "json" };
import family49 from "./families/cortecs~2Fhermes-4-405b.json" with { type: "json" };
import family50 from "./families/cortecs~2Fhermes-4-70b.json" with { type: "json" };
import family51 from "./families/cortecs~2Fholo2-30b-a3b.json" with { type: "json" };
import family52 from "./families/cortecs~2Fintellect-3.json" with { type: "json" };
import family53 from "./families/cortecs~2Fmagistral-medium-2509.json" with { type: "json" };
import family54 from "./families/cortecs~2Fmagistral-small-2509.json" with { type: "json" };
import family55 from "./families/cortecs~2Fminicpm-v-4.5.json" with { type: "json" };
import family56 from "./families/cortecs~2Fministral-14b-2512.json" with { type: "json" };
import family57 from "./families/cortecs~2Fministral-3b-2512.json" with { type: "json" };
import family58 from "./families/cortecs~2Fministral-8b-2512.json" with { type: "json" };
import family59 from "./families/cortecs~2Fpixtral-12b-2409.json" with { type: "json" };
import family60 from "./families/cortecs~2Fvoxtral-small-2507.json" with { type: "json" };
import family61 from "./families/deepinfra~2Fxiaomi~2Fmimo-v2.5.json" with { type: "json" };
import family62 from "./families/deepinfra~2Fxiaomi~2Fmimo-v2.5-pro.json" with { type: "json" };
import family63 from "./families/deepseek.json" with { type: "json" };
import family64 from "./families/deepseek-flash.json" with { type: "json" };
import family65 from "./families/deepseek-thinking.json" with { type: "json" };
import family66 from "./families/devstral.json" with { type: "json" };
import family67 from "./families/elevenlabs~2Fscribe_v2_realtime.json" with { type: "json" };
import family68 from "./families/ernie.json" with { type: "json" };
import family69 from "./families/exa~2Fexa.json" with { type: "json" };
import family70 from "./families/exa~2Fexa-research.json" with { type: "json" };
import family71 from "./families/exa~2Fexa-research-pro.json" with { type: "json" };
import family72 from "./families/fireworks~2Faccounts~2Ffireworks~2Fmodels~2Fember-1.json" with { type: "json" };
import family73 from "./families/flux.json" with { type: "json" };
import family74 from "./families/fugu.json" with { type: "json" };
import family75 from "./families/gemini.json" with { type: "json" };
import family76 from "./families/gemini-flash.json" with { type: "json" };
import family77 from "./families/gemini-flash-lite.json" with { type: "json" };
import family78 from "./families/gemini-pro.json" with { type: "json" };
import family79 from "./families/gemma.json" with { type: "json" };
import family80 from "./families/github-copilot~2Fo3.json" with { type: "json" };
import family81 from "./families/github-copilot~2Fo3-mini.json" with { type: "json" };
import family82 from "./families/github-copilot~2Fo4-mini.json" with { type: "json" };
import family83 from "./families/github-copilot~2Fraptor-mini.json" with { type: "json" };
import family84 from "./families/glm.json" with { type: "json" };
import family85 from "./families/glm-air.json" with { type: "json" };
import family86 from "./families/glm-flash.json" with { type: "json" };
import family87 from "./families/gpt.json" with { type: "json" };
import family88 from "./families/gpt-astra.json" with { type: "json" };
import family89 from "./families/gpt-codex.json" with { type: "json" };
import family90 from "./families/gpt-codex-spark.json" with { type: "json" };
import family91 from "./families/gpt-image.json" with { type: "json" };
import family92 from "./families/gpt-luna.json" with { type: "json" };
import family93 from "./families/gpt-mini.json" with { type: "json" };
import family94 from "./families/gpt-nano.json" with { type: "json" };
import family95 from "./families/gpt-oss.json" with { type: "json" };
import family96 from "./families/gpt-pro.json" with { type: "json" };
import family97 from "./families/gpt-sol.json" with { type: "json" };
import family98 from "./families/gpt-terra.json" with { type: "json" };
import family99 from "./families/granite.json" with { type: "json" };
import family100 from "./families/greenpt~2Fgreen-embedding.json" with { type: "json" };
import family101 from "./families/greenpt~2Fgreen-rerank.json" with { type: "json" };
import family102 from "./families/greenpt~2Fgreen-s.json" with { type: "json" };
import family103 from "./families/greenpt~2Fgreen-s-pro.json" with { type: "json" };
import family104 from "./families/greenpt~2Fholo2-30b-a3b.json" with { type: "json" };
import family105 from "./families/greenpt~2Fqwen3-embedding-8b.json" with { type: "json" };
import family106 from "./families/grok.json" with { type: "json" };
import family107 from "./families/grok-build.json" with { type: "json" };
import family108 from "./families/groq.json" with { type: "json" };
import family109 from "./families/groq~2Fallam-2-7b.json" with { type: "json" };
import family110 from "./families/hermes.json" with { type: "json" };
import family111 from "./families/huggingface~2Fstepfun-ai~2FStep-3.5-Flash.json" with { type: "json" };
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
import family122 from "./families/kimi.json" with { type: "json" };
import family123 from "./families/kimi-k2.json" with { type: "json" };
import family124 from "./families/kimi-k3.json" with { type: "json" };
import family125 from "./families/kimi-thinking.json" with { type: "json" };
import family126 from "./families/kling.json" with { type: "json" };
import family127 from "./families/laguna.json" with { type: "json" };
import family128 from "./families/laguna-s.json" with { type: "json" };
import family129 from "./families/leanstral.json" with { type: "json" };
import family130 from "./families/ling.json" with { type: "json" };
import family131 from "./families/liquid.json" with { type: "json" };
import family132 from "./families/llama.json" with { type: "json" };
import family133 from "./families/longcat.json" with { type: "json" };
import family134 from "./families/lucid.json" with { type: "json" };
import family135 from "./families/lyria.json" with { type: "json" };
import family136 from "./families/magistral.json" with { type: "json" };
import family137 from "./families/magistral-medium.json" with { type: "json" };
import family138 from "./families/magistral-small.json" with { type: "json" };
import family139 from "./families/mai.json" with { type: "json" };
import family140 from "./families/mercury.json" with { type: "json" };
import family141 from "./families/mimo.json" with { type: "json" };
import family142 from "./families/mimo-v2.5.json" with { type: "json" };
import family143 from "./families/mimo-v2.5-pro.json" with { type: "json" };
import family144 from "./families/minimax.json" with { type: "json" };
import family145 from "./families/minimax-m2.7.json" with { type: "json" };
import family146 from "./families/minimax-m3.json" with { type: "json" };
import family147 from "./families/minimax-music.json" with { type: "json" };
import family148 from "./families/ministral.json" with { type: "json" };
import family149 from "./families/mistral.json" with { type: "json" };
import family150 from "./families/mistral-embed.json" with { type: "json" };
import family151 from "./families/mistral-large.json" with { type: "json" };
import family152 from "./families/mistral-medium.json" with { type: "json" };
import family153 from "./families/mistral-nemo.json" with { type: "json" };
import family154 from "./families/mistral-small.json" with { type: "json" };
import family155 from "./families/mistral~2Fcodestral-embed.json" with { type: "json" };
import family156 from "./families/mistral~2Fministral-14b-latest.json" with { type: "json" };
import family157 from "./families/mistral~2Fvoxtral-mini-transcribe-realtime-2602.json" with { type: "json" };
import family158 from "./families/mixtral.json" with { type: "json" };
import family159 from "./families/model-router.json" with { type: "json" };
import family160 from "./families/morph.json" with { type: "json" };
import family161 from "./families/muse.json" with { type: "json" };
import family162 from "./families/muse-free.json" with { type: "json" };
import family163 from "./families/nano-banana.json" with { type: "json" };
import family164 from "./families/nemotron.json" with { type: "json" };
import family165 from "./families/nemotron-free.json" with { type: "json" };
import family166 from "./families/north.json" with { type: "json" };
import family167 from "./families/nousresearch.json" with { type: "json" };
import family168 from "./families/nova.json" with { type: "json" };
import family169 from "./families/nova-lite.json" with { type: "json" };
import family170 from "./families/nova-micro.json" with { type: "json" };
import family171 from "./families/nova-pro.json" with { type: "json" };
import family172 from "./families/o.json" with { type: "json" };
import family173 from "./families/o-mini.json" with { type: "json" };
import family174 from "./families/o-pro.json" with { type: "json" };
import family175 from "./families/olmo.json" with { type: "json" };
import family176 from "./families/openai~2Fcodex-mini-latest.json" with { type: "json" };
import family177 from "./families/opencode-go~2Fspace-bunny.json" with { type: "json" };
import family178 from "./families/opencode-go~2Funion-alpha.json" with { type: "json" };
import family179 from "./families/opencode~2Fexo-free.json" with { type: "json" };
import family180 from "./families/opencode~2Ffledge-alpha-free.json" with { type: "json" };
import family181 from "./families/opencode~2Fjev-latest.json" with { type: "json" };
import family182 from "./families/opencode~2Fspace-bunny-free.json" with { type: "json" };
import family183 from "./families/opencode~2Funion-alpha.json" with { type: "json" };
import family184 from "./families/openrouter~2Faion-labs~2Faion-1.0.json" with { type: "json" };
import family185 from "./families/openrouter~2Faion-labs~2Faion-1.0-mini.json" with { type: "json" };
import family186 from "./families/openrouter~2Faion-labs~2Faion-2.0.json" with { type: "json" };
import family187 from "./families/openrouter~2Faion-labs~2Faion-3.0.json" with { type: "json" };
import family188 from "./families/openrouter~2Faion-labs~2Faion-3.0-mini.json" with { type: "json" };
import family189 from "./families/openrouter~2Faion-labs~2Faion-3.5.json" with { type: "json" };
import family190 from "./families/openrouter~2Faion-labs~2Faion-3.5-mini.json" with { type: "json" };
import family191 from "./families/openrouter~2Falibaba~2Ftongyi-deepresearch-30b-a3b.json" with { type: "json" };
import family192 from "./families/openrouter~2Fanthracite-org~2Fmagnum-v4-72b.json" with { type: "json" };
import family193 from "./families/openrouter~2Fapodex~2Fapodex-1.1-mini~3Afree.json" with { type: "json" };
import family194 from "./families/openrouter~2Farcee-ai~2Fcoder-large.json" with { type: "json" };
import family195 from "./families/openrouter~2Farcee-ai~2Fmaestro-reasoning.json" with { type: "json" };
import family196 from "./families/openrouter~2Farcee-ai~2Fspotlight.json" with { type: "json" };
import family197 from "./families/openrouter~2Farcee-ai~2Ftrinity-large-preview.json" with { type: "json" };
import family198 from "./families/openrouter~2Farcee-ai~2Ftrinity-large-preview~3Afree.json" with { type: "json" };
import family199 from "./families/openrouter~2Farcee-ai~2Ftrinity-large-thinking~3Afree.json" with { type: "json" };
import family200 from "./families/openrouter~2Farcee-ai~2Ftrinity-mini~3Afree.json" with { type: "json" };
import family201 from "./families/openrouter~2Farcee-ai~2Fvirtuoso-large.json" with { type: "json" };
import family202 from "./families/openrouter~2Fbaidu~2Fcobuddy~3Afree.json" with { type: "json" };
import family203 from "./families/openrouter~2Fbaidu~2Fernie-4.5-21b-a3b.json" with { type: "json" };
import family204 from "./families/openrouter~2Fbaidu~2Fernie-4.5-21b-a3b-thinking.json" with { type: "json" };
import family205 from "./families/openrouter~2Fbaidu~2Fernie-4.5-300b-a47b.json" with { type: "json" };
import family206 from "./families/openrouter~2Fbaidu~2Fernie-4.5-vl-28b-a3b.json" with { type: "json" };
import family207 from "./families/openrouter~2Fbaidu~2Fqianfan-ocr-fast.json" with { type: "json" };
import family208 from "./families/openrouter~2Fbytedance~2Fui-tars-1.5-7b.json" with { type: "json" };
import family209 from "./families/openrouter~2Fdots-studio~2Fdots-3-note-preview~3Afree.json" with { type: "json" };
import family210 from "./families/openrouter~2Fessentialai~2Frnj-1-instruct.json" with { type: "json" };
import family211 from "./families/openrouter~2Ffeatherless~2Fqwerky-72b.json" with { type: "json" };
import family212 from "./families/openrouter~2Ffireworks~2Fember-1.json" with { type: "json" };
import family213 from "./families/openrouter~2Fgryphe~2Fmythomax-l2-13b.json" with { type: "json" };
import family214 from "./families/openrouter~2Finference-net~2Fschematron-v2-small.json" with { type: "json" };
import family215 from "./families/openrouter~2Finference-net~2Fschematron-v2-turbo.json" with { type: "json" };
import family216 from "./families/openrouter~2Finflection~2Finflection-3-pi.json" with { type: "json" };
import family217 from "./families/openrouter~2Finflection~2Finflection-3-productivity.json" with { type: "json" };
import family218 from "./families/openrouter~2Fkwaipilot~2Fkat-coder-pro~3Afree.json" with { type: "json" };
import family219 from "./families/openrouter~2Fmicrosoft~2Fmai-ds-r1~3Afree.json" with { type: "json" };
import family220 from "./families/openrouter~2Fmicrosoft~2Fwizardlm-2-8x22b.json" with { type: "json" };
import family221 from "./families/openrouter~2Fnex-agi~2Fnex-n2-pro~3Afree.json" with { type: "json" };
import family222 from "./families/openrouter~2Fopenrouter~2Fbodybuilder.json" with { type: "json" };
import family223 from "./families/openrouter~2Fopenrouter~2Ffree.json" with { type: "json" };
import family224 from "./families/openrouter~2Fopenrouter~2Ffusion.json" with { type: "json" };
import family225 from "./families/openrouter~2Fopenrouter~2Fpareto-code.json" with { type: "json" };
import family226 from "./families/openrouter~2Fopenrouter~2Fsherlock-dash-alpha.json" with { type: "json" };
import family227 from "./families/openrouter~2Fopenrouter~2Fsherlock-think-alpha.json" with { type: "json" };
import family228 from "./families/openrouter~2Fperceptron~2Fperceptron-mk1.json" with { type: "json" };
import family229 from "./families/openrouter~2Fperceptron~2Fperceptron-mk1.5.json" with { type: "json" };
import family230 from "./families/openrouter~2Fpoolside~2Flaguna-xs.2.json" with { type: "json" };
import family231 from "./families/openrouter~2Fpoolside~2Flaguna-xs.2~3Afree.json" with { type: "json" };
import family232 from "./families/openrouter~2Fprime-intellect~2Fintellect-3.json" with { type: "json" };
import family233 from "./families/openrouter~2Fprism-ml~2Fternary-bonsai-2-27b.json" with { type: "json" };
import family234 from "./families/openrouter~2Frelace~2Frelace-apply-3.json" with { type: "json" };
import family235 from "./families/openrouter~2Frelace~2Frelace-search.json" with { type: "json" };
import family236 from "./families/openrouter~2Fsao10k~2Fl3-euryale-70b.json" with { type: "json" };
import family237 from "./families/openrouter~2Fsarvamai~2Fsarvam-m~3Afree.json" with { type: "json" };
import family238 from "./families/openrouter~2Fsourceful~2Friverflow-v2-fast-preview.json" with { type: "json" };
import family239 from "./families/openrouter~2Fsourceful~2Friverflow-v2-max-preview.json" with { type: "json" };
import family240 from "./families/openrouter~2Fsourceful~2Friverflow-v2-standard-preview.json" with { type: "json" };
import family241 from "./families/openrouter~2Fstepfun~2Fstep-3.5-flash.json" with { type: "json" };
import family242 from "./families/openrouter~2Fstepfun~2Fstep-3.5-flash~3Afree.json" with { type: "json" };
import family243 from "./families/openrouter~2Fstepfun~2Fstep-3.7-flash.json" with { type: "json" };
import family244 from "./families/openrouter~2Fswitchpoint~2Frouter.json" with { type: "json" };
import family245 from "./families/openrouter~2Fthedrummer~2Fcydonia-24b-v4.1.json" with { type: "json" };
import family246 from "./families/openrouter~2Fthedrummer~2Frocinante-12b.json" with { type: "json" };
import family247 from "./families/openrouter~2Fthedrummer~2Fskyfall-36b-v2.json" with { type: "json" };
import family248 from "./families/openrouter~2Fthedrummer~2Funslopnemo-12b.json" with { type: "json" };
import family249 from "./families/openrouter~2Ftngtech~2Ftng-r1t-chimera~3Afree.json" with { type: "json" };
import family250 from "./families/openrouter~2Funbiased~2Fpareto.json" with { type: "json" };
import family251 from "./families/openrouter~2Funbiased~2Fpareto-26.10-preview.json" with { type: "json" };
import family252 from "./families/openrouter~2Fundi95~2Fremm-slerp-l2-13b.json" with { type: "json" };
import family253 from "./families/openrouter~2Fxiaomi~2Fmimo-v2-flash.json" with { type: "json" };
import family254 from "./families/openrouter~2Fxiaomi~2Fmimo-v2-omni.json" with { type: "json" };
import family255 from "./families/openrouter~2Fxiaomi~2Fmimo-v2-pro.json" with { type: "json" };
import family256 from "./families/osmosis.json" with { type: "json" };
import family257 from "./families/palmyra.json" with { type: "json" };
import family258 from "./families/parallel~2Fspeed.json" with { type: "json" };
import family259 from "./families/perplexity-ai~2Fr1-1776.json" with { type: "json" };
import family260 from "./families/perplexity-ai~2Fsonar-deep-research.json" with { type: "json" };
import family261 from "./families/perplexity-ai~2Fsonar-reasoning.json" with { type: "json" };
import family262 from "./families/phi.json" with { type: "json" };
import family263 from "./families/pixtral.json" with { type: "json" };
import family264 from "./families/qvq.json" with { type: "json" };
import family265 from "./families/qwen.json" with { type: "json" };
import family266 from "./families/qwen3.5.json" with { type: "json" };
import family267 from "./families/qwen3.6.json" with { type: "json" };
import family268 from "./families/qwen3.7-plus.json" with { type: "json" };
import family269 from "./families/qwen3.8-max.json" with { type: "json" };
import family270 from "./families/recraft.json" with { type: "json" };
import family271 from "./families/rednote.json" with { type: "json" };
import family272 from "./families/regolo-ai~2Fapertus-70b.json" with { type: "json" };
import family273 from "./families/regolo-ai~2Fbrick-complexity-pro.json" with { type: "json" };
import family274 from "./families/reka.json" with { type: "json" };
import family275 from "./families/replicate~2F5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637.json" with { type: "json" };
import family276 from "./families/replicate~2F671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb.json" with { type: "json" };
import family277 from "./families/replicate~2F826801120720e563620006b99e412f7ed7b991dd4477e9160473d44a405ef9d9.json" with { type: "json" };
import family278 from "./families/replicate~2F847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405.json" with { type: "json" };
import family279 from "./families/replicate~2Falibaba~2Fhappyhorse-1.0.json" with { type: "json" };
import family280 from "./families/replicate~2Falibaba~2Fqwen-image-3.json" with { type: "json" };
import family281 from "./families/replicate~2Fblack-forest-labs~2Fflux-video-upscale.json" with { type: "json" };
import family282 from "./families/replicate~2Fbria~2Ffibo.json" with { type: "json" };
import family283 from "./families/replicate~2Fbria~2Fremove-background.json" with { type: "json" };
import family284 from "./families/replicate~2Fcbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f.json" with { type: "json" };
import family285 from "./families/replicate~2Fdatacte~2Fproteus-v0.3.json" with { type: "json" };
import family286 from "./families/replicate~2Felevenlabs~2Fdubbing.json" with { type: "json" };
import family287 from "./families/replicate~2Felevenlabs~2Fmusic.json" with { type: "json" };
import family288 from "./families/replicate~2Fgoogle~2Fgemini-omni-1.1.json" with { type: "json" };
import family289 from "./families/replicate~2Fgoogle~2Fnano-banana.json" with { type: "json" };
import family290 from "./families/replicate~2Fgoogle~2Fnano-banana-2.json" with { type: "json" };
import family291 from "./families/replicate~2Fgoogle~2Fnano-banana-pro.json" with { type: "json" };
import family292 from "./families/replicate~2Flightricks~2Fltx-2.5-fast.json" with { type: "json" };
import family293 from "./families/replicate~2Fluma~2Fray-3.2.json" with { type: "json" };
import family294 from "./families/replicate~2Fnightmareai~2Freal-esrgan.json" with { type: "json" };
import family295 from "./families/replicate~2Fprunaai~2Fp-image-ideogram.json" with { type: "json" };
import family296 from "./families/replicate~2Fprunaai~2Fp-video.json" with { type: "json" };
import family297 from "./families/replicate~2Fprunaai~2Fp-video-2-pro.json" with { type: "json" };
import family298 from "./families/replicate~2Fresemble-ai~2Fchatterbox-turbo.json" with { type: "json" };
import family299 from "./families/replicate~2Frunwayml~2Fgen-4.5.json" with { type: "json" };
import family300 from "./families/replicate~2Fstability-ai~2Fstable-audio-2.5.json" with { type: "json" };
import family301 from "./families/requesty~2Fstep-3.7-flash.json" with { type: "json" };
import family302 from "./families/ring.json" with { type: "json" };
import family303 from "./families/sakana-namazu.json" with { type: "json" };
import family304 from "./families/seed.json" with { type: "json" };
import family305 from "./families/solar.json" with { type: "json" };
import family306 from "./families/solar-mini.json" with { type: "json" };
import family307 from "./families/solar-pro.json" with { type: "json" };
import family308 from "./families/sonar.json" with { type: "json" };
import family309 from "./families/sonar-deep-research.json" with { type: "json" };
import family310 from "./families/sonar-pro.json" with { type: "json" };
import family311 from "./families/sonar-reasoning.json" with { type: "json" };
import family312 from "./families/sora.json" with { type: "json" };
import family313 from "./families/stable-diffusion.json" with { type: "json" };
import family314 from "./families/step.json" with { type: "json" };
import family315 from "./families/text-embedding.json" with { type: "json" };
import family316 from "./families/the-grid-ai~2Fagent-max.json" with { type: "json" };
import family317 from "./families/the-grid-ai~2Fagent-prime.json" with { type: "json" };
import family318 from "./families/the-grid-ai~2Fagent-standard.json" with { type: "json" };
import family319 from "./families/the-grid-ai~2Fbytedance-pro-latest.json" with { type: "json" };
import family320 from "./families/the-grid-ai~2Fcode-max.json" with { type: "json" };
import family321 from "./families/the-grid-ai~2Fcode-prime.json" with { type: "json" };
import family322 from "./families/the-grid-ai~2Fcode-standard.json" with { type: "json" };
import family323 from "./families/the-grid-ai~2Ftext-max.json" with { type: "json" };
import family324 from "./families/the-grid-ai~2Ftext-prime.json" with { type: "json" };
import family325 from "./families/the-grid-ai~2Ftext-standard.json" with { type: "json" };
import family326 from "./families/titan-embed.json" with { type: "json" };
import family327 from "./families/together-ai~2Ftogethercomputer~2FRefuel-Llm-V2.json" with { type: "json" };
import family328 from "./families/together-ai~2Ftogethercomputer~2FRefuel-Llm-V2-Small.json" with { type: "json" };
import family329 from "./families/trinity.json" with { type: "json" };
import family330 from "./families/trinity-mini.json" with { type: "json" };
import family331 from "./families/typesafe~2Fjev.json" with { type: "json" };
import family332 from "./families/unsloth.json" with { type: "json" };
import family333 from "./families/v0.json" with { type: "json" };
import family334 from "./families/veo.json" with { type: "json" };
import family335 from "./families/vercel~2Fcohere~2Fembed-v5.0-fast.json" with { type: "json" };
import family336 from "./families/vercel~2Fcohere~2Fembed-v5.0-pro.json" with { type: "json" };
import family337 from "./families/vercel~2Ffireworks~2Fember-1.json" with { type: "json" };
import family338 from "./families/vercel~2Finception~2Fmercury-edit-2.json" with { type: "json" };
import family339 from "./families/vercel~2Finterfaze~2Finterfaze-beta.json" with { type: "json" };
import family340 from "./families/vercel~2Fmixedbread~2Ftoast-1.json" with { type: "json" };
import family341 from "./families/vercel~2Fopenai~2Fcodex-mini.json" with { type: "json" };
import family342 from "./families/vercel~2Fperplexity~2Fpplx-embed-v1-4b.json" with { type: "json" };
import family343 from "./families/vercel~2Fperplexity~2Fsonar-reasoning.json" with { type: "json" };
import family344 from "./families/vercel~2Fprime-intellect~2Fintellect-3.json" with { type: "json" };
import family345 from "./families/vercel~2Fquiverai~2Farrow-2.json" with { type: "json" };
import family346 from "./families/vercel~2Fquiverai~2Farrow-2-telos.json" with { type: "json" };
import family347 from "./families/vercel~2Fsakana~2Fnamazu.json" with { type: "json" };
import family348 from "./families/vercel~2Fstealth~2Fglyph-cluster.json" with { type: "json" };
import family349 from "./families/vercel~2Fstealth~2Fpixel-canary.json" with { type: "json" };
import family350 from "./families/vercel~2Ftopaz~2Fproteus.json" with { type: "json" };
import family351 from "./families/vercel~2Ftopaz~2Fstarlight-precise-2.6.json" with { type: "json" };
import family352 from "./families/vercel~2Ftopaz~2Fwonder-3.5.json" with { type: "json" };
import family353 from "./families/vercel~2Ftypesafe-ai~2Fjev.json" with { type: "json" };
import family354 from "./families/vercel~2Fvercel~2Fv0-1.0-md.json" with { type: "json" };
import family355 from "./families/vercel~2Fvercel~2Fv0-1.5-md.json" with { type: "json" };
import family356 from "./families/voxtral.json" with { type: "json" };
import family357 from "./families/voyage.json" with { type: "json" };
import family358 from "./families/whisper.json" with { type: "json" };
import family359 from "./families/workers-ai~2F~40cf~2Fai4bharat~2Findictrans2-en-indic-1B.json" with { type: "json" };
import family360 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-base-en-v1.5.json" with { type: "json" };
import family361 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-large-en-v1.5.json" with { type: "json" };
import family362 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-m3.json" with { type: "json" };
import family363 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-reranker-base.json" with { type: "json" };
import family364 from "./families/workers-ai~2F~40cf~2Fbaai~2Fbge-small-en-v1.5.json" with { type: "json" };
import family365 from "./families/workers-ai~2F~40cf~2Fdeepgram~2Faura-1.json" with { type: "json" };
import family366 from "./families/workers-ai~2F~40cf~2Fdeepgram~2Faura-2-en.json" with { type: "json" };
import family367 from "./families/workers-ai~2F~40cf~2Fdeepgram~2Faura-2-es.json" with { type: "json" };
import family368 from "./families/workers-ai~2F~40cf~2Fhuggingface~2Fdistilbert-sst-2-int8.json" with { type: "json" };
import family369 from "./families/workers-ai~2F~40cf~2Fleonardo~2Flucid-origin.json" with { type: "json" };
import family370 from "./families/workers-ai~2F~40cf~2Fleonardo~2Fphoenix-1.0.json" with { type: "json" };
import family371 from "./families/workers-ai~2F~40cf~2Fllava-hf~2Fllava-1.5-7b-hf.json" with { type: "json" };
import family372 from "./families/workers-ai~2F~40cf~2Flykon~2Fdreamshaper-8-lcm.json" with { type: "json" };
import family373 from "./families/workers-ai~2F~40cf~2Fmeta~2Fm2m100-1.2b.json" with { type: "json" };
import family374 from "./families/workers-ai~2F~40cf~2Fmyshell-ai~2Fmelotts.json" with { type: "json" };
import family375 from "./families/workers-ai~2F~40cf~2Fpfnet~2Fplamo-embedding-1b.json" with { type: "json" };
import family376 from "./families/workers-ai~2F~40cf~2Fpipecat-ai~2Fsmart-turn-v2.json" with { type: "json" };
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
import provider29 from "./providers/v0.json" with { type: "json" };
import provider30 from "./providers/replicate.json" with { type: "json" };
import provider31 from "./providers/exa.json" with { type: "json" };
import provider32 from "./providers/fal.json" with { type: "json" };
import provider33 from "./providers/ideogram.json" with { type: "json" };
import provider34 from "./providers/cerebras.json" with { type: "json" };
import provider35 from "./providers/cohere.json" with { type: "json" };
import provider36 from "./providers/opencode.json" with { type: "json" };
import provider37 from "./providers/opencode-go.json" with { type: "json" };
import provider38 from "./providers/cortecs.json" with { type: "json" };
import provider39 from "./providers/nova.json" with { type: "json" };
import provider40 from "./providers/poolside.json" with { type: "json" };
import provider41 from "./providers/hetzner.json" with { type: "json" };
import provider42 from "./providers/alibaba.json" with { type: "json" };
import provider43 from "./providers/zai.json" with { type: "json" };
import provider44 from "./providers/moonshot.json" with { type: "json" };
import provider45 from "./providers/minimax.json" with { type: "json" };
import provider46 from "./providers/google-vertex.json" with { type: "json" };
import provider47 from "./providers/ollama-cloud.json" with { type: "json" };
import provider48 from "./providers/meta.json" with { type: "json" };
import provider49 from "./providers/greenpt.json" with { type: "json" };
import provider50 from "./providers/lucidquery.json" with { type: "json" };
import provider51 from "./providers/ovhcloud.json" with { type: "json" };
import provider52 from "./providers/regolo-ai.json" with { type: "json" };
import provider53 from "./providers/sakana.json" with { type: "json" };
import provider54 from "./providers/standardcompute.json" with { type: "json" };
import provider55 from "./providers/the-grid-ai.json" with { type: "json" };
import provider56 from "./providers/kimi-for-coding.json" with { type: "json" };
import provider57 from "./providers/thinkingmachines.json" with { type: "json" };
import provider58 from "./providers/typesafe.json" with { type: "json" };

const catalogue: UnparsedModelCatalogue = {
  families: {
    "agi": family0,
    "allenai": family1,
    "alpha": family2,
    "auto": family3,
    "azure-openai/mai-ds-r1": family4,
    "azure-openai/o1-preview": family5,
    "bedrock/amazon.titan-text-express-v1": family6,
    "bedrock/amazon.titan-text-express-v1:0:8k": family7,
    "bedrock/cohere.embed-english-v3": family8,
    "bedrock/cohere.embed-multilingual-v3": family9,
    "bedrock/twelvelabs.marengo-embed-2-7-v1:0": family10,
    "bedrock/us.twelvelabs.pegasus-1-2-v1:0": family11,
    "big-pickle": family12,
    "canopylabs": family13,
    "cartesia/ink-2": family14,
    "chutes/chutesai/Devstral-Small-2505": family15,
    "chutes/miromind-ai/MiroThinker-v1.5-235B": family16,
    "chutes/NousResearch/Hermes-4-405B-FP8-TEE": family17,
    "chutes/NousResearch/Hermes-4-70B": family18,
    "chutes/NousResearch/Hermes-4.3-36B": family19,
    "chutes/OpenGVLab/InternVL3-78B-TEE": family20,
    "chutes/tngtech/TNG-R1T-Chimera-TEE": family21,
    "chutes/tngtech/TNG-R1T-Chimera-Turbo": family22,
    "chutes/XiaomiMiMo/MiMo-V2-Flash": family23,
    "claude": family24,
    "claude-fable": family25,
    "claude-haiku": family26,
    "claude-mythos": family27,
    "claude-opus": family28,
    "claude-sonnet": family29,
    "cloudflare/clef": family30,
    "codestral": family31,
    "codestral-embed": family32,
    "cogito": family33,
    "cohere-embed": family34,
    "cohere/c4ai-aya-expanse-32b": family35,
    "cohere/c4ai-aya-expanse-8b": family36,
    "cohere/c4ai-aya-vision-32b": family37,
    "cohere/c4ai-aya-vision-8b": family38,
    "cohere/tiny-aya-earth": family39,
    "cohere/tiny-aya-fire": family40,
    "cohere/tiny-aya-global": family41,
    "cohere/tiny-aya-water": family42,
    "command": family43,
    "command-a": family44,
    "command-r": family45,
    "cortecs/apertus-70b": family46,
    "cortecs/cosmos3-super-reasoner": family47,
    "cortecs/devstral-small-2512": family48,
    "cortecs/hermes-4-405b": family49,
    "cortecs/hermes-4-70b": family50,
    "cortecs/holo2-30b-a3b": family51,
    "cortecs/intellect-3": family52,
    "cortecs/magistral-medium-2509": family53,
    "cortecs/magistral-small-2509": family54,
    "cortecs/minicpm-v-4.5": family55,
    "cortecs/ministral-14b-2512": family56,
    "cortecs/ministral-3b-2512": family57,
    "cortecs/ministral-8b-2512": family58,
    "cortecs/pixtral-12b-2409": family59,
    "cortecs/voxtral-small-2507": family60,
    "deepinfra/xiaomi/mimo-v2.5": family61,
    "deepinfra/xiaomi/mimo-v2.5-pro": family62,
    "deepseek": family63,
    "deepseek-flash": family64,
    "deepseek-thinking": family65,
    "devstral": family66,
    "elevenlabs/scribe_v2_realtime": family67,
    "ernie": family68,
    "exa/exa": family69,
    "exa/exa-research": family70,
    "exa/exa-research-pro": family71,
    "fireworks/accounts/fireworks/models/ember-1": family72,
    "flux": family73,
    "fugu": family74,
    "gemini": family75,
    "gemini-flash": family76,
    "gemini-flash-lite": family77,
    "gemini-pro": family78,
    "gemma": family79,
    "github-copilot/o3": family80,
    "github-copilot/o3-mini": family81,
    "github-copilot/o4-mini": family82,
    "github-copilot/raptor-mini": family83,
    "glm": family84,
    "glm-air": family85,
    "glm-flash": family86,
    "gpt": family87,
    "gpt-astra": family88,
    "gpt-codex": family89,
    "gpt-codex-spark": family90,
    "gpt-image": family91,
    "gpt-luna": family92,
    "gpt-mini": family93,
    "gpt-nano": family94,
    "gpt-oss": family95,
    "gpt-pro": family96,
    "gpt-sol": family97,
    "gpt-terra": family98,
    "granite": family99,
    "greenpt/green-embedding": family100,
    "greenpt/green-rerank": family101,
    "greenpt/green-s": family102,
    "greenpt/green-s-pro": family103,
    "greenpt/holo2-30b-a3b": family104,
    "greenpt/qwen3-embedding-8b": family105,
    "grok": family106,
    "grok-build": family107,
    "groq": family108,
    "groq/allam-2-7b": family109,
    "hermes": family110,
    "huggingface/stepfun-ai/Step-3.5-Flash": family111,
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
    "kimi": family122,
    "kimi-k2": family123,
    "kimi-k3": family124,
    "kimi-thinking": family125,
    "kling": family126,
    "laguna": family127,
    "laguna-s": family128,
    "leanstral": family129,
    "ling": family130,
    "liquid": family131,
    "llama": family132,
    "longcat": family133,
    "lucid": family134,
    "lyria": family135,
    "magistral": family136,
    "magistral-medium": family137,
    "magistral-small": family138,
    "mai": family139,
    "mercury": family140,
    "mimo": family141,
    "mimo-v2.5": family142,
    "mimo-v2.5-pro": family143,
    "minimax": family144,
    "minimax-m2.7": family145,
    "minimax-m3": family146,
    "minimax-music": family147,
    "ministral": family148,
    "mistral": family149,
    "mistral-embed": family150,
    "mistral-large": family151,
    "mistral-medium": family152,
    "mistral-nemo": family153,
    "mistral-small": family154,
    "mistral/codestral-embed": family155,
    "mistral/ministral-14b-latest": family156,
    "mistral/voxtral-mini-transcribe-realtime-2602": family157,
    "mixtral": family158,
    "model-router": family159,
    "morph": family160,
    "muse": family161,
    "muse-free": family162,
    "nano-banana": family163,
    "nemotron": family164,
    "nemotron-free": family165,
    "north": family166,
    "nousresearch": family167,
    "nova": family168,
    "nova-lite": family169,
    "nova-micro": family170,
    "nova-pro": family171,
    "o": family172,
    "o-mini": family173,
    "o-pro": family174,
    "olmo": family175,
    "openai/codex-mini-latest": family176,
    "opencode-go/space-bunny": family177,
    "opencode-go/union-alpha": family178,
    "opencode/exo-free": family179,
    "opencode/fledge-alpha-free": family180,
    "opencode/jev-latest": family181,
    "opencode/space-bunny-free": family182,
    "opencode/union-alpha": family183,
    "openrouter/aion-labs/aion-1.0": family184,
    "openrouter/aion-labs/aion-1.0-mini": family185,
    "openrouter/aion-labs/aion-2.0": family186,
    "openrouter/aion-labs/aion-3.0": family187,
    "openrouter/aion-labs/aion-3.0-mini": family188,
    "openrouter/aion-labs/aion-3.5": family189,
    "openrouter/aion-labs/aion-3.5-mini": family190,
    "openrouter/alibaba/tongyi-deepresearch-30b-a3b": family191,
    "openrouter/anthracite-org/magnum-v4-72b": family192,
    "openrouter/apodex/apodex-1.1-mini:free": family193,
    "openrouter/arcee-ai/coder-large": family194,
    "openrouter/arcee-ai/maestro-reasoning": family195,
    "openrouter/arcee-ai/spotlight": family196,
    "openrouter/arcee-ai/trinity-large-preview": family197,
    "openrouter/arcee-ai/trinity-large-preview:free": family198,
    "openrouter/arcee-ai/trinity-large-thinking:free": family199,
    "openrouter/arcee-ai/trinity-mini:free": family200,
    "openrouter/arcee-ai/virtuoso-large": family201,
    "openrouter/baidu/cobuddy:free": family202,
    "openrouter/baidu/ernie-4.5-21b-a3b": family203,
    "openrouter/baidu/ernie-4.5-21b-a3b-thinking": family204,
    "openrouter/baidu/ernie-4.5-300b-a47b": family205,
    "openrouter/baidu/ernie-4.5-vl-28b-a3b": family206,
    "openrouter/baidu/qianfan-ocr-fast": family207,
    "openrouter/bytedance/ui-tars-1.5-7b": family208,
    "openrouter/dots-studio/dots-3-note-preview:free": family209,
    "openrouter/essentialai/rnj-1-instruct": family210,
    "openrouter/featherless/qwerky-72b": family211,
    "openrouter/fireworks/ember-1": family212,
    "openrouter/gryphe/mythomax-l2-13b": family213,
    "openrouter/inference-net/schematron-v2-small": family214,
    "openrouter/inference-net/schematron-v2-turbo": family215,
    "openrouter/inflection/inflection-3-pi": family216,
    "openrouter/inflection/inflection-3-productivity": family217,
    "openrouter/kwaipilot/kat-coder-pro:free": family218,
    "openrouter/microsoft/mai-ds-r1:free": family219,
    "openrouter/microsoft/wizardlm-2-8x22b": family220,
    "openrouter/nex-agi/nex-n2-pro:free": family221,
    "openrouter/openrouter/bodybuilder": family222,
    "openrouter/openrouter/free": family223,
    "openrouter/openrouter/fusion": family224,
    "openrouter/openrouter/pareto-code": family225,
    "openrouter/openrouter/sherlock-dash-alpha": family226,
    "openrouter/openrouter/sherlock-think-alpha": family227,
    "openrouter/perceptron/perceptron-mk1": family228,
    "openrouter/perceptron/perceptron-mk1.5": family229,
    "openrouter/poolside/laguna-xs.2": family230,
    "openrouter/poolside/laguna-xs.2:free": family231,
    "openrouter/prime-intellect/intellect-3": family232,
    "openrouter/prism-ml/ternary-bonsai-2-27b": family233,
    "openrouter/relace/relace-apply-3": family234,
    "openrouter/relace/relace-search": family235,
    "openrouter/sao10k/l3-euryale-70b": family236,
    "openrouter/sarvamai/sarvam-m:free": family237,
    "openrouter/sourceful/riverflow-v2-fast-preview": family238,
    "openrouter/sourceful/riverflow-v2-max-preview": family239,
    "openrouter/sourceful/riverflow-v2-standard-preview": family240,
    "openrouter/stepfun/step-3.5-flash": family241,
    "openrouter/stepfun/step-3.5-flash:free": family242,
    "openrouter/stepfun/step-3.7-flash": family243,
    "openrouter/switchpoint/router": family244,
    "openrouter/thedrummer/cydonia-24b-v4.1": family245,
    "openrouter/thedrummer/rocinante-12b": family246,
    "openrouter/thedrummer/skyfall-36b-v2": family247,
    "openrouter/thedrummer/unslopnemo-12b": family248,
    "openrouter/tngtech/tng-r1t-chimera:free": family249,
    "openrouter/unbiased/pareto": family250,
    "openrouter/unbiased/pareto-26.10-preview": family251,
    "openrouter/undi95/remm-slerp-l2-13b": family252,
    "openrouter/xiaomi/mimo-v2-flash": family253,
    "openrouter/xiaomi/mimo-v2-omni": family254,
    "openrouter/xiaomi/mimo-v2-pro": family255,
    "osmosis": family256,
    "palmyra": family257,
    "parallel/speed": family258,
    "perplexity-ai/r1-1776": family259,
    "perplexity-ai/sonar-deep-research": family260,
    "perplexity-ai/sonar-reasoning": family261,
    "phi": family262,
    "pixtral": family263,
    "qvq": family264,
    "qwen": family265,
    "qwen3.5": family266,
    "qwen3.6": family267,
    "qwen3.7-plus": family268,
    "qwen3.8-max": family269,
    "recraft": family270,
    "rednote": family271,
    "regolo-ai/apertus-70b": family272,
    "regolo-ai/brick-complexity-pro": family273,
    "reka": family274,
    "replicate/5599ed30703defd1d160a25a63321b4dec97101d98b4674bcc56e41f62f35637": family275,
    "replicate/671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb": family276,
    "replicate/826801120720e563620006b99e412f7ed7b991dd4477e9160473d44a405ef9d9": family277,
    "replicate/847dfa8b01e739637fc76f480ede0c1d76408e1d694b830b5dfb8e547bf98405": family278,
    "replicate/alibaba/happyhorse-1.0": family279,
    "replicate/alibaba/qwen-image-3": family280,
    "replicate/black-forest-labs/flux-video-upscale": family281,
    "replicate/bria/fibo": family282,
    "replicate/bria/remove-background": family283,
    "replicate/cbd15da9f839c5f932742f86ce7def3a03c22e2b4171d42823e83e314547003f": family284,
    "replicate/datacte/proteus-v0.3": family285,
    "replicate/elevenlabs/dubbing": family286,
    "replicate/elevenlabs/music": family287,
    "replicate/google/gemini-omni-1.1": family288,
    "replicate/google/nano-banana": family289,
    "replicate/google/nano-banana-2": family290,
    "replicate/google/nano-banana-pro": family291,
    "replicate/lightricks/ltx-2.5-fast": family292,
    "replicate/luma/ray-3.2": family293,
    "replicate/nightmareai/real-esrgan": family294,
    "replicate/prunaai/p-image-ideogram": family295,
    "replicate/prunaai/p-video": family296,
    "replicate/prunaai/p-video-2-pro": family297,
    "replicate/resemble-ai/chatterbox-turbo": family298,
    "replicate/runwayml/gen-4.5": family299,
    "replicate/stability-ai/stable-audio-2.5": family300,
    "requesty/step-3.7-flash": family301,
    "ring": family302,
    "sakana-namazu": family303,
    "seed": family304,
    "solar": family305,
    "solar-mini": family306,
    "solar-pro": family307,
    "sonar": family308,
    "sonar-deep-research": family309,
    "sonar-pro": family310,
    "sonar-reasoning": family311,
    "sora": family312,
    "stable-diffusion": family313,
    "step": family314,
    "text-embedding": family315,
    "the-grid-ai/agent-max": family316,
    "the-grid-ai/agent-prime": family317,
    "the-grid-ai/agent-standard": family318,
    "the-grid-ai/bytedance-pro-latest": family319,
    "the-grid-ai/code-max": family320,
    "the-grid-ai/code-prime": family321,
    "the-grid-ai/code-standard": family322,
    "the-grid-ai/text-max": family323,
    "the-grid-ai/text-prime": family324,
    "the-grid-ai/text-standard": family325,
    "titan-embed": family326,
    "together-ai/togethercomputer/Refuel-Llm-V2": family327,
    "together-ai/togethercomputer/Refuel-Llm-V2-Small": family328,
    "trinity": family329,
    "trinity-mini": family330,
    "typesafe/jev": family331,
    "unsloth": family332,
    "v0": family333,
    "veo": family334,
    "vercel/cohere/embed-v5.0-fast": family335,
    "vercel/cohere/embed-v5.0-pro": family336,
    "vercel/fireworks/ember-1": family337,
    "vercel/inception/mercury-edit-2": family338,
    "vercel/interfaze/interfaze-beta": family339,
    "vercel/mixedbread/toast-1": family340,
    "vercel/openai/codex-mini": family341,
    "vercel/perplexity/pplx-embed-v1-4b": family342,
    "vercel/perplexity/sonar-reasoning": family343,
    "vercel/prime-intellect/intellect-3": family344,
    "vercel/quiverai/arrow-2": family345,
    "vercel/quiverai/arrow-2-telos": family346,
    "vercel/sakana/namazu": family347,
    "vercel/stealth/glyph-cluster": family348,
    "vercel/stealth/pixel-canary": family349,
    "vercel/topaz/proteus": family350,
    "vercel/topaz/starlight-precise-2.6": family351,
    "vercel/topaz/wonder-3.5": family352,
    "vercel/typesafe-ai/jev": family353,
    "vercel/vercel/v0-1.0-md": family354,
    "vercel/vercel/v0-1.5-md": family355,
    "voxtral": family356,
    "voyage": family357,
    "whisper": family358,
    "workers-ai/@cf/ai4bharat/indictrans2-en-indic-1B": family359,
    "workers-ai/@cf/baai/bge-base-en-v1.5": family360,
    "workers-ai/@cf/baai/bge-large-en-v1.5": family361,
    "workers-ai/@cf/baai/bge-m3": family362,
    "workers-ai/@cf/baai/bge-reranker-base": family363,
    "workers-ai/@cf/baai/bge-small-en-v1.5": family364,
    "workers-ai/@cf/deepgram/aura-1": family365,
    "workers-ai/@cf/deepgram/aura-2-en": family366,
    "workers-ai/@cf/deepgram/aura-2-es": family367,
    "workers-ai/@cf/huggingface/distilbert-sst-2-int8": family368,
    "workers-ai/@cf/leonardo/lucid-origin": family369,
    "workers-ai/@cf/leonardo/phoenix-1.0": family370,
    "workers-ai/@cf/llava-hf/llava-1.5-7b-hf": family371,
    "workers-ai/@cf/lykon/dreamshaper-8-lcm": family372,
    "workers-ai/@cf/meta/m2m100-1.2b": family373,
    "workers-ai/@cf/myshell-ai/melotts": family374,
    "workers-ai/@cf/pfnet/plamo-embedding-1b": family375,
    "workers-ai/@cf/pipecat-ai/smart-turn-v2": family376,
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
    "v0": provider29,
    "replicate": provider30,
    "exa": provider31,
    "fal": provider32,
    "ideogram": provider33,
    "cerebras": provider34,
    "cohere": provider35,
    "opencode": provider36,
    "opencode-go": provider37,
    "cortecs": provider38,
    "nova": provider39,
    "poolside": provider40,
    "hetzner": provider41,
    "alibaba": provider42,
    "zai": provider43,
    "moonshot": provider44,
    "minimax": provider45,
    "google-vertex": provider46,
    "ollama-cloud": provider47,
    "meta": provider48,
    "greenpt": provider49,
    "lucidquery": provider50,
    "ovhcloud": provider51,
    "regolo-ai": provider52,
    "sakana": provider53,
    "standardcompute": provider54,
    "the-grid-ai": provider55,
    "kimi-for-coding": provider56,
    "thinkingmachines": provider57,
    "typesafe": provider58,
  },
};

export default catalogue;
