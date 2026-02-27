/**
 * Bitrix Order Status Page Integration
 * 
 * Add this code to your Bitrix order status page template
 * or include it as a script on the order details page.
 * 
 * This code:
 * 1. Adds a "Still having issues?" button
 * 2. Calls the RMA service to start a session
 * 3. Opens the customer modal UI in an iframe
 */

(function() {
  'use strict';

  // Configuration - Update these values
  const RMA_SERVICE_URL = 'https://your-rma-service.com'; // Your RMA service URL
  const RMA_UI_URL = 'https://your-rma-service.com/ui'; // Your RMA UI URL

  /**
   * Initialize RMA button on order status page
   */
  function initRmaButton() {
    // Find the order details container
    // Adjust selector based on your Bitrix template structure
    const orderContainer = document.querySelector('.order-details') || 
                          document.querySelector('[data-order-id]') ||
                          document.body;

    if (!orderContainer) {
      console.warn('RMA: Order container not found');
      return;
    }

    // Get order information from the page
    // Adjust selectors based on your Bitrix template
    const orderId = getOrderId();
    const orderItems = getOrderItems();

    if (!orderId || !orderItems || orderItems.length === 0) {
      console.warn('RMA: Order ID or items not found');
      return;
    }

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'rma-button-container';
    buttonContainer.style.cssText = 'margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 4px;';

    // Create "Still having issues?" button
    const button = document.createElement('button');
    button.textContent = 'Still having issues?';
    button.className = 'rma-start-button';
    button.style.cssText = 'padding: 12px 24px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;';
    button.onclick = () => showItemSelector(orderId, orderItems);

    buttonContainer.appendChild(button);
    
    // Insert button after order details
    orderContainer.appendChild(buttonContainer);
  }

  /**
   * Get order ID from the page
   */
  function getOrderId() {
    // Try multiple common selectors
    const orderIdElement = 
      document.querySelector('[data-order-id]') ||
      document.querySelector('.order-id') ||
      document.querySelector('#order-id');

    if (orderIdElement) {
      return orderIdElement.getAttribute('data-order-id') || 
             orderIdElement.textContent.trim() ||
             orderIdElement.value;
    }

    // Try to extract from URL
    const urlMatch = window.location.pathname.match(/\/orders?\/([^\/]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    return null;
  }

  /**
   * Get order items from the page
   */
  function getOrderItems() {
    const items = [];
    const itemElements = document.querySelectorAll('.order-item, [data-order-item-id]');

    itemElements.forEach((element) => {
      const itemId = element.getAttribute('data-order-item-id') || 
                     element.querySelector('[data-order-item-id]')?.getAttribute('data-order-item-id');
      const sku = element.getAttribute('data-sku') ||
                  element.querySelector('[data-sku]')?.getAttribute('data-sku') ||
                  element.querySelector('.sku')?.textContent.trim();
      const name = element.querySelector('.item-name')?.textContent.trim() ||
                   element.textContent.trim();

      if (itemId && sku) {
        items.push({
          orderItemId: itemId,
          sku: sku,
          name: name || sku,
        });
      }
    });

    return items.length > 0 ? items : null;
  }

  /**
   * Show item selector modal
   */
  function showItemSelector(orderId, orderItems) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'rma-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'rma-modal';
    modal.style.cssText = `
      background: white;
      padding: 30px;
      border-radius: 8px;
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Select the item you\'re having issues with';
    title.style.cssText = 'margin-top: 0;';

    const itemList = document.createElement('div');
    itemList.className = 'rma-item-list';

    orderItems.forEach((item) => {
      const itemButton = document.createElement('button');
      itemButton.textContent = `${item.name} (${item.sku})`;
      itemButton.style.cssText = `
        display: block;
        width: 100%;
        padding: 15px;
        margin: 10px 0;
        text-align: left;
        background: #f9f9f9;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
      `;
      itemButton.onmouseover = () => itemButton.style.background = '#e9e9e9';
      itemButton.onmouseout = () => itemButton.style.background = '#f9f9f9';
      itemButton.onclick = () => startRmaSession(orderId, item);
      itemList.appendChild(itemButton);
    });

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Cancel';
    closeButton.style.cssText = `
      margin-top: 20px;
      padding: 10px 20px;
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    closeButton.onclick = () => document.body.removeChild(overlay);

    modal.appendChild(title);
    modal.appendChild(itemList);
    modal.appendChild(closeButton);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    };
  }

  /**
   * Start RMA session and open modal
   */
  async function startRmaSession(orderId, orderItem) {
    try {
      // Get customer information
      // Adjust based on how Bitrix stores customer data
      const customerEmail = getCustomerEmail();
      const customerId = getCustomerId();
      const brand = getBrand(); // 'UPFIX' or 'MYAIRBAGS'

      // Call RMA service to start session
      const response = await fetch(`${RMA_SERVICE_URL}/api/rma/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          brand: brand || 'UPFIX',
          orderId: orderId,
          orderItemId: orderItem.orderItemId,
          sku: orderItem.sku,
          customer: {
            id: customerId,
            email: customerEmail,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`RMA service error: ${response.statusText}`);
      }

      const data = await response.json();

      // Open RMA modal UI in iframe
      openRmaModal(data.rmaSessionToken, data.rmaId);

    } catch (error) {
      console.error('RMA start failed:', error);
      alert('Failed to start RMA session. Please try again or contact support.');
    }
  }

  /**
   * Open RMA modal UI
   */
  function openRmaModal(sessionToken, rmaId) {
    // Remove any existing modal
    const existing = document.querySelector('.rma-modal-overlay');
    if (existing) {
      document.body.removeChild(existing);
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'rma-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Create modal content with iframe
    const modal = document.createElement('div');
    modal.className = 'rma-modal';
    modal.style.cssText = `
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 800px;
      height: 90vh;
      display: flex;
      flex-direction: column;
    `;

    // Close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      width: 40px;
      height: 40px;
      background: #f0f0f0;
      border: none;
      border-radius: 50%;
      font-size: 24px;
      cursor: pointer;
      z-index: 10001;
    `;
    closeButton.onclick = () => document.body.removeChild(overlay);

    // Iframe
    const iframe = document.createElement('iframe');
    iframe.src = `${RMA_UI_URL}?rmaSessionToken=${encodeURIComponent(sessionToken)}&rmaId=${encodeURIComponent(rmaId)}`;
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
      border-radius: 8px;
    `;
    iframe.allow = 'camera; microphone'; // For evidence uploads

    modal.style.position = 'relative';
    modal.appendChild(closeButton);
    modal.appendChild(iframe);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on overlay click (but not on iframe)
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    };
  }

  /**
   * Get customer email from Bitrix
   */
  function getCustomerEmail() {
    // Adjust selector based on your Bitrix template
    const emailElement = 
      document.querySelector('[data-customer-email]') ||
      document.querySelector('.customer-email') ||
      document.querySelector('#customer-email');

    return emailElement?.getAttribute('data-customer-email') ||
           emailElement?.textContent.trim() ||
           emailElement?.value ||
           null;
  }

  /**
   * Get customer ID from Bitrix
   */
  function getCustomerId() {
    // Adjust selector based on your Bitrix template
    const idElement = 
      document.querySelector('[data-customer-id]') ||
      document.querySelector('.customer-id') ||
      document.querySelector('#customer-id');

    return idElement?.getAttribute('data-customer-id') ||
           idElement?.textContent.trim() ||
           idElement?.value ||
           null;
  }

  /**
   * Get brand from page or default
   */
  function getBrand() {
    // Check if there's a brand indicator on the page
    const brandElement = document.querySelector('[data-brand]');
    if (brandElement) {
      return brandElement.getAttribute('data-brand').toUpperCase();
    }

    // Check URL or domain
    if (window.location.hostname.includes('myairbags')) {
      return 'MYAIRBAGS';
    }

    return 'UPFIX'; // Default
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRmaButton);
  } else {
    initRmaButton();
  }

})();
