LUA_VERSION=5.2.1
WEBLUA_VERSION=0.0.1

DOWNLOAD_PROGRAM=wget
LUA_SRC_URL=http://www.lua.org/ftp/lua-$(LUA_VERSION).tar.gz
LUA_SRC_LOCATION=src/lua-$(LUA_VERSION).tar.gz
LUA_ROOT=src/lua-$(LUA_VERSION)

CLOSURE_SRC_URL=http://closure-compiler.googlecode.com/files/compiler-latest.zip
CLOSURE_SRC_LOCATION=src/closure.zip
CLOSURE_UNPACK_LOCATION=src/closure
CLOSURE_COMMAND=java -jar $(CLOSURE_UNPACK_LOCATION)/compiler.jar

COMPILED_LIB=liblua.so.ll
COMPILED_LIB_LOCATION=$(LUA_ROOT)/src/$(COMPILED_LIB)

WEBLUA_LOCATION=build/weblua-$(WEBLUA_VERSION).js

all: build/weblua.js

clean:
	rm -r $(LUA_ROOT) build

build/weblua.js : $(WEBLUA_LOCATION)
	# Remove old symlink if it exists
	rm -f build/weblua.js
	ln -s `pwd`/$(WEBLUA_LOCATION) build/weblua.js

$(WEBLUA_LOCATION) : build/liblua.js $(CLOSURE_UNPACK_LOCATION)
	$(CLOSURE_COMMAND) \
		--js build/liblua.js \
		--js_output_file $(WEBLUA_LOCATION) \
		--language_in ECMASCRIPT5 \
		--compilation_level ADVANCED_OPTIMIZATIONS

build/liblua.js : $(COMPILED_LIB_LOCATION) src/API.js
	mkdir -p build
	emcc -o build/liblua.js $(COMPILED_LIB_LOCATION) -s INVOKE_RUN=0 \
		-s SAFE_HEAP=0 \
		-s INIT_STACK=1 \
		-s OPTIMIZE=1 \
		-s ASSERTIONS=0 \
		-s CORRECT_SIGNS=1 \
		-s CORRECT_OVERFLOWS=1 \
		-s EXCEPTION_DEBUG=1 \
		-s LABEL_DEBUG=1 \
		-s CORRUPTION_CHECk=1 \
   		-s EMCC_DEBUG=1 \
   		-s LINKABLE=1 \
		#-s EXPORTED_FUNCTIONS='["_lua_settop","_lua_newstate","_lua_openlibs","_malloc"]'
	cat src/API.js >> build/liblua.js

$(COMPILED_LIB_LOCATION) : $(LUA_ROOT)
	emmake make linux -C $(LUA_ROOT)/src

$(LUA_ROOT) : $(LUA_SRC_LOCATION)
	tar -C src -xf $(LUA_SRC_LOCATION)
	cp lua_makefile_override $(LUA_ROOT)/src/Makefile

$(LUA_SRC_LOCATION):
	$(DOWNLOAD_PROGRAM) $(LUA_SRC_URL) -O $(LUA_SRC_LOCATION)

$(CLOSURE_UNPACK_LOCATION): $(CLOSURE_SRC_LOCATION)
	unzip $(CLOSURE_SRC_LOCATION) -d $(CLOSURE_UNPACK_LOCATION)

$(CLOSURE_SRC_LOCATION):
	$(DOWNLOAD_PROGRAM) $(CLOSURE_SRC_URL) -O $(CLOSURE_SRC_LOCATION)
