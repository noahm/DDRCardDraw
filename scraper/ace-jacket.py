import json
import os.path
import csv
import io

def parseSong(song, aceJSON):
    for item in aceJSON:
        if (song[0]== item['name']):
#            print('match')
            item['jacket']=song[6]+'_jk.png'
            item['folder']=song[2]
            return
    print('No Match '+song[0])

def main():

    with io.open('ace.json', encoding='utf-8') as aceJSONFile:
            aceJSON = json.load(aceJSONFile)
    with io.open('acedb.csv',encoding='utf-8') as acedb:
        songs = csv.reader(acedb)
        for song in songs:
            parseSong(song, aceJSON)
    with io.open('ace_out.json', encoding='utf-8', mode='w') as aceOutJSONFile:
        json.dump(aceJSON, aceOutJSONFile)
if __name__ == "__main__":
    main()
