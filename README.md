# Active Acoustics Academy

A visual curriculum on active acoustic modeling and sensor performance prediction. Twenty units run from a single ping to a multistatic field, and from a propagation engine's output to an operator's display. Each unit stays locked until the test for the one before it is passed.

## Personal learning only

This is a personal project for learning the subject, and it is for personal learning only. It is not a product, a reference or official guidance, and it is not affiliated with or endorsed by any employer or organization. The lessons are a synthesis of open literature and have not been reviewed by an acoustician, so check anything that matters against the sources the site cites.

## Use it

Open `dist/index.html` in a browser. It is one self-contained file that needs no server and no network access. Progress is kept in that browser's local storage.

To rebuild after a change, or to work on it with live reload, install the dependencies and run one of the two scripts.

```
npm install
npm run dev        # live development server
npm run build      # writes dist/index.html
```

## What is in it

- 20 units in three tiers. The trunk is foundations, the limbs are the terms of the active sonar equation and the geometries, and the crown is the prediction pipeline, displays, measured data and scenarios. Three of the units teach math.
- 60 branches and 198 leaves. A leaf is one short lesson.
- 20 playgrounds, one per unit, built on a small physics library that runs in the browser.
- 275 problem generators. A test draws ten and gives them fresh numbers on each attempt. The pass mark is 80 percent.
- A glossary and a list of sources.

## How it is put together

| Path | Holds |
|---|---|
| `src/lib` | The physics library, which covers rays, loss fields, eigenrays, beam patterns, target strength, noise, reverberation, waveforms, detection statistics and bistatic geometry. Pure functions with tests. |
| `src/curriculum/meta.ts` | The list of units with their titles, objectives and playgrounds. |
| `src/curriculum/units/*.md` | The lessons, one file per unit. `# ` starts a branch and `## ` starts a leaf. |
| `src/curriculum/questions` | The problem generators and the engine that builds and grades tests. |
| `src/playgrounds` | The interactive labs. |
| `src/components`, `src/pages` | The shell, the knowledge tree, the lesson reader and the test runner. |
| `e2e` | Browser tests of the locking flow and a sweep of every page. |

### Writing lessons

Lessons are Markdown with math between dollar signs. Two extensions are available.

The first is a callout. Its kind is one of `key`, `pipeline`, `operator`, `pitfall`, `scenario`, `math` or `try`.

```
:::pipeline
Text of the callout.
:::
```

The second embeds a playground in the lesson. With no `id` it is the unit's own playground. `preset` picks a starting state where the playground supports one.

```
::play{preset="surface-duct"}
::play{id="field-planner" preset="barrier"}
```

### Writing problems

A generator is a function that takes a seeded random source and returns a question. Use `num` for a numeric answer and `mc` for multiple choice. Compute the answer in code from the same numbers that go into the prompt. `banks.test.ts` runs every generator over many seeds and checks that answers are finite, options are distinct and the text is well formed.

## Checks

```
npm run typecheck
npm test           # unit tests for the physics, the test engine, the parser and progress
npm run e2e        # builds, then runs the browser tests against dist/index.html
npm run check      # all of the above
```

`node scripts/shots.mjs <outDir> <route> ...` renders routes of the built site to PNG files for visual review. It marks every unit as passed first so that all of them can be opened.

## Limits to keep in mind

Everything here comes from open literature. The playgrounds use small teaching models. They show the right trends, but they are not validated engines or databases, so their numbers are for intuition only. The target model is a notional shape and describes no real vessel. Nothing here is specific to any system.
