



"""
Examples data entries
'urldate': '2023-04-18',
'pages': '687--697',
'number': '5',
'volume': '26',
'journal': 'Journal of Computer-Aided Design & Computer Graphics',
'year': '2014',
'author': 'Zhao, Ying and Fan, XiaoPing and Zhou, FangFang and Wang, Fei and Zhang, JiaWan',
'title': 'A survey on network security data visualization',
'ENTRYTYPE': 'article',
'ID': 'zhao2014survey'
"""
import json

import bibtexparser as bp
from bibtexparser.bparser import BibTexParser
from bibtexparser.customization import convert_to_unicode
from bibtexparser.bibdatabase import BibDatabase
from bibtexparser.bwriter import BibTexWriter









if __name__ == '__main__':
    # bib文件路径
    # bibfile_path = "../data/00-survey-bib.bib"
    bibfile_path = "../data/My Collection_5.17.bib"

    # Load bib files
    with open(bibfile_path) as bibfile:
        parser = BibTexParser()  # 声明解析器类
        parser.customization = convert_to_unicode  # 将BibTeX编码强制转换为UTF编码
        bibdata = bp.load(bibfile, parser=parser)  # 通过bp.load()加载


    # 初始化bibdatabase
    bib_db = BibDatabase()
    bib_writer = BibTexWriter()



    # 遍历bibfile输出, 独立的bib文件
    for paper in bibdata.entries:
        bib_db.entries = [paper]
        with open("../bibtex/" + paper["ID"] + ".bib", 'w', encoding='utf-8') as bibfile:
            bibfile.write(bib_writer.write(bib_db))


    content_json_list = []

    # 输出JSON格式的文件
    for paper in bibdata.entries:
        exp_paper_json = {}
        try:
            if paper['ENTRYTYPE'] == "article":
                exp_paper_json['title'] = paper['title']
                exp_paper_json['url'] = paper['doi']
                exp_paper_json['reference'] = ''
                exp_paper_json['id'] = paper['ID']
                exp_paper_json['venue'] = paper['journal']
                exp_paper_json['year'] = paper['year']
                exp_paper_json['authors'] = paper['author']
                exp_paper_json['categories'] = []
            elif paper['ENTRYTYPE'] == "inproceedings":
                exp_paper_json['title'] = paper['title']
                exp_paper_json['url'] = paper['doi']
                exp_paper_json['reference'] = ''
                exp_paper_json['id'] = paper['ID']
                exp_paper_json['venue'] = paper['booktitle']
                exp_paper_json['year'] = paper['year']
                exp_paper_json['authors'] = paper['author']
                exp_paper_json['categories'] = []
            content_json_list.append(exp_paper_json)

        except:
            print(paper)

    with open('../data/' + 'content_convert.json', 'w', encoding='utf-8') as content:
        json.dump(content_json_list, content)








