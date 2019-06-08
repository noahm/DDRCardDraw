import json
import shutil
import io

def rename(oldname,newname):
    print(oldname+" => "+newname)
    shutil.copyfile('../Jackets/'+oldname, '../NewJackets/'+newname+'.png')
    return (newname+'.png')
def main():
    with io.open('../src/songs/ace.json', encoding='utf-8') as aceJSONFile:
        aceJSON = json.load(aceJSONFile)

    for item in aceJSON:
        if 'valid_filename' in item.keys():
            item['jacket'] = rename(item['jacket'], item['valid_filename'])
        elif 'name_translation' in item.keys():
            if item['name_translation'] == "":
                item['jacket'] = rename(item['jacket'],item['name'])
            else:
                item['jacket'] = rename(item['jacket'],item['name_translation'])
        else:
            print ('no name_translation')

    with io.open('ace_out.json', encoding='utf-8', mode='w') as aceOutJSONFile:
        json.dump(aceJSON, aceOutJSONFile)


if __name__=="__main__":
  main()
