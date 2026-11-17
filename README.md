# MagosysTech - Soluciones IT Profesionales

[![Website](https://img.shields.io/badge/website-magosystech.github.io-blue)](https://magosystech.github.io)
[![Security Headers](https://img.shields.io/security-headers?url=https://magosystech.github.io)](https://securityheaders.com)

Sitio web corporativo para MagosysTech, empresa de soluciones tecnológicas con sede en Venezuela.

## 🛡️ Seguridad Implementada

- **Content Security Policy (CSP)**: Restringe recursos a orígenes confiables
- **Headers de seguridad**: X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Enlaces seguros**: Todos los enlaces externos usan `rel="noopener noreferrer"`
- **No Jekyll**: GitHub Pages sirve HTML puro sin procesamiento

## 📱 Características Técnicas

- ✅ HTML5 semántico y accesible
- ✅ CSS3 con variables y metodología BEM
- ✅ JavaScript vanilla optimizado
- ✅ Diseño responsivo (mobile-first)
- ✅ Página 404 personalizada
- ✅ Favicon en múltiples formatos
- ✅ Analítica anónima opcional con consentimiento y retención limitada

## 🚀 Despliegue

Este sitio está desplegado en GitHub Pages y se actualiza automáticamente con cada push a la rama `master`.

## 📊 API de analítica

La API de registro de visitas usa Cloudflare Workers y D1; GitHub Pages solo sirve la web estática. Incluye consentimiento explícito, un panel administrativo protegido y no almacena nombres, correos ni direcciones IP. Consulta la [guía de despliegue de la API](./analytics/README.md) antes de activarla.

## 📄 Licencia

© 2024 MagosysTech. Todos los derechos reservados.
