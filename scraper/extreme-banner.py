import json
import os
import csv
import io
import shutil

def parseSong(song, extremeJSON):
    if (song['name_translation'] == ''):
        songName = song['name']

    else:
        songName = song['name_translation']

    for root, dirnames, filenames in os.walk('Songs'):
        if (songName in dirnames):
            if (songName+'.png' in os.listdir(root+"\\"+songName)):
                shutil.copyfile(root+'\\'+songName+'\\'+songName+'.png','Extreme Banners/ex_'+songName+'.png')
                for item in extremeJSON:
                    if (song['name'] == item['name'] and song['name_translation'] ==item['name_translation']):
                        item['jacket'] = 'ex_'+songName +'.png'
                        item['folder'] = root.split('\\')[1]
                        return
    print("NO MATCH: "+ songName)

def main():

    with io.open('../src/songs/extreme.json', encoding='utf-8') as extremeJSONFile:
            extremeJSON = json.load(extremeJSONFile)
    for song in extremeJSON:
            parseSong(song, extremeJSON)
    with io.open('extreme_out.json', encoding='utf-8', mode='w') as extremeOutJSONFile:
        json.dump(extremeJSON, extremeOutJSONFile)
if __name__ == "__main__":
    main()
