import json
import os.path
import xml.etree.ElementTree as et
import io

def parseSongs(aceXML, aceJSON):
    numErrors = 0
    for item in aceJSON:
        itemMatch = False
        for music in aceXML.findall('music'):
            if music.find('title').text == item['name']:
                #print (item['name'])
                xmlDiff = music.find('diffLv').text.split()
                jsonDiff = []
                if (item['single']['beginner'] != None):
                    jsonDiff.append (item['single']['beginner']['difficulty'])
                else:
                    jsonDiff.append('0')
                if (item['single']['basic'] != None):
                    jsonDiff.append (item['single']['basic']['difficulty'])
                else:
                    jsonDiff.append('0')
                if (item['single']['difficult'] != None):
                    jsonDiff.append (item['single']['difficult']['difficulty'])
                else:
                    jsonDiff.append('0')
                if (item['single']['expert'] != None):
                    jsonDiff.append (item['single']['expert']['difficulty'])
                else:
                    jsonDiff.append('0')
                if (item['single']['challenge'] != None):
                    jsonDiff.append (item['single']['challenge']['difficulty'])
                else:
                    jsonDiff.append('0')
                jsonDiff.append('0')
                if (item['double']['basic'] != None):
                    jsonDiff.append (item['double']['basic']['difficulty'])
                else:
                    jsonDiff.append('0')
                if (item['double']['difficult'] != None):
                    jsonDiff.append (item['double']['difficult']['difficulty'])
                else:
                    jsonDiff.append('0')
                if (item['double']['expert'] != None):
                    jsonDiff.append (item['double']['expert']['difficulty'])
                else:
                    jsonDiff.append('0')
                if (item['double']['challenge'] != None):
                    jsonDiff.append (item['double']['challenge']['difficulty'])
                else:
                    jsonDiff.append('0')
                match = True
                for xmlNum, jsonNum in zip(jsonDiff, xmlDiff ):
                    if jsonNum != xmlNum:
                        match = False
                        numErrors +=1
                if not match:
                    print (item['name'])
                    print ("ACE:     " ,xmlDiff)
                    print ("Current: ",jsonDiff)
    print(numErrors)

#        if itemMatch == False:
#            print(item['name'])


def main():

    with io.open('ace.json', encoding='utf-8') as aceJSONFile:
            aceJSON = json.load(aceJSONFile)
    parser = et.XMLParser(encoding='utf-8')
    aceXML = et.parse('acedb.xml', parser=parser)

    parseSongs(aceXML, aceJSON)

#    with io.open('ace_out.json', encoding='utf-8', mode='w') as aceOutJSONFile:
#        json.dump(aceJSON, aceOutJSONFile)
if __name__ == "__main__":
    main()
