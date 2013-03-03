
DOWNLOAD_URL=http://www.lua.org/ftp/lua-5.2.1.tar.gz
DOWNLOAD_PROGRAM=wget
DOWNLOADED_LOCATION=lua-5.2.1.tar.gz
UNPACK_COMMAND=tar -xf
LUA_ROOT=lua-5.2.1

COMPILED_LIB=liblua.so.ll
COMPILED_LIB_LOCATION=$(LUA_ROOT)/src/$(COMPILED_LIB)

all: weblua.js

weblua.js : liblua.js
	cp liblua.js weblua.js # TODO: entry hooks and optimization

liblua.js : $(COMPILED_LIB_LOCATION)
	emcc -o liblua.js $(COMPILED_LIB_LOCATION) -s LINKABLE=1

$(COMPILED_LIB_LOCATION) : $(LUA_ROOT)
	emmake make linux -C $(LUA_ROOT)/src

$(LUA_ROOT) : $(DOWNLOADED_LOCATION)
	$(UNPACK_COMMAND) $(DOWNLOADED_LOCATION)
	cp lua_makefile_override $(LUA_ROOT)/src/Makefile

$(DOWNLOADED_LOCATION):
	$(DOWNLOAD_PROGRAM) $(DOWNLOAD_URL)
