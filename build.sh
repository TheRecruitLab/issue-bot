#!/bin/bash

rm -r ./lib/*

for file in src/*.js; 
do 
    filename=`echo "$file" | sed "s/src\///" | sed "s/.js//"`
    echo "$file  | $filename"
    if [ "$filename" != 'utils'] -a ["$filename" != 'index' ] 
    then
        ncc build "$file" -o lib/"$filename" -m
    fi
done;