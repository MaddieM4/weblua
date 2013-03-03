# weblua

A project for the consistent, reproducible, and simple compilation of the Lua interpreter for the web. It uses Emscripten and produces an interpreter of version 5.2.1.

## Generating JS files

You need a working Emscripten setup, with the Emscripten binaries in the PATH of the shell you're using to compile the JS files.

The whole project is created from scratch via a single command, `make`, which will download, decompress, and compile the latest version of the Lua interpreter, transcode that to liblua.js, and add convenience hooks/compression/optimization for the final product, weblua.js.

## Using weblua.js

You don't have to install or set up Emscripten to use weblua.js, unless you want to actually make changes to weblua.js. The binaries are available precompiled for you in this repository. You can get straight to including it in your projects.

To test out the demo and make sure things work, run `python -m SimpleHTTPServer 8770` in the root of this git repository, and go to `localhost:8770` in your browser.

### Todo: API reference

## Current progress

This is still very much prealpha quality stuff. I'm still learning my way around Emscripten and exposing library functions.

Compression of any kind, including optimization, is currently disabled for debugging purposes, and ultimately will be a separate nondestructive step. This means that at any time there's a liblua.js you can manually inspect, and a weblua.js that you can actually import and use in your projects.

While the output is (of course) cross-platform, building weblua.js is currently only supported on Linux, but may work by accident/with a little tuning on other platforms.

## Aren't other people already working on this, a la JSREPL?

The ultimate goal is to have a high-level interface to the Lua interpreter that requires no special skill or knowledge to use (aside from JS and Lua), and supports exporting/wrapping functions from one side to the other. It will in no way require modifications to the source of Lua.

JSREPL has been a great reference implementation, but it's poorly documented and contains a lot of stuff we don't care about. JSREPL Lua is a mediocre-quality port with out-of-date build ingredients that are hard to reproduce, nested among a large codebase of unrelated interpreters - and that's all it'll ever need to be. I don't mean to dog on those people, because they did a fantastic job figuring out the hard stuff for the rest of us, and this project would probably be impossible without their open source contributions.

Weblua aims a bit higher, and with a narrower scope. It ought to be trivial to include a Lua interpreter in your page, that can call JS functions and vice versa without difficulty or complication. Introspection should be simple, sane and clear. The code should also be optimized, so that it can compete with projects like lua\_parser.js in terms of speed, while still retaining the massive advantage of being a complete and verbatim implementation of the official Lua interpreter.
