LUA_VERSION=5.2.1
WEBLUA_VERSION=0.1.5

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

WEBLUA_NAME=weblua-$(WEBLUA_VERSION).js
WEBLUA_LOCATION=build/$(WEBLUA_NAME)

REQUIRED_FUNCTIONS=$(shell grep -oP '_lua[a-zA-Z_0-9]+' src/API.js | uniq)
REQUIRED_FUNCTION_STRING="[$(foreach func,$(REQUIRED_FUNCTIONS),\"$(func)\",)]"

# ------------------------------------------------------------------------------
# Emscripten options

EM_DEBUG=0
EM_EXCEPTION_DEBUG=$(EM_DEBUG)
EM_LABEL_DEBUG=$(EM_DEBUG)
EM_ASSERTIONS=$(EM_DEBUG)

EM_STACK_MB=10
EM_STACK_SIZE=$(shell echo $(EM_STACK_MB)\*1024\*1024 | bc)
EM_ALLOW_MEMORY_GROWTH=1

EM_ASM_JS=0

# ------------------------------------------------------------------------------

all: build/weblua.js

clean:
	rm -r $(LUA_ROOT) build

diagnose:
	echo REQUIRED_FUNCTION_STRING=$(REQUIRED_FUNCTION_STRING)
	echo EM_STACK_SIZE=$(EM_STACK_SIZE)

build/weblua.js : $(WEBLUA_LOCATION)
	# Remove old symlink if it exists
	rm -f build/weblua.js
	ln -s $(WEBLUA_NAME) build/weblua.js

$(WEBLUA_LOCATION) : build/liblua.js $(CLOSURE_UNPACK_LOCATION)
	$(CLOSURE_COMMAND) \
		--js build/liblua.js \
		--js_output_file $(WEBLUA_LOCATION) \
		--language_in ECMASCRIPT5 \
		--compilation_level ADVANCED_OPTIMIZATIONS

build/raw.js : $(COMPILED_LIB_LOCATION) src/API.js Makefile
	mkdir -p build
	emcc -o build/raw.js $(COMPILED_LIB_LOCATION) -s INVOKE_RUN=0 \
		-s CLOSURE_ANNOTATIONS=1 \
		-s OPTIMIZE=1 \
		-s ASSERTIONS=$(EM_ASSERTIONS) \
		-s CORRECT_SIGNS=1 \
		-s CORRECT_OVERFLOWS=1 \
		-s WARN_ON_UNDEFINED_SYMBOLS=1 \
		-s EXPORTED_FUNCTIONS=$(REQUIRED_FUNCTION_STRING) \
		-s ALLOW_MEMORY_GROWTH=$(EM_ALLOW_MEMORY_GROWTH) \
		-s EXCEPTION_DEBUG=$(EM_EXCEPTION_DEBUG) \
		-s LABEL_DEBUG=$(EM_LABEL_DEBUG) \
		-s TOTAL_STACK=$(EM_STACK_SIZE) \
		-s ASM_JS=$(EM_ASM_JS)

build/liblua.js : build/raw.js src/API.js
	cat build/raw.js src/API.js > build/liblua.js

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
