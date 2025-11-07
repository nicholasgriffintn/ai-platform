export interface PatternExample {
	id: string;
	name: string;
	description: string;
	code: string;
	category:
		| "drums"
		| "melody"
		| "ambient"
		| "techno"
		| "experimental"
		| "house"
		| "jazz";
}

export const examplePatterns: PatternExample[] = [
	{
		id: "stranger-things",
		name: "Stranger Things",
		description:
			"Iconic pulsing bassline inspired by the Stranger Things theme.",
		code: `setcps(0.7);

p1: n("0 2 4 6 7 6 4 2")
  .scale("<c3:major>/2")
  .s("supersaw")
  .distort(0.7)
  .superimpose((x) => x.detune("<0.5>"))
  .lpenv(perlin.slow(3).range(1, 4))
  .lpf(perlin.slow(2).range(100, 2000))
  .gain(0.3);
p2: "<a1 e2>/8".clip(0.8).struct("x*8").s("supersaw").note();
// @version 1.2`,
		category: "ambient",
	},
	{
		id: "old-mcdonald",
		name: "Old McDonald",
		description: "Simple melody of 'Old McDonald Had a Farm' on a piano.",
		code: `// old mcdonalds has bad samples
setDefaultVoicings('legacy')
const beast = ["crow","space","gm_bird_tweet","space:4","clash","space:1"]
const bsequ = "<~@2 0 ~@3 1 0 ~@3 2 1 0 ~@3 3 2 1 0 ~@3 4 3 2 1 0 ~@2>".pick(beast)
const chrds = "F [A# F] [F C] [F@3 ~]";
const strct = "[[x ~]!2] [[x ~]!2 x  ~]";
const bstrc = "[[~ x]!2] [[~ x]!2 ~  x]";
const trnsp = "<0!4 1!5 2!6 3!7 4!8 ~>";

"<[0,3] [0,1] 2 0!2 [0,1] [2,1] 2 0!2 [0,1] [2,1]!2 2 0!2 [0,1] [2,1]!3 2 0!2 [0,1] [2,1]!4 2 [0@7 ~] ~>".pick(
[stack(
  "F5*2 [F5 C5] D5*2 C5 A5*2 G5*2 F5@2".note().clip(0.9),
  chord(chrds).anchor("G4").voicing().struct("[~ x]*4 [[~ x]*2 [x@3 ~]]").gain(0.6),
  n("[2 1]*4").chord(chrds).anchor("F2").voicing().struct("[x ~]*8").gain(0.6),
 ).piano().add(note(trnsp))
,"~@7 [C5 D5]".note().clip(0.8).piano().add(note(trnsp)) 
,stack(
  stack(
  "[[F5*2 ~]!2] [[F5 ~]!2 F5*2 ~]".note(),
 chord("F").anchor("G4").voicing().struct(strct).gain(0.6),
  "F2".struct(strct).note().gain(0.6)
    ).clip(0.8).piano().add(note(trnsp)),
 "F".struct(bstrc).s(bsequ).release(0))
 
,"0,1,2,3,4,5".pick(beast).gain(0) // samples preload trick
]).cpm(140/8).room(0.4)
// @version 1.2`,
		category: "melody",
	},
	{
		id: "enjoy-the-silence",
		name: "Enjoy the Silence",
		description:
			"Melancholic synth pad inspired by Depeche Mode's 'Enjoy the Silence'.",
		code: `// "Enjoy The Silence (coda)"
// song @by Depeche Mode
// script @by eefano
setCps(113/60/4)
await samples({'gtr': 'gtr/0001_cleanC.wav'}, 'github:tidalcycles/Dirt-Samples/master/');

const melodia   = x => x.note().s("ocarina").gain(0.6).clip(1).release(0.1)
const guitar    = x => x.note().s("gtr").room(1).gain(0.25).clip(1).release(0.5)
const accordi   = x => x.note().s("recorder_bass_sus").gain(1.5).clip(1).release(0.5)
const basso     = x => x.note().s("triangle").gain(0.8).clip(1).sustain(0.8)
const ritmo     = x => x.bank("AlesisHR16").clip(1).gain(0.08)

const scala = cat('c minor')  // IV VI I III
stack(
"<[3,5,0] [5,0,2] [0,2,4] [2,4,-1]>".scale(scala).apply(accordi),
"<[2@3 3] [0@3 2] [4@3 6] [2@3 3] [0@3 1] [-1@3 -2] -3 [0 1]>".scale(scala).transpose(12).apply(melodia),
"~@2 2 <7 9 6 6>@2 2 <8 6 4 4>@2".scale(scala).transpose(-12).apply(guitar),
"<-4 -2 0 -1>".struct("[[x ~]!2 x x@0.5 [x ~]!2 x@0.5 [x ~]!2]").scale(scala).apply(basso),
s("bd!4,[~ sd]!2,[~ hh!2 hh*2]!2").apply(ritmo),
//s("hh!4").apply(ritmo)
)`,
		category: "ambient",
	},
	{
		id: "pump-up-the-jam",
		name: "Pump Up The Jam",
		description: "Classic house bassline inspired by 'Pump Up The Jam'.",
		code: `// "Pump Up The Jam" - Work In Progress
// song @by Technotronic
// script @by eefano
const pickRestart = register('pickRestart', (arr, pat) => pat.pick(arr.map((x)=>x.restart(pat.collect().fmap(v=>v+1)))))
const as = register('as', (mapping, pat) => { mapping = Array.isArray(mapping) ? mapping : [mapping];
  return pat.fmap((v) => { v = Array.isArray(v) ? v : [v, 0];
    return Object.fromEntries(mapping.map((prop, i) => [prop, v[i]])); }); });
stack("~"
,"<~@8 0@4 1@4 ~@8>".pickRestart(
  ["[u [u e] a [u i] [u ~] [a u] [i a] [o@3 i] ~ [a e] [a i] [o@3 i] [~ u@2 a] [e e] [o i] [o@3 i]]/4"
  ,"~ [u i] [u ~ ~ a] [i i@2 o]"
]).vowel().s("z_sawtooth").clip(0.8).gain(1.4)
             
,"<~@16 0@8>".pickRestart(
  ["[ ~@2 4 [5:1 ~] ~ [~ 0] [3:-1@5 3:1@2 2]@2 ~ [4@3:1 3 3@3 2 2@3 3 4:1@3 0 0@2 2:2@2]@5 [~ ~ 0@2 ~ 0@2 -2:-3]@2 ]/4"
]).as("n:penv").scale("c4:minor").clip(0.90).patt("0.15").s("square").delay(0.3).dfb(0.3).dt(60/128).gain(0.7)
            
,"<0@32>".pickRestart(
  ["[~@13 [[~@3 [0,-2,-4]@2 ~]@3 [0,-2,-4] [1,-1,-3]!2]@3 ]/4"
]).scale("c4:minor").note().clip(0.7).s("z_sawtooth").color("red").adsr("0.07:.1:0.6:0.1").gain(0.5)

,"<0@12 0 1 ~@2 3@8>".pickRestart(
  ["[0 ~@23]/2"
  ,"~@2 [~ [e2 ~]] [[0 2] ~]"
  ,"[0 ~ ~ 0 ~ ~ 0 ~] <[[~ [0 1]] [2 ~]] ~>"
]).scale("c2:minor").note().clip(0.9)
      .layer(x=>x.s("z_sawtooth").delay(0.6).dfb(0.5).dt(60/125*3/4).pan(0.55).gain(0.8)
            ,x=>x.s("z_square").lpf(300).lpe(2).lpa(-1.5).lpd(0.1).lpr(0.05).pan(0.45).gain(1)).color("green")

,"<0@4 [0,1]@12 [0,1,2]@4 [0,1,2,3]@4>".pickRestart(
 [stack(s("oh*16").pan(0.45).gain("[0.08 0.16]*4").release(0),s("hh*4").pan(0.7).gain(0.20))
 ,s("bd*4").lpf(150).gain(1)
 ,s("[~ cp]*2").gain(0.5).pan(0.25)
 ,s("[~ rd]*4").gain(0.15).release(0).hpf(1500).pan(0.75)
 ,s("[~ sd!3]!4 [sd*4]!4").slow(2).gain(run(32).slow(2).mul(1/31).add(0.1).mul(0.4))
 ,s("cr").gain(0.2)
 ,s("bd").gain(0.8)
 ]).bank("RolandTR909").color("yellow").velocity(0.7)
 
).cpm(124.5/4).room(0.3)`,
		category: "house",
	},
	{
		id: "satiesfaction",
		name: "Satie's Faction",
		description: "Minimalist melody inspired by Erik Satie's compositions.",
		code: `// "low Effort, high Satie'sfaction"
// song @by eefano

setcps(185 / 60)
stack(
  n("<0 1 2 [1 3 4] 5 4 [6 2 3] 1 4 0>/3".add("<7@24 14>/17")),
  n("<[3,5,9] [2,5,9] [2,4,9]>/3".sub(7)).gain("<.35 .45 .25 .35>"),
  n("<[5@3 4] 5>/8".sub(14).gain("<.7@9 .8>/10"))
)
  .scale("<b3:lydian c#4:locrian>/48").s("piano")
  .postgain(sine.mul(.3).add(1.2).segment(48).slow(48 * 7))
  .room(".8").clip(1)`,
		category: "melody",
	},
	{
		id: "vine",
		name: "Vine",
		description:
			"Progressive rock composition inspired by 'Vine' by Spratleys Japs.",
		code: `// "Vine" (work in progress)
// composed @by Tim Smith of Spratleys Japs
// script @by eefano
setCps(143 / 60 / 4)
const song = "<0@8 1@28 2@24 3@24 1@25 1@28 2@36 3@24 4@16 5@12 6@66 7@66 8@66 ~@8>*4"
const chordseq = song.pickRestart(["~",
"<C@3 G# C# Cm G# C# Cm B F# A@3>*2", // verse
"<E B C# G# A# F>*2", // chorus
"<G# C@2>/2", "~", // post-chorus
"<E@4 C@2 A#@3 D@4 C@2 G#@5 D@4>*8", // interlude
"<Dm@9 G@5 A@5 G@4 A@6 Dm@4 G@10 A@5 G@3 A@4 G@5 Dm@13 G@7 A@5 G@7 A@4 G@4 Dm@7 G@9 A@4 G@5 A@3 G@4>*8", //snare      
"<Dm@9 G@5 A@5 G@4 A@6 Dm@4 G@9 A@6 G@3 A@4 G@5 Dm@13 G@7 A@5 G@7 A@4 G@4 Dm@7 G@9 A@4 G@5 A@3 G@4>*8", //handclaps
"<Dm@9 G@6 A@5 G@4 A@6 Dm@4 G@9 A@6 G@3 A@4 G@5 Dm@13 G@7 A@5 G@7 A@4 G@4 Dm@7 G@9 A@4 G@5 A@3 G@3>*8"]); //triangle

voice: song.pickRestart(["~",
  note("<c4*2 c4 [a#3 c4] c4@2 ~ c4*2 d#4 f4 ~ d#4*2!2 d#4 c4 g#4 ~ g4 ~ [f#4 f4] [d#4 c#4] a#3 ~ [e4 d#4] e4 [e4 f#4] g#4@2 g#4>*4"),
  note("<[g#4@2 ~ f#4] [f#4@2 ~ f4] [f4@2 ~ d#4] [d#4@2 ~ d4] [d4@2 ~ c4] [c4 a4@3]>*2").gain(1.4),
  "~"
]).s('gm_oboe').clip(.95).color('yellow')

bass: n(song.pickRestart(["~","0*4","[0@2 ~ 0]*2","0*8"])).chord(chordseq).mode("root:e2").voicing()
  .s("gm_electric_bass_pick").clip(.90).lpf(300).gain(1).color('green')
guitar: n(song.pickRestart(["~","[0,2,3]*2","[[0,2,3]@3 [0,2,3]]*2","~"])).chord(chordseq).mode("root:e3").voicing()
  .s(song.pick(["~","gm_acoustic_guitar_steel:2","gm_overdriven_guitar:2","~"])).color('red')
organ: n(song.pick(["~","~","~","~","[2 1]*4"])).anchor("g5").chord(chordseq).voicing()
  .s("sawtooth").clip(.6).color('cyan')

drums: song.pickRestart([
  "<hh*4,[<bd bd*2> sd]>*2",
  "<hh*4,[bd sd]>*2",
  "<hh*4,[bd sd]>*2",
  "~","<sl*4>","<sl*4>",
  "<hh*4,[<bd bd*2> sd]>*2",
  "<hh*4,[<bd bd*2> [sd,cp]]>*2",
  "<hh*4,tr*2,[<bd bd*2> [sd,cp]]>*2",
]).pickOut({
  bd:s('linndrum_bd').lpf(3000).room(.2).velocity(.8),
  sd:s('linndrum_sd').room(.2).velocity(.65),
  hh:s('linndrum_hh').hpf(7000).speed(1.5).velocity(.3),
  oh:s('linndrum_oh'),
  sl:s('sleighbells'),
  tr:s('anvil').speed(1.15).velocity(30),
  cp:s('cp')
})

all(x=>x.room(.1)
   // .ribbon(2*4,1*8)
  )`,
		category: "melody",
	},
	{
		id: "simple-drums",
		name: "Simple Drums",
		description:
			"808-style kick, snare and hats using mini-notation and a drum-machine bank.",
		code: 's("bd sd [~ bd] sd,hh*8").bank("RolandTR808")',
		category: "drums",
	},
	{
		id: "techno-beat",
		name: "Techno Beat",
		description:
			"Driving 909-style techno beat with Euclidean clap and subtle variation.",
		code: 's("bd*4,hh*8,cp(3,8)").bank("RolandTR909").fast(2).degradeBy(0.1)',
		category: "techno",
	},
	{
		id: "layered-drums",
		name: "Layered Drums",
		description: "Three drum voices layered using stack: kick, hats and claps.",
		code: 'stack("bd ~ sd ~","[hh*2 oh]*2","~ cp ~ cp").sound().degradeBy(0.2)',
		category: "drums",
	},
	{
		id: "melody",
		name: "Minor Motif",
		description:
			"Minor-scale motif voiced on piano, alternating forwards and backwards.",
		code: 'n("0 2 4 7 4 2").scale("C:minor").s("piano").palindrome()',
		category: "melody",
	},
	{
		id: "ambient",
		name: "Ambient Pad",
		description:
			"Slow evolving sine pad with reverb, filtering and long release.",
		code: 'note("<c4 g4 bb4 e5> <f4 a4 c5 d5>").slow(4).s("sine").room(0.9).lpf(1500).release(2)',
		category: "ambient",
	},
	{
		id: "house-groove",
		name: "House Groove",
		description:
			"Four-on-the-floor house groove with hi-hats and Euclidean claps.",
		code: 's("bd*4,hh*8,cp(2,8)").bank("RolandTR909").room(0.4).degradeBy(0.05)',
		category: "house",
	},
	{
		id: "bassline",
		name: "Techno Bassline",
		description:
			"Dark sawtooth bassline built from numbers in a C minor scale.",
		code: 'n("0 0 3 5 [7 5] 3 0").scale("C2:minor").sound("sawtooth").lpf(600).clip(0.8)',
		category: "techno",
	},
	{
		id: "euclidean",
		name: "Euclidean Stack",
		description: "Polyrhythmic Euclidean drum stack of kick, snare and hats.",
		code: 'stack(s("bd").euclid(3,8), s("sd").euclidRot(5,8,2), s("hh*2").euclid(7,16)).degradeBy(0.15)',
		category: "experimental",
	},
	{
		id: "cafe",
		name: "CAFE Pattern",
		description: "Classic CAFE rhythm with stereo jux and piano reverb.",
		code: 'note("<c a f e>(3,8)").jux(rev).sound("piano").room(0.4)',
		category: "melody",
	},
	{
		id: "jazz-chords",
		name: "Jazz Chords",
		description:
			"Jazz ii–V–I style chord loop voiced for piano using tonal helpers.",
		code: 'n("0 1 2 3").chord("<Dm7 G7 Cmaj7 A7>").voicing().s("piano").slow(2)',
		category: "jazz",
	},
];

export const defaultCode = `// Welcome to AI-Powered Strudel!
// Enter a prompt above to generate music with AI
// Or edit this code manually and click Play
s("bd sd [~ bd] sd,hh*8").bank("RolandTR808")
// Try modifying:
// - Replace 'bd' or 'sd' with other drum names (hh, cp, lt, perc)
// - Add '*2' or '/2' inside the quotes to change density
// - Add '.room(0.4)' or '.lpf(2000)' for reverb / filtering`;

export function getExamplesByCategory(
	category: PatternExample["category"],
): PatternExample[] {
	return examplePatterns.filter((pattern) => pattern.category === category);
}

export function getRandomExample(): PatternExample {
	return examplePatterns[Math.floor(Math.random() * examplePatterns.length)];
}
