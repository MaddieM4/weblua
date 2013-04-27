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
    tmp_id: 0,
    default_source_name: 'stdin',
    preallocated_strings: {
        '__handle': null,
        '__index': null,
    },
    initialize: function (source_name, stdout, stderr) {
        if (this.isInitialized) throw new Error('Lua already initialized');
        this.default_source_name = source_name || this.default_source_name;
        this.stdout = stdout || this.stdout;
        this.stderr = stderr || this.stderr;
        run();
        this.state = _luaL_newstate();
        _luaL_openlibs(this.state);
        for (var key in this.preallocated_strings) {
            this.preallocated_strings[key] = this.allocate_string(key);
        }
        this.isInitialized = true;
    },
    require_initialization: function(){
        if (!this.isInitialized) throw new Error('Lua not yet initialized');
    },
    parse: function (command, source_name) {
        // Put new function, from buffer, at the top of the stack
        this.require_initialization();
        var commandPtr = this.allocate_string(command);
        var namePtr    = this.allocate_string(source_name);
        var parseFailed = _luaL_loadbufferx(
            this.state, commandPtr, command.length, namePtr
        );
        if (parseFailed) {
            this.report_error("Parsing failure");
        }
        _free(commandPtr);
        _free(namePtr);
        return !parseFailed;
    },
    eval: function (command, source_name, source) {
        source_name = source_name || this.default_source_name;
        source      = source      || command;
        return this.exec("return "+command, source_name, source);
    },
    exec: function (command, source_name, source) {
        this.require_initialization();
        source_name = source_name || this.default_source_name;
        source      = source      || command;

        if (this.parse(command, source_name)) {
            // Parse success, now try calling func at top of stack
            var callFailed = _lua_pcallk(this.state, 0, -1, 0);
            if (callFailed) {
                this.report_error("Evaluation failure");
            } else {
                return this.get_stack_args();
            }
        } else {
            this.report_error("Parsing failure");
        }
    },
    inject: function (object, name, final_location, metatable) {
        name = name || this.get_tmp_name();
        this.pushStack(object);
        if (metatable) {
            this.pushStack(metatable);
            _lua_setmetatable(this.state, -2);
        }
        var strptr = this.allocate_string(name);
        _lua_setglobal(this.state, strptr);
        _free(strptr);
        if (final_location) {
            this.exec(final_location + " = " + name + "\n" + name + " = nil");
        }
        return (final_location || name);
    },
    cache: function (evalstring) {
        if (!(evalstring in this.cache['items'])) {
            this.cache['items'][evalstring] = this.eval(evalstring)
        }
        return this.cache['items'][evalstring];
    },
    call: function (evalstring, args) {
        var func = this.cache(evalstring)[0];
        return func.apply(null, args);
    },
    allocate_string: function(str) {
        var arr = intArrayFromString(str);
        return allocate(arr, 'i8', 0);  // ALLOC_NORMAL
    },
    inspect: function(index) {
        var type = _lua_type(this.state, index);
        var ptr = _lua_typename(this.state, type);
        var typename = Pointer_stringify(ptr)
        var address = _lua_topointer(this.state, index);
        return {
            'type': type,
            'typename': typename,
            'address': address,
            'addrstr': address.toString(16),
        }
    },
    peekStack: function(index, source) {
        this.require_initialization();
        var ret;
        var type = _lua_type(this.state, index);
        switch (type) {
            case -1: // LUA_TNONE
            case 0:  // LUA_TNIL
                ret = null;
                break;
            case 1:  // LUA_TBOOLEAN
                var result = _lua_toboolean(this.state, index);
                ret = result ? true : false;
                break;
            case 3:  // LUA_TNUMBER
                ret = _lua_tonumberx(this.state, index);
                break;
            case 4:  // LUA_TSTRING
                var ptr = _lua_tolstring(this.state, index, 0);
                var len = _lua_rawlen(this.state, index);
                var buffer = [];
                for (var i = 0; i < len; i++)
                    buffer.push(String.fromCharCode(HEAP8[ptr+i]));
                ret = buffer.join('');
                break;
            case 5:  // LUA_TTABLE
                var is_array = true;
                var max_key = 0;

                // Check for handle
                _lua_pushstring(this.state, this.preallocated_strings['__handle']);
                _lua_rawget(this.state, index-1);
                var handle = this.popStack();
                if (handle) {
                    // Return original value
                    var ptr = this.preallocated_strings["__index"];
                    var success = _luaL_getmetafield(
                        this.state,
                        index,
                        ptr
                    );
                    var __indexfunc = this.popStack();
                    var source = __indexfunc.source;
                    return source;
                }

                ret = {};
                // Populate with values
                _lua_pushnil(this.state);
                _lua_pushnil(this.state);
                while (_lua_next(this.state, index-2)) {
                    var value = this.popStack();
                    var key = this.peekStack(-1);
                    ret[key] = value;

                    if (is_array && typeof key === "number") {
                        if (key > max_key)
                            max_key = key;
                    } else {
                        is_array = false;
                    }
                }
                this.popStack(); // Clear out leftover key
                if (is_array) {
                    newret = [];
                    for (var i = 1; i <= max_key; i++) {
                        if (ret[i] === undefined) {
                            // Abort
                            is_array = false;
                            break;
                        }
                        newret.push(ret[i]);
                    }
                    if (is_array) // not aborted
                        ret = newret;
                }
                break;
            case 6:  // LUA_TFUNCTION
                var self = this;
                var address = _lua_topointer(this.state, index);

                if (_lua_iscfunction(this.state, index)) {
                    var func = FUNCTION_TABLE[address];
                    if (func.unwrapped) {
                        return func.unwrapped;
                    }
                }

                // Don't allocate this stuff for wrapped funcs
                var name = this.get_tmp_name();
                var aname = this.allocate_string(name);

                _lua_pushvalue(this.state, index); // For non-destructive pop
                _lua_setglobal(this.state, aname);
                _free(aname);
                ret = function () {
                    var orig_top = _lua_gettop(self.state);

                    // Push function to stack
                    var aname = self.allocate_string(name);
                    _lua_getglobal(self.state, aname);
                    _free(aname);

                    // Convert arguments to Lua
                    for (var i = 0; i < arguments.length; i++) {
                        self.pushStack(arguments[i])
                    }

                    // Call
                    var failure = _lua_pcallk(self.state, arguments.length, -1, 0) // LUA_MULTRET
                    if (failure) {
                        self.report_error("Failure calling Lua function");
                    }
                    var num_args = _lua_gettop(self.state) - orig_top ;
                    return self.get_stack_args(num_args);
                }
                source = source || "";
                ret.toString = function() { 
                    return "Lua function " + source + ": " + name + " at " + address;
                };
                ret.source = source;
                ret.name = name;
                ret.address = address;
                break;
            default: // Other Lua type
                var inspection = this.inspect(index);
                ret = inspection.typename + " (typecode "+type+"): 0x" + inspection.addrstr;
        }
        return ret;
    },
    popStack: function(source) {
        var ret = this.peekStack(-1, source);
        _lua_settop(this.state, -2);
        return ret;
    },
    pushStack: function(object) {
        if (object === null) {
            object = undefined;
        }
        switch(typeof object) {
            case "undefined" :
                _lua_pushnil(this.state);
                return 1;
            case "boolean" :
                _lua_pushboolean(this.state, object);
                return 1;
            case "number" :
                _lua_pushnumber(this.state, object);
                return 1;
            case "string" :
                var strptr = this.allocate_string(object);
                _lua_pushstring(this.state, strptr);
                _free(strptr);
                return 1;
            case "function" :
                var self = this;
                var wrapper = function (state) {
                    var result = object.apply(self, self.get_stack_args());
                    if (result == undefined || result == null) {
                        result = [];
                    }
                    if (!( typeof result == 'object' && typeof result.length == "number")) {
                        throw new Error("Expected array return type from JS function");
                    }
                    for (var i = 0; i < result.length; i++) {
                        self.pushStack(result[i]);
                    }
                    return result.length;
                }
                wrapper.unwrapped = object;
                var pointer = Runtime.addFunction(wrapper);
                _lua_pushcclosure(this.state, pointer, 0);
                return 1;
            case "object" :
                if (object.length === undefined) {
                    // Object
                    _lua_createtable(this.state, 0, 0);
                    if (object['__handle']) {
                        // Handled object
                        var source = object;
                        var metatable = {
                            '__index': function (table, key) {
                                return [source[key]];
                            },
                            '__newindex': function (table, key, value) {
                                source[key] = value;
                                return [];
                            },
                        }
                        metatable['__index'].source = source;

                        this.pushStack(metatable);
                        _lua_setmetatable(this.state, -2);

                        object = {'__handle': object.toString()};
                    }
                    for (var k in object) {
                        this.pushStack(k);
                        this.pushStack(object[k]);
                        _lua_rawset(this.state, -3);
                    }
                } else {
                    // Array
                    _lua_createtable(this.state, object.length, 0);
                    for (var k in object) {
                        k = 1*k;
                        this.pushStack(k+1)
                        this.pushStack(object[k]);
                        _lua_rawset(this.state, -3);
                    }
                }
                return 1;
            default:
                throw new Error("Cannot push object to stack: " + object);
        }
    },
    get_stack_args: function(num_args) {
        num_args = (num_args === undefined) ? _lua_gettop(this.state) : num_args;
        var args = [];
        for (var i = 0; i < num_args; i++) {
            args.push(this.popStack());
        }
        return args.reverse();
    },
    anon_lua_object: function (object) {
        // Create anonymous Lua object or literal from JS object
        if (object == undefined || object == null) {
            return "nil";
        }
        switch (typeof object) {
            case "string":
                return '"' + object.replace('"','\\"') + '"';
            case "function":
            case "object":
                return this.inject(object);
            default:
                return object.toString();
        }
    },
    get_tmp_name: function() {
        return "_weblua_tmp_" + this.tmp_id++;
    },
    cleanup_tmp: function(name) {
        if (name == "_weblua_tmp_" + (this.tmp_id-1)) {
            // Latest tmp_id, can safely decrement
            tmp_id--;
        }
        // Set global to nil
        _lua_pushnil(this.state);
        var strptr = this.allocate_string(name);
        _lua_setglobal(this.state, strptr);
        _free(strptr);
    },
    stdout: function (str) {console.log("stdout: " +str)},
    stderr: function (str) {console.log("stderr: " +str)},
    report_error: function(defaultMessage) {
        if (this.isInitialized) {
            var errorMessage = this.popStack();
            if (!(errorMessage && errorMessage.length)) errorMessage = defaultMessage;
            this.stderr(errorMessage);
        } else {
            this.stderr(defaultMessage);
        }
        _lua_settop(this.state, 0);
    }
}
// Public functions
this['Lua']['initialize'] = this['Lua'].initialize;
this['Lua']['stdout'] = this['Lua'].stdout;
this['Lua']['stderr'] = this['Lua'].stderr;
this['Lua']['eval'] = this['Lua'].eval;
this['Lua']['exec'] = this['Lua'].exec;
this['Lua']['anon_lua_object'] = this['Lua'].anon_lua_object;
this['Lua']['inject'] = this['Lua'].inject;
this['Lua']['cache'] = this['Lua'].cache;

Lua.cache['items'] = {};
Lua.cache['clear'] = function (evalstring) { delete Lua.cache['items'][evalstring] }
