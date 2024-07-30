#!/bin/sh

for f in $(find -L node_modules -name '*.js' -type f)
do
    # Replace exports
    sed -i '/^export.*\.js/b; s/\(^export\ .*"\)\([^@].*\/.*\)\(".*$\)/\1\2.js\3/' $f
    # Replace imports
    sed -i '/^import.*\.js/b; s/\(^import\ .*"\)\([^@].*\/.*\)\(".*$\)/\1\2.js\3/' $f
done
