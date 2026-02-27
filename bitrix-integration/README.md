# Bitrix Integration

This directory contains the integration code for connecting the RMA system with your Bitrix order status page.

## Files

- `order-status-integration.js` - JavaScript code to add RMA functionality to Bitrix order pages

## Installation

1. **Copy the integration script** to your Bitrix template directory or include it in your order status page template.

2. **Update configuration** in `order-status-integration.js`:
   ```javascript
   const RMA_SERVICE_URL = 'https://your-rma-service.com';
   const RMA_UI_URL = 'https://your-rma-service.com/ui';
   ```

3. **Adjust selectors** based on your Bitrix template:
   - Update `getOrderId()` to match your order ID element
   - Update `getOrderItems()` to match your order item structure
   - Update `getCustomerEmail()` and `getCustomerId()` to match your customer data elements

4. **Include the script** in your order status page:
   ```html
   <script src="/path/to/order-status-integration.js"></script>
   ```

## How It Works

1. The script adds a **"Still having issues?"** button to the order status page
2. When clicked, it shows a modal to select the specific order item
3. It calls the RMA service `/api/rma/start` endpoint with order and customer information
4. It opens the RMA modal UI in an iframe with the session token
5. The customer completes the RMA flow in the modal

## Customization

You may need to adjust:
- CSS selectors to match your Bitrix template structure
- Data attributes if your template uses different naming
- Modal styling to match your site's design
- Brand detection logic if you have multiple brands

## Testing

1. Navigate to an order status page in Bitrix
2. Verify the "Still having issues?" button appears
3. Click the button and select an order item
4. Verify the RMA modal opens and functions correctly
