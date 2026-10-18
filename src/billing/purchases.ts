import Constants from 'expo-constants';
import { Platform } from 'react-native';
import RNPurchases, { type PurchasesStoreProduct } from 'react-native-purchases';

/**
 * App Store / Google Play subscriptions through RevenueCat (react-native-purchases).
 *
 * The RevenueCat app user id is the business (organization) id, so a subscription belongs to the
 * business, not to the person who paid. Each tier is its own subscription product, pvm_pro_<stores>,
 * all in one subscription group, so changing the number of stores is an upgrade/downgrade.
 * Purchases only work in a development or store build on a phone; on the web and in Expo Go
 * {@link purchasesAvailable} is false.
 */

type Purchases = typeof RNPurchases;
type StoreProduct = PurchasesStoreProduct;

const apiKey = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
}) || undefined;

const native = Platform.OS === 'ios' || Platform.OS === 'android';
const expoGo = Constants.appOwnership === 'expo';

export function purchasesAvailable() {
  return native && !expoGo && !!apiKey;
}

let sdk: Purchases | null = null;
let configuredFor: string | null = null;

async function client(appUserId: string): Promise<Purchases> {
  if (!purchasesAvailable()) throw new Error('purchases_unavailable');
  if (!sdk) {
    // configured on first use (only on phones; see purchasesAvailable)
    sdk = RNPurchases;
    sdk.configure({ apiKey: apiKey!, appUserID: appUserId });
    configuredFor = appUserId;
  } else if (configuredFor !== appUserId) {
    await sdk.logIn(appUserId);
    configuredFor = appUserId;
  }
  return sdk;
}

/** Store prices ("$14.99", "359.000 ₫") of the given products, by product id. */
export async function storePrices(appUserId: string, productIds: string[]): Promise<Record<string, StoreProduct>> {
  const purchases = await client(appUserId);
  const products = await purchases.getProducts(productIds, purchases.PRODUCT_CATEGORY.SUBSCRIPTION);
  return Object.fromEntries(products.map((p) => [p.identifier.split(':')[0], p]));
}

export type PurchaseOutcome = 'purchased' | 'cancelled';

/**
 * Buys (or switches to) a tier. On Android a switch must name the current product so Play
 * replaces it instead of adding a second subscription; on iOS the subscription group handles it.
 */
export async function buy(appUserId: string, product: StoreProduct, currentProductId?: string | null): Promise<PurchaseOutcome> {
  const purchases = await client(appUserId);
  try {
    const switching = Platform.OS === 'android' && !!currentProductId && currentProductId !== product.identifier.split(':')[0];
    await purchases.purchaseStoreProduct(product, switching ? { oldProductIdentifier: currentProductId! } : null);
    return 'purchased';
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    throw e;
  }
}

/** Re-attach purchases made with this Apple ID / Google account (new phone, reinstall). */
export async function restore(appUserId: string) {
  const purchases = await client(appUserId);
  await purchases.restorePurchases();
}

/** Where the store lets the user cancel or change the subscription. */
export async function manageUrl(appUserId: string): Promise<string | null> {
  const purchases = await client(appUserId);
  return (await purchases.getCustomerInfo()).managementURL;
}
