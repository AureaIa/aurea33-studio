import { buffer } from 'micro';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

// Inicializa Firebase Admin solo una vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

const webhookHandler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Error verificando firma del webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // EVENTOS DE STRIPE
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    const customerEmail = session.customer_email;
    const priceId = session?.metadata?.priceId || session?.display_items?.[0]?.price?.id;

    let plan = 'FREE TRIAL';

    if (priceId === process.env.STRIPE_PRICE_PRO) {
      plan = 'PRO';
    } else if (priceId === process.env.STRIPE_PRICE_PLUS) {
      plan = 'PLUS CREATOR';
    }

    try {
      // Encuentra al usuario por su email en Firebase
      const userRef = await admin
        .firestore()
        .collection('usuarios')
        .where('email', '==', customerEmail)
        .get();

      userRef.forEach(async (docu) => {
        await docu.ref.update({ plan, updatedAt: new Date() });
      });

      return res.status(200).send('Webhook recibido y plan actualizado');
    } catch (err) {
      console.error('Error actualizando plan:', err);
      return res.status(500).send('Error interno');
    }
  }

  res.status(200).send('Evento recibido');
};

export default webhookHandler;
