# weblua

A project for the consistent, reproducible, and simple compilation of the Lua interpreter for the web. It uses Emscripten and produces an interpreter of version 5.2.1.

## Generating JS files

You need a working Emscripten setup, with the Emscripten binaries in the PATH of the shell you're using to compile the JS files.

The whole project is created from scratch via a single command, `make`, which will download, decompress, and compile the latest version of the Lua interpreter, transcode that to liblua.js, and add convenience hooks/compression/optimization for the final product, weblua.js.

## Using weblua.js

You don't have to install or set up Emscripten to use weblua.js, unless you want to actually make changes to weblua.js. The binaries are available precompiled for you in this repository. You can get straight to including it in your projects.

To test out the demo and make sure things work, run `python -m SimpleHTTPServer 8770` in the root of this git repository, and go to `localhost:8770` in your browser.

### API reference

#### The Lua object

When you include the weblua.js script in your page, you will have a window.Lua object available to you. Currently you can only have one global interpreter for your whole page. In the future, this will be changed such that you can have as many as you want.

#### Lua.initialize()

Must be called exactly once, to initialize the internal state of the Lua library.

Other functions will not work until this has been called.

#### Lua.eval("5 + 2")

Evaluates a Lua _expression._ Returns the result.

Lua functions are automatically wrapped so that you can call them directly:

    Lua.initialize();
    Lua.exec("function add(a,b)\n    return a + b\nend");
    my add_func = Lua.eval("add")
    add_func(13, 7) // Returns 20

This function expects expressions, not statements. For defining functions and other such things, use Lua.exec.

**BEHIND THE SCENES MAGIC:** Function wrapping is simply a matter of creating an anonymous function that re-runs the same eval statement, only with "(...arguments...)" appended to the end. This means that if your functions move around, are subject to change, or whatever, then you may get some surprises when function wrapping doesn't work as expected. I think I have a future workaround for this.

#### Lua.exec("x = 5")

Evaluates a block of Lua code. If it encounters a return statement, that value will be returned. This is the function you want to use to manipulate an interpreter's global state, define functions, etc.

**BEHIND THE SCENES MAGIC:** Both exec and eval use a part of the Lua API for turning a string into the contents of a function, and then running that function. Internally, there is no difference between Lua.eval("x") and Lua.exec("return x"). Literally, all eval does is prepend "return " to the command before calling this.exec().

## Current progress

Basic features work. It's the special stuff that's flimsy, specifically in JS-to-Lua conversion. Example.html is still totally blank, as I've been working in web developer consoles, but ought to provide a more visual demo of the library's features.

While the output is (of course) cross-platform, building weblua.js is currently only supported on Linux, but may work by accident/with a little tuning on other platforms. Likewise, due to API differences between Lua 5.1 and 5.2, currently API.js is only engineered to work with 5.2, and will need tweaking to work with 5.1, for anyone looking for that.

## Aren't other people already working on this, a la JSREPL?

The ultimate goal is to have a high-level interface to the Lua interpreter that requires no special skill or knowledge to use (aside from JS and Lua), and supports exporting/wrapping functions from one side to the other. It will in no way require modifications to the source of Lua.

JSREPL has been a great reference implementation, but it's poorly documented and contains a lot of stuff we don't care about. JSREPL Lua is a mediocre-quality port with out-of-date build ingredients that are hard to reproduce, nested among a large codebase of unrelated interpreters - and that's all it'll ever need to be. I don't mean to dog on those people, because they did a fantastic job figuring out the hard stuff for the rest of us, and this project would probably be impossible without their open source contributions.

Weblua aims a bit higher, and with a narrower scope. It ought to be trivial to include a Lua interpreter in your page, that can call JS functions and vice versa without difficulty or complication. Introspection should be simple, sane and clear. The code should also be optimized, so that it can compete with projects like lua\_parser.js in terms of speed, while still retaining the massive advantage of being a complete and verbatim implementation of the official Lua interpreter.
