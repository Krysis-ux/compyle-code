# Compyle Tutor — Architecture

Compyle Tutor provides adaptive explanations of code concepts using a hybrid approach: a static lesson card library for instant, offline coverage of common patterns, with an optional fallback to Compyle Brain (AI) for project-specific questions.

---

## Design Principles

1. **Static-first**: The core system works offline with no network call and no AI inference. Lesson cards are bundled in the editor.
2. **No fake AI**: If a concept isn't in the static library and Compyle Brain isn't configured, the command says so clearly instead of showing a spinner or placeholder.
3. **Level-aware**: Every lesson card has three explanation texts — beginner, normal, advanced. The user picks a level once; it applies everywhere.
4. **Error-aware**: The concept library includes entries for common error types (SyntaxError, TypeError, NameError, IndentationError, ModuleNotFoundError, ReferenceError). These surface first when error keywords appear in the code or message.

---

## Concept Card Schema

```typescript
interface ILearnConcept {
  id: string;              // unique, e.g. "py.print"
  language: string;        // "python" | "javascript" | "css"
  concept: string;         // display name, e.g. "print() function"
  triggers: RegExp[];      // patterns to detect in code
  beginnerExplanation: string;
  normalExplanation: string;
  advancedExplanation: string;
  example: string;         // working code snippet
  commonMistake: string;   // what goes wrong
  practicePrompt: string;  // "Try: ..."
}
```

---

## Concept Coverage

### Python (17 concepts)
| ID | Concept |
|----|---------|
| `py.print` | print() function |
| `py.input` | input() function |
| `py.variable` | variable assignment |
| `py.fstring` | f-strings |
| `py.typeconv` | type conversion (int, float, str) |
| `py.ifelse` | if / elif / else |
| `py.forloop` | for loops |
| `py.whileloop` | while loops |
| `py.function` | def functions |
| `py.list` | list operations |
| `py.dict` | dict operations |
| `py.class` | class definitions |
| `py.import` | import statements |
| `py.SyntaxError` | SyntaxError |
| `py.NameError` | NameError |
| `py.TypeError` | TypeError |
| `py.IndentationError` | IndentationError |
| `py.ModuleNotFoundError` | ModuleNotFoundError |

### JavaScript / TypeScript (9 concepts)
| ID | Concept |
|----|---------|
| `js.console` | console.log |
| `js.letconst` | let / const declarations |
| `js.function` | function declaration |
| `js.array` | array operations |
| `js.object` | object literals |
| `js.fetch` | fetch API |
| `js.asyncawait` | async / await |
| `js.promise` | Promises |
| `js.ReferenceError` | ReferenceError |
| `js.TypeError` | TypeError |

### CSS / SCSS (3 concepts)
| ID | Concept |
|----|---------|
| `css.flexbox` | Flexbox layout |
| `css.grid` | CSS Grid |
| `css.mediaquery` | Media queries |

---

## Language Mapping

The `detectConcepts()` function maps VS Code language IDs to concept categories:

| VS Code language ID | Concept library |
|--------------------|-----------------|
| `python` | Python |
| `javascript` | JavaScript |
| `typescript` | JavaScript |
| `javascriptreact` | JavaScript |
| `typescriptreact` | JavaScript |
| `css` | CSS |
| `scss` | CSS |
| `less` | CSS |
| `html` | JavaScript + CSS |

---

## Detection Algorithm

`detectConcepts(code: string, languageId: string): ILearnConcept[]`

1. Maps `languageId` to a concept subset.
2. For each concept in the subset, runs all `triggers` regexes against `code`.
3. Collects all concepts where at least one trigger matches.
4. Sorts results: error-type concepts first (when the code/message contains error keywords), then others.
5. Returns up to the full match list — callers display the first 1–2 results.

`findConceptForError(errorMessage: string, languageId: string): ILearnConcept | undefined`

1. Scans error-type concepts in the language subset.
2. Runs each concept's `triggers` against the error message string.
3. Returns the first match, or `undefined`.

---

## Commands

### `Compyle: Explain Selected Code`

1. Gets the active editor via `ICodeEditorService.getActiveCodeEditor()`.
2. Gets the selected text and the document's language ID.
3. Runs `detectConcepts(selectedText, languageId)`.
4. If concepts found: shows an `INotificationService.info()` notification with the explanation at the current `compyle.modes.tutor.explanationLevel` setting.
5. If no concepts found: shows "No recognized concepts in selection. Use Compyle Brain for AI-powered explanations."

### `Compyle: Explain Current Error`

1. Gets the active editor cursor position.
2. Gets all markers for the current file via `IMarkerService.read({ resource: ... })`.
3. Finds the first error/warning marker at or near the cursor line.
4. Runs `findConceptForError(marker.message, languageId)`.
5. If match: shows the explanation for that error type.
6. If no match: shows the raw error message + "For project-specific help, use Compyle Brain."

---

## AI Integration (Future)

When Compyle Brain is implemented, the Tutor commands will gain an opt-in path:

```
if (no static match && aiBehavior !== 'off') {
  prompt user → if approved → call CompyleBrainService with code + question
}
```

The static-first approach means the commands already work and deliver value before AI is wired.

---

## Adding Lesson Cards

Lesson cards live in `browser/compyleTutorConcepts.ts`. To add a card:

1. Add a new entry to the `PYTHON_CONCEPTS`, `JS_CONCEPTS`, or `CSS_CONCEPTS` array.
2. Write at least one `trigger` regex that reliably detects the pattern.
3. Write all three explanation levels.
4. Include a working `example` code snippet.
5. Write a `commonMistake` and a `practicePrompt`.

No registration or configuration needed — `detectConcepts()` scans the full array automatically.
