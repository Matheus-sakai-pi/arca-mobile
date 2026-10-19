import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { PHOTO_CONFIG } from '@/lib/profilePhoto';

export async function pickProfilePhoto(): Promise<{ image: string; uri: string } | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    exif: false,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (
    !asset ||
    !asset.width ||
    !asset.height ||
    asset.width * asset.height > 50000000 ||
    (asset.fileSize ?? 0) > 20 * 1024 * 1024
  )
    throw new Error('Escolha uma imagem de até 20 MB.');
  const side = Math.min(asset.width, asset.height);
  const context = ImageManipulator.manipulate(asset.uri);
  context.crop({
    originX: Math.floor((asset.width - side) / 2),
    originY: Math.floor((asset.height - side) / 2),
    width: side,
    height: side,
  });
  context.resize({ width: PHOTO_CONFIG.dimension, height: PHOTO_CONFIG.dimension });
  const rendered = await context.renderAsync();
  try {
    const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
    if (!result.base64 || (result.base64.length * 3) / 4 > PHOTO_CONFIG.bytes)
      throw new Error('A foto ficou muito grande. Escolha outra imagem.');
    return { image: result.base64, uri: `data:image/jpeg;base64,${result.base64}` };
  } finally {
    rendered.release();
    context.release();
  }
}
