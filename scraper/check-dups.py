import json
import os.path
import csv
import io

def main():

    with io.open('../src/songs/ace.json', encoding='utf-8') as aceJSONFile:
            aceJSON = json.load(aceJSONFile)
    for song in aceJSON:
        i =0
        for checksong in aceJSON:
            if song['name'] == checksong['name']:
                i+=1
        if (i> 1):
            print("Dupe: "+song['name'])
if __name__ == "__main__":
    main()
