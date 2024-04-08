#!/bin/bash

# This script has been specially modified to exclude the branch, in order to maintain backwards compatibility
# feederbox826//2024-04-06

# Set the output directory to the root directory if not specified
outdir="$1"
if [ -z "$outdir" ]; then
    outdir="./"
fi

echo "Output directory: $outdir"

# Skip removal if the output directory is the current directory
if [ "$outdir" != "./" ]; then
    rm -rf "$outdir"
fi

mkdir -p "$outdir"

buildPlugin() 
{
    f=$1

    if grep -q "^#pkgignore" "$f"; then
        return
    fi
    
    # Get the scraper id from the directory
    dir=$(dirname "$f")
    plugin_id=$(basename "$f" .yml)

    echo "Processing $plugin_id"

    # Create a directory for the version
    version=$(git log -n 1 --pretty=format:%h -- "$dir"/*)
    updated=$(TZ=UTC0 git log -n 1 --date="format-local:%F %T" --pretty=format:%ad -- "$dir"/*)
    
    # Create the zip file
    # Copy other files
    zipfile="$outdir/$plugin_id.zip"
    
    echo "Creating zipfile: $zipfile"

    pushd "$dir" > /dev/null
    zip -r "$zipfile" . > /dev/null
    popd > /dev/null

    # Set metadata
    name=$(grep "^name:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    description=$(grep "^description:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    ymlVersion=$(grep "^version:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    version="$ymlVersion-$version"

    # Write to the index.yml file in the root directory
    index_file="$outdir/index.yml"
    echo "- id: $plugin_id
  name: $name
  metadata:
    description: $description
  version: $version
  date: $updated
  path: $plugin_id.zip
  sha256: $(sha256sum "$zipfile" | cut -d' ' -f1)" >> "$index_file"

    echo "Added entry to $index_file"

    # Handle dependencies
    if [ ! -z "$dep" ]; then
        echo "  requires:" >> "$index_file"
        for d in ${dep//,/ }; do
            echo "    - $d" >> "$index_file"
        done
    fi

    echo "" >> "$index_file"
    echo "Finished processing $plugin_id"
}

# Iterate over plugin files and build
find ./plugins -mindepth 1 -name *.yml | while read file; do
    buildPlugin "$file"
done

# Iterate over theme files and build
find ./themes -mindepth 1 -name *.yml | while read file; do
    buildPlugin "$file"
done

echo "Script execution completed"
