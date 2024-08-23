build: cache patch

cache:
	@echo "Caching dependencies..."
	@deno cache --reload src/index.ts

patch:
	@echo "Patching dependencies..."
	@./scripts/patch-gpcircuits.sh
	@./scripts/patch-fastfile.sh
	@./scripts/patch-ffjavascript.sh

clean:
	rm -rf node_modules vendor
