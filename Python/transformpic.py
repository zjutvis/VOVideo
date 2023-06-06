import os.path
import re

from PIL import Image

def get_files_in_folder(folder_path):
    file_paths = []
    file_names = []
    for file_name in os.listdir(folder_path):
        file_path = os.path.join(folder_path, file_name)
        if os.path.isfile(file_path):
            file_paths.append(file_path)
            file_names.append(file_name)
    return file_paths, file_names


if __name__ == '__main__':
    # 读取文件夹下所有文件路径
    thumbs200_path = "../thumbs200"
    files, names = get_files_in_folder(thumbs200_path)
    for file_path, file_name in zip(files, names):
        original_image = Image.open(file_path)
        resized_image = original_image.resize((290, 145))
        resized_image.save('../thumbs100/' + file_name)
