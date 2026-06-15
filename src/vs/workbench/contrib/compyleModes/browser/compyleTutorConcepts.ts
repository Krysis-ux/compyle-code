/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Compyle. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface ILearnConcept {
	readonly id: string;
	readonly language: string;
	readonly concept: string;
	readonly triggers: RegExp[];
	readonly beginnerExplanation: string;
	readonly normalExplanation: string;
	readonly advancedExplanation: string;
	readonly example: string;
	readonly commonMistake: string;
	readonly practicePrompt: string;
}

export type ExplanationLevel = 'beginner' | 'normal' | 'advanced';

export function getExplanation(concept: ILearnConcept, level: ExplanationLevel): string {
	switch (level) {
		case 'beginner': return concept.beginnerExplanation;
		case 'advanced': return concept.advancedExplanation;
		default: return concept.normalExplanation;
	}
}

// ---------------------------------------------------------------------------
// Python concepts
// ---------------------------------------------------------------------------

const PYTHON_CONCEPTS: ILearnConcept[] = [
	{
		id: 'py-print',
		language: 'python',
		concept: 'print()',
		triggers: [/\bprint\s*\(/],
		beginnerExplanation: 'print() shows text or values in the terminal. Everything inside the parentheses gets displayed when your program runs.',
		normalExplanation: 'print() writes to stdout. You can pass multiple values separated by commas, use sep= to change the separator, and end= to change the line ending.',
		advancedExplanation: 'print() calls sys.stdout.write() internally. For performance with large output, use sys.stdout.write() directly or buffer output. Consider logging.debug() instead of print() in production code.',
		example: 'print("Hello, world!")\nprint("Score:", 42)',
		commonMistake: 'Forgetting the parentheses: `print "hello"` is Python 2 syntax and will cause a SyntaxError in Python 3.',
		practicePrompt: 'Write a program that prints your name, age, and favorite language on three separate lines.',
	},
	{
		id: 'py-input',
		language: 'python',
		concept: 'input()',
		triggers: [/\binput\s*\(/],
		beginnerExplanation: 'input() pauses the program and waits for the user to type something. The text they type is returned as a string.',
		normalExplanation: 'input() always returns a string. If you need a number, wrap it: int(input("Enter age: ")). The optional argument is the prompt shown to the user.',
		advancedExplanation: 'input() reads from stdin. In scripts called non-interactively, stdin may be piped, so handle EOFError. For robust CLI tools, use argparse or click instead of raw input().',
		example: 'name = input("What is your name? ")\nprint("Hello " + name)',
		commonMistake: 'Using input() when you need a number without converting: `age = input()` gives you a string, so `age + 1` causes a TypeError. Use `age = int(input())`.',
		practicePrompt: 'Ask the user for two numbers and print their sum. Remember to convert from string to int.',
	},
	{
		id: 'py-variables',
		language: 'python',
		concept: 'variables',
		triggers: [/\b\w+\s*=\s*[^=]/],
		beginnerExplanation: 'A variable is a named container that stores a value. You create one by writing a name, then =, then the value. Python figures out the type automatically.',
		normalExplanation: 'Python uses dynamic typing — the same variable can hold different types at different times. Variable names are case-sensitive and follow snake_case convention.',
		advancedExplanation: 'Variables are references to objects, not containers. Assignment binds a name to an object. Understanding this matters for mutable defaults, aliasing, and garbage collection.',
		example: 'name = "Alice"\nage = 25\nis_active = True',
		commonMistake: 'Using = instead of == for comparison: `if x = 5` causes a SyntaxError. Use `if x == 5`.',
		practicePrompt: 'Create variables for a product: name, price, and in_stock. Then print a formatted description.',
	},
	{
		id: 'py-fstring',
		language: 'python',
		concept: 'f-strings',
		triggers: [/f["'].*\{/],
		beginnerExplanation: 'An f-string lets you put variables directly inside a string using curly braces {}. Write f before the opening quote, then use {variable} anywhere in the text.',
		normalExplanation: 'f-strings (formatted string literals) evaluate expressions inside {} at runtime. They are faster than .format() and more readable. You can do math: f"Total: {price * qty}".',
		advancedExplanation: 'f-strings support format specs: f"{value:.2f}" for 2 decimal places, f"{num:04d}" for zero-padded integers. Nested f-strings and walrus operator := also work inside {}.',
		example: 'name = "Alice"\nage = 25\nprint(f"Hello, {name}! You are {age} years old.")',
		commonMistake: 'Forgetting the f prefix: `"Hello {name}"` is just a regular string and won\'t substitute the variable.',
		practicePrompt: 'Rewrite three print statements that use + concatenation to use f-strings instead.',
	},
	{
		id: 'py-type-conversion',
		language: 'python',
		concept: 'type conversion',
		triggers: [/\bint\s*\(|\bstr\s*\(|\bfloat\s*\(|\bbool\s*\(/],
		beginnerExplanation: 'Type conversion changes a value from one type to another. int() turns text into a whole number, str() turns a number into text, float() gives you a decimal number.',
		normalExplanation: 'Python distinguishes implicit coercion (rare) from explicit conversion. int("42") works, int("hello") raises ValueError. Always wrap user input conversions in try/except.',
		advancedExplanation: 'Python\'s data model uses __int__, __str__, __float__ for conversions. isinstance() checks type without converting. For safe parsing, consider the third-party `parse` library or regex validation.',
		example: 'age = int(input("Enter age: "))\nprice = float("19.99")\nlabel = str(42)',
		commonMistake: 'Trying to concatenate a string and an integer: `"Age: " + 25` raises TypeError. Use `"Age: " + str(25)` or an f-string.',
		practicePrompt: 'Get a number from the user as input, double it, and print the result. Handle the case where they type something that is not a number.',
	},
	{
		id: 'py-if',
		language: 'python',
		concept: 'if / elif / else',
		triggers: [/\bif\b.*:/, /\belif\b.*:/, /\belse\s*:/],
		beginnerExplanation: 'An if statement runs code only when a condition is true. elif checks another condition if the first was false. else runs when none of the conditions matched.',
		normalExplanation: 'Python uses indentation (not braces) to define if blocks. Conditions can use ==, !=, <, >, <=, >=, and, or, not, in, is. Any value can be truthy/falsy.',
		advancedExplanation: 'Python\'s truthiness rules: empty containers, 0, None, and False are falsy. Use `is None` not `== None`. Consider match/case (Python 3.10+) for multiple value comparisons.',
		example: 'score = 85\nif score >= 90:\n    print("A")\nelif score >= 70:\n    print("B")\nelse:\n    print("C")',
		commonMistake: 'Using = instead of == in a condition: `if x = 5` is a SyntaxError. Comparison uses ==.',
		practicePrompt: 'Write a program that reads a temperature and prints "hot" if above 30, "warm" if 15-30, or "cold" if below 15.',
	},
	{
		id: 'py-for-loop',
		language: 'python',
		concept: 'for loop',
		triggers: [/\bfor\b\s+\w+\s+\bin\b/],
		beginnerExplanation: 'A for loop repeats code for each item in a sequence. `for item in list:` runs the indented code once for every item, with `item` set to the current value.',
		normalExplanation: 'Python for loops work on any iterable: lists, strings, ranges, dicts, files. range(n) gives 0 to n-1. Use enumerate() when you need both index and value.',
		advancedExplanation: 'For loops use the iterator protocol (__iter__, __next__). List comprehensions are often faster than for loops. Use itertools for advanced patterns like chain, groupby, and combinations.',
		example: 'fruits = ["apple", "banana", "cherry"]\nfor fruit in fruits:\n    print(fruit)\n\nfor i in range(5):\n    print(i)',
		commonMistake: 'Modifying a list while iterating over it causes skipped items or errors. Iterate over a copy: `for item in list.copy():`.',
		practicePrompt: 'Use a for loop to print the squares of numbers 1 through 10.',
	},
	{
		id: 'py-functions',
		language: 'python',
		concept: 'functions',
		triggers: [/\bdef\s+\w+\s*\(/],
		beginnerExplanation: 'A function is a reusable block of code with a name. You define it with `def name():` and call it with `name()`. Use `return` to send back a result.',
		normalExplanation: 'Functions have parameters (variables in the definition) and arguments (values passed when calling). Python supports default arguments, *args for variable positional args, and **kwargs for keyword args.',
		advancedExplanation: 'Functions are first-class objects in Python. They have __name__, __doc__, __annotations__. Closures capture variables from enclosing scope. Decorators are functions that wrap other functions.',
		example: 'def greet(name, greeting="Hello"):\n    return f"{greeting}, {name}!"\n\nprint(greet("Alice"))\nprint(greet("Bob", "Hi"))',
		commonMistake: 'Using a mutable default argument like `def f(items=[])`: the list is shared across all calls. Use `def f(items=None): if items is None: items = []`.',
		practicePrompt: 'Write a function `calculate_area(width, height)` that returns the area of a rectangle. Call it with a few different values.',
	},
	{
		id: 'py-lists',
		language: 'python',
		concept: 'lists',
		triggers: [/\[\s*\]|\[.*,.*\]/, /\.append\(|\.extend\(|\.remove\(|\.pop\(/],
		beginnerExplanation: 'A list is an ordered collection of items you can change. Create one with square brackets: `[1, 2, 3]`. Add items with .append(), access them with [index] starting at 0.',
		normalExplanation: 'Lists are mutable sequences. Common operations: append, extend, insert, remove, pop, index, count, sort, reverse. Slicing with [start:end:step] creates new lists.',
		advancedExplanation: 'Lists are dynamic arrays in CPython. Append is O(1) amortized, insert/remove at index is O(n). Use collections.deque for efficient front/back operations. List comprehensions are idiomatic and fast.',
		example: 'numbers = [1, 2, 3, 4, 5]\nnumbers.append(6)\nprint(numbers[0])   # 1\nprint(numbers[-1])  # 6\nprint(numbers[1:3]) # [2, 3]',
		commonMistake: 'Off-by-one indexing: the last element is at `list[-1]` or `list[len(list)-1]`, not `list[len(list)]` which raises IndexError.',
		practicePrompt: 'Create a list of 5 items, remove the middle one, sort the list, and print the result.',
	},
	{
		id: 'py-dicts',
		language: 'python',
		concept: 'dictionaries',
		triggers: [/\{.*:.*\}/, /\.get\(|\.keys\(\)|\.values\(\)|\.items\(\)/],
		beginnerExplanation: 'A dictionary stores key-value pairs. Access values using the key in square brackets: `person["name"]`. Use .get() for safe access that returns None if the key does not exist.',
		normalExplanation: 'Dicts use hash tables for O(1) average-case lookups. As of Python 3.7+ they maintain insertion order. Common operations: get, setdefault, update, pop, items(), keys(), values().',
		advancedExplanation: 'Dict comprehensions: `{k: v for k, v in pairs}`. Use collections.defaultdict for missing keys. Counter is a dict subclass for counting. ChainMap combines multiple dicts without copying.',
		example: 'person = {"name": "Alice", "age": 25}\nprint(person["name"])\nperson["city"] = "Berlin"\nprint(person.get("email", "not set"))',
		commonMistake: 'Accessing a key that does not exist with [] raises KeyError. Use .get("key", default) or `if "key" in dict:` to check first.',
		practicePrompt: 'Create a dictionary for a book with title, author, and year. Add a rating key, then print each field with its label.',
	},
	{
		id: 'py-classes',
		language: 'python',
		concept: 'classes',
		triggers: [/\bclass\s+\w+/],
		beginnerExplanation: 'A class is a blueprint for creating objects that group related data and functions. `__init__` runs when you create a new object and sets up its starting values.',
		normalExplanation: 'Classes use `self` to refer to the instance. Methods are functions defined inside a class. Inheritance lets one class extend another with `class Child(Parent):`. Use `super()` to call parent methods.',
		advancedExplanation: 'Python uses descriptor protocol for attributes. @property, @classmethod, @staticmethod are built-in decorators. Use __slots__ to reduce memory. dataclasses (Python 3.7+) reduce boilerplate for data-holding classes.',
		example: 'class Dog:\n    def __init__(self, name, breed):\n        self.name = name\n        self.breed = breed\n\n    def speak(self):\n        return f"{self.name} says woof!"\n\ndog = Dog("Rex", "Labrador")\nprint(dog.speak())',
		commonMistake: 'Forgetting `self` as the first parameter of a method causes a TypeError when the method is called.',
		practicePrompt: 'Create a BankAccount class with a balance, a deposit method, and a withdraw method that prevents overdrafts.',
	},
	// Python errors
	{
		id: 'py-syntax-error',
		language: 'python',
		concept: 'SyntaxError',
		triggers: [/SyntaxError/],
		beginnerExplanation: 'A SyntaxError means Python cannot understand your code because of a writing mistake — like a missing colon after `if`, mismatched brackets, or a typo.',
		normalExplanation: 'SyntaxError is raised during parsing before execution. Common causes: missing colon after if/for/def/class, mismatched quotes or brackets, using Python 2 syntax in Python 3.',
		advancedExplanation: 'SyntaxError includes a lineno and offset. The error may point to the line after the actual mistake (e.g., missing closing bracket causes the error on the next line). Use a linter like pylint or flake8 to catch these before running.',
		example: '# Missing colon:\n# if x > 0    ← SyntaxError\nif x > 0:\n    print("positive")',
		commonMistake: 'The error line number may not be where the actual problem is — check the line before it for unclosed brackets or missing colons.',
		practicePrompt: 'Can you spot all three syntax errors? `def greet(name)\n    print("Hello" + name\ngreet("Alice")`',
	},
	{
		id: 'py-name-error',
		language: 'python',
		concept: 'NameError',
		triggers: [/NameError/],
		beginnerExplanation: 'A NameError means you used a variable or function name that Python does not recognize — usually because it was never defined, or it was defined somewhere Python cannot see it.',
		normalExplanation: 'Python looks up names in LEGB order: Local, Enclosing, Global, Built-in. NameError fires when none of these scopes contain the name. Check for typos, missing imports, or accessing variables before assignment.',
		advancedExplanation: 'In CPython, `LOAD_NAME` bytecode raises NameError. Use `dir()`, `locals()`, `globals()` to inspect scopes. `__builtins__` is the innermost fallback. UnboundLocalError is a subclass for when a local variable is used before assignment.',
		example: '# NameError example:\n# print(massage)  ← NameError: name "massage" is not defined\nmessage = "Hello"\nprint(message)',
		commonMistake: 'Typos in variable names: `messaage` vs `message`. Python is case-sensitive: `Name` and `name` are different variables.',
		practicePrompt: 'Fix this code that has two NameErrors: `print(greting)\ngreeting = "Hi"\nprint(Greeting)`',
	},
	{
		id: 'py-type-error',
		language: 'python',
		concept: 'TypeError',
		triggers: [/TypeError/],
		beginnerExplanation: 'A TypeError means you tried to do something with the wrong type of value — like adding a number to a string, or calling something that is not a function.',
		normalExplanation: 'Common TypeErrors: concatenating str and int (`"age: " + 25`), calling a non-callable, wrong number of arguments, unsupported operand types. Fix with type conversion or check the expected types.',
		advancedExplanation: 'TypeError is raised when an operation is not supported for the given types. Python\'s type system uses duck typing — check with isinstance() or use type hints and mypy for static analysis.',
		example: '# TypeError: can only concatenate str (not "int") to str\n# Fix:\nage = 25\nprint("Age: " + str(age))  # or\nprint(f"Age: {age}")',
		commonMistake: 'Mixing str and int in concatenation. Always use str() or an f-string when combining text with numbers.',
		practicePrompt: 'This code has a TypeError — find and fix it: `score = input("Score: ") + 10`',
	},
	{
		id: 'py-indentation-error',
		language: 'python',
		concept: 'IndentationError',
		triggers: [/IndentationError/],
		beginnerExplanation: 'Python uses indentation (spaces or tabs) to organize code into blocks. An IndentationError means a line of code is not indented correctly relative to the block it should be in.',
		normalExplanation: 'Python requires consistent indentation. Use 4 spaces (PEP 8 standard). Mixing tabs and spaces causes TabError (a subclass of IndentationError). Configure your editor to insert spaces when you press Tab.',
		advancedExplanation: 'CPython tokenizes indentation via INDENT and DEDENT tokens. Unexpected indent means more indentation than expected; expected an indented block means code after a colon was not indented.',
		example: '# IndentationError:\n# if True:\n# print("oops")  ← needs 4 spaces\nif True:\n    print("correct")',
		commonMistake: 'Mixing tabs and spaces in the same file. Set your editor to "convert tabs to spaces" to avoid this.',
		practicePrompt: 'Fix the indentation: `def add(a, b):\nresult = a + b\n    return result`',
	},
	{
		id: 'py-module-not-found',
		language: 'python',
		concept: 'ModuleNotFoundError',
		triggers: [/ModuleNotFoundError/],
		beginnerExplanation: 'Python could not find the package or module you tried to import. Usually this means you need to install it first with `pip install package-name`.',
		normalExplanation: 'ModuleNotFoundError (subclass of ImportError) fires when the module is not in sys.path. Solutions: `pip install name`, check the correct module name (e.g., `pip install Pillow` but `import PIL`), check your virtual environment.',
		advancedExplanation: 'Python resolves imports using sys.path. Virtual environments isolate packages per project. Use `python -m pip` to ensure pip matches your Python version. Check `sys.path` at runtime to debug import issues.',
		example: '# pip install requests  (run in terminal first)\nimport requests\nresponse = requests.get("https://example.com")',
		commonMistake: 'Installing the package globally but running code inside a virtual environment where it is not installed, or vice versa.',
		practicePrompt: 'What would you run in the terminal to install the `numpy` package and make `import numpy` work?',
	},
];

// ---------------------------------------------------------------------------
// JavaScript concepts
// ---------------------------------------------------------------------------

const JS_CONCEPTS: ILearnConcept[] = [
	{
		id: 'js-console-log',
		language: 'javascript',
		concept: 'console.log()',
		triggers: [/console\s*\.\s*log\s*\(/],
		beginnerExplanation: 'console.log() prints values to the browser console or terminal. It is the main way to see what your program is doing or what value a variable holds.',
		normalExplanation: 'console.log() accepts multiple comma-separated arguments and prints them with a space between. Other methods: console.error() (red), console.warn() (yellow), console.table() (tabular data), console.time() (timing).',
		advancedExplanation: 'In Node.js, console.log writes to stdout. In browsers, the DevTools console accepts object references — expand them after the fact. Use %c for CSS styling, %o for objects, %d for numbers. For production, use a proper logging library.',
		example: 'const name = "Alice";\nconst age = 25;\nconsole.log("Name:", name, "Age:", age);\nconsole.log(`Hello ${name}!`);',
		commonMistake: 'Leaving console.log() calls in production code. Use a build step (like tree shaking or Babel transforms) to strip them, or use a logging library with log levels.',
		practicePrompt: 'Create three variables for a user (name, email, score) and log them with descriptive labels.',
	},
	{
		id: 'js-let-const',
		language: 'javascript',
		concept: 'let and const',
		triggers: [/\blet\b|\bconst\b/],
		beginnerExplanation: '`const` creates a variable that cannot be reassigned. `let` creates one that can be changed. Use `const` by default; only use `let` when you know the value will change.',
		normalExplanation: 'Both `let` and `const` are block-scoped (unlike `var` which is function-scoped). `const` prevents reassignment but does not make objects immutable — you can still mutate their properties.',
		advancedExplanation: 'Temporal Dead Zone (TDZ): `let` and `const` are hoisted but not initialized — accessing before declaration throws ReferenceError. Unlike `var` which is initialized to `undefined`. Use ESLint `no-var` rule to enforce let/const.',
		example: 'const PI = 3.14159;\nlet count = 0;\n\ncount += 1; // OK\n// PI = 3; // TypeError: Assignment to constant variable',
		commonMistake: 'Using `const` for an object and thinking its properties cannot change. `const obj = {}; obj.name = "Alice"` works fine — const only prevents reassigning `obj` itself.',
		practicePrompt: 'Rewrite this code replacing all `var` with `let` or `const` as appropriate: `var name = "Alice"; var count = 0; count++; var MAX = 100;`',
	},
	{
		id: 'js-functions',
		language: 'javascript',
		concept: 'functions',
		triggers: [/\bfunction\s+\w+\s*\(|\bconst\s+\w+\s*=\s*\(.*\)\s*=>|\bconst\s+\w+\s*=\s*function/],
		beginnerExplanation: 'A function is a reusable block of code. You define it once and call it as many times as needed. Arrow functions (`=>`) are a shorter way to write functions.',
		normalExplanation: 'JavaScript has function declarations (hoisted), function expressions, and arrow functions. Arrow functions do not have their own `this` binding, making them useful in callbacks and methods.',
		advancedExplanation: 'Functions are first-class objects: assignable to variables, passable as arguments, returnable from other functions. Closures capture variables from the outer scope. Pure functions have no side effects and return the same output for the same input.',
		example: '// Function declaration\nfunction add(a, b) { return a + b; }\n\n// Arrow function\nconst multiply = (a, b) => a * b;\n\nconsole.log(add(2, 3));      // 5\nconsole.log(multiply(4, 5)); // 20',
		commonMistake: 'Arrow functions do not have their own `this`. Using an arrow function as a method that references `this` will give unexpected results.',
		practicePrompt: 'Write two versions of a `square(n)` function: one using the `function` keyword and one as an arrow function.',
	},
	{
		id: 'js-arrays',
		language: 'javascript',
		concept: 'arrays',
		triggers: [/\[\s*\]|\[.*,.*\]/, /\.push\(|\.pop\(|\.map\(|\.filter\(|\.reduce\(|\.forEach\(|\.find\(/],
		beginnerExplanation: 'An array is an ordered list of values. Access items with brackets and an index starting at 0. Use .push() to add to the end and .pop() to remove from the end.',
		normalExplanation: 'JavaScript arrays have functional methods: .map() transforms each item, .filter() removes unwanted items, .reduce() combines everything into one value, .find() returns the first match. These methods do not mutate the original array.',
		advancedExplanation: 'Arrays are objects with numeric keys. Spread operator [...arr] creates shallow copies. Array.from() converts iterables. Destructuring: `const [first, ...rest] = arr`. For performance-critical code, typed arrays (Int32Array, Float64Array) avoid boxing overhead.',
		example: 'const nums = [1, 2, 3, 4, 5];\nconst doubled = nums.map(n => n * 2);\nconst evens = nums.filter(n => n % 2 === 0);\nconst sum = nums.reduce((acc, n) => acc + n, 0);\nconsole.log(doubled, evens, sum);',
		commonMistake: '.map(), .filter(), and .reduce() return new arrays — they do not modify the original. Beginners sometimes expect the original array to change.',
		practicePrompt: 'Given `const prices = [10, 25, 8, 40, 15]`, use .filter() and .map() to get only prices above 12, doubled.',
	},
	{
		id: 'js-objects',
		language: 'javascript',
		concept: 'objects',
		triggers: [/\{[^}]*:\s*[^}]+\}/, /\bObject\.\w+\s*\(/],
		beginnerExplanation: 'An object stores named values (properties). Access them with dot notation (obj.name) or bracket notation (obj["name"]). Objects can also hold functions, called methods.',
		normalExplanation: 'Objects are dynamic key-value stores. Use Object.keys(), Object.values(), Object.entries() to iterate. Destructuring: `const { name, age } = person`. Spread: `const copy = { ...obj, newProp: value }`.',
		advancedExplanation: 'Objects use prototype chains for inheritance. Object.create(), Object.assign(), Object.freeze(). Symbols as keys avoid collisions. Property descriptors (enumerable, writable, configurable) control behavior. Proxies intercept object operations.',
		example: 'const user = { name: "Alice", age: 25 };\nconsole.log(user.name);       // dot notation\nconsole.log(user["age"]);     // bracket notation\n\nconst { name, age } = user;   // destructuring\nconsole.log(`${name} is ${age}`);',
		commonMistake: 'Accessing a property that does not exist returns `undefined`, not an error. Accessing a property of `undefined` (like `user.address.city` when `address` is undefined) throws TypeError.',
		practicePrompt: 'Create an object for a movie with title, director, year, and rating. Write a function that takes a movie and prints a formatted summary.',
	},
	{
		id: 'js-fetch',
		language: 'javascript',
		concept: 'fetch()',
		triggers: [/\bfetch\s*\(/],
		beginnerExplanation: 'fetch() retrieves data from a URL — like calling an API. It returns a Promise. Use .then() to handle the response, or async/await for cleaner code.',
		normalExplanation: 'fetch() returns a Promise<Response>. Call .json() on the response to parse JSON (also returns a Promise). Always check response.ok before processing. Add { method, headers, body } for POST requests.',
		advancedExplanation: 'fetch uses the Streams API — .json() is a shortcut for response.body streaming. Handle network errors (catch) vs HTTP errors (response.ok check) separately. For production apps, use a wrapper like axios or SWR for retries, caching, and better error handling.',
		example: 'async function getUser(id) {\n  const response = await fetch(`/api/users/${id}`);\n  if (!response.ok) throw new Error(`HTTP ${response.status}`);\n  return response.json();\n}',
		commonMistake: 'fetch() only rejects on network failure, not on 4xx/5xx HTTP errors. Always check `response.ok` or `response.status` to detect API errors.',
		practicePrompt: 'Write an async function that fetches a post from https://jsonplaceholder.typicode.com/posts/1 and logs the title.',
	},
	{
		id: 'js-async-await',
		language: 'javascript',
		concept: 'async / await',
		triggers: [/\basync\s+function|\basync\s*\(.*\)\s*=>|\bawait\b/],
		beginnerExplanation: 'async/await makes asynchronous code look like regular code. Mark a function with `async`, then use `await` in front of anything that takes time (like fetch). The function pauses at `await` until the result is ready.',
		normalExplanation: 'async functions always return a Promise. `await` unwraps a Promise value. Wrap in try/catch to handle errors. You can await multiple things in parallel with Promise.all([p1, p2]).',
		advancedExplanation: 'async/await is syntax sugar over Promises and generators. The event loop is not blocked — other code runs while waiting. Use Promise.allSettled() to handle mixed success/failure. For sequential rate-limited calls, use for...of with await, not Promise.all.',
		example: 'async function loadData() {\n  try {\n    const response = await fetch("/api/data");\n    const data = await response.json();\n    console.log(data);\n  } catch (error) {\n    console.error("Failed:", error.message);\n  }\n}',
		commonMistake: 'Forgetting to `await` an async call: `const data = fetchData()` gives you a Promise, not the data. You need `const data = await fetchData()`.',
		practicePrompt: 'Rewrite this callback-based code using async/await: `fetch(url).then(r => r.json()).then(d => console.log(d)).catch(e => console.error(e))`',
	},
	// JS errors
	{
		id: 'js-reference-error',
		language: 'javascript',
		concept: 'ReferenceError',
		triggers: [/ReferenceError/],
		beginnerExplanation: 'A ReferenceError means you used a variable that does not exist yet. Check if you spelled the name correctly and that the variable is defined before you use it.',
		normalExplanation: 'ReferenceError occurs when accessing an undeclared variable or a `let`/`const` variable in its Temporal Dead Zone. `var` variables are hoisted (return `undefined`), but `let`/`const` variables throw ReferenceError if accessed before their declaration.',
		advancedExplanation: 'Accessing a variable that has not been declared fires ReferenceError. In strict mode (`"use strict"`), assigning to an undeclared variable also throws ReferenceError instead of creating an accidental global.',
		example: '// ReferenceError:\n// console.log(message);  ← not defined yet\n\n// Fix: declare before use\nconst message = "Hello";\nconsole.log(message);',
		commonMistake: 'Using a variable before its `const`/`let` declaration due to hoisting misconceptions. Unlike `var`, `let`/`const` are not initialized until execution reaches the declaration.',
		practicePrompt: 'Fix this code that has a ReferenceError: `console.log(total); let total = price * qty;`',
	},
	{
		id: 'js-type-error',
		language: 'javascript',
		concept: 'TypeError',
		triggers: [/TypeError/],
		beginnerExplanation: 'A TypeError means you tried to do something that is not allowed for that type of value — like calling a function on `null`, or accessing a property of `undefined`.',
		normalExplanation: 'Common TypeErrors: `undefined is not a function`, `Cannot read properties of null/undefined`, calling a non-function value. Often caused by misspelling a method name or accessing a property before data loads.',
		advancedExplanation: 'TypeErrors are runtime errors. TypeScript\'s static analysis catches most of these at compile time. Use optional chaining (`?.`) and nullish coalescing (`??`) to safely navigate potentially-null values.',
		example: '// TypeError: Cannot read properties of undefined\n// const name = user.profile.name;  ← if user or profile is undefined\n\n// Safe with optional chaining:\nconst name = user?.profile?.name ?? "Guest";',
		commonMistake: 'Calling a method that does not exist on a value, or calling `.then()` on a non-Promise (forgetting `fetch` returns a Promise).',
		practicePrompt: 'Fix this code using optional chaining: `const city = response.data.address.city;` (assume any level might be undefined)',
	},
];

// ---------------------------------------------------------------------------
// HTML/CSS concepts
// ---------------------------------------------------------------------------

const HTML_CSS_CONCEPTS: ILearnConcept[] = [
	{
		id: 'html-flexbox',
		language: 'css',
		concept: 'flexbox',
		triggers: [/display\s*:\s*flex/, /flex-direction|justify-content|align-items|flex-wrap|flex-grow/],
		beginnerExplanation: 'Flexbox is a CSS layout tool that makes it easy to arrange items in a row or column and control how they align and space out. Add `display: flex` to a container to enable it.',
		normalExplanation: 'Key flexbox properties: `flex-direction` (row/column), `justify-content` (main axis alignment), `align-items` (cross axis), `flex-wrap`, `gap`. Child properties: `flex`, `align-self`, `order`.',
		advancedExplanation: 'Flexbox is one-dimensional (row OR column). For two-dimensional layouts, use CSS Grid. `flex: 1` is shorthand for `flex-grow: 1; flex-shrink: 1; flex-basis: 0`. Understanding flex-basis vs width is critical for predictable layouts.',
		example: '.container {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 16px;\n}',
		commonMistake: 'Applying flex properties to the wrong element: `justify-content` and `align-items` go on the parent container, not the child items.',
		practicePrompt: 'Create a nav bar with a logo on the left and three links on the right using flexbox.',
	},
	{
		id: 'html-grid',
		language: 'css',
		concept: 'CSS Grid',
		triggers: [/display\s*:\s*grid/, /grid-template|grid-column|grid-row|grid-area|auto-fill|auto-fit/],
		beginnerExplanation: 'CSS Grid lets you create two-dimensional layouts with rows and columns. Add `display: grid` to a container, then define columns with `grid-template-columns`.',
		normalExplanation: 'Key grid properties: `grid-template-columns`, `grid-template-rows`, `gap`, `grid-column`, `grid-row`. `repeat(auto-fill, minmax(200px, 1fr))` creates responsive grids without media queries.',
		advancedExplanation: 'Grid\'s explicit vs implicit grid: named template areas (`grid-template-areas`) for semantic layouts. `fr` unit divides remaining space. `auto-fill` vs `auto-fit` behaves differently with empty tracks. Subgrid (CSS Grid Level 2) aligns nested grids.',
		example: '.grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 24px;\n}',
		commonMistake: 'Confusing flexbox (one-dimensional) with grid (two-dimensional). Use flexbox for single rows/columns of items, grid for full page layouts or card grids.',
		practicePrompt: 'Create a responsive card grid that shows 1 column on small screens, 2 on medium, and 3 on large screens.',
	},
	{
		id: 'html-media-queries',
		language: 'css',
		concept: 'media queries',
		triggers: [/@media\b/],
		beginnerExplanation: 'Media queries apply different CSS rules depending on the screen size. Use them to make your layout look good on phones, tablets, and desktops.',
		normalExplanation: 'Use `min-width` for mobile-first (start small, expand) or `max-width` for desktop-first (start large, shrink). Common breakpoints: 480px (mobile), 768px (tablet), 1024px (desktop), 1440px (wide).',
		advancedExplanation: 'Media queries can target more than width: `prefers-color-scheme` (dark mode), `prefers-reduced-motion`, `hover`, `orientation`, `resolution`. Container queries (`@container`) target parent size instead of viewport.',
		example: '/* Mobile first */\n.card { width: 100%; }\n\n@media (min-width: 768px) {\n  .card { width: 50%; }\n}\n\n@media (min-width: 1024px) {\n  .card { width: 33%; }\n}',
		commonMistake: 'Mixing mobile-first and desktop-first media queries in the same file leads to specificity conflicts. Pick one approach and stick with it.',
		practicePrompt: 'Take a two-column desktop layout and write media queries to make it a single column on screens smaller than 768px.',
	},
];

// ---------------------------------------------------------------------------
// All concepts
// ---------------------------------------------------------------------------

export const ALL_CONCEPTS: ILearnConcept[] = [
	...PYTHON_CONCEPTS,
	...JS_CONCEPTS,
	...HTML_CSS_CONCEPTS,
];

const LANGUAGE_MAP: Record<string, string> = {
	'python': 'python',
	'py': 'python',
	'javascript': 'javascript',
	'js': 'javascript',
	'typescript': 'javascript', // reuse JS cards for TS
	'ts': 'javascript',
	'typescriptreact': 'javascript',
	'javascriptreact': 'javascript',
	'css': 'css',
	'scss': 'css',
	'less': 'css',
	'html': 'css', // HTML/CSS concepts cover both
};

export function detectConcepts(code: string, languageId: string): ILearnConcept[] {
	const lang = LANGUAGE_MAP[languageId.toLowerCase()] ?? languageId.toLowerCase();
	const relevant = ALL_CONCEPTS.filter(c => c.language === lang);
	const matches: ILearnConcept[] = [];

	for (const concept of relevant) {
		for (const trigger of concept.triggers) {
			if (trigger.test(code)) {
				matches.push(concept);
				break;
			}
		}
	}

	// Sort: put error concepts at front if code contains error keywords
	const isErrorContext = /Error\b/.test(code);
	if (isErrorContext) {
		matches.sort((a, b) => {
			const aIsError = a.id.includes('error') || a.concept.includes('Error');
			const bIsError = b.id.includes('error') || b.concept.includes('Error');
			if (aIsError && !bIsError) { return -1; }
			if (!aIsError && bIsError) { return 1; }
			return 0;
		});
	}

	return matches;
}

export function findConceptForError(errorMessage: string, languageId: string): ILearnConcept | undefined {
	const lang = LANGUAGE_MAP[languageId.toLowerCase()] ?? languageId.toLowerCase();
	for (const concept of ALL_CONCEPTS) {
		if (concept.language !== lang) { continue; }
		for (const trigger of concept.triggers) {
			if (trigger.test(errorMessage)) {
				return concept;
			}
		}
	}
	return undefined;
}
