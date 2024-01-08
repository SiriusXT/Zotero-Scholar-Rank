import csv
import json

# 读取CSV文件
csv_file_path = r'X:\workspace\others\ShowJCR\中科院分区表及JCR原始数据文件/FQBJCR2023-UTF8.csv'
json_file_path = 'output.json'

data_list = []
with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
    csv_reader = csv.DictReader(csv_file)
    for row in csv_reader:
        # 选择特定字段
        selected_data = {
            'Journal': row['Journal'],
            'fenqu': row['大类分区'],
            'Top': 'Y' if row['Top'] == '是' else 'N'
        }
        data_list.append(selected_data)

# 将数据保存为JSON文件，去除换行等字符
with open(json_file_path, 'w', encoding='utf-8') as json_file:
    json.dump(data_list, json_file, ensure_ascii=False, separators=(',', ':'))

print(f'Data has been successfully converted and saved to {json_file_path}.')
