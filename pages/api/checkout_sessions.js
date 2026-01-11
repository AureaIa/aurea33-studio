// pages/api/checkout_sessions.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { plan, uid } = req.body;

    const priceId = plan === 'pro'
      ? process.env.STRIPE_PRICE_PRO
      : process.env.STRIPE_PRICE_PLUS;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      success_url: `${req.headers.origin}/dashboard?success=true&plan=${plan}&uid=${uid}`,
      cancel_url: `${req.headers.origin}/dashboard?canceled=true`,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
    });

    res.status(200).json({ url: session.url });
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}
