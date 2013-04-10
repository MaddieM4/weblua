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
    initialize: function (source_name, stdout, stderr) {
        if (this.isInitialized) throw new Error('Lua already initialized');
        this.default_source_name = source_name || this.default_source_name;
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
    parse: function (command, source_name) {
        // Put new function, from buffer, at the top of the stack
        this.require_initialization();
        var commandPtr = this.allocate_string(command);
        var parseFailed = _luaL_loadbufferx(
            this.state, commandPtr, command.length, source_name
        );
        if (parseFailed) {
            this.report_error("Parsing failure");
        }
        _free(commandPtr);
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
            var callFailed = _lua_pcallk(this.state, 0, 1, 0);
            if (callFailed) {
                this.report_error("Evaluation failure");
            } else {
                return _lua_gettop(this.state) > 0 ? this.popStack(source) : null;
            }
        } else {
            this.report_error("Parsing failure");
        }
    },
    inject: function (object, name, final_location) {
        name = name || this.get_tmp_name();
        this.pushStack(object);
        _lua_setglobal(this.state, this.allocate_string(name));
        if (final_location) {
            this.exec(final_location + " = " + name + "\n" + name + " = nil");
        }
        return (final_location || name);
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
        var inspection = this.inspect(index);
        var type = inspection.type;
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
                _lua_pushnil(this.state);
                ret = {};
                // Populate with values
                _lua_pushnil(this.state);
                while (_lua_next(this.state, index-2)) {
                    var value = this.popStack();
                    var key = this.peekStack(-1);
                    ret[key] = value;
                }
                this.popStack(); // Clear out leftover key
                break;
            case 6:  // LUA_TFUNCTION
                var self = this;
                var name = this.get_tmp_name();
                var aname = this.allocate_string(name);
                var address = _lua_topointer(this.state, index);
                _lua_pushvalue(this.state, index); // For non-destructive pop
                _lua_setglobal(this.state, aname);
                ret = function () {
                    var orig_top = _lua_gettop(self.state);
                    // Push function to stack
                    _lua_getglobal(self.state, aname);
                    // Convert arguments to Lua
                    for (var i = 0; i < arguments.length; i++) {
                        self.pushStack(arguments[i])
                    }
                    // Call
                    var failure = _lua_pcallk(self.state, arguments.length, -1, 0) // LUA_MULTRET
                    if (failure) {
                        this.report_error("Failure calling Lua function");
                    }
                    var num_args = _lua_gettop(self.state) - orig_top ;
                    var results = self.get_stack_args(num_args);
                    switch (results.length) {
                        case 0:
                            return null;
                        case 1:
                            return results[0];
                        default:
                            return results;
                    }
                }
                source = source || "";
                ret.toString = function() { 
                    return "Lua function " + source + ": " + name + " at " + address;
                };
                break;
            default: // Other Lua type
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
        if (object && object.type === "MultiReturn") {
            for (var i = 0; i < object.args.length; i++) {
                this.pushStack(objects.args[i]);
            }
            return object.args.length;
        }
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
                _lua_pushstring(this.state, this.allocate_string(object));
                return 1;
            case "function" :
                var self = this;
                var wrapper = function (state) {
                    var result = object.apply(self, self.get_stack_args());
                    return self.pushStack(result);
                }
                var pointer = Runtime.addFunction(wrapper);
                _lua_pushcclosure(this.state, pointer, 0);
                return 1;
            case "object" :
                if (object.length === undefined) {
                    _lua_createtable(this.state, object.length, 0);
                    for (var k in object) {
                        this.pushStack(object[k]);
                        _lua_setfield(this.state, -2, this.allocate_string(k));
                    }
                } else {
                    _lua_createtable(this.state, 0, 0);
                    for (var k in object) {
                        k = 1*k;
                        this.pushStack(k)
                        this.pushStack(object[k]);
                        _lua_settable(this.state, -3);
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
