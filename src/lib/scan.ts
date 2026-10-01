import { FunctionsHttpError } from '@supabase/supabase-js';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

import type { CategoryId } from '@/lib/categories';
import { today } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import type { ReceiptItem } from '@/lib/types';

export type PickedImage = { uri: string; width: number; height: number };
export type PreparedImage = { uri: string; base64: string };
export type ScanResult = {
  merchant: string;
  total: number;
  purchased_on: string;
  category: CategoryId;
  // Absent if the deployed scan function predates summaries and itemized lists.
  summary?: string;
  items?: ReceiptItem[];
};

// Claude downsizes anything larger than this, so bigger photos would only slow the upload.
const MAX_EDGE = 1568;

/** Opens the camera or photo library. Returns null if the user cancels or denies access. */
export async function pickReceiptImage(source: 'camera' | 'library'): Promise<PickedImage | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      source === 'camera' ? 'Camera access needed' : 'Photo access needed',
      'Allow access in Settings to scan receipts.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
    return null;
  }

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const { uri, width, height } = result.assets[0];
  return { uri, width, height };
}

/** Shrinks the photo to a size Claude reads well and that uploads quickly. */
export async function prepareImage(image: PickedImage): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(image.uri);
  if (Math.max(image.width, image.height) > MAX_EDGE) {
    context.resize(image.width >= image.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('Could not encode image');
  return { uri: saved.uri, base64: saved.base64 };
}

export async function readReceipt(imageBase64: string): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke<ScanResult>('scan-receipt', {
    body: { image_base64: imageBase64, today: today() },
  });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new Error(body?.error ?? 'Couldn’t read the receipt.');
    }
    throw new Error('Couldn’t reach the server. Check your connection.');
  }
  if (!data) throw new Error('Couldn’t read the receipt.');
  return data;
}
