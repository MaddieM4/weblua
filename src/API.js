// This file is appended to the end of build/liblua.js

// WEBLUA API =================================================================
// 
// Written by Philip Horger
// Based on https://github.com/replit/jsrepl/blob/master/extern/lua/entry_point.js
// 
// ============================================================================

this['Lua'] = {
    isInitialized: false,
    state: null,
    initialize: function (command) {
        throw "Not implemented yet: Lua.initialize";
    },
    eval: function (command) {
        throw "Not implemented yet: Lua.eval";
    },
    lua_to_js: function (name, object) {
        throw "Not implemented yet: Lua.lua_to_js";
    },
    js_to_lua: function (command) {
        throw "Not implemented yet: Lua.js_to_lua";
    },
}
