import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

// SF Symbols only exist on Apple platforms; the web build draws the closest Material Symbol instead.
const WEB_ICONS: Partial<Record<SFSymbol, AndroidSymbol>> = {
  airplane: 'flight',
  bag: 'shopping_bag',
  bell: 'notifications',
  bolt: 'bolt',
  camera: 'photo_camera',
  car: 'directions_car',
  cart: 'shopping_cart',
  'chart.bar': 'bar_chart',
  'chart.bar.fill': 'bar_chart',
  checkmark: 'check',
  'checkmark.circle': 'check_circle',
  'chevron.left': 'chevron_left',
  'chevron.right': 'chevron_right',
  'doc.text': 'receipt_long',
  'doc.text.viewfinder': 'document_scanner',
  'exclamationmark.triangle': 'warning',
  'fork.knife': 'restaurant',
  heart: 'favorite',
  house: 'home',
  'list.bullet': 'list',
  magnifyingglass: 'search',
  'person.2': 'group',
  'person.2.fill': 'group',
  photo: 'photo',
  plus: 'add',
  'square.and.arrow.up': 'ios_share',
  'square.and.pencil': 'edit_square',
  'square.grid.2x2': 'grid_view',
  ticket: 'confirmation_number',
  trash: 'delete',
  xmark: 'close',
  'wifi.exclamationmark': 'wifi_off',
};

export function symbolName(name: SFSymbol): { ios: SFSymbol; web?: AndroidSymbol } {
  return { ios: name, web: WEB_ICONS[name] };
}
