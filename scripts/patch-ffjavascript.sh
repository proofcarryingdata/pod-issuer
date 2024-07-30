#!/bin/sh

main_js_file=node_modules/.deno/ffjavascript*/node_modules/ffjavascript/build/main.cjs
threadman_file=node_modules/.deno/ffjavascript*/node_modules/ffjavascript/src/threadman.js


# Comment out Worker-related definitions
sed -i 's/^\(var Worker.*\)/\/\/\ \1/' $main_js_file
sed -i 's/^import Worker.*//' $threadman_file

# Replace Worker calls
sed -i 's/\(.*new Worker\).*[(]\(.*\)[)].*/\1(\2, { type: "module" });/' $main_js_file
sed -i 's/\(.*new Worker\).*[(]\(.*\)[)].*/\1(\2, { type: "module" });/g' $threadman_file
