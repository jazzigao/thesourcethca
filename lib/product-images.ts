import fizz from '@/assets/fizz-primary.jpg';
import fizzMacro from '@/assets/fizz-macro.jpg';
import fizzTexture from '@/assets/fizz-texture.jpg';
import fizzTool from '@/assets/fizz-tool.jpg';
import gakSmoovie from '@/assets/gak-smoovie-primary.jpg';
import gakSmoovieMacro from '@/assets/gak-smoovie-macro.jpg';
import gakSmoovieTexture from '@/assets/gak-smoovie-texture.jpg';
import gakSmoovieTool from '@/assets/gak-smoovie-tool.jpg';
import gmo from '@/assets/gmo-upload-primary.jpg';
import gmoMacro from '@/assets/gmo-upload-macro.jpg';
import gmoTexture from '@/assets/gmo-upload-texture.jpg';
import gmoTool from '@/assets/gmo-upload-tool.jpg';
import highFructoseCornSyrup from '@/assets/high-fructose-corn-syrup-primary.jpg';
import highFructoseCornSyrupMacro from '@/assets/high-fructose-corn-syrup-macro.jpg';
import highFructoseCornSyrupTexture from '@/assets/high-fructose-corn-syrup-texture.jpg';
import highFructoseCornSyrupTool from '@/assets/high-fructose-corn-syrup-tool.jpg';
import ogkbMelonade from '@/assets/ogkb-melonade-primary.jpg';
import ogkbMelonadeMacro from '@/assets/ogkb-melonade-macro.jpg';
import ogkbMelonadeTexture from '@/assets/ogkb-melonade-texture.jpg';
import ogkbMelonadeTool from '@/assets/ogkb-melonade-tool.jpg';
import organicFlower from '@/assets/organic-flower-upload-primary.jpg';
import organicFlowerDetail from '@/assets/organic-flower-detail_2.jpg';

const productImages: Record<string, string> = {
  'gak-smoovie': gakSmoovie,
  'high-fructose-corn-syrup': highFructoseCornSyrup,
  gmo,
  fizz,
  'ogkb-melonade': ogkbMelonade,
  'organic-cannabis-flower': organicFlower,
};

const productGalleries: Record<string, string[]> = {
  'gak-smoovie': [gakSmoovie, gakSmoovieMacro, gakSmoovieTexture, gakSmoovieTool],
  'high-fructose-corn-syrup': [
    highFructoseCornSyrup,
    highFructoseCornSyrupMacro,
    highFructoseCornSyrupTexture,
    highFructoseCornSyrupTool,
  ],
  gmo: [gmo, gmoMacro, gmoTexture, gmoTool],
  fizz: [fizz, fizzMacro, fizzTexture, fizzTool],
  'ogkb-melonade': [ogkbMelonade, ogkbMelonadeMacro, ogkbMelonadeTexture, ogkbMelonadeTool],
  'organic-cannabis-flower': [organicFlower, organicFlowerDetail],
};

type ProductImageIdentity = {
  id: string;
  name: string;
  type?: string;
};

const productImageAliases: Record<string, keyof typeof productImages> = {
  fizz: 'fizz',
  'the-fizz': 'fizz',
  'gak-smoovie': 'gak-smoovie',
  gak: 'gak-smoovie',
  gmo: 'gmo',
  'gmo-cookies': 'gmo',
  hfcs: 'high-fructose-corn-syrup',
  'high-fructose-corn-syrup': 'high-fructose-corn-syrup',
  'ogkb-melonade': 'ogkb-melonade',
  'melonade-breath': 'ogkb-melonade',
  'organic-cannabis-flower': 'organic-cannabis-flower',
  'organic-flower': 'organic-cannabis-flower',
};

const normalizeProductIdentity = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const resolveProductImageKey = (
  product: ProductImageIdentity | string,
): keyof typeof productImages => {
  const candidates =
    typeof product === 'string' ? [product] : [product.id, product.name];

  for (const candidate of candidates) {
    const key = productImageAliases[normalizeProductIdentity(candidate)];
    if (key) return key;
  }

  const identity =
    typeof product === 'string' ? product : `${product.id} (${product.name})`;
  throw new Error(`Missing exact product image mapping for ${identity}`);
};

export function getProductImage(product: ProductImageIdentity | string): string {
  return productImages[resolveProductImageKey(product)];
}

export function getProductGallery(product: ProductImageIdentity | string): Array<{
  src: string;
  label: string;
}> {
  const key = resolveProductImageKey(product);
  const labels = [
    'primary product photo',
    'macro product detail',
    'texture product detail',
    'tool product detail',
  ];

  return productGalleries[key].map((src, index) => ({
    src,
    label: `${typeof product === 'string' ? product : product.name} ${labels[index] ?? 'product detail'}`,
  }));
}