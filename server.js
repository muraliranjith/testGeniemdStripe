const express = require('express');
const stripe = require('stripe')('sk_test_51R0zVuPQ16HYEMcYb4MXUgfzJRXfwYqxR9cdbdlorVgkidQ9CkB8YXTcxlq5jRlasQYfMi0h7mlHsUWPaM7IOeLn00r9RUj4Kc');
const cors = require('cors'); // ✅ Import CORS
const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));
 
/*app.post('/api/create-subscription', async (req, res) => {
  try {
    const { email, paymentMethodId, priceId } = req.body;
 
    // Create a customer
    const customer = await stripe.customers.create({
      email: email,
      payment_method: paymentMethodId,
      invoice_settings: { default_payment_method: paymentMethodId },
    });
 
    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      expand: ['latest_invoice.payment_intent'],
    });
 
    res.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(400).json({ error: { message: error.message } });
  }
});
 */
app.post('/create-payment-intent', async (req, res) => {
    try {
        const { amount, currency, paymentMethodId } = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount, // Amount in cents (e.g., $10 = 1000)
            currency, // Example: 'usd'
            payment_method: paymentMethodId, // Provide a valid payment method ID if available
            automatic_payment_methods: { enabled: true } // Enables automatic payment methods
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


app.post('/api/create-subscription', async (req, res) => {
    console.log('⚡ Received request at /api/create-subscription');
    try {
        const { email, paymentMethodId, items } = req.body;

        console.log('insdie subscription :');

        // 🔍 Log the received data
        console.log('📥 Received subscription request:');
        console.log('📧 Email:', email);
        console.log('💳 Payment Method ID:', paymentMethodId);
        console.log('📦 Items:', JSON.stringify(items, null, 2)); // Pretty print

        if (!items || !Array.isArray(items) || items.length === 0) {
            console.error("🚨 Error: Items array is missing or empty.");
            return res.status(400).json({ error: "Items array is required." });
        }

        // 🔍 Ensure priceId is correctly extracted
        items.forEach((item, index) => {
            console.log(`🔹 Item ${index + 1}: Price ID =`, item.priceId);
        });

        // Create the Customer
        const customer = await stripe.customers.create({
            email,
            payment_method: paymentMethodId,
            invoice_settings: { default_payment_method: paymentMethodId },
        });

        // Create the Subscription with multiple items
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: items.map(item => ({
                price: item.priceId,
                quantity: item.quantity || 1
            })),
            expand: ['latest_invoice.payment_intent'],
        });

        console.log("🎉 Subscription created successfully:", subscription.id);

        res.json({ 
            subscriptionId: subscription.id, 
            clientSecret: subscription.latest_invoice.payment_intent.client_secret 
        });
    } catch (error) {
        console.error('❌ Error creating subscription:', error);
        res.status(500).json({ error: error.message });
    }
});

  
  app.get('/products', async (req, res) => {
    try {
        // Fetch all products with their prices
        const products = await stripe.products.list();
        const prices = await stripe.prices.list();

        // Combine products with their respective prices
        const productList = products.data.map(product => {
            return {
                id: product.id,
                name: product.name,
                description: product.description,
                images: product.images,
                prices: prices.data
                    .filter(price => price.product === product.id)
                    .map(price => ({
                        priceId: price.id,
                        amount: price.unit_amount / 100, // Convert cents to dollars
                        currency: price.currency,
                        interval: price.recurring ? price.recurring.interval : null, // If it's a subscription
                    })),
            };
        });

        res.json(productList);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/customers-with-subscriptions", async (req, res) => {
    try {
      // Fetch all customers (limit to 100, you can paginate for more)
      const customersResponse = await stripe.customers.list({ limit: 100 });
      const customers = customersResponse.data;
  
      // Fetch all subscriptions (limit to 100, you can paginate for more)
      const subscriptionsResponse = await stripe.subscriptions.list({ limit: 100 });
      const subscriptions = subscriptionsResponse.data;
  
      // Map subscriptions to their respective customers
      const customerSubscriptions = customers.map((customer) => {
        return {
          id: customer.id,
          name: customer.name || "N/A",
          email: customer.email || "N/A",
          subscriptions: subscriptions.filter(sub => sub.customer === customer.id) || [],
        };
      });
  
      return res.status(200).json({
        message: "Customers and their subscriptions retrieved successfully",
        customers: customerSubscriptions,
      });
  
    } catch (error) {
      console.error("Error fetching customers and subscriptions:", error);
      return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  });
  
app.get("/subscriptions/", async (req, res) => {
    try {
    //   const { customerId } = req.params;
  
    //   if (!customerId) {
    //     return res.status(400).json({ error: "Customer ID is required" });
    //   }
  
      // Fetch all active subscriptions for the customer
      const subscriptions = await stripe.subscriptions.list();

      return res.json({
        message: "Subscriptions retrieved successfully",
        subscriptions: subscriptions.data, // Array of subscription objects
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  app.get("/customer", async (req, res) => {
    try {
    //   const { customerId } = req.params;
  
    //   if (!customerId) {
    //     return res.status(400).json({ error: "Customer ID is required" });
    //   }
  
      // Fetch customer details
      const customer = await stripe.customers.retrieve();
  
    //   if (!customer) {
    //     return res.status(404).json({ error: "Customer not found" });
    //   }
  
      // Fetch active subscriptions for the customer
      const { data: subscriptions } = await stripe.subscriptions.list();
  
      return res.status(200).json({
        message: "Customer details and subscriptions retrieved successfully",
        customer,  // Full customer details
        subscriptions, // Active subscriptions
      });
  
    } catch (error) {
      console.error("Error fetching customer data:", error);
      return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
  });
  

  app.get("/getAllSubscriptions" , async (req, res) => {
    try {
      const subscriptions = await stripe.subscriptions.list(); // Fetching latest 10 subscriptions
  
      const customers = await Promise.all(
        subscriptions.data.map(async (sub) => {
          return stripe.customers.retrieve(sub.customer);
        })
      );
  
      console.log('Customers with Active Subscriptions:', customers);
      return res.status(200).json({ customers });
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  })

  app.post("/cancel-subscription", async (req, res) => {
    try {
      const { subscriptionId } = req.body;
  
      if (!subscriptionId) {
        return res.status(400).json({ error: "Subscription ID is required" });
      }
  
      // Cancel the subscription
      const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true, // Cancels at the end of the billing cycle
      });
  
      return res.json({
        message: "Subscription cancellation scheduled",
        subscription: canceledSubscription,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
 
