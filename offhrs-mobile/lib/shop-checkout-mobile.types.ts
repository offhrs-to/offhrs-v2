export type ShopCheckoutAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  province: string;
  postal_code: string;
};

export type ShopCheckoutResult =
  | { ok: true; orderId?: string }
  | { ok: false; cancelled?: boolean; message: string };
