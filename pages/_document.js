// pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        {/* Preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Google Fonts (incluye las que usamos en el canvas) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Poppins:wght@300;400;600;800&family=Montserrat:wght@300;400;600;800&family=Roboto:wght@300;400;700&family=Oswald:wght@300;400;600;700&family=Playfair+Display:wght@400;600;800&family=Merriweather:wght@300;400;700&family=Lora:wght@400;600;700&family=Cinzel:wght@400;600;800&family=Pacifico&family=Dancing+Script:wght@400;600;700&family=Great+Vibes&family=Bebas+Neue&family=Anton&family=Rubik+Mono+One&family=JetBrains+Mono:wght@300;400;600;800&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
