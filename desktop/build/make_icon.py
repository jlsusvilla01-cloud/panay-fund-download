# Builds the app icons from the Panay Fund logo (peso monogram).
from PIL import Image
src = Image.open('desktop/build/icon-source.png').convert('RGBA')
src.save('desktop/build/icon.png')
src.resize((256, 256), Image.LANCZOS).save('desktop/build/icon.ico', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
src.resize((128, 128), Image.LANCZOS).save('desktop/renderer/icon.png')
