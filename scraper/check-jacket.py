import json
import os.path
import csv
import io

def main():

    with io.open('../src/songs/ace.json', encoding='utf-8') as aceJSONFile:
            aceJSON = json.load(aceJSONFile)
    i =0
    for item in aceJSON:
        if 'jacket' not in item.keys():
            print(item['name'])
            i +=1
    print (i)
if __name__ == "__main__":
    main()
