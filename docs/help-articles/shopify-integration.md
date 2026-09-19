# Shopify integration

Connect your Shopify store to ChatMize and turn carts, orders, and deliveries into chat conversations that recover revenue on autopilot.

## What it does

Once connected, store events flow into ChatMize and can start BotMaps flows:

* **Cart abandoned.** A shopper leaves checkout open past your abandonment window with no order. Fire a recovery flow with their items, total, and a one tap return link.
* **Order confirmed.** A new order is placed or paid. Send a thank you plus an order summary right away.
* **Order shipped.** A fulfillment is created. Share the tracking number and tracking link.
* **Order delivered.** The carrier marks the shipment delivered. Confirm delivery and ask for a review.
* **Product purchased.** A specific product is bought. Run post purchase onboarding, cross sells, or review requests for that product.

Each event carries the shopper details as variables you can use in messages: `{{customer_first_name}}`, `{{cart_items}}`, `{{cart_total}}`, `{{cart_recovery_url}}`, `{{order_name}}`, `{{tracking_number}}`, and more.

## Connect your store

1. Go to Settings, then Channels.
2. Find the Shopify card and enter your store domain, like `mystore.myshopify.com`.
3. Select Connect. You will approve the connection inside your Shopify admin.
4. ChatMize registers its event subscriptions on your store automatically.

ChatMize only reads orders, customers, and checkouts. It never changes products, prices, or orders in your store. Your access token is encrypted and scoped to your workspace only.

## Set the abandonment window

On the Shopify card you can set how long a checkout waits before it counts as abandoned. The default is 60 minutes. The range is 15 minutes to 3 days. When the window passes with no order, the cart recovery flow fires once per checkout.

## Build a cart recovery flow

1. Open BotMaps and create a flow.
2. Add the **Shopify Cart Abandoned** trigger.
3. Add an action node and choose the Shopify message section. Pick **Cart recovery** and write your message, for example: `Hi {{customer_first_name}}, you left {{cart_items}} in your cart ({{cart_total}}). Tap to finish checkout: {{cart_recovery_url}}`
4. Publish the flow.

Do the same with **Shopify Order Confirmed**, **Shopify Order Shipped**, and the other triggers for the rest of the customer journey.

## Disconnect

Select Disconnect on the Shopify card and confirm. ChatMize removes its event subscriptions from your store and disables the stored token. Your flows stay in place but stop receiving store events.

## Troubleshooting

* **Some event subscriptions failed.** The card shows which ones. Select Connect again to retry the failed subscriptions.
* **Connection lost.** Reconnect from the Shopify card. Your flows and settings are kept.
* **Recovery messages not firing.** Check that the abandonment window has passed and that the checkout was never completed. A completed checkout never fires a recovery.
