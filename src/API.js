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
    default_source_name: 'stdin',
    initialize: function (stdout, stderr) {
        if (this.isInitialized) throw new Error('Lua already initialized');
        this.stdout = stdout || this.stdout;
        this.stderr = stderr || this.stderr;
        run();
        this.state = _luaL_newstate();
        _luaL_openlibs(this.state);
        this.isInitialized = true;
    },
    require_initialization: function(){
        if (!this.isInitialized) throw new Error('Lua not yet initialized');
    },
    eval: function (command, source_name) {
        this.require_initialization();
        source_name = source_name || this.default_source_name;

        // Prepare the command, as an expression
        command = 'return ' + command;
        var commandPtr = this.allocate_string(command);
        var ret = null;

        // Try to parse command
        var parseFailed = _luaL_loadbufferx(
            this.state, commandPtr, command.length, source_name
        );
        if (parseFailed) {
            this.report_error("Parsing failure");
        } else {
            var callFailed = _lua_pcallk(this.state, 0, 1, 0);
            if (callFailed) {
                this.report_error("Evaluation failure");
            } else {
                ret = _lua_gettop(this.state) > 0 ? this.popStack() : null;
            }
        }

        _free(commandPtr);
        return ret;
    },
    exec: function (command) {
        throw "Not implemented yet: Lua.exec";
    },
    lua_to_js: function (name, object) {
        throw "Not implemented yet: Lua.lua_to_js";
    },
    js_to_lua: function (command) {
        throw "Not implemented yet: Lua.js_to_lua";
    },
    allocate_string: function(str) {
        var arr = intArrayFromString(str);
        return allocate(arr, 'i8', 0);  // ALLOC_NORMAL
    },
    popStack: function() {
        this.require_initialization();
        var ret;
        var type = _lua_type(this.state, -1);
        switch (type) {
            case -1: // LUA_TNONE
            case 0:  // LUA_TNIL
                ret = null;
                break;
            case 1:  // LUA_TBOOLEAN
                var result = _lua_toboolean(this.state, -1);
                ret = result ? true : false;
                break;
            case 3:  // LUA_TNUMBER
                ret = _lua_tonumberx(this.state, -1);
                break;
            case 4:  // LUA_TSTRING
                var ptr = _lua_tolstring(this.state, -1, 0);
                var len = _lua_rawlen(this.state, -1);
                var buffer = [];
                for (var i = 0; i < len; i++)
                    buffer.push(String.fromCharCode(HEAP8[ptr+i]));
                ret = buffer.join('');
                break;
            default: // Other Lua type
                var ptr = _lua_typename(this.state, type);
                var typename = Pointer_stringify(ptr)
                var address = _lua_topointer(this.state, -1);
                ret = typename + " (typecode "+type+"): 0x" + address.toString(16);
        }
        _lua_settop(this.state, -2);
        return ret;
    },
    stdout: function (str) {console.log("stdout: " +str)},
    stderr: function (str) {console.log("stderr: " +str)},
    report_error: function(defaultMessage) {
        if (this.isInitialized) {
            var errorMessage = this.popStack();
            if (!errorMessage.length) errorMessage = defaultMessage;
            this.stderr(errorMessage);
        } else {
            this.stderr(defaultMessage);
        }
        _lua_settop(this.state, 0);
    }
}
