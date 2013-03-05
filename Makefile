LUA_VERSION=5.2.1
WEBLUA_VERSION=0.0.1

DOWNLOAD_URL=http://www.lua.org/ftp/lua-$(LUA_VERSION).tar.gz
DOWNLOAD_PROGRAM=wget
DOWNLOADED_LOCATION=src/lua-$(LUA_VERSION).tar.gz
UNPACK_COMMAND=tar -C src -xf
LUA_ROOT=src/lua-$(LUA_VERSION)

COMPILED_LIB=liblua.so.ll
COMPILED_LIB_LOCATION=$(LUA_ROOT)/src/$(COMPILED_LIB)

WEBLUA_LOCATION=build/weblua-$(WEBLUA_VERSION).js

all: build/weblua.js

clean:
	rm -r $(LUA_ROOT) build

build/weblua.js : $(WEBLUA_LOCATION)
	# Remove old symlink if it exists
	rm -f build/weblua.js
	ln -s $(WEBLUA_LOCATION) build/weblua.js

$(WEBLUA_LOCATION) : build/liblua.js
	cp build/liblua.js $(WEBLUA_LOCATION) # TODO: entry hooks and optimization

build/liblua.js : $(COMPILED_LIB_LOCATION)
	mkdir -p build
	emcc -o build/liblua.js $(COMPILED_LIB_LOCATION) -s INVOKE_RUN=0 \
		-s SAFE_HEAP=0 \
		-s INIT_STACK=1 \
		-s OPTIMIZE=1 \
		-s ASSERTIONS=0 \
		-s CORRECT_SIGNS=1 \
		-s CORRECT_OVERFLOWS=1 \
		-s EXPORTED_FUNCTIONS='["_lua_settop"]' \
	cat src/API.js >> build/liblua.js

$(COMPILED_LIB_LOCATION) : $(LUA_ROOT)
	emmake make linux -C $(LUA_ROOT)/src

$(LUA_ROOT) : $(DOWNLOADED_LOCATION)
	$(UNPACK_COMMAND) $(DOWNLOADED_LOCATION)
	cp lua_makefile_override $(LUA_ROOT)/src/Makefile
	# Export symbols with C extern
	#sed -i 's/define LUA_API.*extern/define LUA_API\t\textern "C"/' src/lua-5.2.1/src/luaconf.h

$(DOWNLOADED_LOCATION):
	$(DOWNLOAD_PROGRAM) $(DOWNLOAD_URL) -O $(DOWNLOADED_LOCATION)
