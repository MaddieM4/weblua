
DOWNLOAD_URL=http://www.lua.org/ftp/lua-5.2.1.tar.gz
DOWNLOAD_PROGRAM=wget
DOWNLOADED_LOCATION=src/lua-5.2.1.tar.gz
UNPACK_COMMAND=tar -C src -xf
LUA_ROOT=src/lua-5.2.1

COMPILED_LIB=liblua.so.ll
COMPILED_LIB_LOCATION=$(LUA_ROOT)/src/$(COMPILED_LIB)

all: build/weblua.js

build/weblua.js : build/liblua.js
	cp build/liblua.js build/weblua.js # TODO: entry hooks and optimization

build/liblua.js : $(COMPILED_LIB_LOCATION)
	mkdir -p build
	emcc -o build/liblua.js $(COMPILED_LIB_LOCATION) -s LINKABLE=1

$(COMPILED_LIB_LOCATION) : $(LUA_ROOT)
	emmake make linux -C $(LUA_ROOT)/src

$(LUA_ROOT) : $(DOWNLOADED_LOCATION)
	$(UNPACK_COMMAND) $(DOWNLOADED_LOCATION)
	cp lua_makefile_override $(LUA_ROOT)/src/Makefile

$(DOWNLOADED_LOCATION):
	mkdir -p src
	$(DOWNLOAD_PROGRAM) $(DOWNLOAD_URL) -O $(DOWNLOADED_LOCATION)
