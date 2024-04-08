#!/bin/bash

# This script has been specially modified to exclude the branch, in order to maintain backwards compatibility
# feederbox826//2024-04-06

# builds a repository of scrapers
# outputs to _site with the following structure:
# index.yml
# <scraper_id>.zip
# Each zip file contains the scraper.yml file and any other files in the same directory

outdir="$1"
if [ -z "$outdir" ]; then
    outdir="."
fi

echo "Output directory: $outdir"

# Skip removal if the output directory is the current directory
if [ "$outdir" != "main" ]; then
    rm -rf "$outdir"
fi

mkdir -p "$outdir"

buildPlugin() 
{
    f=$1

    if grep -q "^#pkgignore" "$f"; then
        return
    fi
    
    # get the scraper id from the directory
    dir=$(dirname "$f")
    plugin_id=$(basename "$f" .yml)

    echo "Processing $plugin_id"

    # create a directory for the version
    version=$(git log -n 1 --pretty=format:%h -- "$dir"/*)
    updated=$(TZ=UTC0 git log -n 1 --date="format-local:%F %T" --pretty=format:%ad -- "$dir"/*)
    
    # create the zip file
    # copy other files
    zipfile="$outdir/$plugin_id.zip"
    
    echo "Creating zipfile: $zipfile"

    pushd "$dir" > /dev/null
    zip -r "$zipfile" . > /dev/null
    popd > /dev/null

    name=$(grep "^name:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    description=$(grep "^description:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    ymlVersion=$(grep "^version:" "$f" | head -n 1 | cut -d' ' -f2- | sed -e 's/\r//' -e 's/^"\(.*\)"$/\1/')
    version="$ymlVersion-$version"
    # set IFS
    IFS=$'\n' dep=$(grep "^# requires:" "$f" | cut -c 12- | sed -e 's/\r//')

    # Write to the index.yml file
    if [ "$outdir" != "./" ]; then
        index_file="$outdir/index.yml"
    else
        index_file="./index.yml"
    fi

    echo "- id: $plugin_id
  name: $name
  metadata:
    description: $description
  version: $version
  date: $updated
  path: $plugin_id.zip
  sha256: $(sha256sum "$zipfile" | cut -d' ' -f1)" >> "$index_file"

    echo "Added entry to $index_file"

    # handle dependencies
    if [ ! -z "$dep" ]; then
        echo "  requires:" >> "$index_file"
        for d in ${dep//,/ }; do
            echo "    - $d" >> "$index_file"
        done
    fi

    echo "" >> "$index_file"
    echo "Finished processing $plugin_id"
}

find ./plugins -mindepth 1 -name *.yml | while read file; do
    buildPlugin "$file"
done
find ./themes -mindepth 1 -name *.yml | while read file; do
    buildPlugin "$file"
done

echo "Script execution completed"
